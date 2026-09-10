"use client";

import { Barcode, CheckCircle2, Search, ScanBarcode } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { findProductByBarcode } from "@/lib/business";
import { useStore } from "@/lib/store";
import type { Product } from "@/lib/types";
import { currency } from "@/lib/utils";

export default function PriceCheckPage() {
  const { state } = useStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const resetTimer = useRef<number | null>(null);
  const [scan, setScan] = useState("");
  const [query, setQuery] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [message, setMessage] = useState("Bipe um produto para consultar o preço.");

  useEffect(() => {
    const timer = window.setTimeout(() => inputRef.current?.focus(), 160);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => () => { if (resetTimer.current) window.clearTimeout(resetTimer.current); }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return state.products.filter((item) => item.active && [item.name, item.sku, item.barcode, item.category, item.brand].join(" ").toLowerCase().includes(q)).slice(0, 12);
  }, [query, state.products]);

  const showProduct = (item: Product) => {
    setProduct(item);
    setMessage("Produto encontrado.");
    setScan("");
    setQuery("");
    if (resetTimer.current) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => {
      setProduct(null);
      setMessage("Pronto para a próxima consulta.");
      inputRef.current?.focus();
    }, 8000);
    window.setTimeout(() => inputRef.current?.focus(), 60);
  };

  const processScan = () => {
    const match = findProductByBarcode(state.products.filter((item) => item.active), scan);
    if (!match) {
      setProduct(null);
      setMessage("Código não cadastrado. Use a aba Cadastrar códigos para vincular este produto.");
      setScan("");
      window.setTimeout(() => inputRef.current?.focus(), 60);
      return;
    }
    showProduct(match.product);
  };

  return <>
    <PageHeader title="Consultar preço" description="Bipe e veja o preço imediatamente. A tela volta sozinha para a próxima consulta." />

    <div className="mx-auto max-w-4xl space-y-6">
      <section className="panel p-5 md:p-7">
        <form onSubmit={(event) => { event.preventDefault(); processScan(); }}>
          <span className="mb-2 flex items-center gap-2 text-sm font-bold"><ScanBarcode size={19} className="text-lime" /> Leitor de código de barras</span>
          <div className="relative"><Barcode className="absolute left-4 top-1/2 -translate-y-1/2 text-brand" size={26} /><input ref={inputRef} className="input h-20 pl-14 text-2xl font-mono" value={scan} onChange={(event) => setScan(event.target.value)} placeholder="Bipe o produto" autoComplete="off" /></div>
        </form>
      </section>

      {product ? <section className="rounded-3xl border border-lime/30 bg-lime/[0.05] p-6 md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0"><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-lime/30 bg-lime/10 px-3 py-1 text-xs font-bold text-lime"><CheckCircle2 size={14} /> Encontrado</div><h2 className="text-3xl font-black tracking-tight md:text-4xl">{product.name}</h2><p className="mt-2 text-slate-400">{product.category} · {product.sku}{product.location ? ` · ${product.location}` : ""}</p></div>
          <div className="text-left md:text-right"><p className="text-xs font-bold uppercase tracking-widest text-slate-500">Preço de venda</p><p className="mt-2 text-5xl font-black text-lime md:text-6xl">{currency(product.price)}</p><p className="mt-2 text-sm text-slate-400">Estoque: {product.kind === "volume" ? `${product.stock} garrafa(s)` : product.stock}</p></div>
        </div>
      </section> : <section className="panel-soft grid min-h-48 place-items-center p-6 text-center"><div><ScanBarcode className="mx-auto mb-3 text-slate-600" size={36} /><p className="font-semibold">{message}</p></div></section>}

      <section className="panel p-5">
        <label><span className="mb-2 flex items-center gap-2 text-sm font-bold"><Search size={18} /> Busca manual</span><input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, SKU, marca ou categoria" /></label>
        {results.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-2">{results.map((item) => <button key={item.id} className="panel-soft p-3 text-left hover:border-brand/50" onClick={() => showProduct(item)}><p className="truncate font-semibold">{item.name}</p><div className="mt-1 flex items-center justify-between gap-3 text-xs"><span className="truncate text-slate-500">{item.sku} · estoque {item.stock}</span><strong className="text-lime">{currency(item.price)}</strong></div></button>)}</div>}
      </section>
    </div>
  </>;
}
