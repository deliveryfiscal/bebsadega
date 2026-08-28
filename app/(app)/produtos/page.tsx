"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Edit3, Link2, Plus, Power, Search, ScanBarcode } from "lucide-react";
import { useMemo, useState } from "react";
import { ProductForm } from "@/components/products/product-form";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import type { Product } from "@/lib/types";
import { currency } from "@/lib/utils";

export default function ProductsPage() {
  const { state, saveProduct, setProductActive, resolveProductReview } = useStore();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");
  const [status, setStatus] = useState("Todos");
  const [editing, setEditing] = useState<Product | undefined>();
  const [open, setOpen] = useState(false);

  const categories = useMemo(() => ["Todas", ...Array.from(new Set(state.products.map((p) => p.category))).sort((a, b) => a.localeCompare(b))], [state.products]);
  const filtered = useMemo(
    () => state.products.filter((p) => {
      if (category !== "Todas" && p.category !== category) return false;
      if (status === "Ativos" && !p.active) return false;
      if (status === "Inativos" && p.active) return false;
      if (status === "Revisar" && !p.needsReview) return false;
      if (status === "Sem código" && (p.barcode || p.kind === "combo")) return false;
      return [p.name, p.barcode, p.sku, p.category, p.brand, p.notes].join(" ").toLowerCase().includes(query.toLowerCase());
    }),
    [state.products, query, category, status],
  );

  const withoutBarcode = state.products.filter((p) => !p.barcode && p.kind !== "combo").length;
  const reviewCount = state.products.filter((p) => p.needsReview).length;
  const inactiveCombos = state.products.filter((p) => p.kind === "combo" && !p.active).length;
  const close = () => { setOpen(false); setEditing(undefined); };

  return <>
    <PageHeader
      title="Produtos"
      description="Catálogo real da Beb's, com preços transcritos das listas físicas. Complete estoque, custo e código de barras durante a implantação."
      actions={<div className="flex flex-wrap gap-2"><Link href="/codigos" className="btn-lime"><ScanBarcode size={18} /> Cadastrar códigos</Link><button className="btn-primary" onClick={() => setOpen(true)}><Plus size={18} /> Novo produto</button></div>}
    />

    <div className="mb-4 grid gap-3 sm:grid-cols-3">
      <div className="panel-soft flex items-center gap-3 p-4"><ScanBarcode className="text-cyan-300" size={21} /><div><p className="text-xs text-slate-500">Sem código de barras</p><p className="text-xl font-black">{withoutBarcode}</p></div></div>
      <div className="panel-soft flex items-center gap-3 p-4"><AlertTriangle className="text-amber-300" size={21} /><div><p className="text-xs text-slate-500">Itens para revisar</p><p className="text-xl font-black">{reviewCount}</p></div></div>
      <div className="panel-soft flex items-center gap-3 p-4"><Link2 className="text-violet-300" size={21} /><div><p className="text-xs text-slate-500">Combos aguardando vínculo</p><p className="text-xl font-black">{inactiveCombos}</p></div></div>
    </div>

    <section className="panel p-4 md:p-5">
      <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_220px_190px_auto] lg:items-center">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} /><input className="input pl-10" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome, código, SKU, marca ou categoria" /></div>
        <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select>
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}><option>Todos</option><option>Ativos</option><option>Inativos</option><option>Revisar</option><option>Sem código</option></select>
        <div className="flex items-center gap-2 whitespace-nowrap text-xs text-slate-500"><ScanBarcode size={17} /> {filtered.length} registros</div>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Produto</th><th>Código de barras</th><th>Tipo</th><th>Estoque</th><th>Custo</th><th>Venda</th><th>Margem</th><th>Status</th><th></th></tr></thead>
          <tbody>{filtered.map((p) => {
            const margin = p.price ? ((p.price - p.cost) / p.price) * 100 : 0;
            return <tr key={p.id}>
              <td>
                <div className="font-semibold">{p.name}</div>
                <div className="text-xs text-slate-500">{p.category} · {p.sku}</div>
                {p.notes && <div className="mt-1 max-w-md truncate text-[11px] text-slate-600" title={p.notes}>{p.notes}</div>}
              </td>
              <td className="font-mono text-xs">{p.barcode || <span className="font-sans text-amber-300">Não vinculado</span>}</td>
              <td><span className="badge">{p.kind === "unit" ? "Unidade" : p.kind === "volume" ? "Dose/Garrafa" : "Combo"}</span></td>
              <td>{p.kind === "combo" ? "Calculado" : <span className={p.stock <= p.minStock ? "font-bold text-amber-300" : "text-lime"}>{p.stock} un.</span>}</td>
              <td>{currency(p.cost)}</td>
              <td className="font-bold">{currency(p.price)}</td>
              <td className={p.cost === 0 ? "text-slate-500" : margin >= 30 ? "text-lime" : "text-amber-300"}>{p.cost === 0 ? "A definir" : `${margin.toFixed(1)}%`}</td>
              <td><div className="flex flex-col items-start gap-1.5">{p.needsReview ? <span className="badge border-amber-500/30 bg-amber-500/10 text-amber-200">Revisar</span> : !p.active ? <span className="badge border-violet-500/30 bg-violet-500/10 text-violet-200">Inativo</span> : <span className="badge border-lime/30 bg-lime/10 text-lime">OK</span>}{p.needsReview && <button className="text-[11px] font-bold text-lime hover:underline" onClick={() => { resolveProductReview(p.id); toast.success(`${p.name} marcado como conferido.`); }}><CheckCircle2 className="mr-1 inline" size={12} />Marcar conferido</button>}</div></td>
              <td><div className="flex gap-1"><button className="rounded-lg border border-line p-2 hover:bg-white/5" title="Editar" onClick={() => { setEditing(p); setOpen(true); }}><Edit3 size={16} /></button><button className={`rounded-lg border p-2 ${p.active ? "border-lime/30 text-lime hover:bg-lime/10" : "border-line text-slate-500 hover:bg-white/5"}`} title={p.active ? "Desativar produto" : "Ativar produto"} onClick={() => { setProductActive(p.id, !p.active); toast.success(p.active ? "Produto desativado." : "Produto ativado."); }}><Power size={16} /></button></div></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </section>

    <Modal open={open} onClose={close} title={editing ? "Editar produto" : "Novo produto"}>
      <ProductForm product={editing} onCancel={close} onSave={(data) => {
        try {
          saveProduct(data);
          toast.success(editing ? "Produto atualizado." : "Produto cadastrado.");
          close();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
        }
      }} />
    </Modal>
  </>;
}
