"use client";

import { ArrowDownToLine, ArrowUpFromLine, Banknote, Clock, CreditCard, LockKeyhole, PlusCircle, QrCode, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { NumberInput } from "@/components/ui/number-input";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { useToast } from "@/components/ui/toast";
import { paymentBreakdown } from "@/lib/business";
import { useStore } from "@/lib/store";
import { currency, dateTime } from "@/lib/utils";

export default function CashPage() {
  const { state, openCash, cashMovement, closeCash } = useStore();
  const toast = useToast();
  const [mode, setMode] = useState<"open" | "withdrawal" | "supply" | "close" | null>(null);
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState("");
  const [closeReason, setCloseReason] = useState("");
  const session = state.cashSession;

  const expected = useMemo(() => {
    if (!session) return 0;
    return session.openingAmount + session.movements.reduce((sum, movement) => {
      if (movement.type === "sale" || movement.type === "supply") return sum + movement.amount;
      if (movement.type === "withdrawal" || movement.type === "expense") return sum - movement.amount;
      return sum;
    }, 0);
  }, [session]);
  const breakdown = useMemo(() => paymentBreakdown(state.sales, session?.openedAt), [state.sales, session?.openedAt]);
  const cashSales = breakdown.Dinheiro || 0;
  const electronicSales = (breakdown.PIX || 0) + (breakdown.Débito || 0) + (breakdown.Crédito || 0) + (breakdown.Outro || 0);
  const withdrawals = session?.movements.filter((movement) => movement.type === "withdrawal").reduce((sum, movement) => sum + movement.amount, 0) || 0;
  const supplies = session?.movements.filter((movement) => movement.type === "supply").reduce((sum, movement) => sum + movement.amount, 0) || 0;
  const difference = amount - expected;

  const openModal = (next: typeof mode) => {
    setAmount(next === "open" ? 150 : next === "close" ? expected : 0);
    setDescription(""); setCloseReason(""); setMode(next);
  };

  return <>
    <PageHeader title="Caixa" description="Dinheiro físico separado de PIX e cartões. Fechamento com diferença e justificativa." actions={session?.status === "open" ? <><button className="btn-ghost" onClick={() => openModal("withdrawal")}><ArrowDownToLine size={18} /> Sangria</button><button className="btn-ghost" onClick={() => openModal("supply")}><ArrowUpFromLine size={18} /> Suprimento</button><button className="btn-primary" onClick={() => openModal("close")}><LockKeyhole size={18} /> Fechar caixa</button></> : <button className="btn-lime" onClick={() => openModal("open")}><PlusCircle size={18} /> Abrir caixa</button>} />

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Status" value={session?.status === "open" ? "Aberto" : "Fechado"} hint={session?.openedAt ? `Abertura ${dateTime(session.openedAt)}` : "Nenhuma sessão atual"} icon={WalletCards} tone={session?.status === "open" ? "lime" : "warning"} /><StatCard label="Dinheiro esperado" value={currency(expected)} hint="Somente numerário físico" icon={Banknote} tone="lime" /><StatCard label="PIX + cartões" value={currency(electronicSales)} hint="Não entra na gaveta" icon={CreditCard} tone="violet" /><StatCard label="Tempo em aberto" value={session?.status === "open" ? `${Math.max(0, Math.floor((Date.now() - new Date(session.openedAt).getTime()) / 3600000))}h` : "—"} icon={Clock} /></div>

    <div className="mt-6 grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
      <section className="panel p-5"><h2 className="section-title">Conferência por forma</h2><p className="muted">O operador conta apenas o dinheiro; os demais meios vêm das vendas.</p><div className="mt-5 space-y-3"><div className="panel-soft flex items-center justify-between p-4"><span className="flex items-center gap-2 text-slate-400"><Banknote size={17} /> Saldo inicial</span><strong>{currency(session?.openingAmount || 0)}</strong></div><div className="panel-soft flex items-center justify-between p-4"><span className="flex items-center gap-2 text-slate-400"><Banknote size={17} /> Vendas em dinheiro</span><strong className="text-lime">+ {currency(cashSales)}</strong></div><div className="panel-soft flex items-center justify-between p-4"><span className="flex items-center gap-2 text-slate-400"><QrCode size={17} /> PIX</span><strong>{currency(breakdown.PIX || 0)}</strong></div><div className="panel-soft flex items-center justify-between p-4"><span className="flex items-center gap-2 text-slate-400"><CreditCard size={17} /> Débito</span><strong>{currency(breakdown.Débito || 0)}</strong></div><div className="panel-soft flex items-center justify-between p-4"><span className="flex items-center gap-2 text-slate-400"><CreditCard size={17} /> Crédito</span><strong>{currency(breakdown.Crédito || 0)}</strong></div><div className="grid grid-cols-2 gap-3"><div className="panel-soft p-4"><p className="text-xs text-slate-500">Suprimentos</p><p className="mt-1 font-black text-cyan-300">+ {currency(supplies)}</p></div><div className="panel-soft p-4"><p className="text-xs text-slate-500">Sangrias</p><p className="mt-1 font-black text-brand">- {currency(withdrawals)}</p></div></div><div className="flex items-end justify-between border-t border-line pt-5"><span className="font-bold">Dinheiro esperado</span><strong className="text-3xl font-black text-lime">{currency(expected)}</strong></div></div></section>

      <section className="panel p-5"><h2 className="section-title">Histórico da sessão</h2><p className="muted">Abertura, vendas em dinheiro, sangrias e suprimentos.</p><div className="table-wrap mt-5"><table className="table"><thead><tr><th>Data e hora</th><th>Tipo</th><th>Descrição</th><th>Operador</th><th>Valor</th></tr></thead><tbody>{(session?.movements || []).map((movement) => <tr key={movement.id}><td>{dateTime(movement.createdAt)}</td><td><span className="badge">{movement.type}</span></td><td>{movement.description}</td><td>{movement.operator}</td><td className={`font-black ${movement.type === "withdrawal" || movement.type === "expense" ? "text-brand" : "text-lime"}`}>{movement.type === "withdrawal" || movement.type === "expense" ? "- " : "+ "}{currency(movement.amount)}</td></tr>)}</tbody></table>{!session?.movements.length && <div className="grid min-h-40 place-items-center text-sm text-slate-500">Nenhuma movimentação.</div>}</div></section>
    </div>

    <Modal open={Boolean(mode)} onClose={() => setMode(null)} title={mode === "open" ? "Abrir caixa" : mode === "withdrawal" ? "Registrar sangria" : mode === "supply" ? "Registrar suprimento" : "Fechar caixa"} width="max-w-lg">
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); try { if (mode === "open") openCash(Number(amount)); else if (mode === "withdrawal") cashMovement("withdrawal", Number(amount), description); else if (mode === "supply") cashMovement("supply", Number(amount), description); else if (mode === "close") closeCash(Number(amount), expected, closeReason); toast.success(mode === "close" ? "Caixa fechado e conferido." : "Movimentação registrada."); setMode(null); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível concluir."); } }}>
        {mode === "close" && <div className="grid grid-cols-2 gap-3"><div className="panel-soft p-4"><p className="text-xs text-slate-400">Esperado</p><p className="mt-1 text-2xl font-black text-lime">{currency(expected)}</p></div><div className="panel-soft p-4"><p className="text-xs text-slate-400">PIX + cartões</p><p className="mt-1 text-2xl font-black">{currency(electronicSales)}</p></div></div>}
        <label><span className="mb-1.5 block text-sm font-semibold">{mode === "close" ? "Dinheiro contado na gaveta" : mode === "open" ? "Saldo inicial" : "Valor"}</span><NumberInput className="input h-12 text-lg font-black" min={0} step={0.01} required value={amount} onValueChange={setAmount} placeholder="0,00" /></label>
        {mode !== "open" && mode !== "close" && <label><span className="mb-1.5 block text-sm font-semibold">Descrição / motivo</span><input className="input" required value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex.: Depósito bancário" /></label>}
        {mode === "close" && <><div className={`rounded-xl border p-4 ${Math.abs(difference) < .01 ? "border-lime/30 bg-lime/10 text-lime" : "border-amber-500/30 bg-amber-500/10 text-amber-200"}`}><p className="text-xs opacity-75">Diferença</p><p className="mt-1 text-2xl font-black">{currency(difference)}</p></div>{Math.abs(difference) >= .01 && <label><span className="mb-1.5 block text-sm font-semibold">Justificativa obrigatória</span><input className="input" required value={closeReason} onChange={(event) => setCloseReason(event.target.value)} placeholder="Ex.: troco não lançado / conferência pendente" /></label>}</>}
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setMode(null)}>Cancelar</button><button className={mode === "close" ? "btn-primary" : "btn-lime"}>Confirmar</button></div>
      </form>
    </Modal>
  </>;
}
