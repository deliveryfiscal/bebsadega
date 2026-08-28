"use client";

import { ArrowDownToLine, ArrowUpFromLine, Banknote, Clock, LockKeyhole, PlusCircle, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import { currency, dateTime } from "@/lib/utils";

export default function CashPage() {
  const { state, openCash, cashMovement, closeCash } = useStore();
  const toast = useToast();
  const [mode, setMode] = useState<"open" | "withdrawal" | "supply" | "close" | null>(null);
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState("");
  const session = state.cashSession;
  const expected = useMemo(() => {
    if (!session) return 0;
    return session.openingAmount + session.movements.reduce((sum, movement) => {
      if (movement.type === "sale" || movement.type === "supply") return sum + movement.amount;
      if (movement.type === "withdrawal" || movement.type === "expense") return sum - movement.amount;
      return sum;
    }, 0);
  }, [session]);
  const salesTotal = session?.movements.filter((m) => m.type === "sale").reduce((s, m) => s + m.amount, 0) || 0;
  const withdrawals = session?.movements.filter((m) => m.type === "withdrawal").reduce((s, m) => s + m.amount, 0) || 0;
  const supplies = session?.movements.filter((m) => m.type === "supply").reduce((s, m) => s + m.amount, 0) || 0;
  const openModal = (next: typeof mode) => { setAmount(next === "open" ? 150 : next === "close" ? expected : 0); setDescription(""); setMode(next); };
  return <>
    <PageHeader title="Caixa" description="Abertura, sangrias, suprimentos, conferência e fechamento com histórico completo." actions={session?.status === "open" ? <><button className="btn-ghost" onClick={() => openModal("withdrawal")}><ArrowDownToLine size={18} /> Sangria</button><button className="btn-ghost" onClick={() => openModal("supply")}><ArrowUpFromLine size={18} /> Suprimento</button><button className="btn-primary" onClick={() => openModal("close")}><LockKeyhole size={18} /> Fechar caixa</button></> : <button className="btn-lime" onClick={() => openModal("open")}><PlusCircle size={18} /> Abrir caixa</button>} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Status" value={session?.status === "open" ? "Aberto" : "Fechado"} hint={session?.openedAt ? `Abertura ${dateTime(session.openedAt)}` : "Nenhuma sessão atual"} icon={WalletCards} tone={session?.status === "open" ? "lime" : "warning"} /><StatCard label="Saldo esperado" value={currency(expected)} icon={Banknote} tone="lime" /><StatCard label="Vendas da sessão" value={currency(salesTotal)} icon={ArrowUpFromLine} tone="violet" /><StatCard label="Tempo em aberto" value={session?.status === "open" ? `${Math.max(0, Math.floor((Date.now() - new Date(session.openedAt).getTime()) / 3600000))}h` : "—"} icon={Clock} /></div>
    <div className="mt-6 grid gap-6 xl:grid-cols-[.75fr_1.25fr]">
      <section className="panel p-5"><h2 className="section-title">Resumo da sessão</h2><p className="muted">Conferência dos principais movimentos</p><div className="mt-5 space-y-3"><div className="panel-soft flex items-center justify-between p-4"><span className="text-slate-400">Saldo inicial</span><strong>{currency(session?.openingAmount || 0)}</strong></div><div className="panel-soft flex items-center justify-between p-4"><span className="text-slate-400">Vendas</span><strong className="text-lime">+ {currency(salesTotal)}</strong></div><div className="panel-soft flex items-center justify-between p-4"><span className="text-slate-400">Suprimentos</span><strong className="text-cyan-300">+ {currency(supplies)}</strong></div><div className="panel-soft flex items-center justify-between p-4"><span className="text-slate-400">Sangrias</span><strong className="text-brand">- {currency(withdrawals)}</strong></div><div className="flex items-end justify-between border-t border-line pt-5"><span className="font-bold">Saldo esperado</span><strong className="text-3xl font-black text-lime">{currency(expected)}</strong></div></div></section>
      <section className="panel p-5"><h2 className="section-title">Histórico de eventos</h2><p className="muted">Todas as movimentações desta sessão</p><div className="table-wrap mt-5"><table className="table"><thead><tr><th>Data e hora</th><th>Tipo</th><th>Descrição</th><th>Operador</th><th>Valor</th></tr></thead><tbody>{(session?.movements || []).map((m) => <tr key={m.id}><td>{dateTime(m.createdAt)}</td><td><span className="badge">{m.type}</span></td><td>{m.description}</td><td>{m.operator}</td><td className={`font-black ${m.type === "withdrawal" || m.type === "expense" ? "text-brand" : "text-lime"}`}>{m.type === "withdrawal" || m.type === "expense" ? "- " : "+ "}{currency(m.amount)}</td></tr>)}</tbody></table>{!session?.movements.length && <div className="grid min-h-40 place-items-center text-sm text-slate-500">Nenhuma movimentação.</div>}</div></section>
    </div>
    <Modal open={Boolean(mode)} onClose={() => setMode(null)} title={mode === "open" ? "Abrir caixa" : mode === "withdrawal" ? "Registrar sangria" : mode === "supply" ? "Registrar suprimento" : "Fechar caixa"} width="max-w-lg"><form className="space-y-4" onSubmit={(e) => { e.preventDefault(); try { if (mode === "open") openCash(Number(amount)); else if (mode === "withdrawal") cashMovement("withdrawal", Number(amount), description); else if (mode === "supply") cashMovement("supply", Number(amount), description); else if (mode === "close") closeCash(Number(amount)); toast.success(mode === "close" ? "Caixa fechado." : "Movimentação registrada."); setMode(null); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível concluir."); } }}><div className="panel-soft p-4"><p className="text-sm text-slate-400">Saldo esperado</p><p className="mt-1 text-3xl font-black text-lime">{currency(expected)}</p></div><label><span className="mb-1.5 block text-sm font-semibold">{mode === "close" ? "Valor contado" : "Valor"}</span><input className="input" type="number" min="0" step="0.01" required value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></label>{mode !== "open" && mode !== "close" && <label><span className="mb-1.5 block text-sm font-semibold">Descrição / motivo</span><input className="input" required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Depósito bancário" /></label>}{mode === "close" && <div className={`rounded-xl border p-3 text-sm ${Math.abs(amount - expected) < .01 ? "border-lime/30 bg-lime/10 text-lime" : "border-amber-500/30 bg-amber-500/10 text-amber-200"}`}>Diferença: <strong>{currency(amount - expected)}</strong></div>}<div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setMode(null)}>Cancelar</button><button className={mode === "close" ? "btn-primary" : "btn-lime"}>Confirmar</button></div></form></Modal>
  </>;
}
