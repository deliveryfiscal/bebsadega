"use client";

import { ArrowDownToLine, ArrowUpFromLine, Banknote, CalendarDays, Clock, CreditCard, Download, Eye, LockKeyhole, PlusCircle, Printer, QrCode, ReceiptText, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { NumberInput } from "@/components/ui/number-input";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import type { CashSession, PaymentMethod, Sale } from "@/lib/types";
import { currency, dateTime } from "@/lib/utils";

function sessionSales(sales: Sale[], session?: CashSession | null) {
  if (!session) return [];
  const start = new Date(session.openedAt).getTime();
  const end = session.closedAt ? new Date(session.closedAt).getTime() : Date.now();
  return sales.filter((sale) => {
    const at = new Date(sale.createdAt).getTime();
    return at >= start && at <= end;
  });
}

function paymentTotals(sales: Sale[]) {
  const totals: Record<PaymentMethod, number> = { Dinheiro: 0, PIX: 0, Débito: 0, Crédito: 0, Outro: 0 };
  sales.filter((sale) => sale.status === "completed").forEach((sale) => sale.payments.forEach((line) => {
    totals[line.method] = (totals[line.method] || 0) + Number(line.amount || 0);
  }));
  return totals;
}

function downloadCsv(name: string, rows: (string | number)[][]) {
  const content = "\ufeff" + rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(";")).join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
}

function printCashClosing(companyName: string, session: CashSession) {
  const popup = window.open("", "_blank", "width=800,height=760");
  if (!popup) throw new Error("O navegador bloqueou a janela de impressão.");
  const summary = session.closingSummary;
  const payments = summary?.payments || {};
  const rows = session.movements.map((movement) => `<tr><td>${dateTime(movement.createdAt)}</td><td>${movement.type}</td><td>${movement.description}</td><td>${movement.operator}</td><td style="text-align:right">${currency(movement.amount)}</td></tr>`).join("");
  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Fechamento de caixa</title><style>body{font-family:Arial,sans-serif;color:#111;padding:24px}h1{margin:0}.muted{color:#666}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:18px 0}.card{border:1px solid #ddd;border-radius:10px;padding:12px}.card small{color:#666}.card strong{display:block;margin-top:4px;font-size:18px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border-bottom:1px solid #ddd;padding:7px;text-align:left}th{background:#f4f4f4}button{margin-top:16px;padding:10px 16px}@media print{button{display:none}@page{margin:10mm}}</style></head><body><h1>${companyName} · Fechamento de caixa</h1><p class="muted">Abertura: ${dateTime(session.openedAt)} · Fechamento: ${session.closedAt ? dateTime(session.closedAt) : "—"} · Operador: ${session.operator}</p><div class="grid"><div class="card"><small>Vendas</small><strong>${summary?.salesCount || 0}</strong></div><div class="card"><small>Faturamento</small><strong>${currency(summary?.grossSales || 0)}</strong></div><div class="card"><small>Esperado em dinheiro</small><strong>${currency(session.expectedAtClose || 0)}</strong></div><div class="card"><small>Contado</small><strong>${currency(session.closingAmount || 0)}</strong></div></div><div class="grid"><div class="card"><small>Dinheiro</small><strong>${currency(payments.Dinheiro || 0)}</strong></div><div class="card"><small>PIX</small><strong>${currency(payments.PIX || 0)}</strong></div><div class="card"><small>Débito</small><strong>${currency(payments.Débito || 0)}</strong></div><div class="card"><small>Crédito</small><strong>${currency(payments.Crédito || 0)}</strong></div></div><p><strong>Diferença:</strong> ${currency(session.difference || 0)}${session.closeReason ? ` · ${session.closeReason}` : ""}</p><p><strong>Sangrias:</strong> ${currency(summary?.withdrawals || 0)} · <strong>Suprimentos:</strong> ${currency(summary?.supplies || 0)} · <strong>Descontos:</strong> ${currency(summary?.discountTotal || 0)} · <strong>Canceladas:</strong> ${summary?.cancelledSales || 0}</p><h2>Movimentações</h2><table><thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Operador</th><th>Valor</th></tr></thead><tbody>${rows}</tbody></table><button onclick="window.print()">Imprimir / Salvar PDF</button><script>setTimeout(()=>window.print(),300)</script></body></html>`);
  popup.document.close();
}

export default function CashPage() {
  const { state, openCash, cashMovement, closeCash } = useStore();
  const toast = useToast();
  const [mode, setMode] = useState<"open" | "withdrawal" | "supply" | "close" | null>(null);
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState("");
  const [closeReason, setCloseReason] = useState("");
  const [historyDetail, setHistoryDetail] = useState<CashSession | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const session = state.cashSession;

  const currentSales = useMemo(() => sessionSales(state.sales, session), [state.sales, session]);
  const completedSales = currentSales.filter((sale) => sale.status === "completed");
  const payments = useMemo(() => paymentTotals(currentSales), [currentSales]);
  const salesTotal = completedSales.reduce((sum, sale) => sum + sale.total, 0);
  const discountTotal = completedSales.reduce((sum, sale) => sum + sale.discount, 0);
  const cancelledCount = currentSales.filter((sale) => sale.status === "cancelled").length;
  const deletedCount = currentSales.filter((sale) => sale.status === "deleted").length;

  const expected = useMemo(() => {
    if (!session) return 0;
    if (session.status === "closed" && typeof session.expectedAtClose === "number") return session.expectedAtClose;
    return session.openingAmount + session.movements.reduce((sum, movement) => {
      if (movement.type === "sale" || movement.type === "supply") return sum + movement.amount;
      if (movement.type === "withdrawal" || movement.type === "expense") return sum - movement.amount;
      return sum;
    }, 0);
  }, [session]);

  const cashSales = payments.Dinheiro || 0;
  const electronicSales = (payments.PIX || 0) + (payments.Débito || 0) + (payments.Crédito || 0) + (payments.Outro || 0);
  const withdrawals = session?.movements.filter((movement) => movement.type === "withdrawal").reduce((sum, movement) => sum + movement.amount, 0) || 0;
  const supplies = session?.movements.filter((movement) => movement.type === "supply").reduce((sum, movement) => sum + movement.amount, 0) || 0;
  const difference = amount - expected;

  const history = useMemo(() => (state.cashHistory || []).filter((item) => {
    const at = new Date(item.closedAt || item.openedAt).getTime();
    if (dateFrom && at < new Date(`${dateFrom}T00:00:00`).getTime()) return false;
    if (dateTo && at > new Date(`${dateTo}T23:59:59.999`).getTime()) return false;
    return true;
  }).sort((a, b) => (b.closedAt || b.openedAt).localeCompare(a.closedAt || a.openedAt)), [state.cashHistory, dateFrom, dateTo]);

  const openModal = (next: typeof mode) => {
    setAmount(next === "open" ? 150 : next === "close" ? expected : 0);
    setDescription(""); setCloseReason(""); setMode(next);
  };

  const exportHistory = () => downloadCsv(`fechamentos-caixa-${new Date().toISOString().slice(0, 10)}.csv`, [
    ["Abertura", "Fechamento", "Operador", "Vendas", "Faturamento", "Dinheiro", "PIX", "Débito", "Crédito", "Esperado", "Contado", "Diferença", "Sangrias", "Suprimentos", "Justificativa"],
    ...history.map((item) => [dateTime(item.openedAt), item.closedAt ? dateTime(item.closedAt) : "", item.operator, item.closingSummary?.salesCount || 0, (item.closingSummary?.grossSales || 0).toFixed(2), Number(item.closingSummary?.payments?.Dinheiro || 0).toFixed(2), Number(item.closingSummary?.payments?.PIX || 0).toFixed(2), Number(item.closingSummary?.payments?.Débito || 0).toFixed(2), Number(item.closingSummary?.payments?.Crédito || 0).toFixed(2), Number(item.expectedAtClose || 0).toFixed(2), Number(item.closingAmount || 0).toFixed(2), Number(item.difference || 0).toFixed(2), Number(item.closingSummary?.withdrawals || 0).toFixed(2), Number(item.closingSummary?.supplies || 0).toFixed(2), item.closeReason || ""]),
  ]);

  return <>
    <PageHeader title="Caixa" description="Conferência simples na operação e fechamento completo com histórico, formas de pagamento e divergências." actions={session?.status === "open" ? <><button className="btn-ghost" onClick={() => openModal("withdrawal")}><ArrowDownToLine size={18} /> Sangria</button><button className="btn-ghost" onClick={() => openModal("supply")}><ArrowUpFromLine size={18} /> Suprimento</button><button className="btn-primary" onClick={() => openModal("close")}><LockKeyhole size={18} /> Fechar caixa</button></> : <button className="btn-lime" onClick={() => openModal("open")}><PlusCircle size={18} /> Abrir novo caixa</button>} />

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><StatCard label="Status" value={session?.status === "open" ? "Aberto" : "Fechado"} hint={session?.openedAt ? `Abertura ${dateTime(session.openedAt)}` : "Nenhuma sessão atual"} icon={WalletCards} tone={session?.status === "open" ? "lime" : "warning"} /><StatCard label="Vendas no turno" value={String(completedSales.length)} hint={currency(salesTotal)} icon={ReceiptText} /><StatCard label="Dinheiro esperado" value={currency(expected)} hint="Somente numerário físico" icon={Banknote} tone="lime" /><StatCard label="PIX + cartões" value={currency(electronicSales)} hint="Não entra na gaveta" icon={CreditCard} tone="violet" /><StatCard label="Canceladas / excluídas" value={`${cancelledCount} / ${deletedCount}`} hint={`Descontos ${currency(discountTotal)}`} icon={Clock} tone="warning" /></div>

    <div className="mt-6 grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
      <section className="panel p-5"><h2 className="section-title">Conferência por forma</h2><p className="muted">O operador conta apenas o dinheiro físico. PIX e cartões vêm das vendas concluídas.</p><div className="mt-5 space-y-3"><div className="panel-soft flex items-center justify-between p-4"><span className="flex items-center gap-2 text-slate-400"><Banknote size={17} /> Saldo inicial</span><strong>{currency(session?.openingAmount || 0)}</strong></div><div className="panel-soft flex items-center justify-between p-4"><span className="flex items-center gap-2 text-slate-400"><Banknote size={17} /> Vendas em dinheiro</span><strong className="text-lime">+ {currency(cashSales)}</strong></div><div className="panel-soft flex items-center justify-between p-4"><span className="flex items-center gap-2 text-slate-400"><QrCode size={17} /> PIX</span><strong>{currency(payments.PIX || 0)}</strong></div><div className="panel-soft flex items-center justify-between p-4"><span className="flex items-center gap-2 text-slate-400"><CreditCard size={17} /> Débito</span><strong>{currency(payments.Débito || 0)}</strong></div><div className="panel-soft flex items-center justify-between p-4"><span className="flex items-center gap-2 text-slate-400"><CreditCard size={17} /> Crédito</span><strong>{currency(payments.Crédito || 0)}</strong></div><div className="grid grid-cols-2 gap-3"><div className="panel-soft p-4"><p className="text-xs text-slate-500">Suprimentos</p><p className="mt-1 font-black text-cyan-300">+ {currency(supplies)}</p></div><div className="panel-soft p-4"><p className="text-xs text-slate-500">Sangrias</p><p className="mt-1 font-black text-brand">- {currency(withdrawals)}</p></div></div><div className="flex items-end justify-between border-t border-line pt-5"><span className="font-bold">Dinheiro esperado</span><strong className="text-3xl font-black text-lime">{currency(expected)}</strong></div></div></section>

      <section className="panel p-5"><h2 className="section-title">Movimentações da sessão</h2><p className="muted">Abertura, vendas em dinheiro, sangrias e suprimentos.</p><div className="table-wrap mt-5"><table className="table"><thead><tr><th>Data e hora</th><th>Tipo</th><th>Descrição</th><th>Operador</th><th>Valor</th></tr></thead><tbody>{(session?.movements || []).map((movement) => <tr key={movement.id}><td>{dateTime(movement.createdAt)}</td><td><span className="badge">{movement.type}</span></td><td>{movement.description}</td><td>{movement.operator}</td><td className={`font-black ${movement.type === "withdrawal" || movement.type === "expense" ? "text-brand" : "text-lime"}`}>{movement.type === "withdrawal" || movement.type === "expense" ? "- " : "+ "}{currency(movement.amount)}</td></tr>)}</tbody></table>{!session?.movements.length && <div className="grid min-h-40 place-items-center text-sm text-slate-500">Nenhuma movimentação.</div>}</div></section>
    </div>

    <section className="panel mt-6 p-5"><div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="section-title">Fechamentos anteriores</h2><p className="muted">Cada fechamento fica congelado com os números conferidos naquele momento.</p></div><div className="flex flex-wrap gap-2"><label><span className="mb-1 block text-xs text-slate-500">De</span><input className="input" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label><label><span className="mb-1 block text-xs text-slate-500">Até</span><input className="input" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label><button className="btn-ghost self-end" onClick={exportHistory}><Download size={17} /> CSV</button></div></div><div className="table-wrap"><table className="table"><thead><tr><th>Abertura</th><th>Fechamento</th><th>Operador</th><th>Vendas</th><th>Faturamento</th><th>Esperado</th><th>Contado</th><th>Diferença</th><th></th></tr></thead><tbody>{history.map((item) => <tr key={item.id}><td>{dateTime(item.openedAt)}</td><td>{item.closedAt ? dateTime(item.closedAt) : "—"}</td><td>{item.operator}</td><td>{item.closingSummary?.salesCount || 0}</td><td className="font-bold">{currency(item.closingSummary?.grossSales || 0)}</td><td>{currency(item.expectedAtClose || 0)}</td><td>{currency(item.closingAmount || 0)}</td><td className={Math.abs(item.difference || 0) < .01 ? "text-lime" : "text-amber-300"}>{currency(item.difference || 0)}</td><td><button className="rounded-lg border border-line p-2 hover:bg-white/5" title="Ver fechamento" onClick={() => setHistoryDetail(item)}><Eye size={16} /></button></td></tr>)}</tbody></table>{!history.length && <div className="grid min-h-36 place-items-center text-sm text-slate-500">Nenhum fechamento registrado neste período.</div>}</div></section>

    <Modal open={Boolean(mode)} onClose={() => setMode(null)} title={mode === "open" ? "Abrir caixa" : mode === "withdrawal" ? "Registrar sangria" : mode === "supply" ? "Registrar suprimento" : "Fechar caixa"} width={mode === "close" ? "max-w-3xl" : "max-w-lg"}>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); try { if (mode === "open") openCash(Number(amount)); else if (mode === "withdrawal") cashMovement("withdrawal", Number(amount), description); else if (mode === "supply") cashMovement("supply", Number(amount), description); else if (mode === "close") closeCash(Number(amount), expected, closeReason); toast.success(mode === "close" ? "Caixa fechado e resumo salvo." : "Movimentação registrada."); setMode(null); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível concluir."); } }}>
        {mode === "close" && <><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="panel-soft p-4"><p className="text-xs text-slate-400">Vendas</p><p className="mt-1 text-2xl font-black">{completedSales.length}</p><p className="text-xs text-slate-500">{currency(salesTotal)}</p></div><div className="panel-soft p-4"><p className="text-xs text-slate-400">Dinheiro esperado</p><p className="mt-1 text-2xl font-black text-lime">{currency(expected)}</p></div><div className="panel-soft p-4"><p className="text-xs text-slate-400">PIX + cartões</p><p className="mt-1 text-2xl font-black">{currency(electronicSales)}</p></div><div className="panel-soft p-4"><p className="text-xs text-slate-400">Cancel./excl.</p><p className="mt-1 text-2xl font-black text-amber-300">{cancelledCount} / {deletedCount}</p></div></div><div className="grid gap-2 sm:grid-cols-4"><div className="rounded-xl border border-line p-3"><p className="text-xs text-slate-500">Dinheiro</p><strong>{currency(payments.Dinheiro)}</strong></div><div className="rounded-xl border border-line p-3"><p className="text-xs text-slate-500">PIX</p><strong>{currency(payments.PIX)}</strong></div><div className="rounded-xl border border-line p-3"><p className="text-xs text-slate-500">Débito</p><strong>{currency(payments.Débito)}</strong></div><div className="rounded-xl border border-line p-3"><p className="text-xs text-slate-500">Crédito</p><strong>{currency(payments.Crédito)}</strong></div></div></>}
        <label><span className="mb-1.5 block text-sm font-semibold">{mode === "close" ? "Dinheiro contado na gaveta" : mode === "open" ? "Saldo inicial" : "Valor"}</span><NumberInput className="input h-14 text-xl font-black" min={0} step={0.01} required value={amount} onValueChange={setAmount} placeholder="0,00" /></label>
        {mode !== "open" && mode !== "close" && <label><span className="mb-1.5 block text-sm font-semibold">Descrição / motivo</span><input className="input" required value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex.: Depósito bancário" /></label>}
        {mode === "close" && <><div className={`rounded-xl border p-4 ${Math.abs(difference) < .01 ? "border-lime/30 bg-lime/10 text-lime" : "border-amber-500/30 bg-amber-500/10 text-amber-200"}`}><p className="text-xs opacity-75">Diferença entre contado e esperado</p><p className="mt-1 text-3xl font-black">{currency(difference)}</p></div>{Math.abs(difference) >= .01 && <label><span className="mb-1.5 block text-sm font-semibold">Justificativa obrigatória</span><input className="input" required value={closeReason} onChange={(event) => setCloseReason(event.target.value)} placeholder="Ex.: troco não lançado / conferência pendente" /></label>}</>}
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setMode(null)}>Cancelar</button><button className={mode === "close" ? "btn-primary" : "btn-lime"}>Confirmar</button></div>
      </form>
    </Modal>

    <Modal open={Boolean(historyDetail)} onClose={() => setHistoryDetail(null)} title="Detalhes do fechamento" width="max-w-3xl">{historyDetail && <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-4"><div className="panel-soft p-3"><p className="text-xs text-slate-500">Vendas</p><p className="text-xl font-black">{historyDetail.closingSummary?.salesCount || 0}</p></div><div className="panel-soft p-3"><p className="text-xs text-slate-500">Faturamento</p><p className="text-xl font-black text-lime">{currency(historyDetail.closingSummary?.grossSales || 0)}</p></div><div className="panel-soft p-3"><p className="text-xs text-slate-500">Esperado</p><p className="text-xl font-black">{currency(historyDetail.expectedAtClose || 0)}</p></div><div className="panel-soft p-3"><p className="text-xs text-slate-500">Diferença</p><p className="text-xl font-black text-amber-300">{currency(historyDetail.difference || 0)}</p></div></div><div className="table-wrap"><table className="table"><thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Operador</th><th>Valor</th></tr></thead><tbody>{historyDetail.movements.map((movement) => <tr key={movement.id}><td>{dateTime(movement.createdAt)}</td><td>{movement.type}</td><td>{movement.description}</td><td>{movement.operator}</td><td>{currency(movement.amount)}</td></tr>)}</tbody></table></div>{historyDetail.closeReason && <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100"><strong>Justificativa:</strong> {historyDetail.closeReason}</div>}<button className="btn-primary w-full" onClick={() => { try { printCashClosing(state.company.name, historyDetail); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível imprimir."); } }}><Printer size={17} /> Imprimir / Salvar PDF do fechamento</button></div>}</Modal>
  </>;
}
