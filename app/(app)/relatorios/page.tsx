"use client";

import { Banknote, BarChart3, Boxes, CalendarDays, Coffee, CreditCard, Download, FilterX, Printer, ReceiptText, Search, ShoppingBag, TrendingUp, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import type { PaymentMethod, Sale, SaleChannel } from "@/lib/types";
import { currency, dateTime } from "@/lib/utils";

const paymentOptions: (PaymentMethod | "Todos")[] = ["Todos", "Dinheiro", "PIX", "Débito", "Crédito", "Outro"];
const channelOptions: (SaleChannel | "Todos")[] = ["Todos", "Balcão", "iFood", "99Food"];

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function boundary(value: string, end = false) {
  if (!value) return undefined;
  const parsed = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.getTime();
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

function printReport(companyName: string, sales: Sale[], consumptionCost: number, periodText: string) {
  const popup = window.open("", "_blank", "width=1200,height=850");
  if (!popup) throw new Error("O navegador bloqueou a janela de relatório.");

  const revenue = sales.reduce((sum, sale) => sum + sale.total, 0);
  const discounts = sales.reduce((sum, sale) => sum + sale.discount, 0);
  const cost = sales.reduce((sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + Number(item.unitCost || 0) * item.quantity, 0), 0);
  const estimatedProfit = revenue - cost;
  const paymentTotals = new Map<string, number>();
  sales.forEach((sale) => sale.payments.forEach((line) => paymentTotals.set(line.method, (paymentTotals.get(line.method) || 0) + line.amount)));
  const paymentsHtml = Array.from(paymentTotals.entries()).map(([method, total]) => `<div class="card"><small>${method}</small><strong>${currency(total)}</strong></div>`).join("");
  const rows = sales.map((sale) => `<tr><td>#${sale.number}</td><td>${dateTime(sale.createdAt)}</td><td>${sale.operator}</td><td>${sale.channel}</td><td>${sale.items.reduce((sum, item) => sum + item.quantity, 0)}</td><td>${sale.payments.map((line) => line.method).join(", ")}</td><td style="text-align:right">${currency(sale.discount)}</td><td style="text-align:right"><strong>${currency(sale.total)}</strong></td></tr>`).join("");

  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Relatório gerencial de vendas</title><style>body{font-family:Arial,sans-serif;color:#111;padding:24px}h1{margin:0;font-size:24px}p{color:#666}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:18px 0}.card{border:1px solid #ddd;border-radius:10px;padding:12px}.card small{display:block;color:#666}.card strong{display:block;margin-top:4px;font-size:18px}.section{font-size:16px;margin:24px 0 8px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border-bottom:1px solid #ddd;padding:7px;text-align:left;vertical-align:top}th{background:#f3f4f6}button{margin:18px 0;padding:10px 16px}@media print{button{display:none}body{padding:0}@page{size:landscape;margin:10mm}}</style></head><body><h1>${companyName} · Relatório gerencial</h1><p>${periodText}</p><div class="cards"><div class="card"><small>Vendas concluídas</small><strong>${sales.length}</strong></div><div class="card"><small>Faturamento</small><strong>${currency(revenue)}</strong></div><div class="card"><small>CMV estimado</small><strong>${currency(cost)}</strong></div><div class="card"><small>Lucro bruto estimado</small><strong>${currency(estimatedProfit)}</strong></div><div class="card"><small>Ticket médio</small><strong>${currency(sales.length ? revenue / sales.length : 0)}</strong></div><div class="card"><small>Descontos</small><strong>${currency(discounts)}</strong></div><div class="card"><small>Consumo interno (custo)</small><strong>${currency(consumptionCost)}</strong></div>${paymentsHtml}</div><h2 class="section">Vendas do período</h2><table><thead><tr><th>Venda</th><th>Data</th><th>Operador</th><th>Canal</th><th>Itens</th><th>Pagamento</th><th>Desconto</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><button onclick="window.print()">Imprimir / Salvar em PDF</button><script>setTimeout(()=>window.print(),300)</script></body></html>`);
  popup.document.close();
}

export default function ReportsPage() {
  const { state } = useStore();
  const toast = useToast();
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const [dateFrom, setDateFrom] = useState(isoDate(monthStart));
  const [dateTo, setDateTo] = useState(isoDate(today));
  const [channel, setChannel] = useState<"Todos" | SaleChannel>("Todos");
  const [payment, setPayment] = useState<"Todos" | PaymentMethod>("Todos");
  const [operator, setOperator] = useState("Todos");
  const [query, setQuery] = useState("");

  const operators = useMemo(() => ["Todos", ...Array.from(new Set(state.sales.map((sale) => sale.operator).filter(Boolean))).sort((a, b) => a.localeCompare(b))], [state.sales]);
  const from = boundary(dateFrom, false);
  const to = boundary(dateTo, true);

  const periodSalesAllStatus = useMemo(() => state.sales.filter((sale) => {
    const at = new Date(sale.createdAt).getTime();
    return (from === undefined || at >= from) && (to === undefined || at <= to);
  }), [state.sales, from, to]);

  const sales = useMemo(() => {
    const q = query.trim().toLowerCase();
    return periodSalesAllStatus.filter((sale) => {
      if (sale.status !== "completed") return false;
      if (channel !== "Todos" && sale.channel !== channel) return false;
      if (payment !== "Todos" && !sale.payments.some((line) => line.method === payment)) return false;
      if (operator !== "Todos" && sale.operator !== operator) return false;
      if (q) {
        const customer = state.customers.find((item) => item.id === sale.customerId)?.name || "Consumidor final";
        const haystack = [sale.number, sale.operator, sale.channel, customer, ...sale.items.map((item) => item.name)].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [periodSalesAllStatus, channel, payment, operator, query, state.customers]);

  const activeConsumptions = useMemo(() => state.consumptions.filter((row) => {
    if (row.status !== "active") return false;
    const at = new Date(row.createdAt).getTime();
    return (from === undefined || at >= from) && (to === undefined || at <= to);
  }), [state.consumptions, from, to]);

  const revenue = sales.reduce((sum, sale) => sum + sale.total, 0);
  const discounts = sales.reduce((sum, sale) => sum + sale.discount, 0);
  const cost = sales.reduce((sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + Number(item.unitCost || 0) * item.quantity, 0), 0);
  const estimatedProfit = revenue - cost;
  const averageTicket = sales.length ? revenue / sales.length : 0;
  const cancelled = periodSalesAllStatus.filter((sale) => sale.status === "cancelled").length;
  const deleted = periodSalesAllStatus.filter((sale) => sale.status === "deleted").length;
  const consumptionCost = activeConsumptions.reduce((sum, row) => sum + row.totalCost, 0);
  const consumptionEquivalent = activeConsumptions.reduce((sum, row) => sum + row.saleEquivalent, 0);

  const payments = useMemo(() => {
    const result: Record<PaymentMethod, number> = { Dinheiro: 0, PIX: 0, Débito: 0, Crédito: 0, Outro: 0 };
    sales.forEach((sale) => sale.payments.forEach((line) => { result[line.method] = (result[line.method] || 0) + line.amount; }));
    return result;
  }, [sales]);

  const productRanking = useMemo(() => {
    const map = new Map<string, { quantity: number; revenue: number; cost: number }>();
    sales.forEach((sale) => sale.items.forEach((item) => {
      const current = map.get(item.name) || { quantity: 0, revenue: 0, cost: 0 };
      current.quantity += item.quantity;
      current.revenue += item.unitPrice * item.quantity;
      current.cost += Number(item.unitCost || 0) * item.quantity;
      map.set(item.name, current);
    }));
    return Array.from(map.entries()).sort((a, b) => b[1].quantity - a[1].quantity).slice(0, 12);
  }, [sales]);

  const byChannel = useMemo(() => (["Balcão", "iFood", "99Food"] as SaleChannel[]).map((name) => {
    const rows = sales.filter((sale) => sale.channel === name);
    return { name, count: rows.length, total: rows.reduce((sum, sale) => sum + sale.total, 0) };
  }), [sales]);

  const byOperator = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    sales.forEach((sale) => {
      const current = map.get(sale.operator) || { count: 0, total: 0 };
      current.count += 1;
      current.total += sale.total;
      map.set(sale.operator, current);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [sales]);

  const consumptionByEmployee = useMemo(() => Array.from(activeConsumptions.reduce((map, row) => {
    const current = map.get(row.employeeName) || { count: 0, cost: 0, equivalent: 0 };
    current.count += 1;
    current.cost += row.totalCost;
    current.equivalent += row.saleEquivalent;
    map.set(row.employeeName, current);
    return map;
  }, new Map<string, { count: number; cost: number; equivalent: number }>()).entries()).sort((a, b) => b[1].cost - a[1].cost), [activeConsumptions]);

  const setPreset = (preset: "today" | "7" | "30" | "month" | "all") => {
    if (preset === "all") { setDateFrom(""); setDateTo(""); return; }
    const end = new Date();
    const start = new Date(end);
    if (preset === "7") start.setDate(end.getDate() - 6);
    if (preset === "30") start.setDate(end.getDate() - 29);
    if (preset === "month") start.setDate(1);
    setDateFrom(isoDate(start));
    setDateTo(isoDate(end));
  };

  const clearFilters = () => {
    setDateFrom(""); setDateTo(""); setChannel("Todos"); setPayment("Todos"); setOperator("Todos"); setQuery("");
  };

  const periodText = `Período: ${dateFrom || "início"} até ${dateTo || "hoje"} · Canal: ${channel} · Pagamento: ${payment} · Operador: ${operator}`;

  const exportSales = () => downloadCsv(`relatorio-gerencial-bebs-${new Date().toISOString().slice(0, 10)}.csv`, [
    ["Venda", "Data", "Operador", "Canal", "Cliente", "Itens", "Pagamento", "Subtotal", "Desconto", "Total", "CMV estimado", "Lucro bruto estimado"],
    ...sales.map((sale) => {
      const saleCost = sale.items.reduce((sum, item) => sum + Number(item.unitCost || 0) * item.quantity, 0);
      return [sale.number, dateTime(sale.createdAt), sale.operator, sale.channel, state.customers.find((item) => item.id === sale.customerId)?.name || "Consumidor final", sale.items.map((item) => `${item.quantity}x ${item.name}`).join(" | "), sale.payments.map((line) => `${line.method}:${line.amount.toFixed(2)}`).join(" | "), sale.subtotal.toFixed(2), sale.discount.toFixed(2), sale.total.toFixed(2), saleCost.toFixed(2), (sale.total - saleCost).toFixed(2)];
    }),
  ]);

  return <>
    <PageHeader title="Relatórios de vendas" description="Visão gerencial filtrável. Tudo o que aparece aqui respeita o período e os filtros selecionados." actions={<div className="flex flex-wrap gap-2"><button className="btn-ghost" onClick={() => { try { printReport(state.company.name, sales, consumptionCost, periodText); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível gerar o relatório."); } }}><Printer size={18} /> PDF / Imprimir</button><button className="btn-primary" onClick={exportSales}><Download size={18} /> Exportar CSV</button></div>} />

    <section className="panel mb-6 p-4 md:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2"><span className="mr-1 inline-flex items-center gap-2 text-sm font-bold"><CalendarDays size={17} className="text-brand" /> Período:</span><button className="btn-ghost px-3 py-2" onClick={() => setPreset("today")}>Hoje</button><button className="btn-ghost px-3 py-2" onClick={() => setPreset("7")}>7 dias</button><button className="btn-ghost px-3 py-2" onClick={() => setPreset("30")}>30 dias</button><button className="btn-ghost px-3 py-2" onClick={() => setPreset("month")}>Este mês</button><button className="btn-ghost px-3 py-2" onClick={() => setPreset("all")}>Todo período</button></div>
      <div className="grid gap-3 lg:grid-cols-4">
        <div className="relative lg:col-span-2"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} /><input className="input pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Venda, produto, cliente ou operador" /></div>
        <label><span className="mb-1 block text-xs text-slate-500">De</span><input className="input" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
        <label><span className="mb-1 block text-xs text-slate-500">Até</span><input className="input" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
        <select className="select" value={channel} onChange={(event) => setChannel(event.target.value as typeof channel)}>{channelOptions.map((item) => <option key={item}>{item}</option>)}</select>
        <select className="select" value={payment} onChange={(event) => setPayment(event.target.value as typeof payment)}>{paymentOptions.map((item) => <option key={item}>{item}</option>)}</select>
        <select className="select" value={operator} onChange={(event) => setOperator(event.target.value)}>{operators.map((item) => <option key={item}>{item}</option>)}</select>
        <button className="btn-ghost" onClick={clearFilters}><FilterX size={17} /> Limpar filtros</button>
      </div>
    </section>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
      <StatCard label="Faturamento" value={currency(revenue)} icon={ReceiptText} tone="lime" />
      <StatCard label="Vendas" value={String(sales.length)} icon={ShoppingBag} />
      <StatCard label="Ticket médio" value={currency(averageTicket)} icon={BarChart3} tone="violet" />
      <StatCard label="CMV estimado" value={currency(cost)} icon={Boxes} tone="warning" />
      <StatCard label="Lucro bruto est." value={currency(estimatedProfit)} icon={TrendingUp} tone="lime" />
      <StatCard label="Cancel. / excl." value={`${cancelled} / ${deleted}`} icon={ReceiptText} tone="warning" />
    </div>

    <div className="mt-6 grid gap-6 xl:grid-cols-2">
      <section className="panel p-5"><div className="mb-4"><h2 className="section-title">Recebimentos por forma de pagamento</h2><p className="muted">Somente vendas concluídas do filtro atual.</p></div><div className="grid gap-3 sm:grid-cols-2"><div className="panel-soft flex items-center justify-between p-4"><span className="flex items-center gap-2"><Banknote size={18} /> Dinheiro</span><strong className="text-lime">{currency(payments.Dinheiro)}</strong></div><div className="panel-soft flex items-center justify-between p-4"><span className="flex items-center gap-2"><CreditCard size={18} /> PIX</span><strong>{currency(payments.PIX)}</strong></div><div className="panel-soft flex items-center justify-between p-4"><span className="flex items-center gap-2"><CreditCard size={18} /> Débito</span><strong>{currency(payments.Débito)}</strong></div><div className="panel-soft flex items-center justify-between p-4"><span className="flex items-center gap-2"><CreditCard size={18} /> Crédito</span><strong>{currency(payments.Crédito)}</strong></div></div><div className="mt-4 border-t border-line pt-4 text-sm"><div className="flex justify-between"><span className="text-slate-400">Descontos concedidos</span><strong className="text-amber-300">{currency(discounts)}</strong></div></div></section>
      <section className="panel p-5"><div className="mb-4"><h2 className="section-title">Desempenho por canal</h2><p className="muted">Balcão, iFood e 99Food no mesmo período.</p></div><div className="space-y-3">{byChannel.map((item) => <div key={item.name} className="panel-soft flex items-center justify-between p-4"><div><p className="font-bold">{item.name}</p><p className="text-xs text-slate-500">{item.count} venda(s)</p></div><strong className="text-xl text-lime">{currency(item.total)}</strong></div>)}</div></section>
    </div>

    <div className="mt-6 grid gap-6 xl:grid-cols-2">
      <section className="panel p-5"><div className="mb-4"><h2 className="section-title">Produtos mais vendidos</h2><p className="muted">Quantidade, faturamento bruto dos itens e custo histórico registrado.</p></div><div className="table-wrap"><table className="table"><thead><tr><th>#</th><th>Produto</th><th>Qtd.</th><th>Itens vendidos</th><th>Custo</th></tr></thead><tbody>{productRanking.map(([name, totals], index) => <tr key={name}><td className="font-black text-brand">{index + 1}</td><td className="font-semibold">{name}</td><td className="font-black">{totals.quantity}</td><td>{currency(totals.revenue)}</td><td>{currency(totals.cost)}</td></tr>)}</tbody></table>{!productRanking.length && <div className="grid min-h-36 place-items-center text-sm text-slate-500">Nenhuma venda no período.</div>}</div></section>
      <section className="panel p-5"><div className="mb-4"><h2 className="section-title">Por operador</h2><p className="muted">Vendas concluídas registradas para cada funcionário.</p></div><div className="table-wrap"><table className="table"><thead><tr><th>Operador</th><th>Vendas</th><th>Faturamento</th><th>Ticket médio</th></tr></thead><tbody>{byOperator.map(([name, totals]) => <tr key={name}><td className="font-bold">{name}</td><td>{totals.count}</td><td className="font-black text-lime">{currency(totals.total)}</td><td>{currency(totals.count ? totals.total / totals.count : 0)}</td></tr>)}</tbody></table>{!byOperator.length && <div className="grid min-h-36 place-items-center text-sm text-slate-500">Nenhum operador no período.</div>}</div></section>
    </div>

    <section className="panel mt-6 p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="section-title">Vendas detalhadas</h2><p className="muted">Tabela simples para conferência. Para canceladas e excluídas, use a tela Vendas, que mantém motivo e ações.</p></div><Download className="text-brand" size={21} /></div><div className="table-wrap"><table className="table"><thead><tr><th>Venda</th><th>Data</th><th>Operador</th><th>Canal</th><th>Cliente</th><th>Itens</th><th>Pagamento</th><th>Desconto</th><th>Total</th></tr></thead><tbody>{sales.map((sale) => <tr key={sale.id}><td className="font-black">#{sale.number}</td><td className="whitespace-nowrap">{dateTime(sale.createdAt)}</td><td>{sale.operator}</td><td><span className="badge">{sale.channel}</span></td><td>{state.customers.find((item) => item.id === sale.customerId)?.name || "Consumidor final"}</td><td>{sale.items.reduce((sum, item) => sum + item.quantity, 0)}</td><td className="text-xs text-slate-400">{sale.payments.map((line) => line.method).join(", ")}</td><td>{currency(sale.discount)}</td><td className="font-black text-lime">{currency(sale.total)}</td></tr>)}</tbody></table>{!sales.length && <div className="grid min-h-44 place-items-center text-sm text-slate-500">Nenhuma venda concluída com esses filtros.</div>}</div></section>

    <section className="panel mt-6 p-5"><div className="mb-4 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-400/10 text-amber-300"><Coffee size={20} /></div><div><h2 className="section-title">Consumo interno</h2><p className="muted">Separado do faturamento, usando o mesmo período selecionado.</p></div></div><div className="grid gap-3 sm:grid-cols-3"><div className="panel-soft p-4"><p className="text-xs text-slate-500">Lançamentos</p><p className="mt-1 text-2xl font-black">{activeConsumptions.length}</p></div><div className="panel-soft p-4"><p className="text-xs text-slate-500">Custo para a Beb's</p><p className="mt-1 text-2xl font-black text-amber-300">{currency(consumptionCost)}</p></div><div className="panel-soft p-4"><p className="text-xs text-slate-500">Venda equivalente</p><p className="mt-1 text-2xl font-black">{currency(consumptionEquivalent)}</p></div></div><div className="mt-4 table-wrap"><table className="table"><thead><tr><th>Funcionário</th><th>Lançamentos</th><th>Custo</th><th>Venda equivalente</th></tr></thead><tbody>{consumptionByEmployee.map(([name, totals]) => <tr key={name}><td className="font-bold">{name}</td><td>{totals.count}</td><td className="font-black text-amber-300">{currency(totals.cost)}</td><td>{currency(totals.equivalent)}</td></tr>)}</tbody></table>{!consumptionByEmployee.length && <div className="grid min-h-28 place-items-center text-sm text-slate-500">Nenhum consumo interno no período.</div>}</div></section>
  </>;
}
