"use client";

import Link from "next/link";
import { Activity, Boxes, CircleDollarSign, PackageCheck, PackageX, ReceiptText, ScanBarcode, ShoppingBag, TrendingUp, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { dashboardMetrics, lowStockProducts } from "@/lib/business";
import { useStore } from "@/lib/store";
import { currency, dateTime } from "@/lib/utils";

export default function DashboardPage() {
  const { state } = useStore();
  const metrics = dashboardMetrics(state);
  const low = lowStockProducts(state.products).slice(0, 6);
  const recent = state.sales.slice(0, 6);
  const customerCount = state.customers.length;
  const max = Math.max(1, ...state.products.filter((p) => p.kind !== "combo").map((p) => p.stock));
  return (
    <>
      <PageHeader title="Visão geral" description="Operação, vendas, estoque e financeiro em uma única leitura." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Faturamento" value={currency(metrics.totalRevenue)} hint={`${metrics.salesCount} vendas concluídas`} icon={CircleDollarSign} tone="lime" />
        <StatCard label="Lucro bruto estimado" value={currency(metrics.grossProfit)} hint="Receita menos custo dos produtos" icon={TrendingUp} tone="brand" />
        <StatCard label="Ticket médio" value={currency(metrics.averageTicket)} hint="Média por venda" icon={ReceiptText} tone="violet" />
        <StatCard label="Estoque em atenção" value={String(metrics.lowStockCount)} hint="Itens no mínimo ou abaixo" icon={PackageX} tone="warning" />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Link href="/codigos" className="panel-soft flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:border-brand/50"><div className="rounded-xl bg-brand/10 p-2.5 text-brand"><ScanBarcode size={20} /></div><div><p className="font-bold">Cadastrar códigos</p><p className="text-xs text-slate-500">{state.products.filter((p) => p.kind !== "combo" && !p.barcode).length} produtos ainda sem código</p></div></Link>
        <Link href="/recebimento" className="panel-soft flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:border-lime/50"><div className="rounded-xl bg-lime/10 p-2.5 text-lime"><PackageCheck size={20} /></div><div><p className="font-bold">Entrada rápida</p><p className="text-xs text-slate-500">Bipe mercadorias e some estoque em lote</p></div></Link>
        <Link href="/vendas" className="panel-soft flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:border-violet-500/50"><div className="rounded-xl bg-violet-500/10 p-2.5 text-violet-300"><ReceiptText size={20} /></div><div><p className="font-bold">Central de vendas</p><p className="text-xs text-slate-500">Consultar, exportar e cancelar com estorno</p></div></Link>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
        <section className="panel p-5">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="section-title">Níveis de estoque</h2><p className="muted">Quantidade disponível por produto</p></div><Boxes className="text-brand" size={22} /></div>
          <div className="space-y-4">
            {state.products.filter((p) => p.kind !== "combo").slice(0, 8).map((product) => {
              const width = Math.max(4, Math.round((product.stock / max) * 100));
              const critical = product.stock <= product.minStock;
              return <div key={product.id}><div className="mb-1.5 flex items-center justify-between gap-4 text-sm"><span className="truncate font-medium">{product.name}</span><span className={critical ? "font-bold text-amber-300" : "text-slate-400"}>{product.stock} un.</span></div><div className="h-2 overflow-hidden rounded-full bg-white/5"><div className={`h-full rounded-full ${critical ? "bg-amber-400" : "bg-brand"}`} style={{ width: `${width}%` }} /></div></div>;
            })}
          </div>
        </section>

        <section className="panel p-5">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="section-title">Resumo operacional</h2><p className="muted">Situação atual da loja</p></div><Activity className="text-lime" size={22} /></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {[{ icon: ShoppingBag, label: "Vendas", value: metrics.salesCount }, { icon: Users, label: "Clientes", value: customerCount }, { icon: Boxes, label: "Produtos", value: state.products.length }, { icon: ReceiptText, label: "Caixa", value: state.cashSession?.status === "open" ? "Aberto" : "Fechado" }].map((item) => <div key={item.label} className="panel-soft flex items-center gap-3 p-3"><div className="rounded-xl bg-white/5 p-2 text-brand"><item.icon size={18} /></div><div><p className="text-xs text-slate-500">{item.label}</p><p className="font-bold">{item.value}</p></div></div>)}
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="panel p-5">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="section-title">Vendas recentes</h2><p className="muted">Últimas movimentações registradas</p></div><ShoppingBag className="text-brand" size={22} /></div>
          {recent.length ? <div className="space-y-3">{recent.map((sale) => <div key={sale.id} className="panel-soft flex items-center justify-between gap-3 p-3"><div><p className="font-semibold">Venda #{sale.number}</p><p className="text-xs text-slate-500">{sale.channel} · {dateTime(sale.createdAt)}</p></div><div className="text-right"><p className="font-black text-lime">{currency(sale.total)}</p><p className="text-xs text-slate-500">{sale.items.length} itens</p></div></div>)}</div> : <div className="grid min-h-36 place-items-center text-sm text-slate-500">Nenhuma venda concluída ainda.</div>}
        </section>
        <section className="panel p-5">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="section-title">Alertas de estoque</h2><p className="muted">Prioridades de reposição</p></div><PackageX className="text-amber-300" size={22} /></div>
          {low.length ? <div className="space-y-3">{low.map((product) => <div key={product.id} className="panel-soft flex items-center justify-between gap-3 p-3"><div><p className="font-semibold">{product.name}</p><p className="text-xs text-slate-500">Mínimo: {product.minStock}</p></div><span className={`badge ${product.stock === 0 ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-amber-500/30 bg-amber-500/10 text-amber-300"}`}>{product.stock} em estoque</span></div>)}</div> : <div className="grid min-h-36 place-items-center text-sm text-lime">Todos os produtos estão acima do mínimo.</div>}
        </section>
      </div>
    </>
  );
}
