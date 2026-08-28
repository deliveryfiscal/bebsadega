import type { AppState, CartItem, Product } from "./types";

export function availableVolumeMl(product: Product) {
  if (product.kind !== "volume") return 0;
  return (product.stock * (product.bottleVolumeMl || 0)) + (product.openVolumeMl || 0);
}

export function getProductAvailableUnits(product: Product) {
  if (product.kind === "volume") return product.stock;
  return product.stock;
}

export function calculateCart(items: CartItem[], discount = 0) {
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const safeDiscount = Math.max(0, Math.min(discount, subtotal));
  return { subtotal, discount: safeDiscount, total: subtotal - safeDiscount };
}

function consumeUnit(product: Product, quantity: number): Product {
  if (product.stock < quantity) throw new Error(`Estoque insuficiente para ${product.name}.`);
  return { ...product, stock: product.stock - quantity, updatedAt: new Date().toISOString() };
}

function consumeDose(product: Product, totalMl: number): Product {
  const volume = product.bottleVolumeMl || 0;
  let sealed = product.stock;
  let open = product.openVolumeMl || 0;
  let remaining = totalMl;
  if (availableVolumeMl(product) < remaining) throw new Error(`Volume insuficiente para ${product.name}.`);
  while (remaining > 0) {
    if (open <= 0) {
      if (sealed <= 0) throw new Error(`Sem garrafas disponíveis para ${product.name}.`);
      sealed -= 1;
      open = volume;
    }
    const used = Math.min(open, remaining);
    open -= used;
    remaining -= used;
  }
  return { ...product, stock: sealed, openVolumeMl: open, updatedAt: new Date().toISOString() };
}

export function applyCartToStock(products: Product[], items: CartItem[]): Product[] {
  const map = new Map(products.map((p) => [p.id, { ...p }]));
  const consume = (productId: string, quantity: number, doseMl?: number) => {
    const product = map.get(productId);
    if (!product) throw new Error("Produto não encontrado durante a baixa de estoque.");
    const next = doseMl ? consumeDose(product, quantity * doseMl) : consumeUnit(product, quantity);
    map.set(productId, next);
  };
  for (const item of items) {
    const product = map.get(item.productId);
    if (!product) throw new Error(`Produto ${item.name} não encontrado.`);
    if (item.mode === "dose") consume(item.productId, item.quantity, item.doseMl);
    else if (item.mode === "combo") {
      for (const component of product.comboItems || []) {
        consume(component.productId, component.quantity * item.quantity, component.doseMl);
      }
    } else consume(item.productId, item.quantity);
  }
  return Array.from(map.values());
}

export function restoreCartToStock(products: Product[], items: CartItem[]): Product[] {
  const map = new Map(products.map((p) => [p.id, { ...p }]));
  const restore = (productId: string, quantity: number, doseMl?: number) => {
    const product = map.get(productId);
    if (!product) return;
    if (doseMl && product.kind === "volume") {
      const volume = product.bottleVolumeMl || 0;
      let open = (product.openVolumeMl || 0) + quantity * doseMl;
      let stock = product.stock;
      while (volume > 0 && open >= volume) { open -= volume; stock += 1; }
      map.set(productId, { ...product, stock, openVolumeMl: open, updatedAt: new Date().toISOString() });
    } else {
      map.set(productId, { ...product, stock: product.stock + quantity, updatedAt: new Date().toISOString() });
    }
  };
  for (const item of items) {
    const product = map.get(item.productId);
    if (!product) continue;
    if (item.mode === "dose") restore(item.productId, item.quantity, item.doseMl);
    else if (item.mode === "combo") {
      for (const component of product.comboItems || []) restore(component.productId, component.quantity * item.quantity, component.doseMl);
    } else restore(item.productId, item.quantity);
  }
  return Array.from(map.values());
}

export function lowStockProducts(products: Product[]) {
  return products.filter((p) => p.active && p.stock <= p.minStock && p.kind !== "combo");
}

export function dashboardMetrics(state: AppState) {
  const completed = state.sales.filter((s) => s.status === "completed");
  const totalRevenue = completed.reduce((sum, sale) => sum + sale.total, 0);
  const totalCost = completed.reduce((sum, sale) => {
    return sum + sale.items.reduce((inner, item) => {
      const product = state.products.find((p) => p.id === item.productId);
      if (!product) return inner;
      if (item.mode === "dose") {
        const ml = product.bottleVolumeMl || 1;
        return inner + (product.cost / ml) * (item.doseMl || 0) * item.quantity;
      }
      if (item.mode === "combo") {
        const comboCost = (product.comboItems || []).reduce((c, component) => {
          const p = state.products.find((x) => x.id === component.productId);
          if (!p) return c;
          if (component.doseMl) return c + (p.cost / (p.bottleVolumeMl || 1)) * component.doseMl * component.quantity;
          return c + p.cost * component.quantity;
        }, 0);
        return inner + comboCost * item.quantity;
      }
      return inner + product.cost * item.quantity;
    }, 0);
  }, 0);
  const expenses = state.financialEntries.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0);
  const otherIncome = state.financialEntries.filter((e) => e.type === "income" && !e.saleId).reduce((s, e) => s + e.amount, 0);
  return {
    totalRevenue,
    grossProfit: totalRevenue - totalCost,
    netProfit: totalRevenue + otherIncome - totalCost - expenses,
    averageTicket: completed.length ? totalRevenue / completed.length : 0,
    salesCount: completed.length,
    lowStockCount: lowStockProducts(state.products).length,
  };
}
