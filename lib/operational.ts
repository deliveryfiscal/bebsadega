import type { AppState, Product } from "./types";
import { lowStockProducts } from "./business";

export type OperationalAlert = {
  id: string;
  tone: "danger" | "warning" | "info" | "success";
  title: string;
  description: string;
  href: string;
  priority: number;
};

export function implantationStatus(state: AppState) {
  const scannable = state.products.filter((product) => product.kind !== "combo");
  const withoutBarcode = scannable.filter((product) => !product.barcode).length;
  const withoutCost = scannable.filter((product) => product.cost <= 0).length;
  const withoutStock = scannable.filter((product) => product.stock <= 0).length;
  const withoutLocation = scannable.filter((product) => !product.location).length;
  const review = state.products.filter((product) => product.needsReview).length;
  const incompleteCombos = state.products.filter((product) => product.kind === "combo" && (!(product.comboItems || []).length || !product.active)).length;
  const integrationsOff = state.integrations.filter((integration) => !integration.enabled).length;
  const checks = [withoutBarcode === 0, withoutCost === 0, withoutLocation === 0, review === 0, incompleteCombos === 0, integrationsOff === 0];
  const percent = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  return { scannable: scannable.length, withoutBarcode, withoutCost, withoutStock, withoutLocation, review, incompleteCombos, integrationsOff, percent };
}

export function operationalAlerts(state: AppState): OperationalAlert[] {
  const alerts: OperationalAlert[] = [];
  const low = lowStockProducts(state.products).sort((a, b) => (a.stock - a.minStock) - (b.stock - b.minStock));
  low.slice(0, 12).forEach((product) => alerts.push({
    id: `stock_${product.id}`,
    tone: product.stock <= 0 ? "danger" : "warning",
    title: product.stock <= 0 ? `${product.name} zerado` : `${product.name} abaixo do mínimo`,
    description: `Estoque atual ${product.stock} · mínimo ${product.minStock}`,
    href: "/estoque",
    priority: product.stock <= 0 ? 100 : 80,
  }));

  state.financialEntries.filter((entry) => entry.type === "expense" && (entry.status || "pending") === "pending").forEach((entry) => {
    const due = entry.dueDate ? new Date(`${entry.dueDate.slice(0, 10)}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;
    const days = Math.ceil((due - Date.now()) / 86400000);
    if (days <= 7) alerts.push({
      id: `fin_${entry.id}`,
      tone: days < 0 ? "danger" : days <= 1 ? "warning" : "info",
      title: days < 0 ? `Conta vencida: ${entry.description}` : days === 0 ? `Vence hoje: ${entry.description}` : `Conta próxima: ${entry.description}`,
      description: days < 0 ? `${Math.abs(days)} dia(s) em atraso` : `${Math.max(0, days)} dia(s) para o vencimento`,
      href: "/financeiro",
      priority: days < 0 ? 95 : 60,
    });
  });

  const install = implantationStatus(state);
  if (install.withoutBarcode > 0) alerts.push({ id: "missing_barcodes", tone: "info", title: `${install.withoutBarcode} produtos sem código`, description: "Use a fila rápida e bipe produto por produto.", href: "/codigos", priority: 55 });
  if (install.withoutCost > 0) alerts.push({ id: "missing_costs", tone: "warning", title: `${install.withoutCost} produtos sem custo`, description: "Sem custo, a margem e o lucro ficam incompletos.", href: "/produtos", priority: 65 });
  if (install.review > 0) alerts.push({ id: "review_products", tone: "warning", title: `${install.review} cadastros precisam de revisão`, description: "Confira os itens transcritos das listas físicas.", href: "/produtos", priority: 58 });
  if (state.cashSession?.status !== "open") alerts.push({ id: "cash_closed", tone: "warning", title: "Caixa fechado", description: "Abra o caixa antes de iniciar vendas no balcão.", href: "/caixa", priority: 85 });
  state.integrations.filter((integration) => integration.enabled && integration.lastError).forEach((integration) => alerts.push({ id: `integration_${integration.platform}`, tone: "danger", title: `${integration.platform} com falha`, description: integration.lastError || "Falha de integração", href: "/integracoes", priority: 98 }));
  return alerts.sort((a, b) => b.priority - a.priority);
}

export function openBottleProducts(products: Product[]) {
  return products.filter((product) => product.kind === "volume" && (product.openVolumeMl || 0) > 0).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function todaySummary(state: AppState) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const sales = state.sales.filter((sale) => sale.status === "completed" && new Date(sale.createdAt).getTime() >= start);
  const cancelled = state.sales.filter((sale) => sale.status === "cancelled" && new Date(sale.createdAt).getTime() >= start);
  const revenue = sales.reduce((sum, sale) => sum + sale.total, 0);
  const items = sales.reduce((sum, sale) => sum + sale.items.reduce((inner, item) => inner + item.quantity, 0), 0);
  const byChannel = sales.reduce<Record<string, number>>((acc, sale) => { acc[sale.channel] = (acc[sale.channel] || 0) + sale.total; return acc; }, {});
  const productMap = new Map<string, number>();
  sales.forEach((sale) => sale.items.forEach((item) => productMap.set(item.name, (productMap.get(item.name) || 0) + item.quantity)));
  const topProducts = Array.from(productMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return { sales, cancelled, revenue, items, averageTicket: sales.length ? revenue / sales.length : 0, byChannel, topProducts };
}
