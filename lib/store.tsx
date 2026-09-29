"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { demoState } from "./demo-data";
import { applyCartToStock, calculateCart, isDoseShortcut, normalizeBarcode, normalizePhone, productBarcodeBindings, productUnitCost, restoreCartToStock } from "./business";
import type {
  AppState,
  BarcodeBinding,
  CartItem,
  Customer,
  Employee,
  EmployeePermission,
  FinancialEntry,
  InternalConsumption,
  PaymentLine,
  Product,
  Purchase,
  SaleChannel,
  ScannerSettings,
  Supplier,
  SuspendedSale,
} from "./types";
import { uid } from "./utils";
import { ALL_EMPLOYEE_PERMISSIONS, defaultPermissions, systemRoleForPosition } from "./employees";
import { getDataMode, getSupabaseBrowserClient } from "./supabase/client";
import { companyStorageKey, getOrCreateClientId, localModeStorageKey, readEnvelope, readLegacyState, timestampMs, writeEnvelope, writeLegacyState } from "./persistence";


export type FinishSaleInput = {
  items: CartItem[];
  discount: number;
  payments: PaymentLine[];
  customerId?: string;
  channel?: SaleChannel;
  externalId?: string;
  note?: string;
  idempotencyKey?: string;
};

export type StockReceiptItem = { productId: string; quantity: number; unitCost?: number };

export type RecordConsumptionInput = {
  employeeId: string;
  items: CartItem[];
  settlement: "house" | "employee_charge";
  chargeAmount?: number;
  note?: string;
  overrideLimit?: boolean;
};

export type StoreContextValue = {
  state: AppState;
  hydrated: boolean;
  dataMode: "local" | "supabase";
  authReady: boolean;
  signedIn: boolean;
  syncStatus: "local" | "loading" | "saving" | "synced" | "error" | "conflict";
  syncError?: string;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshRemote: () => Promise<void>;
  recordAudit: (action: string, entity: string, details: string, entityId?: string) => void;
  saveProduct: (product: Partial<Product> & Pick<Product, "name" | "barcode" | "category" | "price" | "cost">) => Product;
  bindBarcode: (productId: string, barcode: string, multiplier?: number, label?: string, makePrimary?: boolean) => void;
  unbindBarcode: (productId: string, barcode?: string) => void;
  moveBarcode: (barcode: string, targetProductId: string) => void;
  setProductActive: (productId: string, active: boolean) => void;
  deleteProduct: (productId: string, reason: string) => void;
  setProductFavorite: (productId: string, favorite: boolean) => void;
  setProductLocation: (productId: string, location: string) => void;
  setOpenBottleVolume: (productId: string, volumeMl: number, reason: string) => void;
  registerVolumeLoss: (productId: string, volumeMl: number, reason: string) => void;
  resolveProductReview: (productId: string) => void;
  adjustStock: (productId: string, delta: number, reason: string) => void;
  setStockCount: (counts: Record<string, number>, reason: string) => { adjusted: number; untouched: number };
  receiveStock: (items: StockReceiptItem[], reason: string, supplierId?: string) => void;
  addCustomer: (customer: Omit<Customer, "id" | "createdAt">) => Customer;
  updateCustomer: (id: string, customer: Partial<Omit<Customer, "id" | "createdAt">>) => void;
  finishSale: (input: FinishSaleInput) => string;
  cancelSale: (saleId: string, reason: string) => void;
  deleteSale: (saleId: string, reason: string) => void;
  suspendSale: (input: Omit<SuspendedSale, "id" | "createdAt" | "updatedAt">) => string;
  removeSuspendedSale: (id: string) => void;
  openCash: (amount: number, operator?: string) => void;
  cashMovement: (type: "withdrawal" | "supply", amount: number, description: string) => void;
  closeCash: (countedAmount: number, expectedAmount?: number, reason?: string) => void;
  addFinancialEntry: (entry: Omit<FinancialEntry, "id">) => void;
  updateFinancialEntry: (id: string, patch: Partial<Omit<FinancialEntry, "id">>) => void;
  saveSupplier: (supplier: Partial<Supplier> & Pick<Supplier, "name">) => Supplier;
  createPurchase: (purchase: Omit<Purchase, "id" | "status" | "total"> & { id?: string }) => Purchase;
  receivePurchase: (purchaseId: string) => void;
  setIntegrationEnabled: (platform: "iFood" | "99Food", enabled: boolean) => void;
  updateScannerSettings: (settings: Partial<ScannerSettings>) => void;
  saveEmployee: (employee: Partial<Employee> & Pick<Employee, "name" | "position">) => Employee;
  setEmployeeActive: (employeeId: string, active: boolean) => void;
  selectEmployee: (employeeId: string) => void;
  recordConsumption: (input: RecordConsumptionInput) => string;
  reverseConsumption: (consumptionId: string, reason: string) => void;
  settleConsumptionCharge: (consumptionId: string, status: "discounted" | "forgiven") => void;
  updateCurrentOperator: (operator: AppState["currentOperator"]) => void;
  updateCompany: (company: AppState["company"]) => void;
  exportBackup: () => string;
  importBackup: (raw: string) => void;
  resetDemo: () => void;
};

const StoreContext = createContext<StoreContextValue | null>(null);

function defaultScannerSettings(): ScannerSettings {
  return { duplicateWindowMs: 450, soundEnabled: true, autoFocus: true, autoAdvance: true, suffix: "enter" };
}

function migrateEmployee(employee: Employee): Employee {
  const now = employee.updatedAt || employee.createdAt || new Date().toISOString();
  const position = employee.position || "general";
  return {
    ...employee,
    name: String(employee.name || "Funcionário").trim(),
    nickname: employee.nickname?.trim() || undefined,
    phone: employee.phone?.trim() || undefined,
    position,
    title: employee.title?.trim() || (position === "owner" ? "Proprietário" : position === "manager" ? "Gerente" : position === "cashier" ? "Caixa" : position === "stock" ? "Estoque" : "Funcionário"),
    systemRole: employee.systemRole || systemRoleForPosition(position),
    active: employee.active !== false,
    isOwner: Boolean(employee.isOwner || position === "owner"),
    permissions: Array.isArray(employee.permissions) && employee.permissions.length ? employee.permissions : defaultPermissions(position),
    monthlyConsumptionLimit: employee.monthlyConsumptionLimit && employee.monthlyConsumptionLimit > 0 ? Number(employee.monthlyConsumptionLimit) : undefined,
    createdAt: employee.createdAt || now,
    updatedAt: now,
  };
}

function migrateConsumption(consumption: InternalConsumption): InternalConsumption {
  return {
    ...consumption,
    settlement: consumption.settlement || "house",
    chargeStatus: consumption.chargeStatus || (consumption.settlement === "employee_charge" ? "pending" : "none"),
    chargeAmount: Number(consumption.chargeAmount || 0),
    totalCost: Number(consumption.totalCost || 0),
    saleEquivalent: Number(consumption.saleEquivalent || 0),
    status: consumption.status || "active",
    items: (consumption.items || []).map((item) => ({
      ...item,
      quantity: Number(item.quantity || 0),
      doseMl: item.doseMl ? Number(item.doseMl) : undefined,
      unitCost: Number(item.unitCost || 0),
      unitPriceReference: Number(item.unitPriceReference || 0),
    })),
  };
}

function migrateProduct(product: Product): Product {
  const now = product.updatedAt || product.createdAt || new Date().toISOString();
  const bindings = productBarcodeBindings(product);
  return {
    ...product,
    barcode: normalizeBarcode(product.barcode || ""),
    barcodeType: product.barcodeType || (normalizeBarcode(product.barcode || "").length === 4 ? "internal" : "ean"),
    barcodes: bindings,
    favorite: Boolean(product.favorite),
    location: product.location || "",
    cost: Number(product.cost || 0),
    price: Number(product.price || 0),
    stock: Number(product.stock || 0),
    minStock: Number(product.minStock || 0),
    openVolumeMl: Number(product.openVolumeMl || 0),
    dosePrices: product.dosePrices || {},
    doseSourceProductId: product.doseSourceProductId || undefined,
    comboItems: product.comboItems || [],
    updatedAt: now,
  };
}

function migrateState(raw?: Partial<AppState> | null): AppState {
  const source = raw || demoState;
  const base = demoState;
  return {
    ...base,
    ...source,
    catalogRevision: source.catalogRevision || base.catalogRevision,
    products: (source.products || base.products).map((item) => migrateProduct(item as Product)),
    customers: (source.customers || base.customers).map((customer) => ({
      ...customer,
      tags: customer.tags || [],
      cashback: Number(customer.cashback || 0),
      updatedAt: customer.updatedAt || customer.createdAt,
    })),
    sales: source.sales || base.sales,
    suspendedSales: source.suspendedSales || [],
    cashHistory: source.cashHistory || (source.cashSession?.status === "closed" ? [source.cashSession] : []),
    financialEntries: (source.financialEntries || base.financialEntries).map((entry) => ({ ...entry, status: entry.status || "paid" })),
    suppliers: source.suppliers || base.suppliers,
    purchases: source.purchases || base.purchases,
    integrations: source.integrations || base.integrations,
    auditLogs: source.auditLogs || base.auditLogs,
    scannerSettings: { ...defaultScannerSettings(), ...(source.scannerSettings || {}) },
    employees: ((source.employees && source.employees.length ? source.employees : base.employees) || []).map((employee) => migrateEmployee(employee as Employee)),
    consumptions: (source.consumptions || []).map((consumption) => migrateConsumption(consumption as InternalConsumption)),
    currentOperator: source.currentOperator || base.currentOperator,
    company: source.company || base.company,
  };
}

function loadState(): AppState {
  if (typeof window === "undefined") return migrateState(demoState);
  return migrateState(readLegacyState() || demoState);
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const dataMode = getDataMode();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const initialState = useMemo(() => migrateState(demoState), []);
  const [state, setReactState] = useState<AppState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [authReady, setAuthReady] = useState(dataMode === "local");
  const [signedIn, setSignedIn] = useState(dataMode === "local");
  const [syncStatus, setSyncStatus] = useState<StoreContextValue["syncStatus"]>(dataMode === "local" ? "local" : "loading");
  const [syncError, setSyncError] = useState<string | undefined>(undefined);

  const stateRef = useRef<AppState>(initialState);
  const signedInRef = useRef(dataMode === "local");
  const remoteVersionRef = useRef(0);
  const remoteLoadedRef = useRef(false);
  const clientIdRef = useRef("server");
  const companyIdRef = useRef<string | undefined>(undefined);
  const userIdRef = useRef<string | undefined>(undefined);
  const storageKeyRef = useRef(localModeStorageKey());
  const saveSequenceRef = useRef(0);
  const remoteSaveChainRef = useRef<Promise<void>>(Promise.resolve());
  const lastRemoteErrorRef = useRef<string | undefined>(undefined);
  const processedIdempotencyRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    clientIdRef.current = getOrCreateClientId();
  }, []);

  const persistLocal = useCallback((snapshot: AppState, options?: { savedAt?: string; remoteVersion?: number; pendingRemote?: boolean }) => {
    if (dataMode === "local") {
      writeLegacyState(snapshot);
      return;
    }
    writeEnvelope(storageKeyRef.current, snapshot, {
      savedAt: options?.savedAt,
      remoteVersion: options?.remoteVersion ?? remoteVersionRef.current,
      pendingRemote: options?.pendingRemote ?? true,
      companyId: companyIdRef.current,
      userId: userIdRef.current,
      clientId: clientIdRef.current,
    });
  }, [dataMode]);

  const enqueueRemoteSave = useCallback((snapshot: AppState, reason = "Atualização") => {
    if (dataMode !== "supabase" || !supabase || !remoteLoadedRef.current || !signedInRef.current) return;

    const eventId = `${clientIdRef.current}:${Date.now()}:${++saveSequenceRef.current}`;
    setSyncStatus("saving");
    setSyncError(undefined);

    remoteSaveChainRef.current = remoteSaveChainRef.current
      .catch(() => undefined)
      .then(async () => {
        const { data, error } = await supabase.rpc("save_company_state_durable", {
          p_state: snapshot,
          p_event_id: eventId,
          p_client_id: clientIdRef.current,
          p_reason: reason.slice(0, 240),
        });
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        if (!row?.success) throw new Error("O Supabase não confirmou a gravação dos dados.");

        remoteVersionRef.current = Number(row.new_version || remoteVersionRef.current + 1);
        lastRemoteErrorRef.current = undefined;
        setSyncStatus("synced");
        setSyncError(undefined);

        // Nunca substitui um cache local mais novo pelo snapshot antigo de uma fila.
        if (stateRef.current === snapshot) {
          persistLocal(snapshot, {
            savedAt: row.saved_at ? String(row.saved_at) : new Date().toISOString(),
            remoteVersion: remoteVersionRef.current,
            pendingRemote: false,
          });
        }
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Falha ao gravar os dados no Supabase.";
        lastRemoteErrorRef.current = message;
        setSyncStatus("error");
        setSyncError(`${message} Os dados continuam protegidos neste navegador e serão reenviados.`);
      });
  }, [dataMode, persistLocal, supabase]);

  type StateUpdater = AppState | ((previous: AppState) => AppState);

  const commitState = useCallback((updater: StateUpdater, reason = "Atualização do sistema") => {
    const previous = stateRef.current;
    const next = typeof updater === "function"
      ? (updater as (previous: AppState) => AppState)(previous)
      : updater;

    // Write-through: grava localmente ANTES de depender do ciclo de render do React.
    // Isso protege cadastro, estoque, vendas, caixa, financeiro, CRM etc. contra F5/refresh.
    stateRef.current = next;
    persistLocal(next);
    setReactState(next);

    const previousAuditId = previous.auditLogs[0]?.id;
    const latestAudit = next.auditLogs[0];
    const inferredReason = reason === "Atualização do sistema" && latestAudit?.id !== previousAuditId
      ? `${latestAudit.action} ${latestAudit.entity}: ${latestAudit.details}`
      : reason;
    enqueueRemoteSave(next, inferredReason);
    return next;
  }, [enqueueRemoteSave, persistLocal]);

  // Mantém a assinatura antiga usada pelo restante do store.
  const setState = commitState;

  const hydrateRemote = useCallback(async () => {
    if (dataMode !== "supabase") return;
    if (!supabase) {
      setHydrated(true);
      setAuthReady(true);
      setSignedIn(false);
      signedInRef.current = false;
      setSyncStatus("error");
      setSyncError("Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }

    setSyncStatus("loading");
    setSyncError(undefined);

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const user = sessionData.session?.user;

    if (!user) {
      remoteLoadedRef.current = false;
      remoteVersionRef.current = 0;
      signedInRef.current = false;
      setHydrated(true);
      setAuthReady(true);
      setSignedIn(false);
      setSyncStatus("loading");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("company_id,name,role,active")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) throw new Error("Usuário autenticado sem perfil vinculado à empresa. Crie o registro em public.profiles.");
    if (!profile.active) throw new Error("Este usuário está desativado.");

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("name,phone,document,address")
      .eq("id", profile.company_id)
      .single();

    if (companyError || !company) throw new Error("Empresa do usuário não foi encontrada.");

    companyIdRef.current = String(profile.company_id);
    userIdRef.current = user.id;
    storageKeyRef.current = companyStorageKey(String(profile.company_id), user.id);

    const { data: snapshot, error: snapshotError } = await supabase
      .from("company_state")
      .select("state,version,updated_at")
      .eq("company_id", profile.company_id)
      .maybeSingle();

    if (snapshotError) throw snapshotError;

    const localEnvelope = readEnvelope(storageKeyRef.current);
    const remoteUpdatedAt = snapshot?.updated_at ? String(snapshot.updated_at) : undefined;
    const remoteCatalogRevision = snapshot?.state && typeof snapshot.state === "object"
      ? String((snapshot.state as Partial<AppState>).catalogRevision || "")
      : "";
    const localCatalogRevision = localEnvelope?.state?.catalogRevision ? String(localEnvelope.state.catalogRevision) : "";
    const catalogWasResetRemotely = Boolean(remoteCatalogRevision && remoteCatalogRevision !== localCatalogRevision);
    const hasNewerLocal = Boolean(
      !catalogWasResetRemotely
      && localEnvelope
      && localEnvelope.state
      && (
        localEnvelope.pendingRemote
        || timestampMs(localEnvelope.savedAt) > timestampMs(remoteUpdatedAt) + 50
      ),
    );

    const selectedSource = hasNewerLocal
      ? localEnvelope?.state
      : snapshot?.state
        ? snapshot.state as Partial<AppState>
        : localEnvelope?.state || demoState;

    const profileOperator = {
      name: String(profile.name || user.email || "Operador"),
      role: profile.role as AppState["currentOperator"]["role"],
    };
    const companyState = {
      name: String(company.name || "Beb's Adega e Tabacaria"),
      phone: String(company.phone || ""),
      document: String(company.document || ""),
      address: String(company.address || ""),
    };

    const next = migrateState(selectedSource as Partial<AppState>);
    const selectedEmployee = next.currentOperator.employeeId
      ? next.employees.find((employee) => employee.id === next.currentOperator.employeeId && employee.active)
      : undefined;
    const owner = next.employees.find((employee) => employee.active && (employee.isOwner || employee.position === "owner"));
    const operationalEmployee = selectedEmployee || owner;
    next.currentOperator = operationalEmployee
      ? { employeeId: operationalEmployee.id, name: operationalEmployee.nickname || operationalEmployee.name, role: operationalEmployee.systemRole }
      : profileOperator;
    // company_state preserva edições feitas na tela de Configurações;
    // a tabela companies funciona como fallback/cadastro canônico inicial.
    next.company = { ...companyState, ...((selectedSource as Partial<AppState>)?.company || {}) };

    remoteVersionRef.current = Number(snapshot?.version || 0);
    remoteLoadedRef.current = true;
    signedInRef.current = true;
    stateRef.current = next;
    setReactState(next);
    setSignedIn(true);
    setAuthReady(true);
    setHydrated(true);

    if (hasNewerLocal || !snapshot) {
      // Se houve refresh antes do sync, o cache local mais novo volta para a nuvem.
      persistLocal(next);
      enqueueRemoteSave(next, hasNewerLocal ? "Recuperação automática após recarregar" : "Inicialização do estado da empresa");
    } else {
      persistLocal(next, {
        savedAt: remoteUpdatedAt || new Date().toISOString(),
        remoteVersion: remoteVersionRef.current,
        pendingRemote: false,
      });
      setSyncStatus("synced");
    }
  }, [dataMode, enqueueRemoteSave, persistLocal, supabase]);

  useEffect(() => {
    if (dataMode === "local") {
      const next = loadState();
      stateRef.current = next;
      setReactState(next);
      writeLegacyState(next);
      signedInRef.current = true;
      setHydrated(true);
      setAuthReady(true);
      setSignedIn(true);
      setSyncStatus("local");
      return;
    }

    hydrateRemote().catch((error) => {
      setHydrated(true);
      setAuthReady(true);
      setSignedIn(false);
      signedInRef.current = false;
      setSyncStatus("error");
      setSyncError(error instanceof Error ? error.message : "Falha ao carregar dados do Supabase.");
    });
  }, [dataMode, hydrateRemote]);

  useEffect(() => {
    if (dataMode !== "supabase") return;

    const retry = () => {
      if (!remoteLoadedRef.current || !signedInRef.current) return;
      if (lastRemoteErrorRef.current || syncStatus === "error") {
        enqueueRemoteSave(stateRef.current, "Reenvio após reconexão");
      }
    };

    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [dataMode, enqueueRemoteSave, syncStatus]);

  const signIn = useCallback<StoreContextValue["signIn"]>(async (email, password) => {
    if (dataMode !== "supabase" || !supabase) throw new Error("O modo Supabase não está configurado.");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    await hydrateRemote();
  }, [dataMode, supabase, hydrateRemote]);

  const signOut = useCallback<StoreContextValue["signOut"]>(async () => {
    if (dataMode === "supabase") {
      // Tenta terminar a fila de gravação antes de encerrar a sessão.
      await remoteSaveChainRef.current.catch(() => undefined);
    }
    if (dataMode === "supabase" && supabase) await supabase.auth.signOut();
    remoteLoadedRef.current = false;
    remoteVersionRef.current = 0;
    signedInRef.current = dataMode === "local";
    setSignedIn(dataMode === "local");
    if (dataMode === "supabase") {
      const next = migrateState(demoState);
      stateRef.current = next;
      setReactState(next);
    }
  }, [dataMode, supabase]);

  const refreshRemote = useCallback<StoreContextValue["refreshRemote"]>(async () => {
    if (dataMode !== "supabase") return;
    remoteLoadedRef.current = false;
    await hydrateRemote();
  }, [dataMode, hydrateRemote]);

  const audit = useCallback((action: string, entity: string, entityId: string | undefined, details: string) => ({
    id: uid("audit"),
    action,
    entity,
    entityId,
    details,
    createdAt: new Date().toISOString(),
    operator: stateRef.current.currentOperator?.name || "Operador",
  }), []);

  const recordAudit = useCallback<StoreContextValue["recordAudit"]>((action, entity, details, entityId) => {
    setState((s) => ({
      ...s,
      auditLogs: [audit(action, entity, entityId, details), ...s.auditLogs],
    }));
  }, [audit]);

  const saveProduct = useCallback<StoreContextValue["saveProduct"]>((input) => {
    const normalizedBarcode = normalizeBarcode(input.barcode || "");
    const existing = input.id ? state.products.find((p) => p.id === input.id) : undefined;
    const inputBindings = (input.barcodes || existing?.barcodes || []).map((binding) => ({
      ...binding,
      code: normalizeBarcode(binding.code),
      multiplier: Math.max(1, Number(binding.multiplier) || 1),
      label: binding.label || "Unidade",
      createdAt: binding.createdAt || new Date().toISOString(),
    })).filter((binding) => binding.code);
    const allCodes = new Set(inputBindings.map((binding) => binding.code));
    if (normalizedBarcode) allCodes.add(normalizedBarcode);
    for (const code of allCodes) {
      const duplicate = state.products.find((p) => p.id !== input.id && productBarcodeBindings(p).some((binding) => binding.code === code));
      if (duplicate) throw new Error(`O código ${code} já pertence a ${duplicate.name}.`);
    }

    const now = new Date().toISOString();
    const mergedBindings = new Map<string, BarcodeBinding>();
    for (const binding of inputBindings) mergedBindings.set(binding.code, binding);
    if (normalizedBarcode) {
      mergedBindings.set(normalizedBarcode, {
        ...(mergedBindings.get(normalizedBarcode) || {}),
        code: normalizedBarcode,
        multiplier: mergedBindings.get(normalizedBarcode)?.multiplier || 1,
        label: mergedBindings.get(normalizedBarcode)?.label || "Unidade",
        primary: true,
        createdAt: mergedBindings.get(normalizedBarcode)?.createdAt || now,
      });
    }
    const product: Product = {
      id: existing?.id || uid("product"),
      name: input.name.trim(),
      barcode: normalizedBarcode,
      barcodeType: input.barcodeType || existing?.barcodeType || (normalizedBarcode.length === 4 ? "internal" : "ean"),
      barcodes: Array.from(mergedBindings.values()).map((binding) => ({ ...binding, primary: normalizedBarcode ? binding.code === normalizedBarcode : Boolean(binding.primary), type: binding.type || (binding.code === normalizedBarcode ? (input.barcodeType || existing?.barcodeType || (normalizedBarcode.length === 4 ? "internal" : "ean")) : binding.type) })),
      sku: input.sku?.trim() || existing?.sku || `SKU-${Date.now().toString().slice(-6)}`,
      category: input.category.trim(),
      brand: input.brand?.trim() ?? existing?.brand ?? "",
      kind: input.kind || existing?.kind || "unit",
      price: Math.max(0, Number(input.price)),
      cost: Math.max(0, Number(input.cost)),
      stock: Math.max(0, Number(input.stock ?? existing?.stock ?? 0)),
      minStock: Math.max(0, Number(input.minStock ?? existing?.minStock ?? 0)),
      active: input.active ?? existing?.active ?? true,
      favorite: input.favorite ?? existing?.favorite ?? false,
      location: input.location?.trim() ?? existing?.location ?? "",
      notes: input.notes ?? existing?.notes,
      needsReview: input.needsReview ?? existing?.needsReview,
      source: input.source ?? existing?.source,
      bottleVolumeMl: input.bottleVolumeMl ?? existing?.bottleVolumeMl,
      openVolumeMl: input.openVolumeMl ?? existing?.openVolumeMl ?? 0,
      dosePrices: input.dosePrices ?? existing?.dosePrices ?? {},
      doseSourceProductId: input.doseSourceProductId ?? existing?.doseSourceProductId,
      comboItems: input.comboItems ?? existing?.comboItems ?? [],
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    if (!product.name) throw new Error("Informe o nome do produto.");
    if (!product.category) throw new Error("Informe a categoria do produto.");
    if (product.doseSourceProductId) {
      const sourceBottle = state.products.find((candidate) => candidate.id === product.doseSourceProductId);
      if (!sourceBottle || sourceBottle.kind !== "volume") throw new Error("Selecione uma garrafa válida para o Produto Dose.");
      product.kind = "unit";
      product.stock = 0;
      product.minStock = 0;
      product.cost = 0;
    }
    if (product.kind === "combo" && product.active && !(product.comboItems || []).length) throw new Error("Um combo ativo precisa ter pelo menos um componente.");
    setState((s) => ({
      ...s,
      products: existing ? s.products.map((p) => p.id === product.id ? product : p) : [product, ...s.products],
      auditLogs: [audit(existing ? "Atualizou" : "Cadastrou", "Produto", product.id, `${product.name} · ${product.barcode ? `${product.barcodeType === "internal" ? "código interno" : "código"} ${product.barcode}` : "sem código"}${product.doseSourceProductId ? " · Produto Dose vinculado a garrafa" : ""}`), ...s.auditLogs],
    }));
    return product;
  }, [audit, state.products]);

  const bindBarcode = useCallback<StoreContextValue["bindBarcode"]>((productId, barcode, multiplier = 1, label = "Unidade", makePrimary = true) => {
    const normalized = normalizeBarcode(barcode);
    if (!normalized) throw new Error("Código de barras inválido.");
    const safeMultiplier = Math.max(1, Math.floor(Number(multiplier) || 1));
    setState((s) => {
      const target = s.products.find((p) => p.id === productId);
      if (!target) throw new Error("Produto não encontrado.");
      if (target.kind === "combo") throw new Error("Combos não recebem código de barras neste fluxo.");
      const duplicate = s.products.find((p) => p.id !== productId && productBarcodeBindings(p).some((binding) => binding.code === normalized));
      if (duplicate) throw new Error(`O código ${normalized} já pertence a ${duplicate.name}.`);
      const now = new Date().toISOString();
      const bindings = new Map(productBarcodeBindings(target).map((binding) => [binding.code, binding]));
      bindings.set(normalized, {
        code: normalized,
        multiplier: safeMultiplier,
        label: label.trim() || (safeMultiplier > 1 ? `Pacote x${safeMultiplier}` : "Unidade"),
        primary: makePrimary,
        createdAt: bindings.get(normalized)?.createdAt || now,
      });
      const nextPrimary = makePrimary ? normalized : target.barcode || normalized;
      const normalizedBindings = Array.from(bindings.values()).map((binding) => ({ ...binding, primary: binding.code === nextPrimary }));
      return {
        ...s,
        products: s.products.map((p) => p.id === productId ? { ...p, barcode: nextPrimary, barcodes: normalizedBindings, updatedAt: now } : p),
        auditLogs: [audit("Vinculou código", "Produto", productId, `${target.name} · ${normalized} · x${safeMultiplier}`), ...s.auditLogs],
      };
    });
  }, [audit]);

  const unbindBarcode = useCallback<StoreContextValue["unbindBarcode"]>((productId, barcode) => {
    setState((s) => {
      const target = s.products.find((p) => p.id === productId);
      if (!target) throw new Error("Produto não encontrado.");
      const currentBindings = productBarcodeBindings(target);
      const targetCode = normalizeBarcode(barcode || target.barcode || "");
      if (!targetCode) return s;
      const remaining = currentBindings.filter((binding) => binding.code !== targetCode);
      const nextPrimary = target.barcode === targetCode ? (remaining[0]?.code || "") : target.barcode;
      const nextBindings = remaining.map((binding) => ({ ...binding, primary: binding.code === nextPrimary }));
      return {
        ...s,
        products: s.products.map((p) => p.id === productId ? { ...p, barcode: nextPrimary, barcodes: nextBindings, updatedAt: new Date().toISOString() } : p),
        auditLogs: [audit("Removeu código", "Produto", productId, `${target.name} · ${targetCode}`), ...s.auditLogs],
      };
    });
  }, [audit]);

  const moveBarcode = useCallback<StoreContextValue["moveBarcode"]>((barcode, targetProductId) => {
    const normalized = normalizeBarcode(barcode);
    if (!normalized) throw new Error("Código de barras inválido.");
    setState((s) => {
      const target = s.products.find((product) => product.id === targetProductId && !product.deletedAt);
      if (!target) throw new Error("Produto de destino não encontrado.");
      if (target.kind === "combo") throw new Error("Combos não recebem código neste fluxo.");

      const owners = s.products.filter((product) => productBarcodeBindings(product).some((binding) => binding.code === normalized));
      const sourceBinding = owners.flatMap((product) => productBarcodeBindings(product)).find((binding) => binding.code === normalized);
      const multiplier = Math.max(1, Number(sourceBinding?.multiplier || 1));
      const label = sourceBinding?.label || (multiplier > 1 ? `Pacote x${multiplier}` : "Unidade");
      const now = new Date().toISOString();

      const products = s.products.map((product) => {
        const currentBindings = productBarcodeBindings(product);
        const withoutCode = currentBindings.filter((binding) => binding.code !== normalized);
        let nextPrimary = product.barcode === normalized ? (withoutCode[0]?.code || "") : product.barcode;
        let nextBindings = withoutCode.map((binding) => ({ ...binding, primary: binding.code === nextPrimary }));

        if (product.id === targetProductId) {
          nextPrimary = normalized;
          const map = new Map(nextBindings.map((binding) => [binding.code, binding]));
          map.set(normalized, { code: normalized, multiplier, label, primary: true, type: sourceBinding?.type || (normalized.length === 4 ? "internal" : "ean"), createdAt: sourceBinding?.createdAt || now });
          nextBindings = Array.from(map.values()).map((binding) => ({ ...binding, primary: binding.code === normalized }));
        }

        if (currentBindings.some((binding) => binding.code === normalized) || product.id === targetProductId) {
          return { ...product, barcode: nextPrimary, barcodes: nextBindings, updatedAt: now };
        }
        return product;
      });

      const previous = owners.map((product) => product.name).join(", ") || "sem vínculo anterior";
      return {
        ...s,
        products,
        auditLogs: [audit("Corrigiu vínculo de código", "Produto", targetProductId, `${normalized} · ${previous} → ${target.name}`), ...s.auditLogs],
      };
    }, "Corrigiu vínculo de código");
  }, [audit]);

  const setProductActive = useCallback<StoreContextValue["setProductActive"]>((productId, active) => {
    setState((s) => {
      const target = s.products.find((p) => p.id === productId);
      if (!target) throw new Error("Produto não encontrado.");
      if (active && target.kind === "combo" && !(target.comboItems || []).length) throw new Error("Configure os componentes antes de ativar o combo.");
      return {
        ...s,
        products: s.products.map((p) => p.id === productId ? { ...p, active, updatedAt: new Date().toISOString() } : p),
        auditLogs: [audit(active ? "Ativou" : "Desativou", "Produto", productId, target.name), ...s.auditLogs],
      };
    });
  }, [audit]);

  const deleteProduct = useCallback<StoreContextValue["deleteProduct"]>((productId, reason) => {
    const cleanReason = reason.trim();
    if (!cleanReason) throw new Error("Informe o motivo da exclusão do produto.");
    setState((s) => {
      const target = s.products.find((p) => p.id === productId);
      if (!target) throw new Error("Produto não encontrado.");
      if (target.deletedAt) throw new Error("Este produto já foi excluído.");

      const dependentDose = s.products.find((p) => !p.deletedAt && p.doseSourceProductId === productId);
      if (dependentDose) throw new Error(`Antes de excluir, remova o vínculo do Produto Dose ${dependentDose.name}.`);
      const dependentCombo = s.products.find((p) => !p.deletedAt && (p.comboItems || []).some((item) => item.productId === productId));
      if (dependentCombo) throw new Error(`Antes de excluir, remova ${target.name} da composição do combo ${dependentCombo.name}.`);

      const now = new Date().toISOString();
      const operator = s.currentOperator?.name || "Operador";
      return {
        ...s,
        products: s.products.map((p) => p.id === productId ? {
          ...p,
          active: false,
          favorite: false,
          barcode: "",
          barcodes: [],
          deletedAt: now,
          deleteReason: cleanReason,
          deletedBy: operator,
          updatedAt: now,
        } : p),
        auditLogs: [audit("Excluiu", "Produto", productId, `${target.name} · ${cleanReason} · códigos desvinculados`), ...s.auditLogs],
      };
    }, "Excluiu produto");
  }, [audit]);

  const setProductFavorite = useCallback<StoreContextValue["setProductFavorite"]>((productId, favorite) => {
    setState((s) => ({
      ...s,
      products: s.products.map((p) => p.id === productId ? { ...p, favorite, updatedAt: new Date().toISOString() } : p),
      auditLogs: [audit(favorite ? "Fixou favorito" : "Removeu favorito", "Produto", productId, s.products.find((p) => p.id === productId)?.name || productId), ...s.auditLogs],
    }));
  }, [audit]);

  const setProductLocation = useCallback<StoreContextValue["setProductLocation"]>((productId, location) => {
    setState((s) => ({
      ...s,
      products: s.products.map((p) => p.id === productId ? { ...p, location: location.trim(), updatedAt: new Date().toISOString() } : p),
      auditLogs: [audit("Alterou localização", "Produto", productId, location.trim() || "Sem localização"), ...s.auditLogs],
    }));
  }, [audit]);

  const setOpenBottleVolume = useCallback<StoreContextValue["setOpenBottleVolume"]>((productId, volumeMl, reason) => {
    if (!reason.trim()) throw new Error("Informe o motivo da conferência.");
    setState((s) => {
      const target = s.products.find((product) => product.id === productId);
      if (!target) throw new Error("Produto não encontrado.");
      if (target.kind !== "volume") throw new Error("Este produto não usa controle por volume.");
      const bottleVolume = Math.max(1, Number(target.bottleVolumeMl || 0));
      const nextVolume = Math.max(0, Math.min(Number(volumeMl) || 0, bottleVolume));
      const previous = Number(target.openVolumeMl || 0);
      let sealed = target.stock;
      if (previous <= 0 && nextVolume > 0 && sealed > 0) sealed -= 1;
      return {
        ...s,
        products: s.products.map((product) => product.id === productId ? { ...product, stock: sealed, openVolumeMl: nextVolume, updatedAt: new Date().toISOString() } : product),
        auditLogs: [audit("Conferiu garrafa aberta", "Produto", productId, `${target.name} · ${target.stock} fechada(s) / ${previous} ml → ${sealed} fechada(s) / ${nextVolume} ml · ${reason.trim()}`), ...s.auditLogs],
      };
    });
  }, [audit]);

  const registerVolumeLoss = useCallback<StoreContextValue["registerVolumeLoss"]>((productId, volumeMl, reason) => {
    const loss = Math.max(0, Number(volumeMl) || 0);
    if (loss <= 0) throw new Error("Informe uma perda maior que zero.");
    if (!reason.trim()) throw new Error("Informe o motivo da perda.");
    setState((s) => {
      const target = s.products.find((product) => product.id === productId);
      if (!target) throw new Error("Produto não encontrado.");
      if (target.kind !== "volume") throw new Error("Este produto não usa controle por volume.");
      const totalAvailable = (target.stock * Math.max(1, Number(target.bottleVolumeMl || 0))) + Number(target.openVolumeMl || 0);
      if (loss > totalAvailable) throw new Error("A perda informada é maior que o volume disponível.");
      let sealed = target.stock;
      let open = Number(target.openVolumeMl || 0);
      let remaining = loss;
      const bottleVolume = Math.max(1, Number(target.bottleVolumeMl || 0));
      while (remaining > 0) {
        if (open <= 0) {
          if (sealed <= 0) break;
          sealed -= 1;
          open = bottleVolume;
        }
        const used = Math.min(open, remaining);
        open -= used;
        remaining -= used;
      }
      return {
        ...s,
        products: s.products.map((product) => product.id === productId ? { ...product, stock: sealed, openVolumeMl: open, updatedAt: new Date().toISOString() } : product),
        auditLogs: [audit("Registrou perda em volume", "Produto", productId, `${target.name} · -${loss} ml · ${reason.trim()}`), ...s.auditLogs],
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

  const adjustStock = useCallback<StoreContextValue["adjustStock"]>((productId, delta, reason) => {
    if (!reason.trim()) throw new Error("Informe o motivo do ajuste.");
    if (!Number.isFinite(delta) || delta === 0) throw new Error("Informe uma quantidade diferente de zero.");
    setState((s) => {
      const target = s.products.find((p) => p.id === productId);
      if (!target) throw new Error("Produto não encontrado.");
      if (target.kind === "combo") throw new Error("O estoque do combo é calculado pelos componentes.");
      if (isDoseShortcut(target)) throw new Error("Produto Dose não possui estoque próprio. Ajuste a garrafa vinculada.");
      const next = target.stock + delta;
      if (next < 0) throw new Error("O ajuste deixaria o estoque negativo.");
      return {
        ...s,
        products: s.products.map((p) => p.id === productId ? { ...p, stock: next, updatedAt: new Date().toISOString() } : p),
        auditLogs: [audit("Ajustou estoque", "Produto", productId, `${target.stock} → ${next} · ${reason.trim()}`), ...s.auditLogs],
      };
    });
  }, [audit]);

  const setStockCount = useCallback<StoreContextValue["setStockCount"]>((counts, reason) => {
    const cleanReason = reason.trim();
    if (!cleanReason) throw new Error("Informe o motivo do inventário.");
    const relevant = state.products.filter((product) => product.kind !== "combo" && !isDoseShortcut(product) && product.id in counts);
    const result = relevant.reduce((acc, product) => {
      const counted = Math.max(0, Number(counts[product.id]) || 0);
      if (Math.abs(counted - product.stock) < 0.0001) acc.untouched += 1;
      else acc.adjusted += 1;
      return acc;
    }, { adjusted: 0, untouched: 0 });
    setState((s) => {
      const now = new Date().toISOString();
      const products = s.products.map((product) => {
        if (!(product.id in counts) || product.kind === "combo" || isDoseShortcut(product)) return product;
        const counted = Math.max(0, Number(counts[product.id]) || 0);
        return Math.abs(counted - product.stock) < 0.0001 ? product : { ...product, stock: counted, updatedAt: now };
      });
      return {
        ...s,
        products,
        auditLogs: [audit("Concluiu inventário", "Estoque", undefined, `${result.adjusted} ajustes · ${result.untouched} sem divergência · ${cleanReason}`), ...s.auditLogs],
      };
    });
    return result;
  }, [audit, state.products]);

  const receiveStock = useCallback<StoreContextValue["receiveStock"]>((items, reason, supplierId) => {
    const cleanReason = reason.trim();
    const valid = items.filter((item) => Number.isFinite(item.quantity) && item.quantity > 0);
    if (!cleanReason) throw new Error("Informe o motivo da entrada.");
    if (!valid.length) throw new Error("Bipe pelo menos um produto antes de confirmar.");
    setState((s) => {
      const grouped = new Map<string, { quantity: number; unitCost?: number }>();
      valid.forEach((item) => {
        const current = grouped.get(item.productId) || { quantity: 0 };
        grouped.set(item.productId, { quantity: current.quantity + item.quantity, unitCost: item.unitCost ?? current.unitCost });
      });
      for (const [productId] of grouped) {
        const target = s.products.find((p) => p.id === productId);
        if (!target) throw new Error("Há um produto inválido na entrada.");
        if (target.kind === "combo") throw new Error(`O combo ${target.name} não pode receber estoque direto.`);
        if (isDoseShortcut(target)) throw new Error(`${target.name} é um Produto Dose e não possui estoque próprio.`);
      }
      const now = new Date().toISOString();
      const products = s.products.map((p) => {
        const groupedItem = grouped.get(p.id);
        if (!groupedItem) return p;
        return {
          ...p,
          stock: p.stock + groupedItem.quantity,
          cost: groupedItem.unitCost && groupedItem.unitCost > 0 ? groupedItem.unitCost : p.cost,
          updatedAt: now,
        };
      });
      const totalUnits = Array.from(grouped.values()).reduce((sum, item) => sum + item.quantity, 0);
      const supplier = supplierId ? s.suppliers.find((item) => item.id === supplierId) : undefined;
      return {
        ...s,
        products,
        auditLogs: [audit("Entrada em lote", "Estoque", undefined, `${totalUnits} un. em ${grouped.size} produtos · ${supplier ? supplier.name + " · " : ""}${cleanReason}`), ...s.auditLogs],
      };
    });
  }, [audit]);

  const addCustomer = useCallback<StoreContextValue["addCustomer"]>((input) => {
    const normalized = normalizePhone(input.phone);
    if (!input.name.trim()) throw new Error("Informe o nome do cliente.");
    if (!normalized) throw new Error("Informe o telefone do cliente.");
    const duplicate = state.customers.find((customer) => normalizePhone(customer.phone) === normalized);
    if (duplicate) return duplicate;
    const now = new Date().toISOString();
    const customer: Customer = {
      ...input,
      name: input.name.trim(),
      phone: input.phone.trim(),
      tags: input.tags || [],
      cashback: Number(input.cashback || 0),
      id: uid("customer"),
      createdAt: now,
      updatedAt: now,
    };
    setState((s) => ({ ...s, customers: [customer, ...s.customers], auditLogs: [audit("Cadastrou", "Cliente", customer.id, customer.name), ...s.auditLogs] }));
    return customer;
  }, [audit, state.customers]);

  const updateCustomer = useCallback<StoreContextValue["updateCustomer"]>((id, patch) => {
    setState((s) => {
      const current = s.customers.find((customer) => customer.id === id);
      if (!current) throw new Error("Cliente não encontrado.");
      if (patch.phone) {
        const phone = normalizePhone(patch.phone);
        const duplicate = s.customers.find((customer) => customer.id !== id && normalizePhone(customer.phone) === phone);
        if (duplicate) throw new Error(`Este telefone já pertence a ${duplicate.name}.`);
      }
      return {
        ...s,
        customers: s.customers.map((customer) => customer.id === id ? { ...customer, ...patch, updatedAt: new Date().toISOString() } : customer),
        auditLogs: [audit("Atualizou", "Cliente", id, patch.name || current.name), ...s.auditLogs],
      };
    });
  }, [audit]);

  const finishSale = useCallback<StoreContextValue["finishSale"]>((input) => {
    const currentState = state;
    if (!currentState.cashSession || currentState.cashSession.status !== "open") throw new Error("Abra o caixa antes de finalizar uma venda.");
    if (!input.items.length) throw new Error("Adicione pelo menos um item.");
    if (input.idempotencyKey && (processedIdempotencyRef.current.has(input.idempotencyKey) || currentState.sales.some((sale) => sale.idempotencyKey === input.idempotencyKey))) throw new Error("Esta venda já foi processada.");
    const totals = calculateCart(input.items, input.discount);
    const paid = input.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    if (totals.total < 0) throw new Error("Total da venda inválido.");
    if (Math.abs(paid - totals.total) > 0.009) throw new Error("O total dos pagamentos precisa ser igual ao total da venda.");
    const products = applyCartToStock(currentState.products, input.items);
    if (input.idempotencyKey) processedIdempotencyRef.current.add(input.idempotencyKey);
    const saleId = uid("sale");
    const createdAt = new Date().toISOString();
    const number = Math.max(1000, ...currentState.sales.map((s) => s.number)) + 1;
    const soldItems = input.items.map((item) => {
      const product = currentState.products.find((p) => p.id === item.productId);
      return {
        ...item,
        unitCost: product ? productUnitCost(product, item.mode, item.doseMl, currentState.products) : Number(item.unitCost || 0),
      };
    });
    const sale = {
      id: saleId,
      number,
      channel: input.channel || "Balcão" as const,
      externalId: input.externalId,
      customerId: input.customerId,
      items: soldItems,
      ...totals,
      payments: input.payments.map((line) => ({ ...line, amount: Number(line.amount) })),
      status: "completed" as const,
      createdAt,
      operator: currentState.currentOperator?.name || "Operador",
      note: input.note?.trim() || undefined,
      idempotencyKey: input.idempotencyKey,
    };
    const financialEntry: FinancialEntry = {
      id: uid("fin"),
      type: "income",
      category: `Vendas ${sale.channel}`,
      description: `Venda #${number}`,
      amount: sale.total,
      date: createdAt,
      status: "paid",
      paidAt: createdAt,
      channel: sale.channel,
      saleId,
    };
    const cashAmount = input.payments.filter((p) => p.method === "Dinheiro").reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const saleMovement = cashAmount > 0 ? {
      id: uid("mov"), saleId, type: "sale" as const, amount: cashAmount,
      description: `Venda #${number} · dinheiro`, createdAt, operator: sale.operator,
    } : null;
    const volumeAuditLogs = soldItems.filter((item) => item.mode === "dose" && item.doseMl).flatMap((item) => {
      const before = currentState.products.find((product) => product.id === item.productId);
      const after = products.find((product) => product.id === item.productId);
      if (!before || !after) return [];
      const totalMl = Number(item.doseMl || 0) * item.quantity;
      const logs = [audit("Vendeu em ml", "Produto", item.productId, `${item.name} · ${totalMl} ml · R$ ${(item.unitPrice * item.quantity).toFixed(2)} · venda #${number}`)];
      if (after.stock < before.stock && Number(before.openVolumeMl || 0) <= 0) logs.push(audit("Abriu garrafa automaticamente", "Produto", item.productId, `${before.name} · venda #${number}`));
      return logs;
    });
    setState((s) => ({
      ...s,
      products,
      sales: [sale, ...s.sales],
      financialEntries: [financialEntry, ...s.financialEntries],
      cashSession: s.cashSession ? { ...s.cashSession, movements: saleMovement ? [saleMovement, ...s.cashSession.movements] : s.cashSession.movements } : null,
      auditLogs: [audit("Finalizou", "Venda", saleId, `Venda #${number} · ${sale.channel} · ${sale.total.toFixed(2)}`), ...volumeAuditLogs, ...s.auditLogs],
    }));
    return saleId;
  }, [audit, state]);

  const cancelSale = useCallback<StoreContextValue["cancelSale"]>((saleId, reason) => {
    const cleanReason = reason.trim();
    if (!cleanReason) throw new Error("Informe o motivo do cancelamento.");
    setState((s) => {
      const sale = s.sales.find((x) => x.id === saleId);
      if (!sale || sale.status !== "completed") throw new Error("Venda não encontrada ou não pode mais ser cancelada.");
      const cancelledAt = new Date().toISOString();
      return {
        ...s,
        products: restoreCartToStock(s.products, sale.items),
        sales: s.sales.map((x) => x.id === saleId ? { ...x, status: "cancelled", cancelledAt, cancelReason: cleanReason } : x),
        financialEntries: s.financialEntries.filter((e) => e.saleId !== saleId),
        cashSession: s.cashSession ? { ...s.cashSession, movements: s.cashSession.movements.filter((m) => m.saleId !== saleId) } : null,
        auditLogs: [audit("Cancelou", "Venda", saleId, `Venda #${sale.number} · ${cleanReason}${sale.items.some((item) => item.mode === "dose") ? " · ml devolvidos ao estoque" : ""}`), ...s.auditLogs],
      };
    });
  }, [audit]);

  const deleteSale = useCallback<StoreContextValue["deleteSale"]>((saleId, reason) => {
    const cleanReason = reason.trim();
    if (!cleanReason) throw new Error("Informe o motivo da exclusão da venda.");
    setState((s) => {
      const sale = s.sales.find((x) => x.id === saleId);
      if (!sale || sale.status === "deleted") throw new Error("Venda não encontrada ou já excluída.");

      const shouldReverse = sale.status === "completed";
      const deletedAt = new Date().toISOString();
      const operator = s.currentOperator?.name || "Operador";
      return {
        ...s,
        products: shouldReverse ? restoreCartToStock(s.products, sale.items) : s.products,
        sales: s.sales.map((x) => x.id === saleId ? {
          ...x,
          status: "deleted" as const,
          deletedAt,
          deleteReason: cleanReason,
          deletedBy: operator,
        } : x),
        financialEntries: shouldReverse ? s.financialEntries.filter((e) => e.saleId !== saleId) : s.financialEntries,
        cashSession: shouldReverse && s.cashSession ? { ...s.cashSession, movements: s.cashSession.movements.filter((m) => m.saleId !== saleId) } : s.cashSession,
        auditLogs: [audit("Excluiu", "Venda", saleId, `Venda #${sale.number} · ${cleanReason}${shouldReverse ? " · estoque/financeiro/caixa estornados" : " · registro ocultado dos totais"}`), ...s.auditLogs],
      };
    }, "Excluiu venda");
  }, [audit]);

  const suspendSale = useCallback<StoreContextValue["suspendSale"]>((input) => {
    if (!input.items.length) throw new Error("Não há itens para suspender.");
    const now = new Date().toISOString();
    const suspended: SuspendedSale = {
      ...input,
      id: uid("hold"),
      name: input.name.trim() || `Venda ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
      createdAt: now,
      updatedAt: now,
    };
    setState((s) => ({
      ...s,
      suspendedSales: [suspended, ...s.suspendedSales],
      auditLogs: [audit("Suspendeu", "Venda", suspended.id, `${suspended.name} · ${suspended.items.length} itens`), ...s.auditLogs],
    }));
    return suspended.id;
  }, [audit]);

  const removeSuspendedSale = useCallback<StoreContextValue["removeSuspendedSale"]>((id) => {
    setState((s) => {
      const target = s.suspendedSales.find((sale) => sale.id === id);
      return {
        ...s,
        suspendedSales: s.suspendedSales.filter((sale) => sale.id !== id),
        auditLogs: [audit("Removeu venda suspensa", "Venda", id, target?.name || id), ...s.auditLogs],
      };
    }, "Removeu venda suspensa");
  }, [audit]);

  const openCash = useCallback<StoreContextValue["openCash"]>((amount, operator) => {
    if (state.cashSession?.status === "open") throw new Error("Já existe um caixa aberto.");
    if (amount < 0) throw new Error("O saldo inicial não pode ser negativo.");
    const createdAt = new Date().toISOString();
    const name = operator || state.currentOperator?.name || "Operador";
    setState((s) => ({
      ...s,
      cashSession: {
        id: uid("cash"), status: "open", openedAt: createdAt, openingAmount: amount, operator: name,
        movements: [{ id: uid("mov"), type: "opening", amount, description: "Abertura de caixa", createdAt, operator: name }],
      },
      auditLogs: [audit("Abriu", "Caixa", undefined, `Saldo inicial ${amount}`), ...s.auditLogs],
    }));
  }, [audit, state.cashSession, state.currentOperator?.name]);

  const cashMovement = useCallback<StoreContextValue["cashMovement"]>((type, amount, description) => {
    if (!state.cashSession || state.cashSession.status !== "open") throw new Error("Não há caixa aberto.");
    if (amount <= 0) throw new Error("Informe um valor maior que zero.");
    if (!description.trim()) throw new Error("Informe a descrição da movimentação.");
    const movement = {
      id: uid("mov"), type, amount, description: description.trim(), createdAt: new Date().toISOString(), operator: state.currentOperator?.name || "Operador",
    };
    setState((s) => ({
      ...s,
      cashSession: s.cashSession ? { ...s.cashSession, movements: [movement, ...s.cashSession.movements] } : null,
      auditLogs: [audit(type === "supply" ? "Suprimento" : "Sangria", "Caixa", s.cashSession?.id, `${amount} · ${description.trim()}`), ...s.auditLogs],
    }));
  }, [audit, state.cashSession, state.currentOperator?.name]);

  const closeCash = useCallback<StoreContextValue["closeCash"]>((countedAmount, expectedAmount, reason) => {
    if (!state.cashSession || state.cashSession.status !== "open") throw new Error("Não há caixa aberto.");
    if (countedAmount < 0) throw new Error("O valor contado não pode ser negativo.");
    const expected = typeof expectedAmount === "number" ? expectedAmount : countedAmount;
    const difference = countedAmount - expected;
    if (Math.abs(difference) >= 0.01 && !reason?.trim()) throw new Error("Informe o motivo da diferença antes de fechar o caixa.");

    setState((s) => {
      const session = s.cashSession;
      if (!session || session.status !== "open") throw new Error("Não há caixa aberto.");
      const closedAt = new Date().toISOString();
      const openedAtMs = new Date(session.openedAt).getTime();
      const closedAtMs = new Date(closedAt).getTime();
      const sessionSales = s.sales.filter((sale) => {
        const at = new Date(sale.createdAt).getTime();
        return at >= openedAtMs && at <= closedAtMs;
      });
      const completed = sessionSales.filter((sale) => sale.status === "completed");
      const payments: Record<string, number> = { Dinheiro: 0, PIX: 0, Débito: 0, Crédito: 0, Outro: 0 };
      completed.forEach((sale) => sale.payments.forEach((payment) => {
        payments[payment.method] = (payments[payment.method] || 0) + Number(payment.amount || 0);
      }));
      const withdrawals = session.movements.filter((movement) => movement.type === "withdrawal").reduce((sum, movement) => sum + movement.amount, 0);
      const supplies = session.movements.filter((movement) => movement.type === "supply").reduce((sum, movement) => sum + movement.amount, 0);
      const closedSession = {
        ...session,
        status: "closed" as const,
        closedAt,
        closingAmount: countedAmount,
        expectedAtClose: expected,
        difference,
        closeReason: reason?.trim() || undefined,
        closingSummary: {
          salesCount: completed.length,
          grossSales: completed.reduce((sum, sale) => sum + sale.total, 0),
          discountTotal: completed.reduce((sum, sale) => sum + sale.discount, 0),
          cancelledSales: sessionSales.filter((sale) => sale.status === "cancelled").length,
          deletedSales: sessionSales.filter((sale) => sale.status === "deleted").length,
          payments,
          withdrawals,
          supplies,
          expectedCash: expected,
        },
      };
      const history = [closedSession, ...(s.cashHistory || []).filter((item) => item.id !== closedSession.id)];
      return {
        ...s,
        cashSession: closedSession,
        cashHistory: history,
        auditLogs: [audit("Fechou", "Caixa", session.id, `Esperado ${expected.toFixed(2)} · contado ${countedAmount.toFixed(2)} · diferença ${difference.toFixed(2)} · ${completed.length} venda(s)${reason ? ` · ${reason.trim()}` : ""}`), ...s.auditLogs],
      };
    }, "Fechou caixa com resumo congelado");
  }, [audit, state.cashSession]);

  const addFinancialEntry = useCallback<StoreContextValue["addFinancialEntry"]>((entry) => {
    if (entry.amount <= 0) throw new Error("Informe um valor maior que zero.");
    if (!entry.description.trim()) throw new Error("Informe uma descrição.");
    const normalized: FinancialEntry = {
      ...entry,
      description: entry.description.trim(),
      id: uid("fin"),
      status: entry.status || "pending",
      date: entry.date || new Date().toISOString(),
    };
    setState((s) => ({
      ...s,
      financialEntries: [normalized, ...s.financialEntries],
      auditLogs: [audit("Lançou", "Financeiro", normalized.id, `${entry.type} · ${entry.description.trim()} · ${entry.amount.toFixed(2)}`), ...s.auditLogs],
    }));
  }, [audit]);

  const updateFinancialEntry = useCallback<StoreContextValue["updateFinancialEntry"]>((id, patch) => {
    setState((s) => {
      const current = s.financialEntries.find((entry) => entry.id === id);
      if (!current) throw new Error("Lançamento não encontrado.");
      return {
        ...s,
        financialEntries: s.financialEntries.map((entry) => entry.id === id ? { ...entry, ...patch } : entry),
        auditLogs: [audit("Atualizou", "Financeiro", id, patch.status ? `Status: ${patch.status}` : current.description), ...s.auditLogs],
      };
    });
  }, [audit]);

  const saveSupplier = useCallback<StoreContextValue["saveSupplier"]>((input) => {
    if (!input.name.trim()) throw new Error("Informe o nome do fornecedor.");
    const existing = input.id ? state.suppliers.find((supplier) => supplier.id === input.id) : undefined;
    const supplier: Supplier = { ...existing, ...input, id: existing?.id || uid("supplier"), name: input.name.trim() };
    setState((s) => ({
      ...s,
      suppliers: existing ? s.suppliers.map((item) => item.id === supplier.id ? supplier : item) : [supplier, ...s.suppliers],
      auditLogs: [audit(existing ? "Atualizou" : "Cadastrou", "Fornecedor", supplier.id, supplier.name), ...s.auditLogs],
    }));
    return supplier;
  }, [audit, state.suppliers]);

  const createPurchase = useCallback<StoreContextValue["createPurchase"]>((input) => {
    if (!input.supplierId) throw new Error("Selecione um fornecedor.");
    if (!input.items?.length) throw new Error("Adicione pelo menos um produto à compra.");
    for (const item of input.items) {
      if (item.quantity <= 0) throw new Error("As quantidades da compra precisam ser maiores que zero.");
      if (item.unitCost < 0) throw new Error("O custo dos itens não pode ser negativo.");
      if (!state.products.some((product) => product.id === item.productId && product.kind !== "combo" && !isDoseShortcut(product))) throw new Error("Há um produto inválido na compra. Produto Dose não possui estoque próprio.");
    }
    const total = input.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
    const purchase: Purchase = {
      id: input.id || uid("purchase"),
      supplierId: input.supplierId,
      date: input.date || new Date().toISOString(),
      dueDate: input.dueDate,
      status: "ordered",
      total,
      items: input.items.map((item) => ({ ...item })),
    };
    setState((s) => ({
      ...s,
      purchases: [purchase, ...s.purchases.filter((item) => item.id !== purchase.id)],
      auditLogs: [audit("Criou", "Compra", purchase.id, `${purchase.items?.length || 0} itens · ${total.toFixed(2)}`), ...s.auditLogs],
    }));
    return purchase;
  }, [audit, state.products]);

  const receivePurchase = useCallback<StoreContextValue["receivePurchase"]>((purchaseId) => {
    setState((s) => {
      const purchase = s.purchases.find((item) => item.id === purchaseId);
      if (!purchase) throw new Error("Compra não encontrada.");
      if (purchase.status === "received") throw new Error("Esta compra já foi recebida.");
      if (!purchase.items?.length) throw new Error("A compra não possui itens.");
      for (const line of purchase.items) {
        const target = s.products.find((product) => product.id === line.productId);
        if (!target || target.kind === "combo" || isDoseShortcut(target)) throw new Error("A compra contém um item que não pode receber estoque direto.");
      }
      const now = new Date().toISOString();
      const products = s.products.map((product) => {
        const lines = purchase.items?.filter((item) => item.productId === product.id) || [];
        if (!lines.length) return product;
        const quantity = lines.reduce((sum, item) => sum + item.quantity, 0);
        const totalCost = lines.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
        const weightedCost = quantity > 0 ? totalCost / quantity : product.cost;
        return { ...product, stock: product.stock + quantity, cost: weightedCost, updatedAt: now };
      });
      const financialExists = s.financialEntries.some((entry) => entry.description === `Compra ${purchase.id}`);
      const financialEntry: FinancialEntry | null = purchase.total > 0 && !financialExists ? {
        id: uid("fin"), type: "expense", category: "Compras / fornecedores", description: `Compra ${purchase.id}`, amount: purchase.total,
        date: now, dueDate: purchase.dueDate, status: "pending", supplierId: purchase.supplierId,
      } : null;
      return {
        ...s,
        products,
        purchases: s.purchases.map((item) => item.id === purchaseId ? { ...item, status: "received" } : item),
        financialEntries: financialEntry ? [financialEntry, ...s.financialEntries] : s.financialEntries,
        auditLogs: [audit("Recebeu", "Compra", purchaseId, `${purchase.items?.length || 0} itens · ${purchase.total.toFixed(2)}`), ...s.auditLogs],
      };
    });
  }, [audit]);

  const setIntegrationEnabled = useCallback<StoreContextValue["setIntegrationEnabled"]>((platform, enabled) => {
    setState((s) => ({
      ...s,
      integrations: s.integrations.map((i) => i.platform === platform ? { ...i, enabled, lastSync: enabled ? new Date().toISOString() : i.lastSync, lastError: undefined } : i),
      auditLogs: [audit(enabled ? "Ativou" : "Desativou", "Integração", platform, platform), ...s.auditLogs],
    }));
  }, [audit]);

  const updateScannerSettings = useCallback<StoreContextValue["updateScannerSettings"]>((settings) => {
    setState((s) => ({
      ...s,
      scannerSettings: { ...s.scannerSettings, ...settings },
      auditLogs: [audit("Atualizou configurações", "Scanner", undefined, Object.keys(settings).join(", ") || "Scanner"), ...s.auditLogs],
    }), "Atualizou configurações do scanner");
  }, [audit]);

  const saveEmployee = useCallback<StoreContextValue["saveEmployee"]>((input) => {
    const existing = input.id ? state.employees.find((employee) => employee.id === input.id) : undefined;
    const cleanName = input.name.trim();
    if (!cleanName) throw new Error("Informe o nome do funcionário.");
    const duplicate = state.employees.find((employee) => employee.id !== input.id && employee.name.trim().toLowerCase() === cleanName.toLowerCase());
    if (duplicate) throw new Error("Já existe um funcionário com esse nome.");
    const now = new Date().toISOString();
    const position = existing?.isOwner ? "owner" : input.position;
    const isOwner = Boolean(existing?.isOwner || input.isOwner || position === "owner");
    const employee: Employee = {
      id: existing?.id || uid("emp"),
      name: cleanName,
      nickname: input.nickname?.trim() || undefined,
      phone: input.phone?.trim() || undefined,
      position,
      title: input.title?.trim() || (position === "owner" ? "Proprietário" : position === "manager" ? "Gerente" : position === "cashier" ? "Caixa" : position === "stock" ? "Estoque" : "Funcionário"),
      systemRole: input.systemRole || existing?.systemRole || systemRoleForPosition(position),
      active: input.active ?? existing?.active ?? true,
      isOwner,
      permissions: isOwner ? [...ALL_EMPLOYEE_PERMISSIONS] : [...(input.permissions || existing?.permissions || defaultPermissions(position))],
      monthlyConsumptionLimit: Number(input.monthlyConsumptionLimit || 0) > 0 ? Number(input.monthlyConsumptionLimit) : undefined,
      notes: input.notes?.trim() || undefined,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    setState((current) => ({
      ...current,
      employees: existing ? current.employees.map((item) => item.id === employee.id ? employee : item) : [employee, ...current.employees],
      currentOperator: current.currentOperator.employeeId === employee.id
        ? { employeeId: employee.id, name: employee.nickname || employee.name, role: employee.systemRole }
        : current.currentOperator,
      auditLogs: [audit(existing ? "Atualizou funcionário" : "Cadastrou funcionário", "Funcionário", employee.id, `${employee.name} · ${employee.title} · ${employee.active ? "ativo" : "inativo"}`), ...current.auditLogs],
    }), existing ? "Atualizou funcionário" : "Cadastrou funcionário");
    return employee;
  }, [audit, state.employees]);

  const setEmployeeActive = useCallback<StoreContextValue["setEmployeeActive"]>((employeeId, active) => {
    setState((current) => {
      const employee = current.employees.find((item) => item.id === employeeId);
      if (!employee) throw new Error("Funcionário não encontrado.");
      if (!active && (employee.isOwner || employee.position === "owner")) throw new Error("O proprietário não pode ser desativado.");
      const updatedAt = new Date().toISOString();
      const employees = current.employees.map((item) => item.id === employeeId ? { ...item, active, updatedAt } : item);
      let currentOperator = current.currentOperator;
      if (!active && currentOperator.employeeId === employeeId) {
        const fallback = employees.find((item) => item.active && (item.isOwner || item.position === "owner")) || employees.find((item) => item.active);
        if (fallback) currentOperator = { employeeId: fallback.id, name: fallback.nickname || fallback.name, role: fallback.systemRole };
      }
      return {
        ...current,
        employees,
        currentOperator,
        auditLogs: [audit(active ? "Reativou funcionário" : "Desativou funcionário", "Funcionário", employeeId, employee.name), ...current.auditLogs],
      };
    }, active ? "Reativou funcionário" : "Desativou funcionário");
  }, [audit]);

  const selectEmployee = useCallback<StoreContextValue["selectEmployee"]>((employeeId) => {
    setState((current) => {
      const employee = current.employees.find((item) => item.id === employeeId);
      if (!employee || !employee.active) throw new Error("Selecione um funcionário ativo.");
      return {
        ...current,
        currentOperator: { employeeId: employee.id, name: employee.nickname || employee.name, role: employee.systemRole },
        auditLogs: [audit("Trocou operador", "Funcionário", employee.id, `${employee.name} · ${employee.title}`), ...current.auditLogs],
      };
    }, "Trocou operador");
  }, [audit]);

  const recordConsumption = useCallback<StoreContextValue["recordConsumption"]>((input) => {
    const current = stateRef.current;
    const employee = current.employees.find((item) => item.id === input.employeeId && item.active);
    if (!employee) throw new Error("Selecione um funcionário ativo.");
    if (!input.items.length) throw new Error("Adicione pelo menos um item ao consumo.");

    const normalizedItems: CartItem[] = input.items.map((item) => {
      const selectedProduct = current.products.find((product) => product.id === item.productId);
      if (!selectedProduct) throw new Error(`Produto ${item.name} não encontrado.`);
      if (isDoseShortcut(selectedProduct)) {
        const sourceBottle = current.products.find((product) => product.id === selectedProduct.doseSourceProductId && product.kind === "volume");
        if (!sourceBottle) throw new Error(`A garrafa vinculada a ${selectedProduct.name} não foi encontrada.`);
        return { ...item, productId: sourceBottle.id, name: selectedProduct.name, mode: "dose", unitPrice: Number(item.unitPrice || selectedProduct.price || 0) };
      }
      return item;
    });

    const productsAfter = applyCartToStock(current.products, normalizedItems);
    const consumptionItems = normalizedItems.map((item) => {
      const source = current.products.find((product) => product.id === item.productId);
      if (!source) throw new Error("Produto não encontrado ao calcular o consumo.");
      const fallbackRetail = item.mode === "dose" && item.doseMl && source.bottleVolumeMl
        ? (source.price / Math.max(1, source.bottleVolumeMl)) * item.doseMl
        : source.price;
      return {
        id: uid("cons_item"),
        productId: item.productId,
        name: item.name,
        mode: item.mode,
        quantity: item.quantity,
        doseMl: item.doseMl,
        unitCost: productUnitCost(source, item.mode, item.doseMl, current.products),
        unitPriceReference: Number(item.unitPrice || fallbackRetail || 0),
      };
    });
    const totalCost = consumptionItems.reduce((sum, item) => sum + item.unitCost * item.quantity, 0);
    const saleEquivalent = consumptionItems.reduce((sum, item) => sum + item.unitPriceReference * item.quantity, 0);

    if (employee.monthlyConsumptionLimit && !input.overrideLimit) {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const used = current.consumptions
        .filter((item) => item.employeeId === employee.id && item.status === "active" && new Date(item.createdAt).getTime() >= monthStart)
        .reduce((sum, item) => sum + item.totalCost, 0);
      if (used + totalCost > employee.monthlyConsumptionLimit + 0.009) {
        throw new Error(`LIMITE_CONSUMO:${employee.monthlyConsumptionLimit}:${used}:${totalCost}`);
      }
    }

    const createdAt = new Date().toISOString();
    const number = Math.max(0, ...current.consumptions.map((item) => item.number || 0)) + 1;
    const settlement = input.settlement || "house";
    const chargeAmount = settlement === "employee_charge" ? Math.max(0, Number(input.chargeAmount ?? saleEquivalent)) : 0;
    const record: InternalConsumption = {
      id: uid("cons"),
      number,
      employeeId: employee.id,
      employeeName: employee.name,
      items: consumptionItems,
      settlement,
      chargeStatus: settlement === "employee_charge" ? "pending" : "none",
      chargeAmount,
      totalCost,
      saleEquivalent,
      note: input.note?.trim() || undefined,
      status: "active",
      createdAt,
      operator: current.currentOperator.name || "Operador",
    };

    const volumeLogs = normalizedItems.filter((item) => item.mode === "dose" && item.doseMl).flatMap((item) => {
      const before = current.products.find((product) => product.id === item.productId);
      const after = productsAfter.find((product) => product.id === item.productId);
      if (!before || !after) return [];
      const ml = Number(item.doseMl || 0) * item.quantity;
      const logs = [audit("Consumo em ml", "Consumo", record.id, `${employee.name} · ${item.name} · ${ml} ml`)];
      if (after.stock < before.stock && Number(before.openVolumeMl || 0) <= 0) logs.push(audit("Abriu garrafa automaticamente", "Consumo", record.id, `${before.name} · consumo interno #${number}`));
      return logs;
    });

    setState((snapshot) => ({
      ...snapshot,
      products: productsAfter,
      consumptions: [record, ...snapshot.consumptions],
      auditLogs: [audit("Registrou consumo", "Consumo", record.id, `#${number} · ${employee.name} · custo ${totalCost.toFixed(2)} · referência ${saleEquivalent.toFixed(2)}${settlement === "employee_charge" ? ` · pendente ${chargeAmount.toFixed(2)}` : " · consumo da casa"}`), ...volumeLogs, ...snapshot.auditLogs],
    }), `Registrou consumo interno #${number}`);
    return record.id;
  }, [audit]);

  const reverseConsumption = useCallback<StoreContextValue["reverseConsumption"]>((consumptionId, reason) => {
    const cleanReason = reason.trim();
    if (!cleanReason) throw new Error("Informe o motivo do estorno.");
    setState((current) => {
      const record = current.consumptions.find((item) => item.id === consumptionId);
      if (!record || record.status === "reversed") throw new Error("Consumo não encontrado ou já estornado.");
      const cartItems: CartItem[] = record.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        name: item.name,
        mode: item.mode,
        quantity: item.quantity,
        unitPrice: item.unitPriceReference,
        unitCost: item.unitCost,
        doseMl: item.doseMl,
      }));
      const reversedAt = new Date().toISOString();
      return {
        ...current,
        products: restoreCartToStock(current.products, cartItems),
        consumptions: current.consumptions.map((item) => item.id === consumptionId ? { ...item, status: "reversed", reversedAt, reverseReason: cleanReason } : item),
        auditLogs: [audit("Estornou consumo", "Consumo", consumptionId, `#${record.number} · ${record.employeeName} · ${cleanReason} · estoque devolvido`), ...current.auditLogs],
      };
    }, "Estornou consumo interno");
  }, [audit]);

  const settleConsumptionCharge = useCallback<StoreContextValue["settleConsumptionCharge"]>((consumptionId, status) => {
    setState((current) => {
      const record = current.consumptions.find((item) => item.id === consumptionId);
      if (!record || record.status !== "active") throw new Error("Consumo não encontrado.");
      if (record.chargeStatus !== "pending") throw new Error("Este consumo não possui valor pendente.");
      const now = new Date().toISOString();
      return {
        ...current,
        consumptions: current.consumptions.map((item) => item.id === consumptionId ? { ...item, chargeStatus: status, settledAt: now, settledBy: current.currentOperator.name } : item),
        auditLogs: [audit(status === "discounted" ? "Marcou consumo como descontado" : "Perdoou cobrança de consumo", "Consumo", consumptionId, `#${record.number} · ${record.employeeName} · ${record.chargeAmount.toFixed(2)}`), ...current.auditLogs],
      };
    }, status === "discounted" ? "Baixou cobrança de consumo" : "Perdoou cobrança de consumo");
  }, [audit]);

  const updateCurrentOperator = useCallback<StoreContextValue["updateCurrentOperator"]>((operator) => {
    setState((s) => ({
      ...s,
      currentOperator: operator,
      auditLogs: [audit("Alterou perfil operacional", "Usuário", undefined, `${operator.name} · ${operator.role}`), ...s.auditLogs],
    }));
  }, [audit]);

  const updateCompany = useCallback<StoreContextValue["updateCompany"]>((company) => {
    setState((s) => ({
      ...s,
      company,
      auditLogs: [audit("Atualizou", "Empresa", undefined, company.name), ...s.auditLogs],
    }), "Atualizou dados da empresa");
  }, [audit]);
  const exportBackup = useCallback(() => JSON.stringify(state, null, 2), [state]);
  const importBackup = useCallback((raw: string) => {
    const parsed = JSON.parse(raw) as Partial<AppState>;
    if (!parsed.products || !parsed.sales) throw new Error("Backup inválido.");
    const next = migrateState(parsed);
    next.auditLogs = [audit("Importou", "Backup", undefined, "Backup restaurado"), ...next.auditLogs];
    setState(next, "Importou backup");
  }, [audit]);
  const resetDemo = useCallback(() => {
    if (dataMode === "supabase") throw new Error("O reset de demonstração está bloqueado no modo Supabase para evitar perda de dados.");
    const next = migrateState(demoState);
    next.auditLogs = [audit("Restaurou", "Demonstração", undefined, "Estado demo restaurado"), ...next.auditLogs];
    setState(next, "Restaurou demonstração");
  }, [audit, dataMode]);

  const value = useMemo<StoreContextValue>(() => ({
    state,
    hydrated,
    dataMode,
    authReady,
    signedIn,
    syncStatus,
    syncError,
    signIn,
    signOut,
    refreshRemote,
    recordAudit,
    saveProduct,
    bindBarcode,
    unbindBarcode,
    moveBarcode,
    setProductActive,
    deleteProduct,
    setProductFavorite,
    setProductLocation,
    setOpenBottleVolume,
    registerVolumeLoss,
    resolveProductReview,
    adjustStock,
    setStockCount,
    receiveStock,
    addCustomer,
    updateCustomer,
    finishSale,
    cancelSale,
    deleteSale,
    suspendSale,
    removeSuspendedSale,
    openCash,
    cashMovement,
    closeCash,
    addFinancialEntry,
    updateFinancialEntry,
    saveSupplier,
    createPurchase,
    receivePurchase,
    setIntegrationEnabled,
    updateScannerSettings,
    saveEmployee,
    setEmployeeActive,
    selectEmployee,
    recordConsumption,
    reverseConsumption,
    settleConsumptionCharge,
    updateCurrentOperator,
    updateCompany,
    exportBackup,
    importBackup,
    resetDemo,
  }), [
    state, hydrated, dataMode, authReady, signedIn, syncStatus, syncError, signIn, signOut, refreshRemote, recordAudit,
    saveProduct, bindBarcode, unbindBarcode, moveBarcode, setProductActive, deleteProduct, setProductFavorite, setProductLocation, setOpenBottleVolume, registerVolumeLoss,
    resolveProductReview, adjustStock, setStockCount, receiveStock, addCustomer, updateCustomer, finishSale, cancelSale, deleteSale,
    suspendSale, removeSuspendedSale, openCash, cashMovement, closeCash, addFinancialEntry, updateFinancialEntry,
    saveSupplier, createPurchase, receivePurchase, setIntegrationEnabled, updateScannerSettings, saveEmployee, setEmployeeActive, selectEmployee, recordConsumption, reverseConsumption, settleConsumptionCharge, updateCurrentOperator, updateCompany, exportBackup, importBackup, resetDemo,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore precisa estar dentro de StoreProvider.");
  return context;
}
