export type ProductKind = "unit" | "volume" | "combo";
export type PaymentMethod = "Dinheiro" | "PIX" | "Débito" | "Crédito" | "Outro";
export type SaleChannel = "Balcão" | "iFood" | "99Food";
export type SaleStatus = "completed" | "cancelled";
export type CashMovementType = "opening" | "closing" | "sale" | "withdrawal" | "supply" | "expense";
export type UserRole = "admin" | "manager" | "cashier" | "stock" | "finance";
export type FinancialStatus = "pending" | "paid" | "cancelled";

export interface ComboComponent {
  productId: string;
  quantity: number;
  doseMl?: number;
}

export interface BarcodeBinding {
  code: string;
  multiplier: number;
  label: string;
  primary?: boolean;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  barcode: string;
  barcodes?: BarcodeBinding[];
  sku: string;
  category: string;
  brand?: string;
  kind: ProductKind;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  active: boolean;
  favorite?: boolean;
  location?: string;
  notes?: string;
  needsReview?: boolean;
  source?: string;
  bottleVolumeMl?: number;
  openVolumeMl?: number;
  dosePrices?: Record<string, number>;
  comboItems?: ComboComponent[];
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  cpf?: string;
  birthDate?: string;
  notes?: string;
  tags?: string[];
  cashback?: number;
  consentMarketing: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  mode: "unit" | "dose" | "combo";
  quantity: number;
  unitPrice: number;
  unitCost?: number;
  doseMl?: number;
}

export interface PaymentLine {
  method: PaymentMethod;
  amount: number;
}

export interface Sale {
  id: string;
  number: number;
  channel: SaleChannel;
  externalId?: string;
  customerId?: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  payments: PaymentLine[];
  status: SaleStatus;
  createdAt: string;
  operator: string;
  note?: string;
  idempotencyKey?: string;
  cancelledAt?: string;
  cancelReason?: string;
}

export interface SuspendedSale {
  id: string;
  name: string;
  items: CartItem[];
  discount: number;
  customerId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CashMovement {
  id: string;
  saleId?: string;
  type: CashMovementType;
  amount: number;
  description: string;
  createdAt: string;
  operator: string;
}

export interface CashSession {
  id: string;
  status: "open" | "closed";
  openedAt: string;
  closedAt?: string;
  openingAmount: number;
  closingAmount?: number;
  expectedAtClose?: number;
  difference?: number;
  closeReason?: string;
  operator: string;
  movements: CashMovement[];
}

export interface FinancialEntry {
  id: string;
  type: "income" | "expense";
  category: string;
  description: string;
  amount: number;
  date: string;
  dueDate?: string;
  paidAt?: string;
  status?: FinancialStatus;
  channel?: SaleChannel;
  saleId?: string;
  supplierId?: string;
  recurring?: boolean;
}

export interface Supplier {
  id: string;
  name: string;
  document?: string;
  phone?: string;
  email?: string;
  contactName?: string;
  paymentTerms?: string;
  notes?: string;
}

export interface PurchaseItem {
  productId: string;
  quantity: number;
  unitCost: number;
}

export interface Purchase {
  id: string;
  supplierId: string;
  date: string;
  total: number;
  status: "ordered" | "received";
  items?: PurchaseItem[];
  dueDate?: string;
}

export interface IntegrationConfig {
  platform: "iFood" | "99Food";
  enabled: boolean;
  accountName: string;
  lastSync?: string;
  commissionRate: number;
  lastError?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId?: string;
  details: string;
  createdAt: string;
  operator: string;
}

export interface ScannerSettings {
  duplicateWindowMs: number;
  soundEnabled: boolean;
  autoFocus: boolean;
  autoAdvance: boolean;
  suffix: "enter" | "tab" | "none";
}

export interface AppState {
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  suspendedSales: SuspendedSale[];
  cashSession: CashSession | null;
  financialEntries: FinancialEntry[];
  suppliers: Supplier[];
  purchases: Purchase[];
  integrations: IntegrationConfig[];
  auditLogs: AuditLog[];
  scannerSettings: ScannerSettings;
  currentOperator: {
    name: string;
    role: UserRole;
  };
  company: {
    name: string;
    phone: string;
    document: string;
    address: string;
  };
}
