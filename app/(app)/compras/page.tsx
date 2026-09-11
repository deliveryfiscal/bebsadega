"use client";

import { Building2, CheckCircle2, PackageCheck, Plus, Search, ShoppingCart } from "lucide-react";
import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { NumberInput } from "@/components/ui/number-input";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { useToast } from "@/components/ui/toast";
import { isDoseShortcut } from "@/lib/business";
import { useStore } from "@/lib/store";
import type { PurchaseItem, Supplier } from "@/lib/types";
import { currency, dateTime } from "@/lib/utils";

export default function PurchasesPage() {
  const { state, saveSupplier, createPurchase, receivePurchase } = useStore();
  const toast = useToast();
  const [tab, setTab] = useState<"compras" | "fornecedores">("compras");
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState<Partial<Supplier>>({ name: "", phone: "", contactName: "", paymentTerms: "" });
  const [supplierId, setSupplierId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<PurchaseItem[]>([]);

  const productResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return state.products.filter((product) => product.kind !== "combo" && !isDoseShortcut(product) && product.active && [product.name, product.sku, product.category, product.brand].join(" ").toLowerCase().includes(q)).slice(0, 10);
  }, [query, state.products]);
  const ordered = state.purchases.filter((purchase) => purchase.status === "ordered");
  const received = state.purchases.filter((purchase) => purchase.status === "received");
  const totalPending = ordered.reduce((sum, purchase) => sum + purchase.total, 0);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const total = items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);

  const resetPurchase = () => { setSupplierId(""); setDueDate(""); setItems([]); setQuery(""); };
  const addItem = (productId: string) => {
    const product = state.products.find((item) => item.id === productId);
    if (!product) return;
    setItems((current) => {
      const existing = current.find((item) => item.productId === productId);
      if (existing) return current.map((item) => item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item);
      return [...current, { productId, quantity: 1, unitCost: product.cost || 0 }];
    });
    setQuery("");
  };

  return <>
    <PageHeader title="Compras e fornecedores" description="Crie uma compra em poucos passos. Ao receber, o estoque entra e a conta a pagar é criada automaticamente." actions={<div className="flex flex-wrap gap-2"><button className="btn-ghost" onClick={() => setSupplierOpen(true)}><Building2 size={18} /> Novo fornecedor</button><button className="btn-primary" onClick={() => { resetPurchase(); setPurchaseOpen(true); }}><Plus size={18} /> Nova compra</button></div>} />

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Fornecedores" value={String(state.suppliers.length)} icon={Building2} />
      <StatCard label="Compras pendentes" value={String(ordered.length)} icon={ShoppingCart} tone="warning" />
      <StatCard label="Valor pendente" value={currency(totalPending)} icon={ShoppingCart} tone="warning" />
      <StatCard label="Recebidas" value={String(received.length)} icon={CheckCircle2} tone="lime" />
    </div>

    <div className="mt-6 flex gap-2">
      <button className={tab === "compras" ? "btn-primary" : "btn-ghost"} onClick={() => setTab("compras")}>Compras</button>
      <button className={tab === "fornecedores" ? "btn-primary" : "btn-ghost"} onClick={() => setTab("fornecedores")}>Fornecedores</button>
    </div>

    {tab === "compras" ? <section className="panel mt-4 p-4 md:p-5">
      <div className="table-wrap"><table className="table"><thead><tr><th>Compra</th><th>Fornecedor</th><th>Data</th><th>Itens</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>{state.purchases.map((purchase) => {
        const supplier = state.suppliers.find((item) => item.id === purchase.supplierId);
        return <tr key={purchase.id}><td className="font-mono text-xs">{purchase.id}</td><td className="font-semibold">{supplier?.name || "Fornecedor removido"}</td><td>{dateTime(purchase.date)}</td><td>{purchase.items?.reduce((sum, item) => sum + item.quantity, 0) || 0}</td><td className="font-black">{currency(purchase.total)}</td><td>{purchase.status === "received" ? <span className="badge border-lime/30 bg-lime/10 text-lime">Recebida</span> : <span className="badge border-amber-500/30 bg-amber-500/10 text-amber-200">Aguardando</span>}</td><td>{purchase.status === "ordered" && <button className="btn-lime px-3 py-2" onClick={() => { try { receivePurchase(purchase.id); toast.success("Compra recebida: estoque atualizado e conta a pagar criada."); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível receber a compra."); } }}><PackageCheck size={16} /> Receber</button>}</td></tr>;
      })}</tbody></table>{!state.purchases.length && <div className="grid min-h-44 place-items-center text-sm text-slate-500">Nenhuma compra registrada. Clique em Nova compra.</div>}</div>
    </section> : <section className="panel mt-4 p-4 md:p-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{state.suppliers.map((supplier) => <button key={supplier.id} className="panel-soft p-4 text-left transition hover:border-brand/50" onClick={() => { setSupplierForm(supplier); setSupplierOpen(true); }}><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-brand/10 text-brand"><Building2 size={19} /></div><div className="min-w-0"><p className="truncate font-bold">{supplier.name}</p><p className="truncate text-xs text-slate-500">{supplier.contactName || supplier.phone || "Sem contato cadastrado"}</p></div></div>{supplier.paymentTerms && <p className="mt-3 text-xs text-slate-400">Condição: {supplier.paymentTerms}</p>}</button>)}{!state.suppliers.length && <div className="col-span-full grid min-h-44 place-items-center text-sm text-slate-500">Cadastre o primeiro fornecedor.</div>}</div>
    </section>}

    <Modal open={supplierOpen} onClose={() => setSupplierOpen(false)} title={supplierForm.id ? "Editar fornecedor" : "Novo fornecedor"} width="max-w-xl">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); try { saveSupplier({ ...supplierForm, name: supplierForm.name || "" }); toast.success("Fornecedor salvo."); setSupplierOpen(false); setSupplierForm({ name: "", phone: "", contactName: "", paymentTerms: "" }); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar."); } }}>
        <label><span className="mb-1.5 block text-sm font-semibold">Nome *</span><input className="input" required value={supplierForm.name || ""} onChange={(e) => setSupplierForm((form) => ({ ...form, name: e.target.value }))} /></label>
        <div className="grid gap-3 sm:grid-cols-2"><label><span className="mb-1.5 block text-sm font-semibold">Contato</span><input className="input" value={supplierForm.contactName || ""} onChange={(e) => setSupplierForm((form) => ({ ...form, contactName: e.target.value }))} /></label><label><span className="mb-1.5 block text-sm font-semibold">Telefone</span><input className="input" value={supplierForm.phone || ""} onChange={(e) => setSupplierForm((form) => ({ ...form, phone: e.target.value }))} /></label></div>
        <label><span className="mb-1.5 block text-sm font-semibold">Condição de pagamento</span><input className="input" placeholder="Ex.: 28 dias / semanal / à vista" value={supplierForm.paymentTerms || ""} onChange={(e) => setSupplierForm((form) => ({ ...form, paymentTerms: e.target.value }))} /></label>
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setSupplierOpen(false)}>Cancelar</button><button className="btn-primary">Salvar fornecedor</button></div>
      </form>
    </Modal>

    <Modal open={purchaseOpen} onClose={() => setPurchaseOpen(false)} title="Nova compra" width="max-w-3xl">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); try { const purchase = createPurchase({ supplierId, date: new Date().toISOString(), dueDate: dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : undefined, items }); toast.success(`Compra criada com ${purchase.items?.length || 0} produto(s).`); setPurchaseOpen(false); resetPurchase(); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível criar a compra."); } }}>
        <div className="grid gap-3 sm:grid-cols-2"><label><span className="mb-1.5 block text-sm font-semibold">Fornecedor *</span><select className="select" required value={supplierId} onChange={(e) => setSupplierId(e.target.value)}><option value="">Selecione</option>{state.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label><label><span className="mb-1.5 block text-sm font-semibold">Vencimento</span><input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label></div>
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} /><input className="input pl-10" placeholder="Digite produto, SKU, marca ou categoria" value={query} onChange={(e) => setQuery(e.target.value)} />{productResults.length > 0 && <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-line bg-[#111525] shadow-2xl">{productResults.map((product) => <button type="button" key={product.id} className="flex w-full items-center justify-between border-b border-line px-4 py-3 text-left last:border-0 hover:bg-white/5" onClick={() => addItem(product.id)}><span><strong className="block">{product.name}</strong><span className="text-xs text-slate-500">{product.category} · estoque {product.stock}</span></span><span className="text-sm text-slate-400">custo {currency(product.cost)}</span></button>)}</div>}</div>
        <div className="table-wrap"><table className="table"><thead><tr><th>Produto</th><th className="w-28">Qtd.</th><th className="w-36">Custo un.</th><th>Total</th><th></th></tr></thead><tbody>{items.map((item) => { const product = state.products.find((p) => p.id === item.productId); return <tr key={item.productId}><td className="font-semibold">{product?.name || "Produto removido"}</td><td><NumberInput className="input px-2 py-1.5" min={1} step={1} emptyWhenZero={false} value={item.quantity} onValueChange={(value) => setItems((current) => current.map((line) => line.productId === item.productId ? { ...line, quantity: value } : line))} /></td><td><NumberInput className="input px-2 py-1.5" min={0} step={0.01} value={item.unitCost} onValueChange={(value) => setItems((current) => current.map((line) => line.productId === item.productId ? { ...line, unitCost: value } : line))} /></td><td className="font-bold">{currency(item.quantity * item.unitCost)}</td><td><button type="button" className="text-red-300" onClick={() => setItems((current) => current.filter((line) => line.productId !== item.productId))}>Remover</button></td></tr>; })}</tbody></table>{!items.length && <div className="grid min-h-32 place-items-center text-sm text-slate-500">Busque e adicione os produtos da compra.</div>}</div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white/[0.03] p-4"><p className="text-sm text-slate-400">{totalItems} unidade(s) em {items.length} produto(s)</p><p className="text-xl font-black text-lime">{currency(total)}</p></div>
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setPurchaseOpen(false)}>Cancelar</button><button className="btn-primary"><ShoppingCart size={17} /> Criar compra</button></div>
      </form>
    </Modal>
  </>;
}
