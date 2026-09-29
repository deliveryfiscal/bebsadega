"use client";

import { Ban, CalendarDays, Download, Eye, FileText, FilterX, Printer, ReceiptText, Search, ShoppingBag, Trash2, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { NumberInput } from "@/components/ui/number-input";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import type { PaymentMethod, Sale, SaleChannel, SaleStatus } from "@/lib/types";
import { currency, dateTime } from "@/lib/utils";

const paymentOptions: (PaymentMethod | "Todos")[] = ["Todos", "Dinheiro", "PIX", "Débito", "Crédito", "Outro"];
const channelOptions: (SaleChannel | "Todos")[] = ["Todos", "Balcão", "iFood", "99Food"];

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateBoundary(value: string, end = false) {
  if (!value) return undefined;
  const date = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(date.getTime()) ? undefined : date.getTime();
}

function downloadCsv(name: string, rows: (string | number)[][]) {
  const content = "\ufeff" + rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(";")).join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function statusLabel(status: SaleStatus) {
  if (status === "completed") return "Concluída";
  if (status === "cancelled") return "Cancelada";
  return "Excluída";
}

function printReceipt(sale: Sale, customerName: string, companyName: string) {
  const popup = window.open("", "_blank", "width=420,height=720");
  if (!popup) throw new Error("O navegador bloqueou a janela de impressão.");
  const items = sale.items.map((item) => `<tr><td>${item.quantity}x ${item.name}</td><td style="text-align:right">${currency(item.unitPrice * item.quantity)}</td></tr>`).join("");
  const payments = sale.payments.map((payment) => `<div style="display:flex;justify-content:space-between"><span>${payment.method}</span><strong>${currency(payment.amount)}</strong></div>`).join("");
  popup.document.write(`<!doctype html><html><head><title>Venda #${sale.number}</title><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;width:76mm;margin:0 auto;padding:8mm 2mm;color:#000}h1{font-size:18px;margin:0 0 4px;text-align:center}p{font-size:12px;margin:3px 0}.muted{color:#555}.rule{border-top:1px dashed #000;margin:8px 0}table{width:100%;font-size:12px;border-collapse:collapse}td{padding:3px 0;vertical-align:top}.total{font-size:18px;font-weight:800;display:flex;justify-content:space-between}button{margin-top:14px;width:100%;padding:8px}@media print{button{display:none}}</style></head><body><h1>${companyName}</h1><p style="text-align:center">Comprovante não fiscal</p><div class="rule"></div><p><strong>Venda #${sale.number}</strong></p><p class="muted">${dateTime(sale.createdAt)} · ${sale.channel}</p><p class="muted">Cliente: ${customerName}</p><div class="rule"></div><table>${items}</table><div class="rule"></div><div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>${currency(sale.subtotal)}</span></div><div style="display:flex;justify-content:space-between"><span>Desconto</span><span>-${currency(sale.discount)}</span></div><div class="total"><span>Total</span><span>${currency(sale.total)}</span></div><div class="rule"></div>${payments}<div class="rule"></div><p class="muted">Operador: ${sale.operator}</p>${sale.status !== "completed" ? `<p><strong>${statusLabel(sale.status).toUpperCase()}</strong> · ${sale.cancelReason || sale.deleteReason || "Sem motivo informado"}</p>` : ""}<button onclick="window.print()">Imprimir</button><script>setTimeout(()=>window.print(),250)</script></body></html>`);
  popup.document.close();
}

function printSalesReport(companyName: string, sales: Sale[], customerName: (sale: Sale) => string, filtersDescription: string) {
  const popup = window.open("", "_blank", "width=1100,height=800");
  if (!popup) throw new Error("O navegador bloqueou a janela de relatório.");
  const completed = sales.filter((sale) => sale.status === "completed");
  const total = completed.reduce((sum, sale) => sum + sale.total, 0);
  const discount = completed.reduce((sum, sale) => sum + sale.discount, 0);
  const rows = sales.map((sale) => `<tr><td>#${sale.number}</td><td>${dateTime(sale.createdAt)}</td><td>${sale.channel}</td><td>${sale.operator}</td><td>${customerName(sale)}</td><td>${sale.items.reduce((sum, item) => sum + item.quantity, 0)}</td><td>${sale.payments.map((p) => p.method).join(", ")}</td><td style="text-align:right">${currency(sale.total)}</td><td>${statusLabel(sale.status)}</td></tr>`).join("");
  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Relatório de vendas</title><style>body{font-family:Arial,sans-serif;color:#111;padding:24px}h1{margin:0;font-size:24px}p{color:#555}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:18px 0}.card{border:1px solid #ddd;border-radius:10px;padding:12px}.card small{color:#666}.card strong{display:block;font-size:20px;margin-top:4px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border-bottom:1px solid #ddd;padding:7px;text-align:left;vertical-align:top}th{background:#f4f4f4}button{margin:18px 0;padding:10px 16px}@media print{button{display:none}body{padding:0}@page{size:landscape;margin:10mm}}</style></head><body><h1>${companyName} · Relatório de vendas</h1><p>${filtersDescription}</p><div class="cards"><div class="card"><small>Vendas concluídas</small><strong>${completed.length}</strong></div><div class="card"><small>Faturamento</small><strong>${currency(total)}</strong></div><div class="card"><small>Descontos</small><strong>${currency(discount)}</strong></div><div class="card"><small>Ticket médio</small><strong>${currency(completed.length ? total / completed.length : 0)}</strong></div></div><table><thead><tr><th>Venda</th><th>Data</th><th>Canal</th><th>Operador</th><th>Cliente</th><th>Itens</th><th>Pagamento</th><th>Total</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table><button onclick="window.print()">Imprimir / Salvar em PDF</button><script>setTimeout(()=>window.print(),300)</script></body></html>`);
  popup.document.close();
}

export default function SalesPage() {
  const { state, cancelSale, deleteSale } = useStore();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | SaleStatus>("all");
  const [channel, setChannel] = useState<"Todos" | SaleChannel>("Todos");
  const [payment, setPayment] = useState<"Todos" | PaymentMethod>("Todos");
  const [operator, setOperator] = useState("Todos");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minTotal, setMinTotal] = useState(0);
  const [maxTotal, setMaxTotal] = useState(0);
  const [detail, setDetail] = useState<Sale | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Sale | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Sale | null>(null);
  const [reason, setReason] = useState("");

  const operators = useMemo(() => ["Todos", ...Array.from(new Set(state.sales.map((sale) => sale.operator).filter(Boolean))).sort((a, b) => a.localeCompare(b))], [state.sales]);
  const customerName = (sale: Sale) => state.customers.find((customer) => customer.id === sale.customerId)?.name || "Consumidor final";

  const sales = useMemo(() => {
    const from = dateBoundary(dateFrom, false);
    const to = dateBoundary(dateTo, true);
    const q = query.trim().toLowerCase();
    return state.sales.filter((sale) => {
      if (status !== "all" && sale.status !== status) return false;
      if (channel !== "Todos" && sale.channel !== channel) return false;
      if (payment !== "Todos" && !sale.payments.some((line) => line.method === payment)) return false;
      if (operator !== "Todos" && sale.operator !== operator) return false;
      const at = new Date(sale.createdAt).getTime();
      if (from !== undefined && at < from) return false;
      if (to !== undefined && at > to) return false;
      if (minTotal > 0 && sale.total < minTotal) return false;
      if (maxTotal > 0 && sale.total > maxTotal) return false;
      if (q) {
        const customer = state.customers.find((c) => c.id === sale.customerId)?.name || "Consumidor final";
        const haystack = [sale.number, sale.channel, sale.externalId, sale.operator, customer, sale.cancelReason, sale.deleteReason, ...sale.items.map((item) => item.name)].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [state.sales, state.customers, status, channel, payment, operator, dateFrom, dateTo, minTotal, maxTotal, query]);

  const completed = sales.filter((sale) => sale.status === "completed");
  const revenue = completed.reduce((sum, sale) => sum + sale.total, 0);
  const discounts = completed.reduce((sum, sale) => sum + sale.discount, 0);
  const average = completed.length ? revenue / completed.length : 0;
  const cancelled = sales.filter((sale) => sale.status === "cancelled").length;
  const deleted = sales.filter((sale) => sale.status === "deleted").length;

  const setPreset = (preset: "today" | "7" | "30" | "month" | "all") => {
    if (preset === "all") { setDateFrom(""); setDateTo(""); return; }
    const today = new Date();
    const start = new Date(today);
    if (preset === "7") start.setDate(today.getDate() - 6);
    if (preset === "30") start.setDate(today.getDate() - 29);
    if (preset === "month") start.setDate(1);
    setDateFrom(isoDate(start));
    setDateTo(isoDate(today));
  };

  const clearFilters = () => {
    setQuery(""); setStatus("all"); setChannel("Todos"); setPayment("Todos"); setOperator("Todos"); setDateFrom(""); setDateTo(""); setMinTotal(0); setMaxTotal(0);
  };

  const exportRows = () => downloadCsv(`vendas-bebs-${new Date().toISOString().slice(0, 10)}.csv`, [
    ["Venda", "Data", "Canal", "Operador", "Status", "Cliente", "Itens", "Subtotal", "Desconto", "Total", "Pagamento", "Motivo cancelamento/exclusão"],
    ...sales.map((sale) => [
      sale.number,
      dateTime(sale.createdAt),
      sale.channel,
      sale.operator,
      statusLabel(sale.status),
      customerName(sale),
      sale.items.map((item) => `${item.quantity}x ${item.name}`).join(" | "),
      sale.subtotal.toFixed(2),
      sale.discount.toFixed(2),
      sale.total.toFixed(2),
      sale.payments.map((p) => `${p.method}:${p.amount.toFixed(2)}`).join(" | "),
      sale.cancelReason || sale.deleteReason || "",
    ]),
  ]);

  const filtersDescription = `Período: ${dateFrom || "início"} até ${dateTo || "hoje"} · Status: ${status === "all" ? "Todos" : statusLabel(status)} · Canal: ${channel} · Pagamento: ${payment} · Operador: ${operator}`;

  return <>
    <PageHeader title="Vendas · Controle completo" description="Filtre por período, pagamento, operador, canal e valor. Exporte o mesmo recorte que está vendo na tela." actions={<div className="flex flex-wrap gap-2"><button className="btn-ghost" onClick={() => { try { printSalesReport(state.company.name, sales, customerName, filtersDescription); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível gerar o relatório."); } }}><FileText size={18} /> PDF / Imprimir</button><button className="btn-primary" onClick={exportRows}><Download size={18} /> Exportar CSV</button></div>} />

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <StatCard label="Faturamento filtrado" value={currency(revenue)} icon={ReceiptText} tone="lime" />
      <StatCard label="Vendas concluídas" value={String(completed.length)} icon={ShoppingBag} />
      <StatCard label="Ticket médio" value={currency(average)} icon={ReceiptText} tone="violet" />
      <StatCard label="Descontos" value={currency(discounts)} icon={ReceiptText} tone="warning" />
      <StatCard label="Canceladas / excluídas" value={`${cancelled} / ${deleted}`} icon={Ban} tone="warning" />
    </div>

    <section className="panel mt-6 p-4 md:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2"><span className="mr-1 inline-flex items-center gap-2 text-sm font-bold"><CalendarDays size={17} className="text-brand" /> Período rápido:</span><button className="btn-ghost px-3 py-2" onClick={() => setPreset("today")}>Hoje</button><button className="btn-ghost px-3 py-2" onClick={() => setPreset("7")}>7 dias</button><button className="btn-ghost px-3 py-2" onClick={() => setPreset("30")}>30 dias</button><button className="btn-ghost px-3 py-2" onClick={() => setPreset("month")}>Este mês</button><button className="btn-ghost px-3 py-2" onClick={() => setPreset("all")}>Todo período</button></div>

      <div className="grid gap-3 lg:grid-cols-4">
        <div className="relative lg:col-span-2"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} /><input className="input pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Venda, cliente, produto, operador ou motivo" /></div>
        <label><span className="mb-1 block text-xs text-slate-500">De</span><input type="date" className="input" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
        <label><span className="mb-1 block text-xs text-slate-500">Até</span><input type="date" className="input" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
        <select className="select" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="all">Todos os status</option><option value="completed">Concluídas</option><option value="cancelled">Canceladas</option><option value="deleted">Excluídas</option></select>
        <select className="select" value={channel} onChange={(event) => setChannel(event.target.value as typeof channel)}>{channelOptions.map((item) => <option key={item}>{item}</option>)}</select>
        <select className="select" value={payment} onChange={(event) => setPayment(event.target.value as typeof payment)}>{paymentOptions.map((item) => <option key={item}>{item}</option>)}</select>
        <select className="select" value={operator} onChange={(event) => setOperator(event.target.value)}>{operators.map((item) => <option key={item}>{item}</option>)}</select>
        <label><span className="mb-1 block text-xs text-slate-500">Total mínimo</span><NumberInput className="input" min={0} step={0.01} value={minTotal} onValueChange={setMinTotal} placeholder="0,00" /></label>
        <label><span className="mb-1 block text-xs text-slate-500">Total máximo</span><NumberInput className="input" min={0} step={0.01} value={maxTotal} onValueChange={setMaxTotal} placeholder="Sem limite" /></label>
        <button className="btn-ghost self-end" onClick={clearFilters}><FilterX size={17} /> Limpar filtros</button>
        <div className="self-end text-right text-xs text-slate-500">{sales.length} registro(s) no filtro</div>
      </div>
    </section>

    <section className="panel mt-4 p-4 md:p-5">
      <div className="table-wrap"><table className="table"><thead><tr><th>Venda</th><th>Data / hora</th><th>Operador</th><th>Canal</th><th>Cliente</th><th>Itens</th><th>Pagamento</th><th>Desconto</th><th>Total</th><th>Status</th><th>Ações</th></tr></thead><tbody>{sales.map((sale) => <tr key={sale.id} className={sale.status === "deleted" ? "opacity-60" : ""}><td className="font-black">#{sale.number}</td><td className="whitespace-nowrap">{dateTime(sale.createdAt)}</td><td>{sale.operator}</td><td><span className="badge">{sale.channel}</span></td><td>{customerName(sale)}</td><td>{sale.items.reduce((sum, item) => sum + item.quantity, 0)}</td><td className="text-xs text-slate-400">{sale.payments.map((p) => p.method).join(", ")}</td><td>{currency(sale.discount)}</td><td className="font-black text-lime">{currency(sale.total)}</td><td>{sale.status === "completed" ? <span className="badge border-lime/30 bg-lime/10 text-lime">Concluída</span> : sale.status === "cancelled" ? <span className="badge border-amber-500/30 bg-amber-500/10 text-amber-200">Cancelada</span> : <span className="badge border-red-500/30 bg-red-500/10 text-red-300">Excluída</span>}</td><td><div className="flex gap-1"><button className="rounded-lg border border-line p-2 hover:bg-white/5" title="Ver detalhes" onClick={() => setDetail(sale)}><Eye size={16} /></button>{sale.status === "completed" && <button className="rounded-lg border border-amber-500/30 p-2 text-amber-300 hover:bg-amber-500/10" title="Cancelar / estornar venda" onClick={() => { setCancelTarget(sale); setReason(""); }}><Undo2 size={16} /></button>}{sale.status !== "deleted" && <button className="rounded-lg border border-red-500/30 p-2 text-red-300 hover:bg-red-500/10" title="Excluir venda mantendo auditoria" onClick={() => { setDeleteTarget(sale); setReason(""); }}><Trash2 size={16} /></button>}</div></td></tr>)}</tbody></table>{!sales.length && <div className="grid min-h-44 place-items-center text-sm text-slate-500">Nenhuma venda encontrada com esses filtros.</div>}</div>
    </section>

    <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title={detail ? `Venda #${detail.number}` : "Venda"} width="max-w-3xl">{detail && <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-4"><div className="panel-soft p-3"><p className="text-xs text-slate-500">Canal</p><p className="mt-1 font-bold">{detail.channel}</p></div><div className="panel-soft p-3"><p className="text-xs text-slate-500">Operador</p><p className="mt-1 font-bold">{detail.operator}</p></div><div className="panel-soft p-3"><p className="text-xs text-slate-500">Cliente</p><p className="mt-1 font-bold">{customerName(detail)}</p></div><div className="panel-soft p-3"><p className="text-xs text-slate-500">Data</p><p className="mt-1 font-bold">{dateTime(detail.createdAt)}</p></div></div><div className="table-wrap"><table className="table"><thead><tr><th>Item</th><th>Qtd.</th><th>Unit.</th><th>Total</th></tr></thead><tbody>{detail.items.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.quantity}</td><td>{currency(item.unitPrice)}</td><td className="font-bold">{currency(item.unitPrice * item.quantity)}</td></tr>)}</tbody></table></div><div className="panel-soft space-y-2 p-4 text-sm"><div className="flex justify-between"><span className="text-slate-400">Subtotal</span><span>{currency(detail.subtotal)}</span></div><div className="flex justify-between"><span className="text-slate-400">Desconto</span><span>- {currency(detail.discount)}</span></div><div className="flex justify-between border-t border-line pt-2 text-lg font-black"><span>Total</span><span className="text-lime">{currency(detail.total)}</span></div></div><div><p className="mb-2 text-sm font-bold">Pagamentos</p><div className="grid gap-2 sm:grid-cols-2">{detail.payments.map((paymentLine, index) => <div key={`${paymentLine.method}-${index}`} className="panel-soft flex justify-between p-3 text-sm"><span>{paymentLine.method}</span><strong>{currency(paymentLine.amount)}</strong></div>)}</div></div>{detail.status === "cancelled" && <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100"><strong>Cancelada:</strong> {detail.cancelReason || "Motivo não informado"}</div>}{detail.status === "deleted" && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100"><strong>Excluída por {detail.deletedBy || "operador"}:</strong> {detail.deleteReason || "Motivo não informado"}</div>}<button className="btn-ghost w-full" onClick={() => { try { printReceipt(detail, customerName(detail), state.company.name); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível imprimir."); } }}><Printer size={17} /> Imprimir / reimprimir comprovante</button></div>}</Modal>

    <Modal open={Boolean(cancelTarget)} onClose={() => setCancelTarget(null)} title="Cancelar / estornar venda" width="max-w-lg">{cancelTarget && <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); try { cancelSale(cancelTarget.id, reason); toast.success(`Venda #${cancelTarget.number} cancelada. Estoque, financeiro e caixa foram estornados.`); setCancelTarget(null); setDetail(null); setReason(""); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível cancelar."); } }}><div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">O cancelamento mantém a venda visível como <strong>Cancelada</strong> e devolve estoque / ml, além de retirar financeiro e dinheiro da gaveta quando aplicável.</div><div><span className="mb-2 block text-sm font-semibold">Motivo obrigatório</span><div className="mb-3 flex flex-wrap gap-2">{["Cliente desistiu", "Erro de pagamento", "Lançamento duplicado", "Produto lançado errado"].map((item) => <button key={item} type="button" className={reason === item ? "btn-primary px-3 py-2" : "btn-ghost px-3 py-2"} onClick={() => setReason(item)}>{item}</button>)}</div><textarea className="input min-h-20 resize-none" required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ou escreva outro motivo..." /></div><div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setCancelTarget(null)}>Voltar</button><button className="btn-primary"><Undo2 size={17} /> Confirmar cancelamento</button></div></form>}</Modal>

    <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Excluir venda" width="max-w-lg">{deleteTarget && <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); try { deleteSale(deleteTarget.id, reason); toast.success(`Venda #${deleteTarget.number} excluída. O motivo ficou registrado na auditoria.`); setDeleteTarget(null); setDetail(null); setReason(""); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível excluir."); } }}><div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100"><strong>Exclusão segura.</strong><p className="mt-1 text-red-200/80">A venda deixa de entrar nos totais e fica marcada como Excluída. Se ainda estava concluída, estoque, financeiro e caixa são estornados. O registro e o motivo permanecem para auditoria.</p></div><label><span className="mb-1.5 block text-sm font-semibold">Motivo obrigatório</span><textarea className="input min-h-24 resize-none" required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ex.: venda duplicada / lançamento de teste / erro operacional" /></label><div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setDeleteTarget(null)}>Voltar</button><button className="btn-danger"><Trash2 size={17} /> Excluir venda</button></div></form>}</Modal>
  </>;
}
