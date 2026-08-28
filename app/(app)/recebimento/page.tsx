"use client";

import Link from "next/link";
import { Barcode, CheckCircle2, Minus, PackageCheck, Plus, ScanBarcode, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import { currency } from "@/lib/utils";

type ReceiptLine = { productId: string; quantity: number };

export default function ReceivingPage() {
  const { state, receiveStock } = useStore();
  const toast = useToast();
  const scannerRef = useRef<HTMLInputElement>(null);
  const [scan, setScan] = useState("");
  const [query, setQuery] = useState("");
  const [reason, setReason] = useState("Recebimento de mercadoria");
  const [lines, setLines] = useState<ReceiptLine[]>([]);

  useEffect(() => { const timer = window.setTimeout(() => scannerRef.current?.focus(), 180); return () => window.clearTimeout(timer); }, []);

  const products = useMemo(() => state.products.filter((p) => p.kind !== "combo" && [p.name, p.barcode, p.sku, p.category].join(" ").toLowerCase().includes(query.toLowerCase())).slice(0, 18), [state.products, query]);
  const units = lines.reduce((sum, line) => sum + line.quantity, 0);
  const estimatedCost = lines.reduce((sum, line) => sum + (state.products.find((p) => p.id === line.productId)?.cost || 0) * line.quantity, 0);

  const add = (productId: string, amount = 1) => {
    setLines((items) => {
      const found = items.find((item) => item.productId === productId);
      if (found) return items.map((item) => item.productId === productId ? { ...item, quantity: Math.max(1, item.quantity + amount) } : item);
      return [...items, { productId, quantity: Math.max(1, amount) }];
    });
    window.setTimeout(() => scannerRef.current?.focus(), 60);
  };

  const processScan = () => {
    const code = scan.trim();
    if (!code) return;
    const product = state.products.find((p) => p.kind !== "combo" && p.barcode === code);
    if (!product) {
      toast.error("Código não encontrado. Cadastre o código antes de receber este item.");
      setScan("");
      return;
    }
    add(product.id, 1);
    setScan("");
    toast.success(`${product.name}: +1 na entrada.`);
  };

  return <>
    <PageHeader title="Entrada rápida" description="Receba mercadorias bipando caixa por caixa. Cada bip soma uma unidade e a entrada é aplicada em lote ao final." actions={<Link href="/codigos" className="btn-ghost"><ScanBarcode size={18} /> Cadastrar códigos</Link>} />

    <div className="grid gap-4 sm:grid-cols-3">
      <div className="stat"><p className="text-xs uppercase tracking-wide text-slate-500">Produtos na entrada</p><p className="mt-2 text-3xl font-black">{lines.length}</p></div>
      <div className="stat"><p className="text-xs uppercase tracking-wide text-slate-500">Unidades</p><p className="mt-2 text-3xl font-black text-lime">{units}</p></div>
      <div className="stat"><p className="text-xs uppercase tracking-wide text-slate-500">Custo estimado</p><p className="mt-2 text-3xl font-black text-brand">{currency(estimatedCost)}</p></div>
    </div>

    <div className="mt-6 grid gap-6 2xl:grid-cols-[1fr_430px]">
      <section className="space-y-4">
        <div className="panel p-4 md:p-5"><form onSubmit={(e) => { e.preventDefault(); processScan(); }}><label><span className="mb-2 flex items-center gap-2 text-sm font-bold"><ScanBarcode size={19} className="text-lime" /> Bipe os produtos recebidos</span><div className="relative"><Barcode className="absolute left-4 top-1/2 -translate-y-1/2 text-brand" size={24} /><input ref={scannerRef} className="input h-16 pl-12 text-xl font-mono" value={scan} onChange={(e) => setScan(e.target.value)} placeholder="Cada bip soma +1" autoComplete="off" /></div></label></form><p className="mt-2 text-xs text-slate-500">Para uma caixa com 12 unidades, você pode bipar 12 vezes ou alterar a quantidade manualmente no resumo.</p></div>

        <section className="panel p-4 md:p-5"><div className="relative mb-4"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} /><input className="input pl-10" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Adicionar manualmente por nome, SKU ou código" /></div><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{products.map((product) => <button key={product.id} onClick={() => add(product.id)} className="panel-soft p-3 text-left hover:border-brand/50"><p className="line-clamp-2 font-semibold">{product.name}</p><p className="mt-1 text-xs text-slate-500">{product.category} · estoque {product.stock}</p><p className="mt-2 text-xs font-mono text-lime">{product.barcode || "sem código"}</p></button>)}</div></section>
      </section>

      <aside className="panel h-fit 2xl:sticky 2xl:top-24"><div className="flex items-center justify-between border-b border-line p-4"><div className="flex items-center gap-2"><PackageCheck className="text-brand" size={20} /><h2 className="font-bold">Conferência da entrada</h2></div>{lines.length > 0 && <button className="text-xs font-bold text-red-300" onClick={() => setLines([])}>Limpar</button>}</div><div className="max-h-[50vh] min-h-72 overflow-auto p-4">{lines.length ? <div className="space-y-2">{lines.map((line) => { const product = state.products.find((p) => p.id === line.productId); if (!product) return null; return <div key={line.productId} className="panel-soft p-3"><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><p className="truncate font-semibold">{product.name}</p><p className="mt-1 text-xs text-slate-500">Atual: {product.stock} → Após entrada: <strong className="text-lime">{product.stock + line.quantity}</strong></p></div><button className="rounded-lg p-2 text-red-300 hover:bg-red-500/10" onClick={() => setLines((items) => items.filter((x) => x.productId !== line.productId))}><Trash2 size={15} /></button></div><div className="mt-3 flex items-center justify-between"><div className="flex items-center rounded-lg border border-line"><button className="p-2 hover:bg-white/5" onClick={() => setLines((items) => items.map((x) => x.productId === line.productId ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x))}><Minus size={14} /></button><input className="w-16 bg-transparent text-center text-sm font-black outline-none" type="number" min="1" value={line.quantity} onChange={(e) => setLines((items) => items.map((x) => x.productId === line.productId ? { ...x, quantity: Math.max(1, Number(e.target.value) || 1) } : x))} /><button className="p-2 hover:bg-white/5" onClick={() => add(line.productId)}><Plus size={14} /></button></div><span className="text-xs text-slate-500">{currency(product.cost * line.quantity)}</span></div></div>; })}</div> : <div className="grid min-h-64 place-items-center text-center text-sm text-slate-500"><div><PackageCheck className="mx-auto mb-3" size={34} />Bipe o primeiro produto para iniciar.</div></div>}</div><div className="space-y-3 border-t border-line p-4"><label><span className="mb-1.5 block text-xs font-bold text-slate-400">Motivo da entrada</span><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></label><button className="btn-lime h-14 w-full" disabled={!lines.length} onClick={() => { try { receiveStock(lines, reason); toast.success(`${units} unidades adicionadas ao estoque.`); setLines([]); window.setTimeout(() => scannerRef.current?.focus(), 80); } catch (error) { toast.error(error instanceof Error ? error.message : "Falha ao aplicar a entrada."); } }}><CheckCircle2 size={19} /> Confirmar entrada</button></div></aside>
    </div>
  </>;
}
