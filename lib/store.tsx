"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { demoState } from "./demo-data";
import { applyCartToStock, calculateCart, restoreCartToStock } from "./business";
import type { AppState, CartItem, Customer, FinancialEntry, PaymentLine, Product, SaleChannel } from "./types";
import { uid } from "./utils";

const STORAGE_KEY = "bebs-gestao-v2";

type FinishSaleInput = {
  items: CartItem[];
  discount: number;
  payments: PaymentLine[];
  customerId?: string;
  channel?: SaleChannel;
  externalId?: string;
};

type StockReceiptItem = { productId: string; quantity: number };

type StoreContextValue = {
  state: AppState;
  hydrated: boolean;
  saveProduct: (product: Partial<Product> & Pick<Product, "name" | "barcode" | "category" | "price" | "cost">) => Product;
  bindBarcode: (productId: string, barcode: string) => void;
  unbindBarcode: (productId: string) => void;
  setProductActive: (productId: string, active: boolean) => void;
  resolveProductReview: (productId: string) => void;
  adjustStock: (productId: string, delta: number, reason: string) => void;
  receiveStock: (items: StockReceiptItem[], reason: string) => void;
  addCustomer: (customer: Omit<Customer, "id" | "createdAt">) => Customer;
  finishSale: (input: FinishSaleInput) => string;
  cancelSale: (saleId: string, reason: string) => void;
  openCash: (amount: number, operator?: string) => void;
  cashMovement: (type: "withdrawal" | "supply", amount: number, description: string) => void;
  closeCash: (countedAmount: number) => void;
  addFinancialEntry: (entry: Omit<FinancialEntry, "id">) => void;
  setIntegrationEnabled: (platform: "iFood" | "99Food", enabled: boolean) => void;
  updateCompany: (company: AppState["company"]) => void;
  exportBackup: () => string;
  importBackup: (raw: string) => void;
  resetDemo: () => void;
};

const StoreContext = createContext<StoreContextValue | null>(null);

function loadState(): AppState {
  if (typeof window === "undefined") return demoState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as AppState : demoState;
  } catch {
    return demoState;
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(demoState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(loadState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const audit = useCallback((action: string, entity: string, entityId: string | undefined, details: string) => ({
    id: uid("audit"), action, entity, entityId, details, createdAt: new Date().toISOString(), operator: "Pedro Silva",
  }), []);

  const saveProduct = useCallback<StoreContextValue["saveProduct"]>((input) => {
    const normalizedBarcode = input.barcode.trim();
    const duplicate = normalizedBarcode
      ? state.products.find((p) => p.barcode.trim() === normalizedBarcode && p.id !== input.id)
      : undefined;
    if (duplicate) throw new Error(`O código ${normalizedBarcode} já pertence a ${duplicate.name}.`);
    const now = new Date().toISOString();
    const existing = input.id ? state.products.find((p) => p.id === input.id) : undefined;
    const product: Product = {
      id: existing?.id || uid("product"),
      name: input.name,
      barcode: normalizedBarcode,
      sku: input.sku || existing?.sku || `SKU-${Date.now().toString().slice(-6)}`,
      category: input.category,
      brand: input.brand ?? existing?.brand ?? "",
      kind: input.kind || existing?.kind || "unit",
      price: Number(input.price),
      cost: Number(input.cost),
      stock: Number(input.stock ?? existing?.stock ?? 0),
      minStock: Number(input.minStock ?? existing?.minStock ?? 0),
      active: input.active ?? existing?.active ?? true,
      notes: input.notes ?? existing?.notes,
      needsReview: input.needsReview ?? existing?.needsReview,
      source: input.source ?? existing?.source,
      bottleVolumeMl: input.bottleVolumeMl ?? existing?.bottleVolumeMl,
      openVolumeMl: input.openVolumeMl ?? existing?.openVolumeMl,
      dosePrices: input.dosePrices ?? existing?.dosePrices,
      comboItems: input.comboItems ?? existing?.comboItems,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    setState((s) => ({
      ...s,
      products: existing ? s.products.map((p) => p.id === product.id ? product : p) : [product, ...s.products],
      auditLogs: [audit(existing ? "Atualizou" : "Cadastrou", "Produto", product.id, `${product.name} · ${product.barcode || "sem código"}`), ...s.auditLogs],
    }));
    return product;
  }, [audit, state.products]);

  const bindBarcode = useCallback<StoreContextValue["bindBarcode"]>((productId, barcode) => {
    const normalized = barcode.trim();
    if (!normalized) throw new Error("Código de barras inválido.");
    setState((s) => {
      const target = s.products.find((p) => p.id === productId);
      if (!target) throw new Error("Produto não encontrado.");
      if (target.kind === "combo") throw new Error("Combos não recebem código de barras neste fluxo.");
      const duplicate = s.products.find((p) => p.id !== productId && p.barcode.trim() === normalized);
      if (duplicate) throw new Error(`O código ${normalized} já pertence a ${duplicate.name}.`);
      return {
        ...s,
        products: s.products.map((p) => p.id === productId ? { ...p, barcode: normalized, updatedAt: new Date().toISOString() } : p),
        auditLogs: [audit(target.barcode ? "Alterou código" : "Vinculou código", "Produto", productId, `${target.name} · ${normalized}`), ...s.auditLogs],
      };
    });
  }, [audit]);

  const unbindBarcode = useCallback<StoreContextValue["unbindBarcode"]>((productId) => {
    setState((s) => {
      const target = s.products.find((p) => p.id === productId);
      if (!target) throw new Error("Produto não encontrado.");
      if (!target.barcode) return s;
      const old = target.barcode;
      return {
        ...s,
        products: s.products.map((p) => p.id === productId ? { ...p, barcode: "", updatedAt: new Date().toISOString() } : p),
        auditLogs: [audit("Removeu código", "Produto", productId, `${target.name} · ${old}`), ...s.auditLogs],
      };
    });
  }, [audit]);

  const setProductActive = useCallback<StoreContextValue["setProductActive"]>((productId, active) => {
    setState((s) => {
      const target = s.products.find((p) => p.id === productId);
      if (!target) throw new Error("Produto não encontrado.");
      return {
        ...s,
        products: s.products.map((p) => p.id === productId ? { ...p, active, updatedAt: new Date().toISOString() } : p),
        auditLogs: [audit(active ? "Ativou" : "Desativou", "Produto", productId, target.name), ...s.auditLogs],
      };
    });
  }, [audit]);

  const resolveProductReview = useCallback<StoreContextValue["resolveProductReview"]>((productId) => {
    setState((s) => {
      const target = s.products.find((p) => p.id === productId);
      if (!target) throw new Error("Produto não encontrado.");
      return {
        ...s,
        products: s.products.map((p) => p.id === productId ? { ...p, needsReview: false, updatedAt: new Date().toISOString() } : p),
        auditLogs: [audit("Conferiu cadastro", "Produto", productId, target.name), ...s.auditLogs],
      };
    });
  }, [audit]);

  const adjustStock = useCallback((productId: string, delta: number, reason: string) => {
    if (!reason.trim()) throw new Error("Informe o motivo do ajuste.");
    if (!Number.isFinite(delta) || delta === 0) throw new Error("Informe uma quantidade diferente de zero.");
    setState((s) => {
      const target = s.products.find((p) => p.id === productId);
      if (!target) throw new Error("Produto não encontrado.");
      if (target.kind === "combo") throw new Error("O estoque do combo é calculado pelos componentes.");
      const next = target.stock + delta;
      if (next < 0) throw new Error("O ajuste deixaria o estoque negativo.");
      return {
        ...s,
        products: s.products.map((p) => p.id === productId ? { ...p, stock: next, updatedAt: new Date().toISOString() } : p),
        auditLogs: [audit("Ajustou estoque", "Produto", productId, `${delta > 0 ? "+" : ""}${delta} · ${reason.trim()}`), ...s.auditLogs],
      };
    });
  }, [audit]);

  const receiveStock = useCallback<StoreContextValue["receiveStock"]>((items, reason) => {
    const cleanReason = reason.trim();
    const valid = items.filter((item) => Number.isFinite(item.quantity) && item.quantity > 0);
    if (!cleanReason) throw new Error("Informe o motivo da entrada.");
    if (!valid.length) throw new Error("Bipe pelo menos um produto antes de confirmar.");
    setState((s) => {
      const grouped = new Map<string, number>();
      valid.forEach((item) => grouped.set(item.productId, (grouped.get(item.productId) || 0) + item.quantity));
      for (const [productId] of grouped) {
        const target = s.products.find((p) => p.id === productId);
        if (!target) throw new Error("Há um produto inválido na entrada.");
        if (target.kind === "combo") throw new Error(`O combo ${target.name} não pode receber estoque direto.`);
      }
      const now = new Date().toISOString();
      const products = s.products.map((p) => grouped.has(p.id) ? { ...p, stock: p.stock + (grouped.get(p.id) || 0), updatedAt: now } : p);
      const totalUnits = Array.from(grouped.values()).reduce((sum, quantity) => sum + quantity, 0);
      return {
        ...s,
        products,
        auditLogs: [audit("Entrada em lote", "Estoque", undefined, `${totalUnits} un. em ${grouped.size} produtos · ${cleanReason}`), ...s.auditLogs],
      };
    });
  }, [audit]);

  const addCustomer = useCallback<StoreContextValue["addCustomer"]>((input) => {
    const customer: Customer = { ...input, id: uid("customer"), createdAt: new Date().toISOString() };
    setState((s) => ({ ...s, customers: [customer, ...s.customers], auditLogs: [audit("Cadastrou", "Cliente", customer.id, customer.name), ...s.auditLogs] }));
    return customer;
  }, [audit]);

  const finishSale = useCallback<StoreContextValue["finishSale"]>((input) => {
    if (!state.cashSession || state.cashSession.status !== "open") throw new Error("Abra o caixa antes de finalizar uma venda.");
    if (!input.items.length) throw new Error("Adicione pelo menos um item.");
    const totals = calculateCart(input.items, input.discount);
    const paid = input.payments.reduce((sum, p) => sum + p.amount, 0);
    if (Math.abs(paid - totals.total) > 0.009) throw new Error("O total dos pagamentos precisa ser igual ao total da venda.");
    const products = applyCartToStock(state.products, input.items);
    const saleId = uid("sale");
    const createdAt = new Date().toISOString();
    const number = Math.max(1000, ...state.sales.map((s) => s.number)) + 1;
    const sale = {
      id: saleId, number, channel: input.channel || "Balcão", externalId: input.externalId,
      customerId: input.customerId, items: input.items, ...totals, payments: input.payments,
      status: "completed" as const, createdAt, operator: "Pedro Silva",
    };
    const financialEntries: FinancialEntry[] = [{ id: uid("fin"), type: "income", category: `Vendas ${sale.channel}`, description: `Venda #${number}`, amount: sale.total, date: createdAt, channel: sale.channel, saleId }, ...state.financialEntries];
    const cashAmount = input.payments.filter((p) => p.method === "Dinheiro").reduce((sum, p) => sum + p.amount, 0);
    const saleMovement = cashAmount > 0 ? { id: uid("mov"), saleId, type: "sale" as const, amount: cashAmount, description: `Venda #${number} · dinheiro`, createdAt, operator: "Pedro Silva" } : null;
    setState((s) => ({
      ...s, products, sales: [sale, ...s.sales], financialEntries,
      cashSession: s.cashSession ? { ...s.cashSession, movements: saleMovement ? [saleMovement, ...s.cashSession.movements] : s.cashSession.movements } : null,
      auditLogs: [audit("Finalizou", "Venda", saleId, `Venda #${number} · ${sale.channel}`), ...s.auditLogs],
    }));
    return saleId;
  }, [audit, state]);

  const cancelSale = useCallback((saleId: string, reason: string) => {
    const cleanReason = reason.trim();
    if (!cleanReason) throw new Error("Informe o motivo do cancelamento.");
    setState((s) => {
      const sale = s.sales.find((x) => x.id === saleId);
      if (!sale || sale.status === "cancelled") throw new Error("Venda não encontrada ou já cancelada.");
      return {
        ...s,
        products: restoreCartToStock(s.products, sale.items),
        sales: s.sales.map((x) => x.id === saleId ? { ...x, status: "cancelled" } : x),
        financialEntries: s.financialEntries.filter((e) => e.saleId !== saleId),
        cashSession: s.cashSession ? { ...s.cashSession, movements: s.cashSession.movements.filter((m) => m.saleId !== saleId) } : null,
        auditLogs: [audit("Cancelou", "Venda", saleId, cleanReason), ...s.auditLogs],
      };
    });
  }, [audit]);

  const openCash = useCallback((amount: number, operator = "Pedro Silva") => {
    if (state.cashSession?.status === "open") throw new Error("Já existe um caixa aberto.");
    const createdAt = new Date().toISOString();
    setState((s) => ({ ...s, cashSession: { id: uid("cash"), status: "open", openedAt: createdAt, openingAmount: amount, operator, movements: [{ id: uid("mov"), type: "opening", amount, description: "Abertura de caixa", createdAt, operator }] }, auditLogs: [audit("Abriu", "Caixa", undefined, `Saldo inicial ${amount}`), ...s.auditLogs] }));
  }, [audit, state.cashSession]);

  const cashMovement = useCallback((type: "withdrawal" | "supply", amount: number, description: string) => {
    if (!state.cashSession || state.cashSession.status !== "open") throw new Error("Não há caixa aberto.");
    if (amount <= 0) throw new Error("Informe um valor maior que zero.");
    if (!description.trim()) throw new Error("Informe a descrição da movimentação.");
    const movement = { id: uid("mov"), type, amount, description: description.trim(), createdAt: new Date().toISOString(), operator: "Pedro Silva" };
    setState((s) => ({ ...s, cashSession: s.cashSession ? { ...s.cashSession, movements: [movement, ...s.cashSession.movements] } : null, auditLogs: [audit(type === "supply" ? "Suprimento" : "Sangria", "Caixa", s.cashSession?.id, `${amount} · ${description.trim()}`), ...s.auditLogs] }));
  }, [audit, state.cashSession]);

  const closeCash = useCallback((countedAmount: number) => {
    if (!state.cashSession || state.cashSession.status !== "open") throw new Error("Não há caixa aberto.");
    if (countedAmount < 0) throw new Error("O valor contado não pode ser negativo.");
    setState((s) => ({ ...s, cashSession: s.cashSession ? { ...s.cashSession, status: "closed", closedAt: new Date().toISOString(), closingAmount: countedAmount } : null, auditLogs: [audit("Fechou", "Caixa", s.cashSession?.id, `Valor contado ${countedAmount}`), ...s.auditLogs] }));
  }, [audit, state.cashSession]);

  const addFinancialEntry = useCallback((entry: Omit<FinancialEntry, "id">) => {
    if (entry.amount <= 0) throw new Error("Informe um valor maior que zero.");
    if (!entry.description.trim()) throw new Error("Informe uma descrição.");
    setState((s) => ({ ...s, financialEntries: [{ ...entry, description: entry.description.trim(), id: uid("fin") }, ...s.financialEntries], auditLogs: [audit("Lançou", "Financeiro", undefined, `${entry.type} · ${entry.description.trim()}`), ...s.auditLogs] }));
  }, [audit]);

  const setIntegrationEnabled = useCallback((platform: "iFood" | "99Food", enabled: boolean) => {
    setState((s) => ({ ...s, integrations: s.integrations.map((i) => i.platform === platform ? { ...i, enabled, lastSync: enabled ? new Date().toISOString() : i.lastSync } : i), auditLogs: [audit(enabled ? "Ativou" : "Desativou", "Integração", platform, platform), ...s.auditLogs] }));
  }, [audit]);

  const updateCompany = useCallback((company: AppState["company"]) => setState((s) => ({ ...s, company })), []);
  const exportBackup = useCallback(() => JSON.stringify(state, null, 2), [state]);
  const importBackup = useCallback((raw: string) => { const parsed = JSON.parse(raw) as AppState; if (!parsed.products || !parsed.sales) throw new Error("Backup inválido."); setState(parsed); }, []);
  const resetDemo = useCallback(() => setState(demoState), []);

  const value = useMemo<StoreContextValue>(() => ({
    state, hydrated, saveProduct, bindBarcode, unbindBarcode, setProductActive, resolveProductReview, adjustStock, receiveStock,
    addCustomer, finishSale, cancelSale, openCash, cashMovement, closeCash, addFinancialEntry, setIntegrationEnabled,
    updateCompany, exportBackup, importBackup, resetDemo,
  }), [state, hydrated, saveProduct, bindBarcode, unbindBarcode, setProductActive, resolveProductReview, adjustStock, receiveStock, addCustomer, finishSale, cancelSale, openCash, cashMovement, closeCash, addFinancialEntry, setIntegrationEnabled, updateCompany, exportBackup, importBackup, resetDemo]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore precisa estar dentro de StoreProvider.");
  return context;
}
