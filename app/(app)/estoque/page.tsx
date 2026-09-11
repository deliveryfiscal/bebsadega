"use client";

import Link from "next/link";
import { AlertTriangle, ArrowDown, ArrowUp, Boxes, ClipboardCheck, MapPin, PackageCheck, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { NumberInput } from "@/components/ui/number-input";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { useToast } from "@/components/ui/toast";
import { isDoseShortcut, lowStockProducts } from "@/lib/business";
import { useStore } from "@/lib/store";
import type { Product } from "@/lib/types";
import { currency } from "@/lib/utils";

export default function StockPage() {
  const { state, adjustStock, setProductLocation } = useStore();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Todos");
  const [target, setTarget] = useState<Product | null>(null);
  const [delta, setDelta] = useState(1);
  const [reason, setReason] = useState("Ajuste manual conferido");
  const [locationTarget, setLocationTarget] = useState<Product | null>(null);
  const [location, setLocation] = useState("");

  const all = useMemo(() => state.products.filter((product) => product.kind !== "combo" && !isDoseShortcut(product)), [state.products]);
  const products = useMemo(() => all.filter((product) => {
    if (filter === "Baixo" && product.stock > product.minStock) return false;
    if (filter === "Zerado" && product.stock !== 0) return false;
    if (filter === "Sem custo" && product.cost > 0) return false;
    if (filter === "Sem localização" && product.location) return false;
    return [product.name, product.barcode, product.sku, product.category, product.location].join(" ").toLowerCase().includes(query.toLowerCase());
  }), [all, query, filter]);
  const low = lowStockProducts(state.products);
  const inventoryValue = all.reduce((sum, product) => sum + product.stock * product.cost, 0);
  const potentialRevenue = all.reduce((sum, product) => sum + product.stock * product.price, 0);

  return <>
    <PageHeader title="Estoque" description="Veja o que precisa de atenção. Entrada e inventário ficam separados para evitar ajustes acidentais." actions={<div className="flex flex-wrap gap-2"><Link href="/recebimento" className="btn-lime"><PackageCheck size={18} /> Entrada rápida</Link><Link href="/inventario" className="btn-ghost"><ClipboardCheck size={18} /> Inventário express</Link></div>} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Produtos controlados" value={String(all.length)} icon={Boxes} /><StatCard label="Custo em estoque" value={currency(inventoryValue)} icon={ArrowUp} tone="lime" /><StatCard label="Potencial de venda" value={currency(potentialRevenue)} icon={ArrowUp} tone="violet" /><StatCard label="Abaixo do mínimo" value={String(low.length)} hint={`${all.filter((product) => product.stock === 0).length} zerados`} icon={AlertTriangle} tone="warning" /></div>

    <section className="panel mt-6 p-4 md:p-5">
      <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_220px_auto] lg:items-center"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} /><input className="input pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar produto, código, SKU ou localização" /></div><select className="select" value={filter} onChange={(event) => setFilter(event.target.value)}><option>Todos</option><option>Baixo</option><option>Zerado</option><option>Sem custo</option><option>Sem localização</option></select><span className="text-xs text-slate-500">{products.length} produtos</span></div>
      <div className="table-wrap"><table className="table"><thead><tr><th>Produto</th><th>Localização</th><th>Atual</th><th>Mínimo</th><th>Custo</th><th>Venda potencial</th><th>Status</th><th></th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td><div className="font-semibold">{product.name}</div><div className="text-xs text-slate-500">{product.category} · {product.sku}</div></td><td><button className="flex items-center gap-1 text-left text-xs text-slate-400 hover:text-white" onClick={() => { setLocationTarget(product); setLocation(product.location || ""); }}><MapPin size={14} /> {product.location || "Definir"}</button></td><td className={product.stock <= product.minStock ? "font-black text-amber-300" : "font-black text-lime"}>{product.stock}</td><td>{product.minStock}</td><td>{currency(product.stock * product.cost)}</td><td>{currency(product.stock * product.price)}</td><td>{product.stock === 0 ? <span className="badge border-red-500/30 bg-red-500/10 text-red-300">Zerado</span> : product.stock <= product.minStock ? <span className="badge border-amber-500/30 bg-amber-500/10 text-amber-300">Repor</span> : <span className="badge border-lime/30 bg-lime/10 text-lime">OK</span>}</td><td><button className="btn-ghost py-2" onClick={() => { setTarget(product); setDelta(1); setReason("Ajuste manual conferido"); }}>Ajustar</button></td></tr>)}</tbody></table></div>
    </section>

    <Modal open={Boolean(target)} onClose={() => setTarget(null)} title={target ? `Ajustar ${target.name}` : "Ajustar estoque"} width="max-w-md">{target && <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); try { adjustStock(target.id, delta, reason); toast.success("Estoque ajustado."); setTarget(null); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível ajustar."); } }}><div className="panel-soft p-4"><p className="text-xs text-slate-500">Estoque atual</p><p className="mt-1 text-3xl font-black">{target.stock}</p></div><label><span className="mb-1.5 block text-sm font-semibold">Variação</span><NumberInput className="input" step={1} value={delta} onValueChange={setDelta} placeholder="Ex.: 5 ou -2" /><span className="mt-1 block text-xs text-slate-500">Use positivo para entrada e negativo para saída. Para recebimento normal, prefira Entrada rápida.</span></label><label><span className="mb-1.5 block text-sm font-semibold">Motivo obrigatório</span><select className="select" value={reason} onChange={(event) => setReason(event.target.value)}><option>Ajuste manual conferido</option><option>Perda / avaria</option><option>Consumo interno</option><option>Devolução</option><option>Correção de cadastro</option></select></label><div className="rounded-xl border border-line bg-white/[0.03] p-3 text-sm">Após ajuste: <strong className={target.stock + delta < 0 ? "text-red-300" : "text-lime"}>{target.stock + delta}</strong></div><button className="btn-primary w-full">Aplicar ajuste</button></form>}</Modal>

    <Modal open={Boolean(locationTarget)} onClose={() => setLocationTarget(null)} title="Localização física" width="max-w-md">{locationTarget && <div className="space-y-4"><p className="text-sm text-slate-400">Facilita inventário e reposição sem procurar o produto pela loja.</p><label><span className="mb-1.5 block text-sm font-semibold">Local</span><input className="input" autoFocus value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Ex.: Geladeira 2 / Prateleira B" /></label><div className="flex flex-wrap gap-2">{["Balcão", "Geladeira 1", "Geladeira 2", "Prateleira A", "Prateleira B", "Depósito"].map((value) => <button key={value} className="btn-ghost py-2" onClick={() => setLocation(value)}>{value}</button>)}</div><button className="btn-lime w-full" onClick={() => { setProductLocation(locationTarget.id, location); toast.success("Localização salva."); setLocationTarget(null); }}>Salvar localização</button></div>}</Modal>
  </>;
}
