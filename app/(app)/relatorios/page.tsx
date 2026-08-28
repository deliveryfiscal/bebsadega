"use client";

import { BarChart3, Download, FileSpreadsheet, Printer, ReceiptText, ShoppingBag, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { dashboardMetrics } from "@/lib/business";
import { useStore } from "@/lib/store";
import { currency, dateTime } from "@/lib/utils";

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const { state } = useStore();
  const metrics = dashboardMetrics(state);
  const sales = state.sales.filter((s) => s.status === "completed");
  const productRanking = new Map<string, number>();
  sales.forEach((sale) => sale.items.forEach((item) => productRanking.set(item.name, (productRanking.get(item.name) || 0) + item.quantity)));
  const ranking = Array.from(productRanking.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const byChannel = ["Balcão", "iFood", "99Food"].map((channel) => ({ channel, total: sales.filter((s) => s.channel === channel).reduce((sum, s) => sum + s.total, 0), count: sales.filter((s) => s.channel === channel).length }));
  const exportCsv = () => {
    const rows = [["Venda", "Data", "Canal", "Cliente", "Itens", "Subtotal", "Desconto", "Total", "Pagamento"], ...sales.map((s) => [s.number, dateTime(s.createdAt), s.channel, state.customers.find((c) => c.id === s.customerId)?.name || "Consumidor final", s.items.map((i) => `${i.quantity}x ${i.name}`).join(" | "), s.subtotal.toFixed(2), s.discount.toFixed(2), s.total.toFixed(2), s.payments.map((p) => `${p.method}:${p.amount.toFixed(2)}`).join(" | ")])];
    download("relatorio-vendas-bebs.csv", "\ufeff" + rows.map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(";")).join("\n"), "text/csv;charset=utf-8");
  };
  return <>
    <PageHeader title="Relatórios" description="Indicadores de vendas, produtos, canais, clientes e operação." actions={<><button className="btn-ghost" onClick={() => window.print()}><Printer size={18} /> Imprimir</button><button className="btn-primary" onClick={exportCsv}><FileSpreadsheet size={18} /> Exportar CSV</button></>} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Faturamento" value={currency(metrics.totalRevenue)} icon={ReceiptText} tone="lime" /><StatCard label="Vendas" value={String(metrics.salesCount)} icon={ShoppingBag} /><StatCard label="Ticket médio" value={currency(metrics.averageTicket)} icon={BarChart3} tone="violet" /><StatCard label="Clientes" value={String(state.customers.length)} icon={Users} tone="warning" /></div>
    <div className="mt-6 grid gap-6 xl:grid-cols-2">
      <section className="panel p-5"><div className="mb-4"><h2 className="section-title">Produtos mais vendidos</h2><p className="muted">Ranking por quantidade de itens</p></div>{ranking.length ? <div className="space-y-3">{ranking.map(([name, quantity], index) => <div key={name} className="panel-soft flex items-center gap-3 p-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-brand/10 font-black text-brand">{index + 1}</div><div className="min-w-0 flex-1"><p className="truncate font-semibold">{name}</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(8, (quantity / (ranking[0]?.[1] || 1)) * 100)}%` }} /></div></div><strong className="text-lime">{quantity}</strong></div>)}</div> : <div className="grid h-56 place-items-center text-slate-500">As vendas aparecerão aqui.</div>}</section>
      <section className="panel p-5"><div className="mb-4"><h2 className="section-title">Desempenho por canal</h2><p className="muted">Balcão, iFood e 99Food</p></div><div className="space-y-3">{byChannel.map((item) => <div key={item.channel} className="panel-soft p-4"><div className="flex items-center justify-between"><div><p className="font-bold">{item.channel}</p><p className="text-xs text-slate-500">{item.count} vendas</p></div><p className="text-xl font-black text-lime">{currency(item.total)}</p></div></div>)}</div></section>
    </div>
    <section className="panel mt-6 p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="section-title">Relatório detalhado de vendas</h2><p className="muted">Registros prontos para conferência e exportação</p></div><Download className="text-brand" size={21} /></div><div className="table-wrap"><table className="table"><thead><tr><th>Venda</th><th>Data</th><th>Canal</th><th>Cliente</th><th>Itens</th><th>Pagamento</th><th>Total</th></tr></thead><tbody>{sales.map((sale) => <tr key={sale.id}><td className="font-bold">#{sale.number}</td><td>{dateTime(sale.createdAt)}</td><td><span className="badge">{sale.channel}</span></td><td>{state.customers.find((c) => c.id === sale.customerId)?.name || "Consumidor final"}</td><td>{sale.items.reduce((s, i) => s + i.quantity, 0)}</td><td>{sale.payments.map((p) => p.method).join(", ")}</td><td className="font-black text-lime">{currency(sale.total)}</td></tr>)}</tbody></table>{!sales.length && <div className="grid min-h-44 place-items-center text-sm text-slate-500">Nenhuma venda concluída.</div>}</div></section>
  </>;
}
