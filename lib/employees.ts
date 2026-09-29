import type { AppState, Employee, EmployeePermission, EmployeePosition } from "./types";

export const ALL_EMPLOYEE_PERMISSIONS: EmployeePermission[] = [
  "pdv", "consumption", "price_check", "sales", "barcodes", "products", "stock", "stock_receipt", "inventory", "bottles",
  "purchases", "customers", "finance", "cash", "integrations", "reports", "daily_summary", "alerts", "audit", "employees", "settings",
];

export const employeePermissionLabels: Record<EmployeePermission, string> = {
  pdv: "Usar PDV",
  consumption: "Registrar consumo",
  price_check: "Consultar preço",
  sales: "Consultar vendas",
  barcodes: "Cadastrar códigos",
  products: "Produtos",
  stock: "Ver / ajustar estoque",
  stock_receipt: "Entrada de mercadoria",
  inventory: "Inventário",
  bottles: "Garrafas abertas",
  purchases: "Compras / fornecedores",
  customers: "Clientes / CRM",
  finance: "Financeiro",
  cash: "Caixa",
  integrations: "iFood / 99Food",
  reports: "Relatórios",
  daily_summary: "Resumo do dia",
  alerts: "Alertas",
  audit: "Auditoria",
  employees: "Funcionários",
  settings: "Configurações",
};

export const employeePositionLabels: Record<EmployeePosition, string> = {
  owner: "Proprietário",
  manager: "Gerente",
  cashier: "Caixa",
  stock: "Estoque",
  general: "Funcionário",
};

export function defaultPermissions(position: EmployeePosition): EmployeePermission[] {
  if (position === "owner") return [...ALL_EMPLOYEE_PERMISSIONS];
  if (position === "manager") return ALL_EMPLOYEE_PERMISSIONS.filter((permission) => permission !== "settings");
  if (position === "cashier") return ["pdv", "consumption", "price_check", "sales", "bottles", "customers", "cash", "alerts"];
  if (position === "stock") return ["consumption", "price_check", "barcodes", "products", "stock", "stock_receipt", "inventory", "bottles", "purchases", "alerts"];
  return ["pdv", "consumption", "price_check"];
}

export function systemRoleForPosition(position: EmployeePosition): Employee["systemRole"] {
  if (position === "owner") return "admin";
  if (position === "manager") return "manager";
  if (position === "cashier") return "cashier";
  if (position === "stock") return "stock";
  return "cashier";
}

export function activeConsumption(state: AppState) {
  return state.consumptions.filter((item) => item.status === "active");
}

export function employeeConsumptionTotals(state: AppState, employeeId: string, start?: Date, end?: Date) {
  const startMs = start?.getTime() ?? 0;
  const endMs = end?.getTime() ?? Number.POSITIVE_INFINITY;
  const rows = activeConsumption(state).filter((item) => {
    const timestamp = new Date(item.createdAt).getTime();
    return item.employeeId === employeeId && timestamp >= startMs && timestamp <= endMs;
  });
  return {
    rows,
    count: rows.length,
    items: rows.reduce((sum, row) => sum + row.items.reduce((inner, item) => inner + item.quantity, 0), 0),
    cost: rows.reduce((sum, row) => sum + row.totalCost, 0),
    saleEquivalent: rows.reduce((sum, row) => sum + row.saleEquivalent, 0),
    pendingCharge: rows.filter((row) => row.chargeStatus === "pending").reduce((sum, row) => sum + row.chargeAmount, 0),
  };
}

export function currentEmployee(state: AppState) {
  return state.currentOperator.employeeId
    ? state.employees.find((employee) => employee.id === state.currentOperator.employeeId && employee.active)
    : undefined;
}

export function employeeCan(state: AppState, permission: EmployeePermission) {
  const employee = currentEmployee(state);
  if (!employee) return true;
  if (employee.isOwner || employee.position === "owner") return true;
  return employee.permissions.includes(permission);
}
