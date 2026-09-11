"use client";

import { Cake, Crown, Edit3, MessageCircle, Plus, Search, ShoppingBag, UserRound, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { NumberInput } from "@/components/ui/number-input";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { useToast } from "@/components/ui/toast";
import { customerStats, normalizePhone } from "@/lib/business";
import { useStore } from "@/lib/store";
import type { Customer } from "@/lib/types";
import { currency, dateOnly } from "@/lib/utils";

const emptyForm = { name: "", phone: "", email: "", cpf: "", birthDate: "", notes: "", tags: "", cashback: 0, consentMarketing: false };

export default function CustomersPage() {
  const { state, addCustomer, updateCustomer } = useStore();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState("Todos");
  const [selectedId, setSelectedId] = useState(state.customers[0]?.id || "");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyForm);

  const withStats = useMemo(() => state.customers.map((customer) => ({ customer, stats: customerStats(state, customer.id) })), [state]);
  const customers = useMemo(() => withStats.filter(({ customer, stats }) => {
    const normalized = normalizePhone(query);
    const matches = [customer.name, customer.phone, customer.email, customer.cpf, ...(customer.tags || [])].join(" ").toLowerCase().includes(query.toLowerCase()) || (normalized && normalizePhone(customer.phone).includes(normalized));
    if (!matches) return false;
    if (segment === "VIP" && !((customer.tags || []).includes("VIP") || stats.spent >= 500)) return false;
    if (segment === "Com compras" && !stats.salesCount) return false;
    if (segment === "Inativos" && (!stats.lastPurchase || Date.now() - new Date(stats.lastPurchase).getTime() < 30 * 86400000)) return false;
    if (segment === "Marketing" && !customer.consentMarketing) return false;
    return true;
  }), [withStats, query, segment]);
  const selected = state.customers.find((customer) => customer.id === selectedId) || customers[0]?.customer || null;
  const selectedStats = selected ? customerStats(state, selected.id) : null;
  const selectedSales = selected ? state.sales.filter((sale) => sale.customerId === selected.id && sale.status === "completed").sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10) : [];
  const topCustomer = [...withStats].sort((a, b) => b.stats.spent - a.stats.spent)[0];
  const inactiveCount = withStats.filter(({ stats }) => stats.lastPurchase && Date.now() - new Date(stats.lastPurchase).getTime() >= 30 * 86400000).length;

  const openForm = (customer?: Customer) => {
    const target = customer || null;
    setEditing(target);
    setForm(target ? { name: target.name, phone: target.phone, email: target.email || "", cpf: target.cpf || "", birthDate: target.birthDate || "", notes: target.notes || "", tags: (target.tags || []).join(", "), cashback: target.cashback || 0, consentMarketing: target.consentMarketing } : emptyForm);
    setOpen(true);
  };

  return <>
    <PageHeader title="Clientes · CRM" description="Cadastro rápido no balcão e inteligência automática depois. O caixa não precisa preencher ficha longa." actions={<button className="btn-primary" onClick={() => openForm()}><Plus size={18} /> Novo cliente</button>} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Clientes" value={String(state.customers.length)} icon={Users} /><StatCard label="Com compras" value={String(withStats.filter(({ stats }) => stats.salesCount > 0).length)} icon={ShoppingBag} tone="lime" /><StatCard label="Cliente destaque" value={topCustomer?.customer.name || "—"} hint={topCustomer ? currency(topCustomer.stats.spent) : "Sem histórico"} icon={Crown} tone="warning" /><StatCard label="Inativos 30+ dias" value={String(inactiveCount)} icon={MessageCircle} tone="violet" /></div>

    <div className="mt-6 grid gap-6 xl:grid-cols-[400px_1fr]">
      <section className="panel overflow-hidden"><div className="space-y-3 border-b border-line p-4"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} /><input className="input pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome ou telefone" /></div><select className="select" value={segment} onChange={(event) => setSegment(event.target.value)}><option>Todos</option><option>Com compras</option><option>VIP</option><option>Inativos</option><option>Marketing</option></select></div><div className="max-h-[680px] overflow-auto p-2">{customers.map(({ customer, stats }) => <button key={customer.id} onClick={() => setSelectedId(customer.id)} className={`mb-1 w-full rounded-xl p-3 text-left transition ${selected?.id === customer.id ? "bg-brand text-white" : "hover:bg-white/5"}`}><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold">{customer.name}</p><p className={selected?.id === customer.id ? "text-xs text-white/70" : "text-xs text-slate-500"}>{customer.phone}</p></div><div className="text-right"><p className={`text-sm font-black ${selected?.id === customer.id ? "text-white" : "text-lime"}`}>{currency(stats.spent)}</p><p className={selected?.id === customer.id ? "text-[11px] text-white/60" : "text-[11px] text-slate-500"}>{stats.salesCount} compras</p></div></div></button>)}</div></section>

      <section className="space-y-5">{selected && selectedStats ? <><div className="panel p-5"><div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-full bg-brand/10 text-brand"><UserRound size={23} /></div><div><h2 className="text-xl font-black">{selected.name}</h2><p className="text-sm text-slate-500">{selected.phone}</p></div></div><button className="btn-ghost" onClick={() => openForm(selected)}><Edit3 size={17} /> Editar</button></div><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="panel-soft p-4"><p className="text-xs text-slate-500">Total gasto</p><p className="mt-1 text-xl font-black text-lime">{currency(selectedStats.spent)}</p></div><div className="panel-soft p-4"><p className="text-xs text-slate-500">Ticket médio</p><p className="mt-1 text-xl font-black">{currency(selectedStats.averageTicket)}</p></div><div className="panel-soft p-4"><p className="text-xs text-slate-500">Última compra</p><p className="mt-1 text-sm font-black">{selectedStats.lastPurchase ? dateOnly(selectedStats.lastPurchase) : "—"}</p></div><div className="panel-soft p-4"><p className="text-xs text-slate-500">Cashback</p><p className="mt-1 text-xl font-black text-brand">{currency(selected.cashback || 0)}</p></div></div><div className="mt-4 grid gap-3 md:grid-cols-2"><div className="panel-soft p-4"><p className="text-xs text-slate-500">Produto favorito</p><p className="mt-1 font-bold">{selectedStats.favoriteProduct}</p></div><div className="panel-soft p-4"><p className="text-xs text-slate-500">Tags</p><div className="mt-2 flex flex-wrap gap-2">{(selected.tags || []).length ? selected.tags?.map((tag) => <span key={tag} className="badge">{tag}</span>) : <span className="text-sm text-slate-500">Sem tags</span>}</div></div></div></div>
        <section className="panel p-5"><h2 className="section-title">Histórico de compras</h2><p className="muted">O CRM é alimentado automaticamente pelas vendas vinculadas.</p><div className="mt-4 space-y-2">{selectedSales.map((sale) => <div key={sale.id} className="panel-soft flex items-center justify-between gap-3 p-3"><div><p className="font-semibold">Venda #{sale.number}</p><p className="text-xs text-slate-500">{dateOnly(sale.createdAt)} · {sale.channel} · {sale.items.reduce((sum, item) => sum + item.quantity, 0)} itens</p></div><strong className="text-lime">{currency(sale.total)}</strong></div>)}{!selectedSales.length && <div className="grid min-h-36 place-items-center text-sm text-slate-500">Nenhuma compra vinculada.</div>}</div></section></> : <div className="panel grid min-h-80 place-items-center text-slate-500">Selecione um cliente.</div>}</section>
    </div>

    <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Editar cliente" : "Novo cliente"} width="max-w-2xl"><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); const payload = { name: form.name, phone: form.phone, email: form.email || undefined, cpf: form.cpf || undefined, birthDate: form.birthDate || undefined, notes: form.notes || undefined, tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean), cashback: Number(form.cashback) || 0, consentMarketing: form.consentMarketing }; try { if (editing) updateCustomer(editing.id, payload); else { const customer = addCustomer(payload); setSelectedId(customer.id); } toast.success(editing ? "Cliente atualizado." : "Cliente cadastrado."); setOpen(false); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar."); } }}><div className="rounded-xl border border-line bg-white/[0.03] p-3 text-xs text-slate-400">No balcão, <strong className="text-white">nome e telefone</strong> bastam. Complete os demais dados quando fizer sentido.</div><div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-1.5 block text-sm font-semibold">Nome</span><input className="input" autoFocus required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label><span className="mb-1.5 block text-sm font-semibold">Telefone</span><input className="input" required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><label><span className="mb-1.5 block text-sm font-semibold">E-mail</span><input className="input" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label><span className="mb-1.5 block text-sm font-semibold">CPF</span><input className="input" value={form.cpf} onChange={(event) => setForm({ ...form, cpf: event.target.value })} /></label><label><span className="mb-1.5 flex items-center gap-2 text-sm font-semibold"><Cake size={15} /> Nascimento</span><input className="input" type="date" value={form.birthDate} onChange={(event) => setForm({ ...form, birthDate: event.target.value })} /></label><label><span className="mb-1.5 block text-sm font-semibold">Cashback</span><NumberInput className="input" min={0} step={0.01} value={form.cashback} onValueChange={(value) => setForm({ ...form, cashback: value })} placeholder="0,00" /></label></div><label><span className="mb-1.5 block text-sm font-semibold">Tags separadas por vírgula</span><input className="input" value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="VIP, Whisky, Sexta-feira" /></label><label><span className="mb-1.5 block text-sm font-semibold">Observações</span><textarea className="input min-h-24" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label><label className="flex items-center gap-2 rounded-xl border border-line p-3"><input type="checkbox" checked={form.consentMarketing} onChange={(event) => setForm({ ...form, consentMarketing: event.target.checked })} /> <span className="text-sm">Cliente autorizou comunicações promocionais</span></label><button className="btn-primary w-full">Salvar cliente</button></form></Modal>
  </>;
}
