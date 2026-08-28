"use client";

import { Ban, Download, Eye, ReceiptText, Search, ShoppingBag, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import type { Sale, SaleChannel } from "@/lib/types";
import { currency, dateTime } from "@/lib/utils";

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

export default function SalesPage() {
  const { state, cancelSale } = useStore();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "completed" | "cancelled">("all");
  const [channel, setChannel] = useState<"Todos" | SaleChannel>("Todos");
  const [detail, setDetail] = useState<Sale | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Sale | null>(null);
  const [reason, setReason] = useState("");

  const sales = useMemo(() => state.sales.filter((sale) => {
    if (status !== "all" && sale.status !== status) return false;
    if (channel !== "Todos" && sale.channel !== channel) return false;
    const customer = state.customers.find((c) => c.id === sale.customerId)?.name || "Consumidor final";
    const haystack = [sale.number, sale.channel, sale.externalId, customer, ...sale.items.map((i) => i.name)].join(" ").toLowerCase();
    return haystack.includes(query.toLowerCase());
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [state.sales, state.customers, status, channel, query]);

  const completed = state.sales.filter((sale) => sale.status === "completed");
  const revenue = completed.reduce((sum, sale) => sum + sale.total, 0);
  const average = completed.length ? revenue / completed.length : 0;
  const cancelled = state.sales.filter((sale) => sale.status === "cancelled").length;

  const exportRows = () => downloadCsv(`vendas-bebs-${new Date().toISOString().slice(0, 10)}.csv`, [
    ["Venda", "Data", "Canal", "Status", "Cliente", "Itens", "Subtotal", "Desconto", "Total", "Pagamento"],
    ...sales.map((sale) => [
      sale.number,
      dateTime(sale.createdAt),
      sale.channel,
      sale.status === "completed" ? "Concluída" : "Cancelada",
      state.customers.find((c) => c.id === sale.customerId)?.name || "Consumidor final",
      sale.items.map((item) => `${item.quantity}x ${item.name}`).join(" | "),
      sale.subtotal.toFixed(2),
      sale.discount.toFixed(2),
      sale.total.toFixed(2),
      sale.payments.map((p) => `${p.method}:${p.amount.toFixed(2)}`).join(" | "),
    ]),
  ]);

  return <>
    <PageHeader title="Vendas" description="Consulte, filtre, confira pagamentos e cancele vendas com estorno automático do estoque e do caixa." actions={<button className="btn-primary" onClick={exportRows}><Download size={18} /> Exportar CSV</button>} />

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Faturamento concluído" value={currency(revenue)} icon={ReceiptText} tone="lime" />
      <StatCard label="Vendas concluídas" value={String(completed.length)} icon={ShoppingBag} />
      <StatCard label="Ticket médio" value={currency(average)} icon={ReceiptText} tone="violet" />
      <StatCard label="Cancelamentos" value={String(cancelled)} icon={Ban} tone="warning" />
    </div>

    <section className="panel mt-6 p-4 md:p-5">
      <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_190px_190px]">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} /><input className="input pl-10" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar venda, cliente, produto ou pedido externo" /></div>
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}><option value="all">Todos os status</option><option value="completed">Concluídas</option><option value="cancelled">Canceladas</option></select>
        <select className="select" value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)}><option>Todos</option><option>Balcão</option><option>iFood</option><option>99Food</option></select>
      </div>

      <div className="table-wrap"><table className="table"><thead><tr><th>Venda</th><th>Data</th><th>Canal</th><th>Cliente</th><th>Itens</th><th>Pagamento</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>{sales.map((sale) => <tr key={sale.id}><td className="font-black">#{sale.number}</td><td>{dateTime(sale.createdAt)}</td><td><span className="badge">{sale.channel}</span></td><td>{state.customers.find((c) => c.id === sale.customerId)?.name || "Consumidor final"}</td><td>{sale.items.reduce((sum, item) => sum + item.quantity, 0)}</td><td className="text-xs text-slate-400">{sale.payments.map((p) => p.method).join(", ")}</td><td className="font-black text-lime">{currency(sale.total)}</td><td>{sale.status === "completed" ? <span className="badge border-lime/30 bg-lime/10 text-lime">Concluída</span> : <span className="badge border-red-500/30 bg-red-500/10 text-red-300">Cancelada</span>}</td><td><div className="flex gap-2"><button className="rounded-lg border border-line p-2 hover:bg-white/5" title="Ver detalhes" onClick={() => setDetail(sale)}><Eye size={16} /></button>{sale.status === "completed" && <button className="rounded-lg border border-red-500/30 p-2 text-red-300 hover:bg-red-500/10" title="Cancelar venda" onClick={() => { setCancelTarget(sale); setReason(""); }}><Undo2 size={16} /></button>}</div></td></tr>)}</tbody></table>{!sales.length && <div className="grid min-h-44 place-items-center text-sm text-slate-500">Nenhuma venda encontrada.</div>}</div>
    </section>

    <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title={detail ? `Venda #${detail.number}` : "Venda"} width="max-w-2xl">{detail && <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-3"><div className="panel-soft p-3"><p className="text-xs text-slate-500">Canal</p><p className="mt-1 font-bold">{detail.channel}</p></div><div className="panel-soft p-3"><p className="text-xs text-slate-500">Operador</p><p className="mt-1 font-bold">{detail.operator}</p></div><div className="panel-soft p-3"><p className="text-xs text-slate-500">Data</p><p className="mt-1 font-bold">{dateTime(detail.createdAt)}</p></div></div><div className="table-wrap"><table className="table"><thead><tr><th>Item</th><th>Qtd.</th><th>Unit.</th><th>Total</th></tr></thead><tbody>{detail.items.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.quantity}</td><td>{currency(item.unitPrice)}</td><td className="font-bold">{currency(item.unitPrice * item.quantity)}</td></tr>)}</tbody></table></div><div className="panel-soft space-y-2 p-4 text-sm"><div className="flex justify-between"><span className="text-slate-400">Subtotal</span><span>{currency(detail.subtotal)}</span></div><div className="flex justify-between"><span className="text-slate-400">Desconto</span><span>- {currency(detail.discount)}</span></div><div className="flex justify-between border-t border-line pt-2 text-lg font-black"><span>Total</span><span className="text-lime">{currency(detail.total)}</span></div></div><div><p className="mb-2 text-sm font-bold">Pagamentos</p><div className="grid gap-2 sm:grid-cols-2">{detail.payments.map((payment, index) => <div key={`${payment.method}-${index}`} className="panel-soft flex justify-between p-3 text-sm"><span>{payment.method}</span><strong>{currency(payment.amount)}</strong></div>)}</div></div></div>}</Modal>

    <Modal open={Boolean(cancelTarget)} onClose={() => setCancelTarget(null)} title="Cancelar venda" width="max-w-lg">{cancelTarget && <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); try { cancelSale(cancelTarget.id, reason); toast.success(`Venda #${cancelTarget.number} cancelada. Estoque, financeiro e caixa foram estornados.`); setCancelTarget(null); setDetail(null); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível cancelar."); } }}><div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">O cancelamento devolve os itens ao estoque e remove os lançamentos associados a esta venda. A ação fica registrada na auditoria.</div><label><span className="mb-1.5 block text-sm font-semibold">Motivo obrigatório</span><textarea className="input min-h-24 resize-none" required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: cliente desistiu, lançamento duplicado, erro do operador..." /></label><div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setCancelTarget(null)}>Voltar</button><button className="btn-danger"><Undo2 size={17} /> Confirmar cancelamento</button></div></form>}</Modal>
  </>;
}
