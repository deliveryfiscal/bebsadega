"use client";

import { Barcode, CheckCircle2, ChevronDown, ChevronUp, Hash, Package, RotateCcw, ScanBarcode, Search, SkipForward } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { NumberInput } from "@/components/ui/number-input";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { generateInternalCode, productBarcodeBindings } from "@/lib/business";
import { useStore } from "@/lib/store";
import type { Product } from "@/lib/types";
import { currency } from "@/lib/utils";

function beep(success: boolean, enabled: boolean) {
  if (!enabled || typeof window === "undefined") return;
  try {
    const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    const context = new AudioCtor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = success ? 880 : 230;
    gain.gain.value = 0.035;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.08);
  } catch { /* som opcional */ }
}

type RecentBinding = { productId: string; productName: string; barcode: string; multiplier: number };

export default function BarcodesPage() {
  const { state, bindBarcode, unbindBarcode } = useStore();
  const toast = useToast();
  const scannerRef = useRef<HTMLInputElement>(null);
  const lastScan = useRef<{ code: string; at: number } | null>(null);
  const [scanCode, setScanCode] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todas");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [skipped, setSkipped] = useState<string[]>([]);
  const [chooseOpen, setChooseOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [multiplier, setMultiplier] = useState(1);
  const [label, setLabel] = useState("Unidade");
  const [recent, setRecent] = useState<RecentBinding[]>([]);

  const scannable = useMemo(() => state.products.filter((product) => product.kind !== "combo" && !product.doseSourceProductId), [state.products]);
  const linked = useMemo(() => scannable.filter((product) => Boolean(product.barcode)), [scannable]);
  const unlinked = useMemo(() => scannable.filter((product) => !product.barcode), [scannable]);
  const categories = useMemo(() => ["Todas", ...Array.from(new Set(scannable.map((product) => product.category))).sort((a, b) => a.localeCompare(b, "pt-BR"))], [scannable]);
  const queue = useMemo(() => unlinked.filter((product) => {
    if (skipped.includes(product.id)) return false;
    if (category !== "Todas" && product.category !== category) return false;
    const text = `${product.name} ${product.sku} ${product.category}`.toLowerCase();
    return text.includes(search.toLowerCase());
  }), [unlinked, category, search, skipped]);
  const current = scannable.find((product) => product.id === selectedProductId && !product.barcode) || queue[0] || null;
  const progress = scannable.length ? Math.round((linked.length / scannable.length) * 100) : 100;

  const focusScanner = () => window.setTimeout(() => scannerRef.current?.focus(), 70);

  useEffect(() => {
    const timer = window.setTimeout(() => scannerRef.current?.focus(), 180);
    return () => window.clearTimeout(timer);
  }, [current?.id]);

  const guardDuplicate = (code: string) => {
    const now = Date.now();
    if (lastScan.current?.code === code && now - lastScan.current.at < state.scannerSettings.duplicateWindowMs) return false;
    lastScan.current = { code, at: now };
    return true;
  };

  const saveBinding = (product: Product, rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;
    if (!guardDuplicate(code)) {
      toast.error("Esse código acabou de ser lido. Aguarde um instante e tente de novo.");
      setScanCode("");
      focusScanner();
      return;
    }
    try {
      bindBarcode(product.id, code, Math.max(1, Math.floor(multiplier || 1)), label.trim() || "Unidade", !product.barcode);
      setRecent((items) => [{ productId: product.id, productName: product.name, barcode: code, multiplier }, ...items].slice(0, 8));
      beep(true, state.scannerSettings.soundEnabled);
      toast.success(`${product.name}: código salvo. Agora pegue o próximo produto.`);
      setScanCode("");
      setSelectedProductId("");
      setMultiplier(1);
      setLabel("Unidade");
      focusScanner();
    } catch (error) {
      beep(false, state.scannerSettings.soundEnabled);
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o código.");
      setScanCode("");
      focusScanner();
    }
  };

  const generateCode = () => {
    if (!current) return;
    try {
      const code = generateInternalCode(state.products);
      bindBarcode(current.id, code, 1, "Código interno", true);
      setRecent((items) => [{ productId: current.id, productName: current.name, barcode: code, multiplier: 1 }, ...items].slice(0, 8));
      beep(true, state.scannerSettings.soundEnabled);
      toast.success(`${current.name}: código interno ${code} criado.`);
      setSelectedProductId("");
      focusScanner();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar o código.");
    }
  };

  const skipCurrent = () => {
    if (!current) return;
    setSkipped((items) => [...items, current.id]);
    setSelectedProductId("");
    setScanCode("");
    focusScanner();
  };

  return <>
    <PageHeader
      title="Cadastrar códigos"
      description="Feito para ser simples: veja o produto na tela, pegue na prateleira e bipe uma vez. O sistema salva e passa sozinho para o próximo."
      actions={<div className="badge border-lime/30 bg-lime/10 text-lime"><ScanBarcode size={16} /> Leitor pronto</div>}
    />

    <div className="grid gap-4 md:grid-cols-3">
      <div className="stat md:col-span-2">
        <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Progresso do cadastro</p><p className="mt-1 text-3xl font-black text-lime">{linked.length} de {scannable.length}</p></div><p className="text-4xl font-black text-white">{progress}%</p></div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-lime transition-all" style={{ width: `${progress}%` }} /></div>
      </div>
      <div className="stat"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Ainda faltam</p><p className="mt-2 text-4xl font-black text-amber-300">{unlinked.length}</p><p className="mt-1 text-sm text-slate-500">produtos sem código</p></div>
    </div>

    <section className="panel mt-6 overflow-hidden">
      {current ? <>
        <div className="border-b border-line bg-brand/[0.05] p-5 md:p-7">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-brand">Produto da vez</p>
          <h2 className="mt-2 text-3xl font-black md:text-4xl">{current.name}</h2>
          <div className="mt-3 flex flex-wrap gap-2"><span className="badge">{current.category}</span><span className="badge font-mono">{current.sku}</span>{current.price > 0 && <span className="badge border-lime/30 bg-lime/10 text-lime">{currency(current.price)}</span>}</div>
          <p className="mt-4 text-base text-slate-300">Pegue <strong className="text-white">esse produto</strong> e passe o leitor no código de barras.</p>
        </div>

        <div className="p-5 md:p-7">
          <form onSubmit={(event) => { event.preventDefault(); saveBinding(current, scanCode); }}>
            <label className="block">
              <span className="mb-2 block text-base font-black">1. Bipe aqui</span>
              <div className="relative"><Barcode className="absolute left-5 top-1/2 -translate-y-1/2 text-lime" size={30} /><input ref={scannerRef} className="input h-20 pl-16 text-2xl font-mono font-black" value={scanCode} onChange={(event) => setScanCode(event.target.value)} placeholder="Passe o leitor no produto" autoComplete="off" /></div>
            </label>
            <p className="mt-2 text-sm text-slate-500">O leitor normalmente envia Enter sozinho. Não precisa clicar em Salvar.</p>
          </form>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <button type="button" className="btn-lime h-16 text-base" onClick={generateCode}><Hash size={22} /> Produto sem código<br className="hidden md:block" /> Gerar 4 dígitos</button>
            <button type="button" className="btn-ghost h-16 text-base" onClick={() => setChooseOpen((value) => !value)}><Search size={21} /> Escolher outro produto</button>
            <button type="button" className="btn-ghost h-16 text-base" onClick={skipCurrent}><SkipForward size={21} /> Pular por enquanto</button>
          </div>

          <button type="button" className="btn-ghost mt-5 w-full justify-between" onClick={() => setAdvancedOpen((value) => !value)}><span><Package size={17} className="mr-2 inline" /> Código de caixa/pack (opcional)</span>{advancedOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>
          {advancedOpen && <div className="mt-3 grid gap-3 rounded-xl border border-line bg-white/[0.02] p-4 sm:grid-cols-2"><label><span className="mb-1.5 block text-sm font-semibold">Quantas unidades existem nessa embalagem?</span><NumberInput className="input h-12" min={1} step={1} emptyWhenZero={false} value={multiplier} onValueChange={(value) => { const safe = Math.max(1, value); setMultiplier(safe); setLabel(safe === 1 ? "Unidade" : `Caixa/pack x${safe}`); }} /></label><label><span className="mb-1.5 block text-sm font-semibold">Nome da embalagem</span><input className="input h-12" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Ex.: Caixa com 12" /></label><p className="sm:col-span-2 text-xs text-slate-500">Use somente quando estiver cadastrando o código da caixa ou pack. Para unidade, deixe x1.</p></div>}
        </div>
      </> : <div className="grid min-h-[360px] place-items-center p-8 text-center"><div><CheckCircle2 className="mx-auto text-lime" size={60} /><h2 className="mt-4 text-3xl font-black">Tudo cadastrado neste filtro</h2><p className="mt-2 text-slate-400">Se você pulou algum produto, use “Mostrar pulados” abaixo.</p>{skipped.length > 0 && <button className="btn-primary mt-5" onClick={() => setSkipped([])}>Mostrar {skipped.length} pulado(s)</button>}</div></div>}
    </section>

    {chooseOpen && <section className="panel mt-5 p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-xl font-black">Escolher outro produto</h2><p className="text-sm text-slate-500">Use somente se o produto mostrado não estiver na sua mão agora.</p></div><button className="btn-ghost" onClick={() => setChooseOpen(false)}>Fechar</button></div><div className="grid gap-3 sm:grid-cols-[1fr_240px]"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} /><input className="input h-12 pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Digite parte do nome" /></div><select className="select h-12" value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></div><div className="mt-4 grid max-h-[420px] gap-2 overflow-y-auto md:grid-cols-2">{queue.map((product) => <button key={product.id} className="panel-soft flex items-center justify-between gap-3 p-4 text-left hover:border-brand/50" onClick={() => { setSelectedProductId(product.id); setChooseOpen(false); focusScanner(); }}><div className="min-w-0"><p className="truncate font-bold">{product.name}</p><p className="mt-1 text-xs text-slate-500">{product.category}</p></div><span className="text-sm font-black text-lime">{product.price > 0 ? currency(product.price) : "Preço pendente"}</span></button>)}</div></section>}

    {recent.length > 0 && <section className="panel mt-5 p-5"><h2 className="mb-3 font-black">Últimos códigos salvos</h2><div className="grid gap-2 md:grid-cols-2">{recent.map((item) => <div key={`${item.productId}-${item.barcode}`} className="panel-soft flex items-center justify-between gap-3 p-3"><div className="min-w-0"><p className="truncate font-semibold">{item.productName}</p><p className="font-mono text-sm text-lime">{item.barcode}{item.multiplier > 1 ? ` · x${item.multiplier}` : ""}</p></div><button className="rounded-lg border border-line p-2 text-amber-300 hover:bg-amber-500/10" title="Desfazer" onClick={() => { try { unbindBarcode(item.productId, item.barcode); setRecent((items) => items.filter((value) => value.barcode !== item.barcode)); toast.success("Código removido."); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível remover."); } }}><RotateCcw size={17} /></button></div>)}</div></section>}
  </>;
}
