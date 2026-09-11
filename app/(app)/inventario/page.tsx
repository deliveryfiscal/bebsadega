"use client";

import { Barcode, CheckCircle2, ClipboardCheck, RotateCcw, ScanBarcode, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { NumberInput } from "@/components/ui/number-input";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { findProductByBarcode, isDoseShortcut } from "@/lib/business";
import { useStore } from "@/lib/store";

export default function InventoryPage() {
  const { state, setStockCount } = useStore();
  const toast = useToast();
  const scannerRef = useRef<HTMLInputElement>(null);
  const lastScan = useRef<{ code: string; at: number } | null>(null);
  const [scan, setScan] = useState("");
  const [scanQty, setScanQty] = useState(1);
  const [query, setQuery] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("Inventário físico");

  useEffect(() => { const timer = window.setTimeout(() => scannerRef.current?.focus(), 180); return () => window.clearTimeout(timer); }, []);
  const products = useMemo(() => state.products.filter((product) => product.kind !== "combo" && !isDoseShortcut(product) && [product.name, product.barcode, product.sku, product.category].join(" ").toLowerCase().includes(query.toLowerCase())).slice(0, 30), [state.products, query]);
  const countedIds = Object.keys(counts);
  const divergences = countedIds.map((id) => {
    const product = state.products.find((item) => item.id === id);
    return product ? { product, counted: counts[id], difference: counts[id] - product.stock } : null;
  }).filter((item): item is NonNullable<typeof item> => Boolean(item));
  const differenceCount = divergences.filter((item) => Math.abs(item.difference) > 0.0001).length;
  const focusScanner = () => window.setTimeout(() => state.scannerSettings.autoFocus && scannerRef.current?.focus(), 60);

  const addCount = (productId: string, amount: number) => {
    setCounts((current) => ({ ...current, [productId]: Math.max(0, (current[productId] || 0) + amount) }));
    focusScanner();
  };

  const processScan = () => {
    const code = scan.trim();
    if (!code) return;
    const now = Date.now();
    if (lastScan.current?.code === code && now - lastScan.current.at < state.scannerSettings.duplicateWindowMs) {
      setScan(""); toast.error("Leitura repetida muito rápido."); focusScanner(); return;
    }
    lastScan.current = { code, at: now };
    const match = findProductByBarcode(state.products.filter((product) => product.kind !== "combo" && !isDoseShortcut(product)), code);
    if (!match) { setScan(""); toast.error("Código não cadastrado."); focusScanner(); return; }
    const amount = Math.max(1, scanQty) * match.multiplier;
    addCount(match.product.id, amount);
    setScan(""); setScanQty(1);
    toast.success(`${match.product.name}: contagem +${amount}.`);
  };

  return <>
    <PageHeader title="Inventário express" description="Ande pela loja bipando. Ao final, o sistema mostra somente as divergências antes de ajustar o estoque." actions={<button className="btn-ghost" disabled={!countedIds.length} onClick={() => { if (window.confirm("Limpar a contagem atual?")) setCounts({}); }}><RotateCcw size={17} /> Reiniciar</button>} />

    <div className="grid gap-4 sm:grid-cols-3"><div className="stat"><p className="text-xs uppercase tracking-wide text-slate-500">Produtos contados</p><p className="mt-2 text-3xl font-black">{countedIds.length}</p></div><div className="stat"><p className="text-xs uppercase tracking-wide text-slate-500">Unidades encontradas</p><p className="mt-2 text-3xl font-black text-lime">{Object.values(counts).reduce((sum, value) => sum + value, 0)}</p></div><div className="stat"><p className="text-xs uppercase tracking-wide text-slate-500">Divergências</p><p className={`mt-2 text-3xl font-black ${differenceCount ? "text-amber-300" : "text-lime"}`}>{differenceCount}</p></div></div>

    <div className="mt-6 grid gap-6 2xl:grid-cols-[1fr_500px]">
      <section className="space-y-4">
        <div className="panel p-5"><form onSubmit={(event) => { event.preventDefault(); processScan(); }}><span className="mb-2 flex items-center gap-2 text-sm font-bold"><ScanBarcode size={19} className="text-lime" /> Contar por bipagem</span><div className="grid gap-2 sm:grid-cols-[96px_1fr_auto]"><NumberInput className="input h-16 text-center text-xl font-black" min={1} step={1} emptyWhenZero={false} value={scanQty} onValueChange={setScanQty} /><div className="relative"><Barcode className="absolute left-4 top-1/2 -translate-y-1/2 text-brand" size={24} /><input ref={scannerRef} className="input h-16 pl-12 text-xl font-mono" value={scan} onChange={(event) => setScan(event.target.value)} placeholder="Bipe o produto" autoComplete="off" /></div><button className="btn-primary px-6">Contar</button></div></form><p className="mt-2 text-xs text-slate-500">Digite uma quantidade antes do bip para contar várias unidades de uma vez. Códigos de caixa respeitam o multiplicador cadastrado.</p></div>

        <section className="panel p-5"><div className="relative mb-4"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} /><input className="input pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Contagem manual por nome, SKU ou código" /></div><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{products.map((product) => <button key={product.id} className="panel-soft p-3 text-left hover:border-brand/50" onClick={() => addCount(product.id, 1)}><p className="truncate font-semibold">{product.name}</p><p className="mt-1 text-xs text-slate-500">Sistema: {product.stock} · Contado: {counts[product.id] ?? 0}</p></button>)}</div></section>
      </section>

      <aside className="panel h-fit 2xl:sticky 2xl:top-24"><div className="border-b border-line p-4"><div className="flex items-center gap-2"><ClipboardCheck size={20} className="text-brand" /><h2 className="font-bold">Conferência</h2></div><p className="mt-1 text-xs text-slate-500">Ajustes só acontecem depois da confirmação.</p></div><div className="max-h-[55vh] min-h-72 overflow-auto p-4">{divergences.length ? <div className="space-y-2">{divergences.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference)).map(({ product, counted, difference }) => <div key={product.id} className={`rounded-xl border p-3 ${Math.abs(difference) > 0.0001 ? "border-amber-500/25 bg-amber-500/[0.04]" : "border-line bg-white/[0.02]"}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold">{product.name}</p><p className="mt-1 text-xs text-slate-500">Sistema {product.stock}</p></div><NumberInput className="input w-24 py-2 text-center font-black" min={0} step={1} value={counted} onValueChange={(value) => setCounts((current) => ({ ...current, [product.id]: value }))} /></div><div className="mt-2 flex justify-between text-xs"><span className="text-slate-500">Diferença</span><strong className={difference === 0 ? "text-lime" : difference > 0 ? "text-cyan-300" : "text-amber-300"}>{difference > 0 ? "+" : ""}{difference}</strong></div></div>)}</div> : <div className="grid min-h-64 place-items-center text-center text-sm text-slate-500"><div><ClipboardCheck className="mx-auto mb-3" size={34} />Nenhum produto contado.</div></div>}</div><div className="space-y-3 border-t border-line p-4"><label><span className="mb-1.5 block text-xs font-bold text-slate-400">Motivo</span><input className="input" value={reason} onChange={(event) => setReason(event.target.value)} /></label><button className="btn-lime h-14 w-full" disabled={!countedIds.length} onClick={() => { if (!window.confirm(`Aplicar o inventário? ${differenceCount} produto(s) terão o estoque ajustado.`)) return; try { const result = setStockCount(counts, reason); toast.success(`Inventário concluído: ${result.adjusted} ajustes.`); setCounts({}); focusScanner(); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível concluir o inventário."); } }}><CheckCircle2 size={18} /> Conferir e aplicar</button></div></aside>
    </div>
  </>;
}
