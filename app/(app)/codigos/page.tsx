"use client";

import { AlertTriangle, Barcode, CheckCircle2, Keyboard, Link2, RotateCcw, ScanBarcode, Search, Sparkles, Undo2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import type { Product } from "@/lib/types";

function beep(ok = true) {
  try {
    const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    const ctx = new AudioCtor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = ok ? 920 : 220;
    gain.gain.value = 0.055;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
    osc.stop(ctx.currentTime + 0.1);
    window.setTimeout(() => void ctx.close(), 140);
  } catch {
    // O som é apenas um reforço; o fluxo continua mesmo quando o navegador bloqueia áudio.
  }
}

type RecentBinding = { productId: string; productName: string; barcode: string };

type Mode = "fila" | "codigo-primeiro";

export default function BarcodePage() {
  const { state, bindBarcode, unbindBarcode } = useStore();
  const toast = useToast();
  const scannerRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("fila");
  const [scanCode, setScanCode] = useState("");
  const [pendingCode, setPendingCode] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todas");
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [recent, setRecent] = useState<RecentBinding[]>([]);

  const scannable = useMemo(() => state.products.filter((p) => p.kind !== "combo"), [state.products]);
  const linked = scannable.filter((p) => Boolean(p.barcode));
  const unlinked = scannable.filter((p) => !p.barcode);
  const categories = useMemo(() => ["Todas", ...Array.from(new Set(scannable.map((p) => p.category))).sort((a, b) => a.localeCompare(b))], [scannable]);
  const queue = useMemo(() => unlinked
    .filter((p) => category === "Todas" || p.category === category)
    .filter((p) => [p.name, p.sku, p.category, p.brand].join(" ").toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)), [unlinked, category, search]);
  const current = queue.find((p) => p.id === selectedProductId) || queue[0];
  const progress = scannable.length ? Math.round((linked.length / scannable.length) * 100) : 100;

  useEffect(() => {
    if (mode !== "fila") return;
    if (current && current.id !== selectedProductId) setSelectedProductId(current.id);
    if (!current && selectedProductId) setSelectedProductId("");
  }, [current, selectedProductId, mode]);

  useEffect(() => {
    const timer = window.setTimeout(() => scannerRef.current?.focus(), 150);
    return () => window.clearTimeout(timer);
  }, [mode, selectedProductId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "F2") {
        event.preventDefault();
        scannerRef.current?.focus();
      }
      if (event.key === "F3") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const nextAfter = (productId: string) => {
    if (!autoAdvance) return;
    const index = queue.findIndex((p) => p.id === productId);
    const next = queue[index + 1] || queue.find((p) => p.id !== productId);
    setSelectedProductId(next?.id || "");
  };

  const saveBinding = (product: Product, code: string) => {
    const normalized = code.trim();
    if (!normalized) return;
    try {
      bindBarcode(product.id, normalized);
      setRecent((items) => [{ productId: product.id, productName: product.name, barcode: normalized }, ...items].slice(0, 12));
      beep(true);
      toast.success(`${product.name} vinculado ao código ${normalized}.`);
      setScanCode("");
      setPendingCode("");
      if (mode === "fila") nextAfter(product.id); else setSelectedProductId("");
      window.setTimeout(() => scannerRef.current?.focus(), 80);
    } catch (error) {
      beep(false);
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o código.");
      window.setTimeout(() => scannerRef.current?.select(), 80);
    }
  };

  const processQueueScan = () => {
    if (!current) {
      toast.error("Selecione um produto da fila antes de bipar.");
      return;
    }
    saveBinding(current, scanCode);
  };

  const processCodeFirst = () => {
    const code = scanCode.trim();
    if (!code) return;
    const existing = scannable.find((p) => p.barcode === code);
    if (existing) {
      beep(true);
      toast.success(`Código já cadastrado em ${existing.name}.`);
      setPendingCode("");
      setSelectedProductId("");
    } else {
      setPendingCode(code);
      toast.success("Código lido. Agora selecione o produto.");
    }
    setScanCode("");
  };

  return <>
    <PageHeader
      title="Códigos de barras"
      description="Implantação rápida: selecione o produto, bipe e o sistema salva automaticamente. Ideal para cadastrar a loja inteira sem digitação."
      actions={<div className="badge border-lime/30 bg-lime/10 text-lime"><ScanBarcode size={16} /> A4003 pronto</div>}
    />

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div className="stat"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Progresso</p><p className="mt-2 text-3xl font-black text-lime">{progress}%</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-lime" style={{ width: `${progress}%` }} /></div></div>
      <div className="stat"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Já vinculados</p><p className="mt-2 text-3xl font-black">{linked.length}</p><p className="mt-1 text-xs text-slate-500">de {scannable.length} produtos bipáveis</p></div>
      <div className="stat"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Faltando</p><p className="mt-2 text-3xl font-black text-amber-300">{unlinked.length}</p><p className="mt-1 text-xs text-slate-500">produtos sem EAN/UPC</p></div>
      <div className="stat"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nesta sessão</p><p className="mt-2 text-3xl font-black text-brand">{recent.length}</p><p className="mt-1 text-xs text-slate-500">vínculos recentes</p></div>
    </div>

    <div className="mt-6 grid gap-6 2xl:grid-cols-[1fr_390px]">
      <section className="space-y-4">
        <div className="panel p-4 md:p-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button className={mode === "fila" ? "btn-primary" : "btn-ghost"} onClick={() => { setMode("fila"); setPendingCode(""); setSelectedProductId(""); }}><Sparkles size={17} /> Fila rápida</button>
            <button className={mode === "codigo-primeiro" ? "btn-primary" : "btn-ghost"} onClick={() => { setMode("codigo-primeiro"); setPendingCode(""); setSelectedProductId(""); }}><Barcode size={17} /> Bipar primeiro</button>
            <label className="ml-auto flex items-center gap-2 rounded-xl border border-line bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-300"><input type="checkbox" className="h-4 w-4 accent-fuchsia-500" checked={autoAdvance} onChange={(e) => setAutoAdvance(e.target.checked)} /> Avançar automaticamente</label>
          </div>

          {mode === "fila" ? <>
            <div className={`mb-4 rounded-2xl border p-5 ${current ? "border-brand/40 bg-brand/[0.06]" : "border-lime/30 bg-lime/[0.06]"}`}>
              {current ? <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-brand">Produto atual</p><h2 className="mt-1 text-2xl font-black">{current.name}</h2><p className="mt-1 text-sm text-slate-400">{current.category} · {current.sku}</p></div><div className="rounded-xl border border-line bg-black/20 px-4 py-3 text-sm"><p className="text-xs text-slate-500">Preço</p><p className="font-black">R$ {current.price.toFixed(2).replace(".", ",")}</p></div></div> : <div className="flex items-center gap-3 text-lime"><CheckCircle2 size={28} /><div><p className="font-black">Fila concluída</p><p className="text-sm opacity-80">Todos os produtos deste filtro já possuem código.</p></div></div>}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); processQueueScan(); }}>
              <label><span className="mb-2 flex items-center gap-2 text-sm font-bold"><ScanBarcode className="text-lime" size={19} /> Agora apenas bipe o produto físico</span><div className="relative"><Barcode className="absolute left-4 top-1/2 -translate-y-1/2 text-brand" size={24} /><input ref={scannerRef} className="input h-16 pl-12 text-xl font-mono" value={scanCode} onChange={(e) => setScanCode(e.target.value)} placeholder={current ? "Bipe e o código será salvo automaticamente" : "Fila concluída"} disabled={!current} autoComplete="off" /></div></label>
            </form>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500"><span className="badge"><Keyboard size={14} /> F2: focar leitor</span><span className="badge"><Search size={14} /> F3: buscar produto</span><span>O leitor normalmente envia Enter sozinho; não é necessário clicar em Salvar.</span></div>
          </> : <>
            <form onSubmit={(e) => { e.preventDefault(); processCodeFirst(); }}><label><span className="mb-2 block text-sm font-bold">1. Bipe o código</span><div className="relative"><Barcode className="absolute left-4 top-1/2 -translate-y-1/2 text-brand" size={24} /><input ref={scannerRef} className="input h-16 pl-12 text-xl font-mono" value={scanCode} onChange={(e) => setScanCode(e.target.value)} placeholder="Bipe qualquer produto" autoComplete="off" /></div></label></form>
            <div className={`mt-4 rounded-xl border p-4 ${pendingCode ? "border-lime/30 bg-lime/5" : "border-line bg-white/[0.02]"}`}><p className="text-xs text-slate-500">Código aguardando vínculo</p><p className="mt-1 font-mono text-xl font-black">{pendingCode || "—"}</p></div>
            {pendingCode && <div className="mt-4"><p className="mb-2 text-sm font-bold">2. Selecione o produto</p><select className="select" value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)}><option value="">Selecione...</option>{queue.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</select><button className="btn-lime mt-3 w-full" disabled={!selectedProductId} onClick={() => { const product = queue.find((p) => p.id === selectedProductId); if (product) saveBinding(product, pendingCode); }}><Link2 size={17} /> Vincular e salvar</button></div>}
          </>}
        </div>

        <section className="panel p-4 md:p-5">
          <div className="mb-4 grid gap-3 md:grid-cols-[1fr_220px]">
            <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} /><input ref={searchRef} className="input pl-10" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar produto sem código" /></div>
            <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select>
          </div>
          <div className="table-wrap max-h-[520px]"><table className="table"><thead><tr><th>Próximos produtos</th><th>Categoria</th><th>SKU</th><th></th></tr></thead><tbody>{queue.map((product) => <tr key={product.id} className={current?.id === product.id ? "bg-brand/[0.08]" : ""}><td className="font-semibold">{product.name}</td><td>{product.category}</td><td className="font-mono text-xs">{product.sku}</td><td><button className={current?.id === product.id ? "btn-primary py-2" : "btn-ghost py-2"} onClick={() => { setSelectedProductId(product.id); window.setTimeout(() => scannerRef.current?.focus(), 50); }}>{current?.id === product.id ? "Atual" : "Selecionar"}</button></td></tr>)}</tbody></table>{!queue.length && <div className="grid min-h-36 place-items-center text-sm text-lime"><CheckCircle2 size={28} className="mb-2" /> Nenhum produto pendente neste filtro.</div>}</div>
        </section>
      </section>

      <aside className="space-y-4 2xl:sticky 2xl:top-24 2xl:h-fit">
        <section className="panel p-4"><div className="mb-3 flex items-center gap-2"><Undo2 size={18} className="text-brand" /><h2 className="font-bold">Últimos vinculados</h2></div>{recent.length ? <div className="space-y-2">{recent.map((item) => <div key={`${item.productId}-${item.barcode}`} className="panel-soft p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold">{item.productName}</p><p className="mt-1 font-mono text-xs text-lime">{item.barcode}</p></div><button className="rounded-lg border border-line p-2 text-amber-300 hover:bg-amber-500/10" title="Desfazer vínculo" onClick={() => { try { unbindBarcode(item.productId); setRecent((items) => items.filter((x) => !(x.productId === item.productId && x.barcode === item.barcode))); beep(false); toast.success("Vínculo desfeito."); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível desfazer."); } }}><RotateCcw size={15} /></button></div></div>)}</div> : <p className="text-sm text-slate-500">Os produtos bipados nesta sessão aparecerão aqui. Você pode desfazer um vínculo errado com um clique.</p>}</section>
        <section className="panel p-4"><div className="mb-3 flex items-center gap-2"><AlertTriangle size={18} className="text-amber-300" /><h2 className="font-bold">Fluxo recomendado</h2></div><ol className="space-y-3 text-sm text-slate-400"><li><strong className="text-white">1.</strong> Deixe a caixa/estoque físico na mesma ordem da fila.</li><li><strong className="text-white">2.</strong> Pegue o produto mostrado em destaque.</li><li><strong className="text-white">3.</strong> Bipe uma vez. O sistema salva e avança sozinho.</li><li><strong className="text-white">4.</strong> Se errar, use o botão de desfazer ao lado.</li></ol></section>
      </aside>
    </div>
  </>;
}
