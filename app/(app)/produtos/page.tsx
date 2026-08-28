"use client";

import { AlertTriangle, Edit3, Link2, Plus, Search, ScanBarcode } from "lucide-react";
import { useMemo, useState } from "react";
import { ProductForm } from "@/components/products/product-form";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import type { Product } from "@/lib/types";
import { currency } from "@/lib/utils";

export default function ProductsPage() {
  const { state, saveProduct } = useStore();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Product | undefined>();
  const [open, setOpen] = useState(false);

  const filtered = useMemo(
    () => state.products.filter((p) => [p.name, p.barcode, p.sku, p.category, p.brand, p.notes].join(" ").toLowerCase().includes(query.toLowerCase())),
    [state.products, query],
  );

  const withoutBarcode = state.products.filter((p) => !p.barcode && p.kind !== "combo").length;
  const reviewCount = state.products.filter((p) => p.needsReview).length;
  const inactiveCombos = state.products.filter((p) => p.kind === "combo" && !p.active).length;
  const close = () => { setOpen(false); setEditing(undefined); };

  return <>
    <PageHeader
      title="Produtos"
      description="Catálogo real da Beb's, com preços transcritos das listas físicas. Complete estoque, custo e código de barras durante a implantação."
      actions={<button className="btn-primary" onClick={() => setOpen(true)}><Plus size={18} /> Novo produto</button>}
    />

    <div className="mb-4 grid gap-3 sm:grid-cols-3">
      <div className="panel-soft flex items-center gap-3 p-4"><ScanBarcode className="text-cyan-300" size={21} /><div><p className="text-xs text-slate-500">Sem código de barras</p><p className="text-xl font-black">{withoutBarcode}</p></div></div>
      <div className="panel-soft flex items-center gap-3 p-4"><AlertTriangle className="text-amber-300" size={21} /><div><p className="text-xs text-slate-500">Itens para revisar</p><p className="text-xl font-black">{reviewCount}</p></div></div>
      <div className="panel-soft flex items-center gap-3 p-4"><Link2 className="text-violet-300" size={21} /><div><p className="text-xs text-slate-500">Combos aguardando vínculo</p><p className="text-xl font-black">{inactiveCombos}</p></div></div>
    </div>

    <section className="panel p-4 md:p-5">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative max-w-xl flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} /><input className="input pl-10" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome, código, SKU, marca ou categoria" /></div>
        <div className="flex items-center gap-2 text-xs text-slate-500"><ScanBarcode size={17} /> {filtered.length} registros</div>
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
              <td>{p.needsReview ? <span className="badge border-amber-500/30 bg-amber-500/10 text-amber-200">Revisar</span> : !p.active ? <span className="badge border-violet-500/30 bg-violet-500/10 text-violet-200">Inativo</span> : <span className="badge border-lime/30 bg-lime/10 text-lime">OK</span>}</td>
              <td><button className="rounded-lg border border-line p-2 hover:bg-white/5" onClick={() => { setEditing(p); setOpen(true); }}><Edit3 size={16} /></button></td>
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
