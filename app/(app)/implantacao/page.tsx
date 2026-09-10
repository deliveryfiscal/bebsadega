"use client";

import Link from "next/link";
import { CheckCircle2, CircleDollarSign, PackageCheck, ScanBarcode, Settings, ShoppingCart } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { implantationStatus } from "@/lib/operational";
import { useStore } from "@/lib/store";

export default function ImplantationPage() {
  const { state, dataMode, syncStatus } = useStore();
  const status = implantationStatus(state);
  const rows = [
    { label: "Códigos de barras", count: status.withoutBarcode, href: "/codigos", help: "Bipe os produtos físicos na fila rápida." },
    { label: "Custos de compra", count: status.withoutCost, href: "/produtos", help: "Necessário para margem e lucro confiáveis." },
    { label: "Localização física", count: status.withoutLocation, href: "/estoque", help: "Ajuda inventário e reposição." },
    { label: "Cadastros em revisão", count: status.review, href: "/produtos", help: "Itens transcritos que precisam de confirmação." },
    { label: "Combos incompletos/inativos", count: status.incompleteCombos, href: "/produtos", help: "Vincule os componentes reais antes de vender." },
    { label: "Integrações desligadas", count: status.integrationsOff, href: "/integracoes", help: "Ative somente após credenciais oficiais." },
  ];

  return <>
    <PageHeader title="Implantação" description="Checklist objetivo para colocar a Beb's em operação sem deixar cadastro crítico para trás." actions={<Link href="/pdv" className="btn-lime"><ShoppingCart size={18} /> Testar PDV</Link>} />
    <section className="panel p-5 md:p-6">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between"><div><p className="text-sm font-bold text-slate-400">Prontidão operacional</p><p className="mt-1 text-5xl font-black text-lime">{status.percent}%</p><p className="mt-2 text-sm text-slate-500">{status.scannable} produtos físicos no catálogo.</p></div><div className="w-full max-w-xl"><div className="h-4 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-lime" style={{ width: `${status.percent}%` }} /></div><div className="mt-3 flex justify-between text-xs text-slate-500"><span>Cadastro inicial</span><span>{status.percent === 100 ? "Concluído" : "Em andamento"}</span></div></div></div>
      <div className="mt-6 grid gap-3 md:grid-cols-2">{rows.map((row) => <Link key={row.label} href={row.href} className="panel-soft flex items-start gap-3 p-4 hover:border-brand/50"><div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${row.count === 0 ? "bg-lime/10 text-lime" : "bg-amber-500/10 text-amber-300"}`}>{row.count === 0 ? <CheckCircle2 size={20} /> : <Settings size={20} />}</div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="font-bold">{row.label}</p><span className={`badge ${row.count === 0 ? "border-lime/30 bg-lime/10 text-lime" : "border-amber-500/30 bg-amber-500/10 text-amber-300"}`}>{row.count === 0 ? "OK" : row.count}</span></div><p className="mt-1 text-sm text-slate-500">{row.help}</p></div></Link>)}</div>
    </section>

    <div className="mt-6 grid gap-4 md:grid-cols-3"><div className="panel-soft p-4"><ScanBarcode className="mb-3 text-brand" size={22} /><p className="font-bold">1. Bipagem</p><p className="mt-1 text-sm text-slate-500">Cadastre os códigos reais sem inventar EAN.</p></div><div className="panel-soft p-4"><PackageCheck className="mb-3 text-lime" size={22} /><p className="font-bold">2. Estoque físico</p><p className="mt-1 text-sm text-slate-500">Faça inventário e informe custos de compra.</p></div><div className="panel-soft p-4"><CircleDollarSign className="mb-3 text-cyan-300" size={22} /><p className="font-bold">3. Teste completo</p><p className="mt-1 text-sm text-slate-500">Venda, pague, cancele e confira estoque/caixa.</p></div></div>

    <section className="panel mt-6 p-5"><h2 className="section-title">Persistência</h2><p className="muted">Situação do armazenamento usado por esta implantação.</p><div className="mt-4 panel-soft p-4"><p className="font-bold">Modo: {dataMode === "supabase" ? "Supabase / nuvem" : "Local / demonstração"}</p><p className="mt-1 text-sm text-slate-500">Status: {syncStatus}. {dataMode === "supabase" ? "Usuários compartilham um estado centralizado com controle de versão." : "Cada navegador possui seus próprios dados."}</p></div></section>
  </>;
}
