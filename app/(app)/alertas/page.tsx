"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, CircleDollarSign, PackageX, PlugZap, ScanBarcode } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { operationalAlerts } from "@/lib/operational";
import { useStore } from "@/lib/store";

const toneClass = {
  danger: "border-red-500/25 bg-red-500/[0.05]",
  warning: "border-amber-500/25 bg-amber-500/[0.05]",
  info: "border-cyan-500/25 bg-cyan-500/[0.05]",
  success: "border-lime/25 bg-lime/[0.05]",
};

export default function AlertsPage() {
  const { state } = useStore();
  const alerts = operationalAlerts(state);
  const critical = alerts.filter((alert) => alert.tone === "danger").length;
  const warning = alerts.filter((alert) => alert.tone === "warning").length;

  return <>
    <PageHeader title="Alertas" description="Uma tela só para o que realmente exige ação. Sem notificações desnecessárias." />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div className="stat"><p className="text-xs uppercase tracking-wide text-slate-500">Pendências</p><p className="mt-2 text-3xl font-black">{alerts.length}</p></div>
      <div className="stat"><p className="text-xs uppercase tracking-wide text-slate-500">Críticas</p><p className="mt-2 text-3xl font-black text-red-300">{critical}</p></div>
      <div className="stat"><p className="text-xs uppercase tracking-wide text-slate-500">Atenção</p><p className="mt-2 text-3xl font-black text-amber-300">{warning}</p></div>
      <div className="stat"><p className="text-xs uppercase tracking-wide text-slate-500">Situação</p><p className={`mt-2 text-3xl font-black ${critical ? "text-red-300" : warning ? "text-amber-300" : "text-lime"}`}>{critical ? "Crítica" : warning ? "Atenção" : "OK"}</p></div>
    </div>

    <section className="panel mt-6 p-4 md:p-5">
      {alerts.length ? <div className="space-y-3">{alerts.map((alert) => <Link key={alert.id} href={alert.href} className={`flex items-start gap-4 rounded-2xl border p-4 transition hover:-translate-y-0.5 ${toneClass[alert.tone]}`}>
        <div className="mt-0.5 rounded-xl bg-black/20 p-2.5">{alert.id.startsWith("stock_") ? <PackageX size={20} /> : alert.id.startsWith("fin_") ? <CircleDollarSign size={20} /> : alert.id.startsWith("integration_") ? <PlugZap size={20} /> : alert.id === "missing_barcodes" ? <ScanBarcode size={20} /> : <AlertTriangle size={20} />}</div>
        <div className="min-w-0 flex-1"><p className="font-bold">{alert.title}</p><p className="mt-1 text-sm text-slate-400">{alert.description}</p></div>
        <span className="text-xs font-bold text-slate-500">Resolver →</span>
      </Link>)}</div> : <div className="grid min-h-72 place-items-center text-center"><div><CheckCircle2 className="mx-auto mb-4 text-lime" size={42} /><h2 className="text-xl font-black">Tudo em ordem</h2><p className="mt-2 text-sm text-slate-500">Não há pendências operacionais importantes agora.</p></div></div>}
    </section>
  </>;
}
