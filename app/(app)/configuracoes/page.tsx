"use client";

import { CheckCircle2, Download, RefreshCw, Save, ScanBarcode, ShieldCheck, Upload, UserCog, Volume2, VolumeX } from "lucide-react";
import { useRef, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { findProductByBarcode } from "@/lib/business";
import { useStore } from "@/lib/store";
import type { UserRole } from "@/lib/types";
import { dateTime } from "@/lib/utils";

function saveFile(name: string, content: string) {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

const roles: Array<{ value: UserRole; label: string; description: string }> = [
  { value: "admin", label: "Administrador", description: "Acesso completo ao sistema" },
  { value: "manager", label: "Gerente", description: "Operação, estoque, financeiro e relatórios" },
  { value: "cashier", label: "Caixa", description: "PDV, vendas, CRM e caixa" },
  { value: "stock", label: "Estoquista", description: "Produtos, códigos, estoque e compras" },
  { value: "finance", label: "Financeiro", description: "Vendas, contas e relatórios" },
];

export default function SettingsPage() {
  const { state, updateCompany, updateScannerSettings, updateCurrentOperator, exportBackup, importBackup, resetDemo } = useStore();
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<HTMLInputElement>(null);
  const [company, setCompany] = useState(state.company);
  const [operatorName, setOperatorName] = useState(state.currentOperator.name);
  const [role, setRole] = useState<UserRole>(state.currentOperator.role);
  const [testCode, setTestCode] = useState("");
  const [testResult, setTestResult] = useState("Aguardando leitura...");

  const testScanner = (raw: string) => {
    const code = raw.trim();
    if (!code) return;
    const found = findProductByBarcode(state.products, code);
    setTestResult(found ? `Leitor OK · ${found.product.name} · ${found.binding.label} (x${found.multiplier})` : `Leitor OK · código ${code} recebido, mas ainda não está vinculado a um produto.`);
    setTestCode("");
    setTimeout(() => scannerRef.current?.focus(), 40);
  };

  return <>
    <PageHeader title="Configurações" description="Ajustes práticos da loja, scanner A4003, perfil operacional, backup e auditoria." />

    <div className="grid gap-6 xl:grid-cols-2">
      <section className="panel p-5">
        <div className="mb-5"><h2 className="section-title">Dados da empresa</h2><p className="muted">Informações usadas em comprovantes e relatórios.</p></div>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); updateCompany(company); toast.success("Dados da empresa atualizados."); }}>
          <label><span className="mb-1.5 block text-sm font-semibold">Nome fantasia</span><input className="input" value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} /></label>
          <div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-1.5 block text-sm font-semibold">Telefone</span><input className="input" value={company.phone} onChange={(e) => setCompany({ ...company, phone: e.target.value })} /></label><label><span className="mb-1.5 block text-sm font-semibold">CNPJ</span><input className="input" value={company.document} onChange={(e) => setCompany({ ...company, document: e.target.value })} /></label></div>
          <label><span className="mb-1.5 block text-sm font-semibold">Endereço</span><input className="input" value={company.address} onChange={(e) => setCompany({ ...company, address: e.target.value })} /></label>
          <button className="btn-primary"><Save size={18} /> Salvar dados</button>
        </form>
      </section>

      <section className="panel p-5">
        <div className="mb-5 flex items-start gap-3"><div className="rounded-xl bg-brand/10 p-2.5 text-brand"><UserCog size={21} /></div><div><h2 className="section-title">Modo operacional</h2><p className="muted">Simule o menu de cada perfil para deixar a interface limpa.</p></div></div>
        <div className="space-y-4"><label><span className="mb-1.5 block text-sm font-semibold">Nome do operador</span><input className="input" value={operatorName} onChange={(e) => setOperatorName(e.target.value)} /></label><label><span className="mb-1.5 block text-sm font-semibold">Perfil</span><select className="select" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>{roles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><p className="rounded-xl border border-line bg-white/[0.03] p-3 text-xs leading-5 text-slate-400">{roles.find((item) => item.value === role)?.description}</p><button className="btn-primary" onClick={() => { if (!operatorName.trim()) return toast.error("Informe o nome do operador."); updateCurrentOperator({ name: operatorName.trim(), role }); toast.success("Perfil operacional atualizado. O menu foi simplificado para este usuário."); }}><ShieldCheck size={18} /> Aplicar perfil</button></div>
      </section>
    </div>

    <section className="panel mt-6 p-5">
      <div className="mb-5 flex items-start gap-3"><div className="rounded-xl bg-lime/10 p-2.5 text-lime"><ScanBarcode size={22} /></div><div><h2 className="section-title">Leitor A4003 / scanner</h2><p className="muted">Configure uma vez. Depois o funcionário só precisa bipar.</p></div></div>
      <div className="grid gap-5 xl:grid-cols-[1fr_.9fr]">
        <div className="grid gap-4 sm:grid-cols-2">
          <label><span className="mb-1.5 block text-sm font-semibold">Proteção contra leitura dupla</span><select className="select" value={state.scannerSettings.duplicateWindowMs} onChange={(e) => updateScannerSettings({ duplicateWindowMs: Number(e.target.value) })}><option value={250}>250 ms</option><option value={350}>350 ms</option><option value={450}>450 ms (recomendado)</option><option value={600}>600 ms</option><option value={800}>800 ms</option></select></label>
          <label><span className="mb-1.5 block text-sm font-semibold">Sufixo esperado</span><select className="select" value={state.scannerSettings.suffix} onChange={(e) => updateScannerSettings({ suffix: e.target.value as "enter" | "tab" | "none" })}><option value="enter">Enter (recomendado)</option><option value="tab">Tab</option><option value="none">Nenhum</option></select></label>
          <button className={state.scannerSettings.soundEnabled ? "btn-lime" : "btn-ghost"} onClick={() => updateScannerSettings({ soundEnabled: !state.scannerSettings.soundEnabled })}>{state.scannerSettings.soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />} Som {state.scannerSettings.soundEnabled ? "ativado" : "desativado"}</button>
          <button className={state.scannerSettings.autoFocus ? "btn-lime" : "btn-ghost"} onClick={() => updateScannerSettings({ autoFocus: !state.scannerSettings.autoFocus })}><CheckCircle2 size={18} /> Foco automático {state.scannerSettings.autoFocus ? "ligado" : "desligado"}</button>
        </div>
        <div className="rounded-2xl border border-brand/30 bg-brand/5 p-4"><p className="font-bold">Teste agora</p><p className="mt-1 text-xs leading-5 text-slate-400">Clique no campo uma vez e bipa qualquer produto. Se o A4003 estiver como teclado/HID e enviar Enter, o teste confirma na hora.</p><input ref={scannerRef} className="input mt-4 text-lg font-mono" autoComplete="off" value={testCode} onChange={(e) => setTestCode(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); testScanner(testCode); } }} placeholder="Bipe aqui" /><div className="mt-3 rounded-xl border border-line bg-black/20 p-3 text-sm text-slate-300">{testResult}</div></div>
      </div>
    </section>

    <div className="mt-6 grid gap-6 xl:grid-cols-2">
      <section className="panel p-5"><div className="mb-5"><h2 className="section-title">Backup local</h2><p className="muted">Antes de alterações grandes, baixe uma cópia dos dados deste navegador.</p></div><div className="space-y-3"><button className="btn-lime w-full" onClick={() => saveFile(`backup-bebs-${new Date().toISOString().slice(0, 10)}.json`, exportBackup())}><Download size={18} /> Baixar backup</button><button className="btn-ghost w-full" onClick={() => file.current?.click()}><Upload size={18} /> Restaurar backup</button><input ref={file} type="file" accept="application/json" hidden onChange={async (e) => { const selected = e.target.files?.[0]; if (!selected) return; try { importBackup(await selected.text()); toast.success("Backup restaurado."); } catch (error) { toast.error(error instanceof Error ? error.message : "Backup inválido."); } e.currentTarget.value = ""; }} /><button className="btn-danger w-full" onClick={() => { if (window.confirm("Restaurar os dados iniciais da Beb's? Os dados atuais deste navegador serão substituídos.")) { resetDemo(); setCompany(state.company); toast.success("Base inicial restaurada."); } }}><RefreshCw size={18} /> Restaurar base inicial</button></div><p className="mt-4 text-xs leading-5 text-slate-500">Este pacote continua com persistência local no front-end. Em produção multiusuário, o backup definitivo deve ser feito no Supabase.</p></section>

      <section className="panel p-5"><div className="mb-4 flex items-center gap-2"><ShieldCheck className="text-lime" size={21} /><h2 className="section-title">Auditoria recente</h2></div><div className="max-h-96 space-y-2 overflow-auto">{state.auditLogs.slice(0, 20).map((log) => <div key={log.id} className="panel-soft p-3"><div className="flex items-center justify-between gap-3"><p className="font-semibold">{log.action} · {log.entity}</p><span className="whitespace-nowrap text-xs text-slate-500">{dateTime(log.createdAt)}</span></div><p className="mt-1 text-xs leading-5 text-slate-500">{log.details} · {log.operator}</p></div>)}{!state.auditLogs.length && <div className="grid min-h-40 place-items-center text-sm text-slate-500">As ações do sistema aparecerão aqui.</div>}</div></section>
    </div>
  </>;
}
