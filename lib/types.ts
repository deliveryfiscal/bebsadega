export type ProductKind = "unit" | "volume" | "combo";
export type PaymentMethod = "Dinheiro" | "PIX" | "Débito" | "Crédito" | "Outro";
export type SaleChannel = "Balcão" | "iFood" | "99Food";
export type SaleStatus = "completed" | "cancelled";
export type CashMovementType = "opening" | "closing" | "sale" | "withdrawal" | "supply" | "expense";

export interface ComboComponent {
  productId: string;
  quantity: number;
  doseMl?: number;
}

export interface Product {
  id: string;
  name: string;
  barcode: string;
  sku: string;
  category: string;
  brand?: string;
  kind: ProductKind;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  active: boolean;
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
  consentMarketing: boolean;
  createdAt: string;
}

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  mode: "unit" | "dose" | "combo";
  quantity: number;
  unitPrice: number;
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
  channel?: SaleChannel;
  saleId?: string;
}

export interface Supplier {
  id: string;
  name: string;
  document?: string;
  phone?: string;
  email?: string;
}

export interface Purchase {
  id: string;
  supplierId: string;
  date: string;
  total: number;
  status: "ordered" | "received";
}

export interface IntegrationConfig {
  platform: "iFood" | "99Food";
  enabled: boolean;
  accountName: string;
  lastSync?: string;
  commissionRate: number;
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

export interface AppState {
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  cashSession: CashSession | null;
  financialEntries: FinancialEntry[];
  suppliers: Supplier[];
  purchases: Purchase[];
  integrations: IntegrationConfig[];
  auditLogs: AuditLog[];
  company: {
    name: string;
    phone: string;
    document: string;
    address: string;
  };
}
