"use client";

import { Download, RefreshCw, Save, ShieldCheck, Upload, Users } from "lucide-react";
import { useRef, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import { dateTime } from "@/lib/utils";

function saveFile(name: string, content: string) {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
}

export default function SettingsPage() {
  const { state, updateCompany, exportBackup, importBackup, resetDemo } = useStore();
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [company, setCompany] = useState(state.company);
  return <>
    <PageHeader title="Configurações" description="Dados da empresa, segurança, usuários, backup e auditoria." />
    <div className="grid gap-6 xl:grid-cols-[1fr_.8fr]">
      <section className="panel p-5"><div className="mb-5"><h2 className="section-title">Dados da empresa</h2><p className="muted">Informações utilizadas em comprovantes e relatórios</p></div><form className="space-y-4" onSubmit={(e) => { e.preventDefault(); updateCompany(company); toast.success("Dados da empresa atualizados."); }}><label><span className="mb-1.5 block text-sm font-semibold">Nome fantasia</span><input className="input" value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} /></label><div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-1.5 block text-sm font-semibold">Telefone</span><input className="input" value={company.phone} onChange={(e) => setCompany({ ...company, phone: e.target.value })} /></label><label><span className="mb-1.5 block text-sm font-semibold">CNPJ</span><input className="input" value={company.document} onChange={(e) => setCompany({ ...company, document: e.target.value })} /></label></div><label><span className="mb-1.5 block text-sm font-semibold">Endereço</span><input className="input" value={company.address} onChange={(e) => setCompany({ ...company, address: e.target.value })} /></label><button className="btn-primary"><Save size={18} /> Salvar dados</button></form></section>
      <section className="panel p-5"><div className="mb-5"><h2 className="section-title">Backup local</h2><p className="muted">Exporte e restaure todos os dados do modo demonstração</p></div><div className="space-y-3"><button className="btn-lime w-full" onClick={() => saveFile(`backup-bebs-${new Date().toISOString().slice(0, 10)}.json`, exportBackup())}><Download size={18} /> Baixar backup</button><button className="btn-ghost w-full" onClick={() => file.current?.click()}><Upload size={18} /> Restaurar backup</button><input ref={file} type="file" accept="application/json" hidden onChange={async (e) => { const selected = e.target.files?.[0]; if (!selected) return; try { importBackup(await selected.text()); toast.success("Backup restaurado."); } catch (error) { toast.error(error instanceof Error ? error.message : "Backup inválido."); } e.currentTarget.value = ""; }} /><button className="btn-danger w-full" onClick={() => { if (window.confirm("Restaurar os dados de demonstração? Os dados atuais serão substituídos.")) { resetDemo(); setCompany(state.company); toast.success("Dados de demonstração restaurados."); } }}><RefreshCw size={18} /> Restaurar demonstração</button></div><p className="mt-4 text-xs leading-5 text-slate-500">No modo de produção com Supabase, os backups devem ser feitos no banco e não apenas pelo navegador.</p></section>
    </div>
    <div className="mt-6 grid gap-6 xl:grid-cols-2"><section className="panel p-5"><div className="mb-4 flex items-center gap-2"><Users className="text-brand" size={21} /><h2 className="section-title">Usuários e permissões</h2></div><div className="space-y-3">{[{ name: "Pedro Silva", role: "Administrador", scope: "Acesso total" }, { name: "Operador Caixa", role: "Caixa", scope: "PDV, clientes e caixa" }, { name: "Responsável Estoque", role: "Estoquista", scope: "Produtos, entradas e inventário" }].map((u) => <div key={u.name} className="panel-soft flex items-center gap-3 p-3"><div className="grid h-10 w-10 place-items-center rounded-full bg-brand/10 font-bold text-brand">{u.name.split(" ").map((x) => x[0]).slice(0, 2).join("")}</div><div className="flex-1"><p className="font-semibold">{u.name}</p><p className="text-xs text-slate-500">{u.role} · {u.scope}</p></div><ShieldCheck className="text-lime" size={18} /></div>)}</div></section><section className="panel p-5"><div className="mb-4 flex items-center gap-2"><ShieldCheck className="text-lime" size={21} /><h2 className="section-title">Auditoria recente</h2></div><div className="max-h-80 space-y-2 overflow-auto">{state.auditLogs.slice(0, 12).map((log) => <div key={log.id} className="panel-soft p-3"><div className="flex items-center justify-between gap-3"><p className="font-semibold">{log.action} · {log.entity}</p><span className="text-xs text-slate-500">{dateTime(log.createdAt)}</span></div><p className="mt-1 text-xs text-slate-500">{log.details} · {log.operator}</p></div>)}{!state.auditLogs.length && <div className="grid min-h-40 place-items-center text-sm text-slate-500">As ações do sistema aparecerão aqui.</div>}</div></section></div>
  </>;
}
