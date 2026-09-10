import type { AppState, BarcodeBinding, CartItem, Product, Sale } from "./types";

export function normalizeBarcode(value: string) {
  return value.trim().replace(/\s+/g, "");
}

export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits.startsWith("55") ? digits : digits;
}

export function productBarcodeBindings(product: Product): BarcodeBinding[] {
  const now = product.updatedAt || product.createdAt || new Date().toISOString();
  const normalizedPrimary = normalizeBarcode(product.barcode || "");
  const fromList = (product.barcodes || [])
    .filter((item) => normalizeBarcode(item.code))
    .map((item) => ({
      ...item,
      code: normalizeBarcode(item.code),
      multiplier: Math.max(1, Number(item.multiplier) || 1),
      label: item.label || (item.multiplier > 1 ? `Pacote x${item.multiplier}` : "Unidade"),
      createdAt: item.createdAt || now,
    }));

  const deduped = new Map<string, BarcodeBinding>();
  for (const item of fromList) deduped.set(item.code, item);
  if (normalizedPrimary && !deduped.has(normalizedPrimary)) {
    deduped.set(normalizedPrimary, { code: normalizedPrimary, multiplier: 1, label: "Unidade", primary: true, createdAt: now });
  }
  return Array.from(deduped.values()).map((item) => ({ ...item, primary: item.code === normalizedPrimary || item.primary === true }));
}

export function findProductByBarcode(products: Product[], rawCode: string) {
  const code = normalizeBarcode(rawCode);
  if (!code) return null;
  for (const product of products) {
    for (const binding of productBarcodeBindings(product)) {
      if (binding.code === code) return { product, binding, multiplier: Math.max(1, binding.multiplier || 1) };
    }
  }
  return null;
}

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

export function productUnitCost(product: Product, mode: CartItem["mode"], doseMl?: number, products: Product[] = []) {
  if (mode === "dose") {
    const volume = Math.max(1, product.bottleVolumeMl || 0);
    return (product.cost / volume) * Math.max(0, doseMl || 0);
  }
  if (mode === "combo") {
    return (product.comboItems || []).reduce((sum, component) => {
      const target = products.find((item) => item.id === component.productId);
      if (!target) return sum;
      if (component.doseMl) {
        const volume = Math.max(1, target.bottleVolumeMl || 0);
        return sum + (target.cost / volume) * component.doseMl * component.quantity;
      }
      return sum + target.cost * component.quantity;
    }, 0);
  }
  return product.cost;
}

export function comboAvailability(product: Product, products: Product[]) {
  if (product.kind !== "combo") return { available: product.stock, blocking: [] as string[] };
  const components = product.comboItems || [];
  if (!components.length) return { available: 0, blocking: ["Composição não configurada"] };
  let max = Number.POSITIVE_INFINITY;
  const blocking: string[] = [];
  for (const component of components) {
    const target = products.find((item) => item.id === component.productId);
    if (!target) {
      blocking.push("Produto removido da composição");
      max = 0;
      continue;
    }
    if (component.doseMl) {
      const perCombo = Math.max(1, component.doseMl * component.quantity);
      const possible = Math.floor(availableVolumeMl(target) / perCombo);
      max = Math.min(max, possible);
      if (possible <= 0) blocking.push(`${target.name} sem volume`);
    } else {
      const perCombo = Math.max(0.0001, component.quantity);
      const possible = Math.floor(target.stock / perCombo);
      max = Math.min(max, possible);
      if (possible <= 0) blocking.push(`${target.name} sem estoque`);
    }
  }
  return { available: Number.isFinite(max) ? Math.max(0, max) : 0, blocking };
}

export function canAddQuantity(products: Product[], product: Product, mode: CartItem["mode"], quantity: number, doseMl?: number) {
  const qty = Math.max(1, quantity);
  if (mode === "dose") {
    const needed = qty * Math.max(0, doseMl || 0);
    return availableVolumeMl(product) >= needed
      ? { ok: true, message: "" }
      : { ok: false, message: `Volume insuficiente para ${product.name}.` };
  }
  if (mode === "combo") {
    const combo = comboAvailability(product, products);
    return combo.available >= qty
      ? { ok: true, message: "" }
      : { ok: false, message: combo.blocking[0] || `Combo disponível apenas para ${combo.available} unidade(s).` };
  }
  return product.stock >= qty
    ? { ok: true, message: "" }
    : { ok: false, message: `Estoque insuficiente para ${product.name}.` };
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
      if (!(product.comboItems || []).length) throw new Error(`O combo ${product.name} não possui composição configurada.`);
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

export function paymentBreakdown(sales: Sale[], since?: string) {
  const start = since ? new Date(since).getTime() : 0;
  const result: Record<string, number> = { Dinheiro: 0, PIX: 0, Débito: 0, Crédito: 0, Outro: 0 };
  for (const sale of sales) {
    if (sale.status !== "completed" || new Date(sale.createdAt).getTime() < start) continue;
    for (const payment of sale.payments) result[payment.method] = (result[payment.method] || 0) + payment.amount;
  }
  return result;
}

export function customerStats(state: AppState, customerId: string) {
  const sales = state.sales.filter((sale) => sale.customerId === customerId && sale.status === "completed");
  const spent = sales.reduce((sum, sale) => sum + sale.total, 0);
  const items = new Map<string, number>();
  sales.forEach((sale) => sale.items.forEach((item) => items.set(item.name, (items.get(item.name) || 0) + item.quantity)));
  const favorite = Array.from(items.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
  return {
    salesCount: sales.length,
    spent,
    averageTicket: sales.length ? spent / sales.length : 0,
    lastPurchase: sales.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.createdAt,
    favoriteProduct: favorite,
  };
}

export function dashboardMetrics(state: AppState) {
  const completed = state.sales.filter((s) => s.status === "completed");
  const totalRevenue = completed.reduce((sum, sale) => sum + sale.total, 0);
  const totalCost = completed.reduce((sum, sale) => {
    return sum + sale.items.reduce((inner, item) => {
      if (typeof item.unitCost === "number") return inner + item.unitCost * item.quantity;
      const product = state.products.find((p) => p.id === item.productId);
      if (!product) return inner;
      return inner + productUnitCost(product, item.mode, item.doseMl, state.products) * item.quantity;
    }, 0);
  }, 0);
  const expenses = state.financialEntries
    .filter((e) => e.type === "expense" && (e.status ?? "paid") !== "cancelled")
    .reduce((s, e) => s + e.amount, 0);
  const otherIncome = state.financialEntries
    .filter((e) => e.type === "income" && !e.saleId && (e.status ?? "paid") !== "cancelled")
    .reduce((s, e) => s + e.amount, 0);
  return {
    totalRevenue,
    grossProfit: totalRevenue - totalCost,
    netProfit: totalRevenue + otherIncome - totalCost - expenses,
    averageTicket: completed.length ? totalRevenue / completed.length : 0,
    salesCount: completed.length,
    lowStockCount: lowStockProducts(state.products).length,
    inventoryValue: state.products.reduce((sum, product) => product.kind === "combo" ? sum : sum + product.stock * product.cost, 0),
  };
}
