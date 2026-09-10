"use client";

import Link from "next/link";
import { Barcode, CheckCircle2, Minus, PackageCheck, Plus, ScanBarcode, Search, Trash2, Truck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { findProductByBarcode } from "@/lib/business";
import { useStore } from "@/lib/store";
import { currency } from "@/lib/utils";

type ReceiptLine = { productId: string; quantity: number; unitCost?: number };

export default function ReceivingPage() {
  const { state, receiveStock } = useStore();
  const toast = useToast();
  const scannerRef = useRef<HTMLInputElement>(null);
  const lastScan = useRef<{ code: string; at: number } | null>(null);
  const [scan, setScan] = useState("");
  const [scanQty, setScanQty] = useState(1);
  const [query, setQuery] = useState("");
  const [reason, setReason] = useState("Recebimento de mercadoria");
  const [supplierId, setSupplierId] = useState("");
  const [lines, setLines] = useState<ReceiptLine[]>([]);

  useEffect(() => { const timer = window.setTimeout(() => scannerRef.current?.focus(), 180); return () => window.clearTimeout(timer); }, []);

  const products = useMemo(() => state.products.filter((product) => product.kind !== "combo" && [product.name, product.barcode, product.sku, product.category, product.brand].join(" ").toLowerCase().includes(query.toLowerCase())).slice(0, 24), [state.products, query]);
  const units = lines.reduce((sum, line) => sum + line.quantity, 0);
  const estimatedCost = lines.reduce((sum, line) => {
    const product = state.products.find((item) => item.id === line.productId);
    return sum + (line.unitCost ?? product?.cost ?? 0) * line.quantity;
  }, 0);

  const focusScanner = () => window.setTimeout(() => state.scannerSettings.autoFocus && scannerRef.current?.focus(), 60);

  const add = (productId: string, amount = 1) => {
    const safe = Math.max(1, Number(amount) || 1);
    setLines((items) => {
      const found = items.find((item) => item.productId === productId);
      if (found) return items.map((item) => item.productId === productId ? { ...item, quantity: item.quantity + safe } : item);
      const product = state.products.find((item) => item.id === productId);
      return [...items, { productId, quantity: safe, unitCost: product?.cost || undefined }];
    });
    focusScanner();
  };

  const processScan = () => {
    const code = scan.trim();
    if (!code) return;
    const now = Date.now();
    if (lastScan.current?.code === code && now - lastScan.current.at < state.scannerSettings.duplicateWindowMs) {
      setScan(""); toast.error("Leitura repetida muito rápido. Bipe novamente se precisar somar outra embalagem."); focusScanner(); return;
    }
    lastScan.current = { code, at: now };
    const match = findProductByBarcode(state.products.filter((product) => product.kind !== "combo"), code);
    if (!match) { toast.error("Código não encontrado. Cadastre-o antes de receber este item."); setScan(""); focusScanner(); return; }
    const amount = Math.max(1, scanQty) * match.multiplier;
    add(match.product.id, amount);
    setScan(""); setScanQty(1);
    toast.success(`${match.product.name}: +${amount}${match.multiplier > 1 ? ` (${match.binding.label})` : ""}.`);
  };

  return <>
    <PageHeader title="Entrada rápida" description="Receba mercadorias sem digitação: quantidade + bip. Códigos de caixa aplicam o multiplicador automaticamente." actions={<Link href="/codigos" className="btn-ghost"><ScanBarcode size={18} /> Cadastrar códigos</Link>} />

    <div className="grid gap-4 sm:grid-cols-3"><div className="stat"><p className="text-xs uppercase tracking-wide text-slate-500">Produtos</p><p className="mt-2 text-3xl font-black">{lines.length}</p></div><div className="stat"><p className="text-xs uppercase tracking-wide text-slate-500">Unidades</p><p className="mt-2 text-3xl font-black text-lime">{units}</p></div><div className="stat"><p className="text-xs uppercase tracking-wide text-slate-500">Custo estimado</p><p className="mt-2 text-3xl font-black text-brand">{currency(estimatedCost)}</p></div></div>

    <div className="mt-6 grid gap-6 2xl:grid-cols-[1fr_450px]">
      <section className="space-y-4">
        <div className="panel p-4 md:p-5">
          <div className="mb-3 grid gap-3 md:grid-cols-[1fr_280px]"><label><span className="mb-1.5 flex items-center gap-2 text-xs font-bold text-slate-400"><Truck size={15} /> Fornecedor</span><select className="select" value={supplierId} onChange={(event) => setSupplierId(event.target.value)}><option value="">Não informado</option>{state.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label><div className="rounded-xl border border-line bg-white/[0.03] p-3 text-xs text-slate-400"><strong className="text-white">Atalho:</strong> 12 + bip = 12 unidades. Se o código já for da caixa x24, um bip soma 24.</div></div>
          <form onSubmit={(event) => { event.preventDefault(); processScan(); }}><label><span className="mb-2 flex items-center gap-2 text-sm font-bold"><ScanBarcode size={19} className="text-lime" /> Bipe os produtos recebidos</span><div className="grid gap-2 sm:grid-cols-[96px_1fr_auto]"><input className="input h-16 text-center text-xl font-black" type="number" min="1" max="9999" value={scanQty} onChange={(event) => setScanQty(Math.max(1, Number(event.target.value) || 1))} title="Quantidade do próximo bip" /><div className="relative"><Barcode className="absolute left-4 top-1/2 -translate-y-1/2 text-brand" size={24} /><input ref={scannerRef} className="input h-16 pl-12 text-xl font-mono" value={scan} onChange={(event) => setScan(event.target.value)} placeholder="Bipe aqui" autoComplete="off" /></div><button className="btn-primary px-6">Somar</button></div></label></form>
        </div>

        <section className="panel p-4 md:p-5"><div className="relative mb-4"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} /><input className="input pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Adicionar manualmente por nome, SKU ou código" /></div><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{products.map((product) => <button key={product.id} onClick={() => add(product.id)} className="panel-soft p-3 text-left hover:border-brand/50"><p className="line-clamp-2 font-semibold">{product.name}</p><p className="mt-1 text-xs text-slate-500">{product.category} · estoque {product.stock}</p><p className="mt-2 text-xs font-mono text-lime">{product.barcode || "sem código"}</p></button>)}</div></section>
      </section>

      <aside className="panel h-fit 2xl:sticky 2xl:top-24"><div className="flex items-center justify-between border-b border-line p-4"><div className="flex items-center gap-2"><PackageCheck className="text-brand" size={20} /><h2 className="font-bold">Conferência</h2></div>{lines.length > 0 && <button className="text-xs font-bold text-red-300" onClick={() => setLines([])}>Limpar</button>}</div><div className="max-h-[52vh] min-h-72 overflow-auto p-4">{lines.length ? <div className="space-y-2">{lines.map((line) => { const product = state.products.find((item) => item.id === line.productId); if (!product) return null; const unitCost = line.unitCost ?? product.cost; return <div key={line.productId} className="panel-soft p-3"><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><p className="truncate font-semibold">{product.name}</p><p className="mt-1 text-xs text-slate-500">Antes {product.stock} → <strong className="text-lime">Depois {product.stock + line.quantity}</strong></p></div><button className="rounded-lg p-2 text-red-300 hover:bg-red-500/10" onClick={() => setLines((items) => items.filter((item) => item.productId !== line.productId))}><Trash2 size={15} /></button></div><div className="mt-3 grid grid-cols-[132px_1fr] gap-2"><div className="flex items-center rounded-lg border border-line"><button className="p-2 hover:bg-white/5" onClick={() => setLines((items) => items.map((item) => item.productId === line.productId ? { ...item, quantity: Math.max(1, item.quantity - 1) } : item))}><Minus size={14} /></button><input className="w-16 bg-transparent text-center text-sm font-black outline-none" type="number" min="1" value={line.quantity} onChange={(event) => setLines((items) => items.map((item) => item.productId === line.productId ? { ...item, quantity: Math.max(1, Number(event.target.value) || 1) } : item))} /><button className="p-2 hover:bg-white/5" onClick={() => add(line.productId)}><Plus size={14} /></button></div><label><span className="sr-only">Custo unitário</span><input className="input py-2 text-right text-xs" type="number" min="0" step="0.01" value={unitCost} onChange={(event) => setLines((items) => items.map((item) => item.productId === line.productId ? { ...item, unitCost: Math.max(0, Number(event.target.value) || 0) } : item))} title="Custo unitário" /></label></div><p className="mt-2 text-right text-xs text-slate-500">{currency(unitCost * line.quantity)}</p></div>; })}</div> : <div className="grid min-h-64 place-items-center text-center text-sm text-slate-500"><div><PackageCheck className="mx-auto mb-3" size={34} />Bipe o primeiro produto para iniciar.</div></div>}</div><div className="space-y-3 border-t border-line p-4"><label><span className="mb-1.5 block text-xs font-bold text-slate-400">Motivo / nota</span><input className="input" value={reason} onChange={(event) => setReason(event.target.value)} /></label><button className="btn-lime h-14 w-full" disabled={!lines.length} onClick={() => { try { receiveStock(lines, reason, supplierId || undefined); toast.success(`${units} unidades adicionadas ao estoque.`); setLines([]); focusScanner(); } catch (error) { toast.error(error instanceof Error ? error.message : "Falha ao aplicar a entrada."); } }}><CheckCircle2 size={19} /> Confirmar entrada</button></div></aside>
    </div>
  </>;
}
