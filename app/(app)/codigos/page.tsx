"use client";

import { AlertTriangle, Barcode, CheckCircle2, Keyboard, Link2, Package, RotateCcw, ScanBarcode, Search, Settings2, Sparkles, Undo2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { NumberInput } from "@/components/ui/number-input";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { findProductByBarcode, productBarcodeBindings } from "@/lib/business";
import { useStore } from "@/lib/store";
import type { Product } from "@/lib/types";

function beep(success: boolean, enabled: boolean) {
  if (!enabled || typeof window === "undefined") return;
  try {
    const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    const context = new AudioCtor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = success ? 850 : 240;
    gain.gain.value = 0.035;
    oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.07);
  } catch { /* áudio é opcional */ }
}

type RecentBinding = { productId: string; productName: string; barcode: string; multiplier: number };

type Mode = "fila" | "codigo-primeiro" | "teste";

export default function BarcodesPage() {
  const { state, bindBarcode, unbindBarcode } = useStore();
  const toast = useToast();
  const scannerRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const lastScan = useRef<{ code: string; at: number } | null>(null);
  const [mode, setMode] = useState<Mode>("fila");
  const [scanCode, setScanCode] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todas");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [pendingCode, setPendingCode] = useState("");
  const [multiplier, setMultiplier] = useState(1);
  const [customMultiplier, setCustomMultiplier] = useState(1);
  const [label, setLabel] = useState("Unidade");
  const [recent, setRecent] = useState<RecentBinding[]>([]);
  const [testResult, setTestResult] = useState<{ product: Product; multiplier: number; label: string } | null>(null);

  const scannable = useMemo(() => state.products.filter((product) => product.kind !== "combo"), [state.products]);
  const linked = useMemo(() => scannable.filter((product) => Boolean(product.barcode)), [scannable]);
  const unlinked = useMemo(() => scannable.filter((product) => !product.barcode), [scannable]);
  const categories = useMemo(() => ["Todas", ...Array.from(new Set(scannable.map((product) => product.category))).sort((a, b) => a.localeCompare(b))], [scannable]);
  const queue = useMemo(() => unlinked.filter((product) => {
    if (category !== "Todas" && product.category !== category) return false;
    return [product.name, product.sku, product.category, product.brand].join(" ").toLowerCase().includes(search.toLowerCase());
  }), [unlinked, category, search]);
  const current = queue.find((product) => product.id === selectedProductId) || queue[0] || null;
  const progress = scannable.length ? Math.round((linked.length / scannable.length) * 100) : 100;
  const totalCodes = scannable.reduce((sum, product) => sum + productBarcodeBindings(product).length, 0);

  useEffect(() => { const timer = window.setTimeout(() => scannerRef.current?.focus(), 180); return () => window.clearTimeout(timer); }, [mode]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "F2") { event.preventDefault(); scannerRef.current?.focus(); }
      if (event.key === "F3") { event.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const safeMultiplier = multiplier === 0 ? Math.max(1, Math.floor(customMultiplier || 1)) : multiplier;
  const autoLabel = safeMultiplier === 1 ? "Unidade" : `Embalagem x${safeMultiplier}`;

  const setPackage = (value: number) => {
    setMultiplier(value);
    const actual = value === 0 ? customMultiplier : value;
    setLabel(actual === 1 ? "Unidade" : `Embalagem x${actual}`);
  };

  const focusScanner = () => window.setTimeout(() => state.scannerSettings.autoFocus && scannerRef.current?.focus(), 60);

  const guardDuplicate = (code: string) => {
    const now = Date.now();
    if (lastScan.current?.code === code && now - lastScan.current.at < state.scannerSettings.duplicateWindowMs) return false;
    lastScan.current = { code, at: now };
    return true;
  };

  const saveBinding = (product: Product, rawCode: string, makePrimary = !product.barcode) => {
    const code = rawCode.trim();
    if (!code) return;
    if (!guardDuplicate(code)) { toast.error("Leitura repetida muito rápido."); setScanCode(""); focusScanner(); return; }
    try {
      bindBarcode(product.id, code, safeMultiplier, label.trim() || autoLabel, makePrimary);
      setRecent((items) => [{ productId: product.id, productName: product.name, barcode: code, multiplier: safeMultiplier }, ...items].slice(0, 12));
      beep(true, state.scannerSettings.soundEnabled);
      toast.success(`${product.name} · código salvo${safeMultiplier > 1 ? ` (x${safeMultiplier})` : ""}.`);
      setScanCode(""); setPendingCode(""); setSelectedProductId(""); setMultiplier(1); setCustomMultiplier(1); setLabel("Unidade");
      focusScanner();
    } catch (error) {
      beep(false, state.scannerSettings.soundEnabled);
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o código.");
      setScanCode(""); focusScanner();
    }
  };

  const processQueueScan = () => {
    if (!current) { toast.error("A fila está concluída ou nenhum produto está selecionado."); return; }
    saveBinding(current, scanCode, true);
  };

  const processCodeFirst = () => {
    const code = scanCode.trim();
    if (!code) return;
    if (!guardDuplicate(code)) { toast.error("Leitura repetida muito rápido."); setScanCode(""); return; }
    const existing = findProductByBarcode(scannable, code);
    if (existing) {
      beep(true, state.scannerSettings.soundEnabled);
      toast.success(`Já cadastrado em ${existing.product.name} (${existing.binding.label} · x${existing.multiplier}).`);
      setPendingCode("");
    } else {
      setPendingCode(code);
      toast.success("Código lido. Selecione o produto e salve.");
    }
    setScanCode("");
  };

  const processTest = () => {
    const code = scanCode.trim();
    if (!code) return;
    const match = findProductByBarcode(scannable, code);
    setScanCode("");
    if (!match) { setTestResult(null); beep(false, state.scannerSettings.soundEnabled); toast.error("Leitor funcionou, mas este código ainda não está cadastrado."); }
    else { setTestResult({ product: match.product, multiplier: match.multiplier, label: match.binding.label }); beep(true, state.scannerSettings.soundEnabled); toast.success("Leitura reconhecida corretamente."); }
    focusScanner();
  };

  return <>
    <PageHeader title="Códigos de barras" description="Cadastro em sequência: pegue o produto, bipe e avance. Sem ficar clicando em salvar." actions={<div className="badge border-lime/30 bg-lime/10 text-lime"><ScanBarcode size={16} /> A4003 / HID pronto</div>} />

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div className="stat"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Implantação</p><p className="mt-2 text-3xl font-black text-lime">{progress}%</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-lime" style={{ width: `${progress}%` }} /></div></div>
      <div className="stat"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Produtos com código</p><p className="mt-2 text-3xl font-black">{linked.length}</p><p className="mt-1 text-xs text-slate-500">de {scannable.length}</p></div>
      <div className="stat"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Faltando principal</p><p className="mt-2 text-3xl font-black text-amber-300">{unlinked.length}</p><p className="mt-1 text-xs text-slate-500">produtos para bipar</p></div>
      <div className="stat"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Códigos cadastrados</p><p className="mt-2 text-3xl font-black text-brand">{totalCodes}</p><p className="mt-1 text-xs text-slate-500">inclui caixas e packs</p></div>
    </div>

    <div className="mt-6 grid gap-6 2xl:grid-cols-[1fr_400px]">
      <section className="space-y-4">
        <div className="panel p-4 md:p-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button className={mode === "fila" ? "btn-primary" : "btn-ghost"} onClick={() => { setMode("fila"); setPendingCode(""); }}><Sparkles size={17} /> Fila rápida</button>
            <button className={mode === "codigo-primeiro" ? "btn-primary" : "btn-ghost"} onClick={() => { setMode("codigo-primeiro"); setPendingCode(""); }}><Barcode size={17} /> Bipar primeiro</button>
            <button className={mode === "teste" ? "btn-primary" : "btn-ghost"} onClick={() => { setMode("teste"); setPendingCode(""); setTestResult(null); }}><Settings2 size={17} /> Testar leitor</button>
          </div>

          {mode !== "teste" && <div className="mb-4 grid gap-3 rounded-xl border border-line bg-white/[0.02] p-3 sm:grid-cols-[1fr_1fr]">
            <div><p className="mb-2 text-xs font-bold text-slate-400">Tipo do código</p><div className="flex flex-wrap gap-2">{[1, 6, 12, 24].map((value) => <button key={value} type="button" className={multiplier === value ? "btn-primary py-2" : "btn-ghost py-2"} onClick={() => setPackage(value)}>{value === 1 ? "Unidade" : `x${value}`}</button>)}<button type="button" className={multiplier === 0 ? "btn-primary py-2" : "btn-ghost py-2"} onClick={() => setPackage(0)}>Outro</button></div></div>
            <div className="grid grid-cols-[100px_1fr] gap-2"><label><span className="mb-2 block text-xs font-bold text-slate-400">Multiplica</span><NumberInput className="input" min={1} step={1} emptyWhenZero={false} disabled={multiplier !== 0} value={multiplier === 0 ? customMultiplier : multiplier} onValueChange={(value) => { setCustomMultiplier(value); setLabel(value === 1 ? "Unidade" : `Embalagem x${value}`); }} /></label><label><span className="mb-2 block text-xs font-bold text-slate-400">Nome da embalagem</span><input className="input" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Ex.: Caixa 24" /></label></div>
          </div>}

          {mode === "fila" && <>
            <div className={`mb-4 rounded-2xl border p-5 ${current ? "border-brand/40 bg-brand/[0.06]" : "border-lime/30 bg-lime/[0.06]"}`}>{current ? <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-brand">Produto atual</p><h2 className="mt-1 text-2xl font-black">{current.name}</h2><p className="mt-1 text-sm text-slate-400">{current.category} · {current.sku}{current.location ? ` · ${current.location}` : ""}</p></div><div className="rounded-xl border border-line bg-black/20 px-4 py-3 text-right"><p className="text-xs text-slate-500">Ação</p><p className="font-bold text-lime">Pegue e bipe</p></div></div> : <div className="flex items-center gap-3 text-lime"><CheckCircle2 size={28} /><div><p className="font-black">Fila concluída</p><p className="text-sm opacity-80">Todos os produtos deste filtro têm código principal.</p></div></div>}</div>
            <form onSubmit={(event) => { event.preventDefault(); processQueueScan(); }}><label><span className="mb-2 flex items-center gap-2 text-sm font-bold"><ScanBarcode className="text-lime" size={19} /> Bipe o produto físico</span><div className="relative"><Barcode className="absolute left-4 top-1/2 -translate-y-1/2 text-brand" size={24} /><input ref={scannerRef} className="input h-16 pl-12 text-xl font-mono" value={scanCode} onChange={(event) => setScanCode(event.target.value)} placeholder={current ? "Bipou → salvou → próximo" : "Fila concluída"} disabled={!current} autoComplete="off" /></div></label></form>
          </>}

          {mode === "codigo-primeiro" && <>
            <form onSubmit={(event) => { event.preventDefault(); processCodeFirst(); }}><label><span className="mb-2 block text-sm font-bold">1. Bipe qualquer código</span><div className="relative"><Barcode className="absolute left-4 top-1/2 -translate-y-1/2 text-brand" size={24} /><input ref={scannerRef} className="input h-16 pl-12 text-xl font-mono" value={scanCode} onChange={(event) => setScanCode(event.target.value)} placeholder="Bipe o produto" autoComplete="off" /></div></label></form>
            <div className={`mt-4 rounded-xl border p-4 ${pendingCode ? "border-lime/30 bg-lime/5" : "border-line bg-white/[0.02]"}`}><p className="text-xs text-slate-500">Código aguardando vínculo</p><p className="mt-1 font-mono text-xl font-black">{pendingCode || "—"}</p></div>
            {pendingCode && <div className="mt-4"><p className="mb-2 text-sm font-bold">2. Escolha o produto</p><select className="select" value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)}><option value="">Selecione...</option>{scannable.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.sku}</option>)}</select><button className="btn-lime mt-3 w-full" disabled={!selectedProductId} onClick={() => { const product = scannable.find((item) => item.id === selectedProductId); if (product) saveBinding(product, pendingCode, !product.barcode); }}><Link2 size={17} /> Vincular e salvar</button><p className="mt-2 text-xs text-slate-500">Se o produto já possui código principal, este será salvo como código adicional (caixa, pack ou embalagem).</p></div>}
          </>}

          {mode === "teste" && <>
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.04] p-4 text-sm text-slate-300"><strong className="text-white">Teste do A4003:</strong> clique no campo uma vez e bipe. Se o leitor estiver em modo teclado/HID, o código aparecerá e será processado com Enter.</div>
            <form className="mt-4" onSubmit={(event) => { event.preventDefault(); processTest(); }}><div className="relative"><ScanBarcode className="absolute left-4 top-1/2 -translate-y-1/2 text-lime" size={24} /><input ref={scannerRef} className="input h-20 pl-12 text-2xl font-mono" value={scanCode} onChange={(event) => setScanCode(event.target.value)} placeholder="Bipe para testar" autoComplete="off" /></div></form>
            {testResult && <div className="mt-4 rounded-2xl border border-lime/30 bg-lime/[0.06] p-5"><div className="flex items-center gap-3 text-lime"><CheckCircle2 size={28} /><div><p className="font-black">Leitor funcionando</p><p className="text-sm text-slate-300">{testResult.product.name} · {testResult.label} · multiplicador x{testResult.multiplier}</p></div></div></div>}
          </>}

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500"><span className="badge"><Keyboard size={14} /> F2 leitor</span><span className="badge"><Search size={14} /> F3 busca</span><span>O Enter do scanner salva automaticamente.</span></div>
        </div>

        {mode !== "teste" && <section className="panel p-4 md:p-5"><div className="mb-4 grid gap-3 md:grid-cols-[1fr_220px]"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} /><input ref={searchRef} className="input pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar na fila" /></div><select className="select" value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></div><div className="table-wrap max-h-[520px]"><table className="table"><thead><tr><th>Próximos produtos</th><th>Categoria</th><th>SKU</th><th></th></tr></thead><tbody>{queue.map((product) => <tr key={product.id} className={current?.id === product.id ? "bg-brand/[0.08]" : ""}><td className="font-semibold">{product.name}</td><td>{product.category}</td><td className="font-mono text-xs">{product.sku}</td><td><button className={current?.id === product.id ? "btn-primary py-2" : "btn-ghost py-2"} onClick={() => { setSelectedProductId(product.id); focusScanner(); }}>{current?.id === product.id ? "Atual" : "Selecionar"}</button></td></tr>)}</tbody></table>{!queue.length && <div className="grid min-h-36 place-items-center text-sm text-lime"><CheckCircle2 size={28} className="mb-2" /> Nenhum produto pendente neste filtro.</div>}</div></section>}
      </section>

      <aside className="space-y-4 2xl:sticky 2xl:top-24 2xl:h-fit">
        <section className="panel p-4"><div className="mb-3 flex items-center gap-2"><Undo2 size={18} className="text-brand" /><h2 className="font-bold">Últimos códigos</h2></div>{recent.length ? <div className="space-y-2">{recent.map((item) => <div key={`${item.productId}-${item.barcode}`} className="panel-soft p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold">{item.productName}</p><p className="mt-1 font-mono text-xs text-lime">{item.barcode} · x{item.multiplier}</p></div><button className="rounded-lg border border-line p-2 text-amber-300 hover:bg-amber-500/10" title="Desfazer vínculo" onClick={() => { try { unbindBarcode(item.productId, item.barcode); setRecent((items) => items.filter((recentItem) => recentItem.barcode !== item.barcode)); beep(false, state.scannerSettings.soundEnabled); toast.success("Vínculo desfeito."); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível desfazer."); } }}><RotateCcw size={15} /></button></div></div>)}</div> : <p className="text-sm text-slate-500">Os códigos salvos nesta sessão aparecem aqui para desfazer rapidamente se necessário.</p>}</section>
        <section className="panel p-4"><div className="mb-3 flex items-center gap-2"><Package size={18} className="text-cyan-300" /><h2 className="font-bold">Caixas e packs</h2></div><p className="text-sm leading-6 text-slate-400">Cadastre o código da unidade como <strong className="text-white">x1</strong> e o código da caixa como <strong className="text-white">x12, x24...</strong>. Na entrada de estoque, um único bip soma toda a embalagem.</p></section>
        <section className="panel p-4"><div className="mb-3 flex items-center gap-2"><AlertTriangle size={18} className="text-amber-300" /><h2 className="font-bold">Fluxo mais rápido</h2></div><ol className="space-y-3 text-sm text-slate-400"><li><strong className="text-white">1.</strong> Deixe os produtos na ordem da fila.</li><li><strong className="text-white">2.</strong> Pegue o item destacado.</li><li><strong className="text-white">3.</strong> Bipe uma vez.</li><li><strong className="text-white">4.</strong> O próximo aparece sozinho.</li></ol></section>
      </aside>
    </div>
  </>;
}
