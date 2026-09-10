"use client";

import Link from "next/link";
import { AlertTriangle, Boxes, CircleDollarSign, ClipboardCheck, PackageCheck, PackageX, ReceiptText, ScanBarcode, ShoppingCart, TrendingUp, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { dashboardMetrics, lowStockProducts } from "@/lib/business";
import { useStore } from "@/lib/store";
import { currency, dateTime } from "@/lib/utils";

export default function DashboardPage() {
  const { state } = useStore();
  const metrics = dashboardMetrics(state);
  const low = lowStockProducts(state.products).slice(0, 7);
  const recent = state.sales.slice(0, 6);
  const withoutBarcode = state.products.filter((product) => product.kind !== "combo" && !product.barcode).length;
  const withoutCost = state.products.filter((product) => product.kind !== "combo" && product.cost <= 0).length;
  const withoutLocation = state.products.filter((product) => product.kind !== "combo" && !product.location).length;
  const pendingBills = state.financialEntries.filter((entry) => !entry.saleId && (entry.status || "paid") === "pending" && entry.type === "expense");
  const openIntegrations = state.integrations.filter((integration) => !integration.enabled).length;
  const readinessChecks = [withoutBarcode === 0, withoutCost === 0, withoutLocation === 0, low.length === 0, openIntegrations === 0];
  const readiness = Math.round((readinessChecks.filter(Boolean).length / readinessChecks.length) * 100);

  return <>
    <PageHeader title="Visão geral" description="O que exige ação hoje aparece primeiro. Sem excesso de gráficos." actions={<Link href="/pdv" className="btn-lime"><ShoppingCart size={18} /> Abrir PDV</Link>} />

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Faturamento" value={currency(metrics.totalRevenue)} hint={`${metrics.salesCount} vendas concluídas`} icon={CircleDollarSign} tone="lime" /><StatCard label="Lucro líquido estimado" value={currency(metrics.netProfit)} hint="Considera custos congelados nas novas vendas" icon={TrendingUp} tone={metrics.netProfit >= 0 ? "brand" : "warning"} /><StatCard label="Ticket médio" value={currency(metrics.averageTicket)} icon={ReceiptText} tone="violet" /><StatCard label="Estoque em atenção" value={String(metrics.lowStockCount)} hint={`${state.products.filter((product) => product.kind !== "combo" && product.stock === 0).length} zerados`} icon={PackageX} tone="warning" /></div>

    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Link href="/codigos" className="panel-soft flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:border-brand/50"><div className="rounded-xl bg-brand/10 p-2.5 text-brand"><ScanBarcode size={20} /></div><div><p className="font-bold">Cadastrar códigos</p><p className="text-xs text-slate-500">{withoutBarcode} faltando</p></div></Link><Link href="/recebimento" className="panel-soft flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:border-lime/50"><div className="rounded-xl bg-lime/10 p-2.5 text-lime"><PackageCheck size={20} /></div><div><p className="font-bold">Receber mercadoria</p><p className="text-xs text-slate-500">quantidade + bip</p></div></Link><Link href="/inventario" className="panel-soft flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:border-cyan-500/50"><div className="rounded-xl bg-cyan-500/10 p-2.5 text-cyan-300"><ClipboardCheck size={20} /></div><div><p className="font-bold">Inventário express</p><p className="text-xs text-slate-500">bipar e comparar</p></div></Link><Link href="/clientes" className="panel-soft flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:border-violet-500/50"><div className="rounded-xl bg-violet-500/10 p-2.5 text-violet-300"><Users size={20} /></div><div><p className="font-bold">CRM</p><p className="text-xs text-slate-500">{state.customers.length} clientes</p></div></Link></div>

    <div className="mt-6 grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
      <section className="panel p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="section-title">Implantação da loja</h2><p className="muted">O que falta para uma operação bem cadastrada.</p></div><span className="text-2xl font-black text-lime">{readiness}%</span></div><div className="mb-5 h-2.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-lime" style={{ width: `${readiness}%` }} /></div><div className="space-y-2">{[
        ["Códigos de barras", withoutBarcode, "/codigos"],
        ["Custos pendentes", withoutCost, "/produtos"],
        ["Localizações pendentes", withoutLocation, "/estoque"],
        ["Produtos abaixo do mínimo", metrics.lowStockCount, "/estoque"],
        ["Integrações desligadas", openIntegrations, "/integracoes"],
      ].map(([label, count, href]) => <Link key={String(label)} href={String(href)} className="panel-soft flex items-center justify-between p-3 hover:border-brand/40"><span className="text-sm">{label}</span><span className={`badge ${Number(count) === 0 ? "border-lime/30 bg-lime/10 text-lime" : "border-amber-500/30 bg-amber-500/10 text-amber-300"}`}>{Number(count) === 0 ? "OK" : count}</span></Link>)}</div></section>

      <section className="panel p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="section-title">Alertas que exigem ação</h2><p className="muted">Somente pendências relevantes.</p></div><AlertTriangle className="text-amber-300" size={22} /></div><div className="grid gap-3 sm:grid-cols-2">{low.slice(0, 4).map((product) => <Link href="/estoque" key={product.id} className="panel-soft p-3 hover:border-amber-500/40"><p className="font-semibold">{product.name}</p><p className="mt-1 text-xs text-amber-300">Estoque {product.stock} · mínimo {product.minStock}</p></Link>)}{pendingBills.slice(0, 4).map((entry) => <Link href="/financeiro" key={entry.id} className="panel-soft p-3 hover:border-brand/40"><p className="font-semibold">{entry.description}</p><p className="mt-1 text-xs text-brand">Conta pendente · {currency(entry.amount)}</p></Link>)}{!low.length && !pendingBills.length && <div className="col-span-full grid min-h-32 place-items-center text-sm text-lime">Nenhuma pendência crítica agora.</div>}</div></section>
    </div>

    <div className="mt-6 grid gap-6 xl:grid-cols-2"><section className="panel p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="section-title">Vendas recentes</h2><p className="muted">Últimas movimentações.</p></div><ReceiptText className="text-brand" size={22} /></div>{recent.length ? <div className="space-y-3">{recent.map((sale) => <div key={sale.id} className="panel-soft flex items-center justify-between gap-3 p-3"><div><p className="font-semibold">Venda #{sale.number}</p><p className="text-xs text-slate-500">{sale.channel} · {dateTime(sale.createdAt)}</p></div><div className="text-right"><p className={`font-black ${sale.status === "completed" ? "text-lime" : "text-red-300"}`}>{currency(sale.total)}</p><p className="text-xs text-slate-500">{sale.status === "completed" ? `${sale.items.length} itens` : "Cancelada"}</p></div></div>)}</div> : <div className="grid min-h-36 place-items-center text-sm text-slate-500">Nenhuma venda ainda.</div>}</section><section className="panel p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="section-title">Estoque financeiro</h2><p className="muted">Valor parado e potencial de venda.</p></div><Boxes className="text-lime" size={22} /></div><div className="grid gap-3 sm:grid-cols-2"><div className="panel-soft p-4"><p className="text-xs text-slate-500">Custo atual</p><p className="mt-2 text-2xl font-black">{currency(metrics.inventoryValue)}</p></div><div className="panel-soft p-4"><p className="text-xs text-slate-500">Caixa</p><p className={`mt-2 text-2xl font-black ${state.cashSession?.status === "open" ? "text-lime" : "text-amber-300"}`}>{state.cashSession?.status === "open" ? "Aberto" : "Fechado"}</p></div></div></section></div>
  </>;
}
