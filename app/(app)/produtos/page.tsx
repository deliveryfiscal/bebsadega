"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Edit3, Link2, MapPin, Plus, Power, Search, ScanBarcode, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { ProductForm } from "@/components/products/product-form";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { isDoseShortcut, productBarcodeBindings } from "@/lib/business";
import { useStore } from "@/lib/store";
import type { Product } from "@/lib/types";
import { currency } from "@/lib/utils";

export default function ProductsPage() {
  const { state, saveProduct, setProductActive, setProductFavorite, resolveProductReview } = useStore();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");
  const [status, setStatus] = useState("Todos");
  const [editing, setEditing] = useState<Product | undefined>(undefined);
  const [open, setOpen] = useState(false);

  const categories = useMemo(() => ["Todas", ...Array.from(new Set(state.products.map((product) => product.category))).sort((a, b) => a.localeCompare(b))], [state.products]);
  const filtered = useMemo(() => state.products.filter((product) => {
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

  const withoutBarcode = state.products.filter((product) => !product.barcode && product.kind !== "combo").length;
  const reviewCount = state.products.filter((product) => product.needsReview).length;
  const withoutCost = state.products.filter((product) => product.kind !== "combo" && !isDoseShortcut(product) && product.cost <= 0).length;
  const favorites = state.products.filter((product) => product.favorite).length;
  const close = () => { setOpen(false); setEditing(undefined); };

  return <>
    <PageHeader title="Produtos" description="Cadastro rápido na superfície; detalhes avançados só quando necessários." actions={<div className="flex flex-wrap gap-2"><Link href="/codigos" className="btn-lime"><ScanBarcode size={18} /> Cadastrar códigos</Link><button className="btn-primary" onClick={() => setOpen(true)}><Plus size={18} /> Novo produto</button></div>} />

    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="panel-soft flex items-center gap-3 p-4"><ScanBarcode className="text-cyan-300" size={21} /><div><p className="text-xs text-slate-500">Sem código</p><p className="text-xl font-black">{withoutBarcode}</p></div></div><div className="panel-soft flex items-center gap-3 p-4"><AlertTriangle className="text-amber-300" size={21} /><div><p className="text-xs text-slate-500">Para revisar</p><p className="text-xl font-black">{reviewCount}</p></div></div><div className="panel-soft flex items-center gap-3 p-4"><Link2 className="text-violet-300" size={21} /><div><p className="text-xs text-slate-500">Sem custo</p><p className="text-xl font-black">{withoutCost}</p></div></div><div className="panel-soft flex items-center gap-3 p-4"><Star className="text-amber-300" size={21} /><div><p className="text-xs text-slate-500">Favoritos PDV</p><p className="text-xl font-black">{favorites}</p></div></div></div>

    <section className="panel p-4 md:p-5"><div className="mb-4 grid gap-3 lg:grid-cols-[1fr_220px_190px_auto] lg:items-center"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} /><input className="input pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, código, SKU, marca ou localização" /></div><select className="select" value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select><select className="select" value={status} onChange={(event) => setStatus(event.target.value)}><option>Todos</option><option>Ativos</option><option>Inativos</option><option>Favoritos</option><option>Revisar</option><option>Sem código</option><option>Sem custo</option><option>Sem localização</option></select><span className="text-xs text-slate-500">{filtered.length} registros</span></div>
      <div className="table-wrap"><table className="table"><thead><tr><th>Produto</th><th>Códigos</th><th>Localização</th><th>Estoque</th><th>Custo</th><th>Venda</th><th>Margem</th><th>Status</th><th></th></tr></thead><tbody>{filtered.map((product) => { const margin = product.price ? ((product.price - product.cost) / product.price) * 100 : 0; const codes = productBarcodeBindings(product); return <tr key={product.id}><td><div className="flex items-center gap-2"><button title={product.favorite ? "Remover dos favoritos" : "Fixar no PDV"} onClick={() => { setProductFavorite(product.id, !product.favorite); toast.success(product.favorite ? "Removido dos favoritos." : "Adicionado aos favoritos do PDV."); }} className={product.favorite ? "text-amber-300" : "text-slate-600 hover:text-amber-300"}><Star size={16} fill={product.favorite ? "currentColor" : "none"} /></button><div><div className="font-semibold">{product.name}</div><div className="text-xs text-slate-500">{product.category} · {product.sku}</div></div></div></td><td><div className="font-mono text-xs">{product.barcode || <span className="font-sans text-amber-300">Não vinculado</span>}</div>{codes.length > 1 && <div className="mt-1 text-[11px] text-cyan-300">+ {codes.length - 1} código(s) de embalagem</div>}</td><td className="text-xs text-slate-400"><span className="inline-flex items-center gap-1"><MapPin size={13} /> {product.location || "—"}</span></td><td>{isDoseShortcut(product) ? <span className="text-cyan-300">Vinculado</span> : product.kind === "combo" ? "Calculado" : <span className={product.stock <= product.minStock ? "font-bold text-amber-300" : "text-lime"}>{product.stock}</span>}</td><td>{isDoseShortcut(product) ? <span className="text-slate-500">Pela garrafa</span> : currency(product.cost)}</td><td className="font-bold">{isDoseShortcut(product) ? <span className="text-cyan-300">Valor no PDV</span> : currency(product.price)}</td><td className={isDoseShortcut(product) ? "text-cyan-300" : product.cost === 0 ? "text-slate-500" : margin >= 30 ? "text-lime" : "text-amber-300"}>{isDoseShortcut(product) ? "Variável" : product.cost === 0 ? "A definir" : `${margin.toFixed(1)}%`}</td><td><div className="flex flex-col items-start gap-1.5">{product.needsReview ? <span className="badge border-amber-500/30 bg-amber-500/10 text-amber-200">Revisar</span> : !product.active ? <span className="badge border-violet-500/30 bg-violet-500/10 text-violet-200">Inativo</span> : <span className="badge border-lime/30 bg-lime/10 text-lime">OK</span>}{product.needsReview && <button className="text-[11px] font-bold text-lime hover:underline" onClick={() => { resolveProductReview(product.id); toast.success(`${product.name} conferido.`); }}><CheckCircle2 className="mr-1 inline" size={12} />Conferido</button>}</div></td><td><div className="flex gap-1"><button className="rounded-lg border border-line p-2 hover:bg-white/5" title="Editar" onClick={() => { setEditing(product); setOpen(true); }}><Edit3 size={16} /></button><button className={`rounded-lg border p-2 ${product.active ? "border-lime/30 text-lime hover:bg-lime/10" : "border-line text-slate-500 hover:bg-white/5"}`} title={product.active ? "Desativar" : "Ativar"} onClick={() => { try { setProductActive(product.id, !product.active); toast.success(product.active ? "Produto desativado." : "Produto ativado."); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível alterar."); } }}><Power size={16} /></button></div></td></tr>; })}</tbody></table></div>
    </section>

    <Modal open={open} onClose={close} title={editing ? "Editar produto" : "Novo produto"}><ProductForm product={editing} quick={!editing} onCancel={close} onSave={(data) => { try { saveProduct(data); toast.success(editing ? "Produto atualizado." : "Produto cadastrado."); close(); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar."); } }} /></Modal>
  </>;
}
