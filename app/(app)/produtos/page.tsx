"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Edit3, Link2, MapPin, Plus, Power, Search, ScanBarcode, Star, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { ProductForm } from "@/components/products/product-form";
import { useManagerPin } from "@/components/security/manager-pin";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { isDoseShortcut, productBarcodeBindings } from "@/lib/business";
import { useStore } from "@/lib/store";
import type { Product } from "@/lib/types";
import { currency } from "@/lib/utils";

export default function ProductsPage() {
  const { state, saveProduct, setProductActive, deleteProduct, setProductFavorite, resolveProductReview, recordAudit } = useStore();
  const toast = useToast();
  const managerPin = useManagerPin();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");
  const [status, setStatus] = useState("Todos");
  const [editing, setEditing] = useState<Product | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleteReason, setDeleteReason] = useState("");

  const liveProducts = useMemo(() => state.products.filter((product) => !product.deletedAt), [state.products]);
  const categories = useMemo(() => ["Todas", ...Array.from(new Set(liveProducts.map((product) => product.category))).sort((a, b) => a.localeCompare(b))], [state.products]);
  const filtered = useMemo(() => state.products.filter((product) => {
    if (status === "Excluídos") return Boolean(product.deletedAt) && [product.name, product.sku, product.category, product.deleteReason].join(" ").toLowerCase().includes(query.toLowerCase());
    if (product.deletedAt) return false;
    if (category !== "Todas" && product.category !== category) return false;
    if (status === "Ativos" && !product.active) return false;
    if (status === "Inativos" && product.active) return false;
    if (status === "Favoritos" && !product.favorite) return false;
    if (status === "Revisar" && !product.needsReview) return false;
    if (status === "Sem código" && (product.barcode || product.kind === "combo")) return false;
    if (status === "Sem custo" && (isDoseShortcut(product) || product.cost > 0)) return false;
    if (status === "Sem localização" && (product.location || product.kind === "combo")) return false;
    return [product.name, product.barcode, product.sku, product.category, product.brand, product.notes, product.location].join(" ").toLowerCase().includes(query.toLowerCase());
  }), [state.products, query, category, status]);

  const withoutBarcode = liveProducts.filter((product) => !product.barcode && product.kind !== "combo").length;
  const reviewCount = liveProducts.filter((product) => product.needsReview).length;
  const withoutCost = liveProducts.filter((product) => product.kind !== "combo" && !isDoseShortcut(product) && product.cost <= 0).length;
  const favorites = liveProducts.filter((product) => product.favorite).length;
  const close = () => { setOpen(false); setEditing(undefined); };

  return <>
    <PageHeader title="Produtos" description="Cadastre, edite ou exclua produtos com segurança. Vendas anteriores não são apagadas." actions={<div className="flex flex-wrap gap-2"><Link href="/codigos" className="btn-lime"><ScanBarcode size={18} /> Cadastrar códigos</Link><button className="btn-primary" onClick={() => setOpen(true)}><Plus size={18} /> Novo produto</button></div>} />

    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="panel-soft flex items-center gap-3 p-4"><ScanBarcode className="text-cyan-300" size={21} /><div><p className="text-xs text-slate-500">Sem código</p><p className="text-xl font-black">{withoutBarcode}</p></div></div><div className="panel-soft flex items-center gap-3 p-4"><AlertTriangle className="text-amber-300" size={21} /><div><p className="text-xs text-slate-500">Para revisar</p><p className="text-xl font-black">{reviewCount}</p></div></div><div className="panel-soft flex items-center gap-3 p-4"><Link2 className="text-violet-300" size={21} /><div><p className="text-xs text-slate-500">Sem custo</p><p className="text-xl font-black">{withoutCost}</p></div></div><div className="panel-soft flex items-center gap-3 p-4"><Star className="text-amber-300" size={21} /><div><p className="text-xs text-slate-500">Favoritos PDV</p><p className="text-xl font-black">{favorites}</p></div></div></div>

    <section className="panel p-4 md:p-5"><div className="mb-4 grid gap-3 lg:grid-cols-[1fr_220px_190px_auto] lg:items-center"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} /><input className="input pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, código, SKU, marca ou localização" /></div><select className="select" value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select><select className="select" value={status} onChange={(event) => setStatus(event.target.value)}><option>Todos</option><option>Ativos</option><option>Inativos</option><option>Favoritos</option><option>Revisar</option><option>Sem código</option><option>Sem custo</option><option>Sem localização</option><option>Excluídos</option></select><span className="text-xs text-slate-500">{filtered.length} registros</span></div>
      <div className="table-wrap"><table className="table"><thead><tr><th>Produto</th><th>Códigos</th><th>Localização</th><th>Estoque</th><th>Custo</th><th>Venda</th><th>Margem</th><th>Status</th><th></th></tr></thead><tbody>{filtered.map((product) => { const margin = product.price ? ((product.price - product.cost) / product.price) * 100 : 0; const codes = productBarcodeBindings(product); return <tr key={product.id}><td><div className="flex items-center gap-2"><button title={product.favorite ? "Remover dos favoritos" : "Fixar no PDV"} onClick={() => { setProductFavorite(product.id, !product.favorite); toast.success(product.favorite ? "Removido dos favoritos." : "Adicionado aos favoritos do PDV."); }} className={product.favorite ? "text-amber-300" : "text-slate-600 hover:text-amber-300"}><Star size={16} fill={product.favorite ? "currentColor" : "none"} /></button><div><div className="font-semibold">{product.name}</div><div className="text-xs text-slate-500">{product.category} · {product.sku}</div></div></div></td><td><div className="font-mono text-xs">{product.barcode || <span className="font-sans text-amber-300">Não vinculado</span>}</div>{codes.length > 1 && <div className="mt-1 text-[11px] text-cyan-300">+ {codes.length - 1} código(s) de embalagem</div>}</td><td className="text-xs text-slate-400"><span className="inline-flex items-center gap-1"><MapPin size={13} /> {product.location || "—"}</span></td><td>{isDoseShortcut(product) ? <span className="text-cyan-300">Vinculado</span> : product.kind === "combo" ? "Calculado" : <span className={product.stock <= product.minStock ? "font-bold text-amber-300" : "text-lime"}>{product.stock}</span>}</td><td>{isDoseShortcut(product) ? <span className="text-slate-500">Pela garrafa</span> : currency(product.cost)}</td><td className="font-bold">{isDoseShortcut(product) ? <span className="text-cyan-300">Valor no PDV</span> : currency(product.price)}</td><td className={isDoseShortcut(product) ? "text-cyan-300" : product.cost === 0 ? "text-slate-500" : margin >= 30 ? "text-lime" : "text-amber-300"}>{isDoseShortcut(product) ? "Variável" : product.cost === 0 ? "A definir" : `${margin.toFixed(1)}%`}</td><td><div className="flex flex-col items-start gap-1.5">{product.deletedAt ? <span className="badge border-red-500/30 bg-red-500/10 text-red-300">Excluído</span> : product.needsReview ? <span className="badge border-amber-500/30 bg-amber-500/10 text-amber-200">Revisar</span> : !product.active ? <span className="badge border-violet-500/30 bg-violet-500/10 text-violet-200">Inativo</span> : <span className="badge border-lime/30 bg-lime/10 text-lime">OK</span>}{!product.deletedAt && product.needsReview && <button className="text-[11px] font-bold text-lime hover:underline" onClick={() => { resolveProductReview(product.id); toast.success(`${product.name} conferido.`); }}><CheckCircle2 className="mr-1 inline" size={12} />Conferido</button>}</div></td><td><div className="flex gap-1">{!product.deletedAt && <><button className="rounded-lg border border-line p-2 hover:bg-white/5" title="Editar" onClick={() => { setEditing(product); setOpen(true); }}><Edit3 size={16} /></button><button className={`rounded-lg border p-2 ${product.active ? "border-lime/30 text-lime hover:bg-lime/10" : "border-line text-slate-500 hover:bg-white/5"}`} title={product.active ? "Desativar" : "Ativar"} onClick={() => { try { if (!product.active && product.kind === "combo" && !product.comboItems?.length) { setEditing(product); setOpen(true); toast.error("Configure a composição abaixo e marque Produto ativo no PDV."); return; } setProductActive(product.id, !product.active); toast.success(product.active ? "Produto desativado." : "Produto ativado."); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível alterar."); } }}><Power size={16} /></button><button type="button" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-2 text-sm font-bold text-red-300 hover:bg-red-500/10" title={`Excluir ${product.name}`} aria-label={`Excluir ${product.name}`} onClick={() => { setDeleteTarget(product); setDeleteReason(""); }}><Trash2 size={16} /><span>Excluir</span></button></>}</div></td></tr>; })}</tbody></table></div>
    </section>

    <Modal open={open} onClose={close} title={editing ? "Editar produto" : "Novo produto"}><ProductForm product={editing} quick={!editing} onCancel={close} onSave={async (data) => {
      try {
        const nextStock = Number(data.stock ?? editing?.stock ?? 0);
        const previousStock = Number(editing?.stock ?? 0);
        const stockChanged = editing ? Math.abs(nextStock - previousStock) > 0.0001 : nextStock > 0.0001;
        if (stockChanged) {
          const authorized = await managerPin.request({
            title: "Autorizar alteração de estoque",
            description: editing
              ? `O estoque de ${editing.name} será alterado de ${previousStock} para ${nextStock}. Informe o PIN gerencial para continuar.`
              : `O novo produto será cadastrado com estoque inicial de ${nextStock}. Informe o PIN gerencial para continuar.`,
            scope: editing ? "estoque:edicao-produto" : "estoque:estoque-inicial-produto",
          });
          if (!authorized) return;
        }
        saveProduct(data);
        if (stockChanged) recordAudit("Alteração manual de estoque autorizada por PIN", "Segurança", `${editing?.name || data.name} · ${previousStock} → ${nextStock}`);
        toast.success(editing ? "Produto atualizado." : "Produto cadastrado.");
        close();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
      }
    }} />
    {editing && <div className="mt-4 border-t border-line pt-4"><button type="button" className="btn-danger w-full" onClick={() => { setDeleteTarget(editing); setDeleteReason(""); close(); }}><Trash2 size={17} /> Excluir este produto</button><p className="mt-2 text-center text-xs text-slate-400">O produto sai do PDV, mas o histórico de vendas e auditoria é preservado.</p></div>}
    </Modal>
    <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Excluir produto" width="max-w-lg">
      {deleteTarget && <form className="space-y-4" onSubmit={async (event) => {
        event.preventDefault();
        if (!deleteReason.trim()) return toast.error("Informe o motivo da exclusão.");
        const authorized = await managerPin.request({
          title: "Autorizar exclusão de produto",
          description: `O produto ${deleteTarget.name} será removido da operação e seus códigos serão liberados. O histórico antigo será preservado.`,
          scope: "produto:excluir",
        });
        if (!authorized) return;
        try { deleteProduct(deleteTarget.id, deleteReason); toast.success("Produto excluído da operação."); setDeleteTarget(null); setDeleteReason(""); }
        catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível excluir o produto."); }
      }}>
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100"><strong>{deleteTarget.name}</strong><p className="mt-1 text-red-200/80">A exclusão é segura: o produto deixa de aparecer no PDV e os códigos são desvinculados, mas vendas antigas continuam registradas.</p></div>
        <label><span className="mb-1.5 block text-sm font-semibold">Motivo obrigatório</span><textarea className="input min-h-24 resize-none" value={deleteReason} onChange={(event) => setDeleteReason(event.target.value)} placeholder="Ex.: produto duplicado / não trabalhamos mais com este item" required /></label>
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setDeleteTarget(null)}>Cancelar</button><button className="btn-danger"><Trash2 size={17} /> Excluir produto</button></div>
      </form>}
    </Modal>
    {managerPin.dialog}
  </>;
}
