"use client";

import { BarChart3, ReceiptText, ShoppingCart, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { todaySummary } from "@/lib/operational";
import { useStore } from "@/lib/store";
import { currency } from "@/lib/utils";

export default function DailySummaryPage() {
  const { state } = useStore();
  const summary = todaySummary(state);
  return <>
    <PageHeader title="Resumo do dia" description="Fechamento rápido da operação: vendas, canais, ticket, cancelamentos e produtos de maior giro." actions={<button className="btn-primary" onClick={() => window.print()}><ReceiptText size={18} /> Imprimir</button>} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Faturamento hoje" value={currency(summary.revenue)} icon={TrendingUp} tone="lime" /><StatCard label="Vendas" value={String(summary.sales.length)} icon={ShoppingCart} /><StatCard label="Ticket médio" value={currency(summary.averageTicket)} icon={ReceiptText} tone="violet" /><StatCard label="Cancelamentos" value={String(summary.cancelled.length)} icon={BarChart3} tone={summary.cancelled.length ? "warning" : "lime"} /></div>
    <div className="mt-6 grid gap-6 xl:grid-cols-2"><section className="panel p-5"><h2 className="section-title">Por canal</h2><p className="muted">Quanto cada origem vendeu hoje.</p><div className="mt-4 space-y-3">{["Balcão", "iFood", "99Food"].map((channel) => <div key={channel} className="panel-soft flex items-center justify-between p-4"><span className="font-semibold">{channel}</span><strong className="text-lime">{currency(summary.byChannel[channel] || 0)}</strong></div>)}</div></section><section className="panel p-5"><h2 className="section-title">Mais vendidos</h2><p className="muted">Itens com maior quantidade no dia.</p><div className="mt-4 space-y-3">{summary.topProducts.length ? summary.topProducts.map(([name, quantity], index) => <div key={name} className="panel-soft flex items-center justify-between p-4"><div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-brand/10 text-xs font-black text-brand">{index + 1}</span><span className="font-semibold">{name}</span></div><strong>{quantity} un.</strong></div>) : <div className="grid min-h-36 place-items-center text-sm text-slate-500">Nenhuma venda hoje.</div>}</div></section></div>
  </>;
}
