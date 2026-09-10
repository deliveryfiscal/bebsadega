"use client";

import { Banknote, Barcode, Beer, CirclePause, CreditCard, Link2, Minus, PackagePlus, Plus, QrCode, ReceiptText, ScanBarcode, Search, ShoppingCart, Star, Trash2, UserRound, Wine } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ProductForm } from "@/components/products/product-form";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { availableVolumeMl, calculateCart, canAddQuantity, findProductByBarcode, normalizePhone } from "@/lib/business";
import { useStore } from "@/lib/store";
import type { CartItem, PaymentLine, PaymentMethod, Product } from "@/lib/types";
import { currency, uid } from "@/lib/utils";

const DRAFT_KEY = "bebs-pdv-draft-v21";
const methods: PaymentMethod[] = ["Dinheiro", "PIX", "Débito", "Crédito"];

function methodIcon(method: PaymentMethod) {
  if (method === "Dinheiro") return <Banknote size={18} />;
  if (method === "PIX") return <QrCode size={18} />;
  return <CreditCard size={18} />;
}

export default function PosPage() {
  const { state, saveProduct, bindBarcode, finishSale, addCustomer, suspendSale, removeSuspendedSale } = useStore();
  const toast = useToast();
  const scanner = useRef<HTMLInputElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const discountInput = useRef<HTMLInputElement>(null);
  const lastScan = useRef<{ code: string; at: number } | null>(null);
  const [query, setQuery] = useState("");
  const [scanCode, setScanCode] = useState("");
  const [scanQty, setScanQty] = useState(1);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [customerId, setCustomerId] = useState("");
  const [unknownBarcode, setUnknownBarcode] = useState<string | null>(null);
  const [linkProductId, setLinkProductId] = useState("");
  const [doseProduct, setDoseProduct] = useState<Product | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([{ method: "PIX", amount: 0 }]);
  const [cashReceived, setCashReceived] = useState(0);
  const [paymentKey, setPaymentKey] = useState("");
  const [completing, setCompleting] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");
  const [holdOpen, setHoldOpen] = useState(false);
  const [holdName, setHoldName] = useState("");
  const [holdsOpen, setHoldsOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const [priceScan, setPriceScan] = useState("");
  const [priceProduct, setPriceProduct] = useState<Product | null>(null);
  const totals = calculateCart(cart, discount);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as { cart?: CartItem[]; discount?: number; customerId?: string };
        if (draft.cart?.length) setCart(draft.cart);
        if (typeof draft.discount === "number") setDiscount(draft.discount);
        if (draft.customerId) setCustomerId(draft.customerId);
      }
    } catch { /* rascunho inválido é ignorado */ }
    const timer = window.setTimeout(() => scanner.current?.focus(), 220);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ cart, discount, customerId })); } catch { /* armazenamento indisponível */ }
  }, [cart, discount, customerId]);

  useEffect(() => {
    setPaymentLines((lines) => lines.length === 1 ? [{ ...lines[0], amount: totals.total }] : lines);
    if (cashReceived < totals.total) setCashReceived(totals.total);
  }, [totals.total]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "F2") { event.preventDefault(); searchInput.current?.focus(); }
      if (event.key === "F3") { event.preventDefault(); scanner.current?.focus(); }
      if (event.key === "F4") { event.preventDefault(); setCustomerOpen(true); }
      if (event.key === "F5") { event.preventDefault(); discountInput.current?.focus(); }
      if (event.key === "F8" && cart.length) { event.preventDefault(); setHoldOpen(true); }
      if (event.key === "F9") { event.preventDefault(); openPayment(); }
      if (event.key === "F10") { event.preventDefault(); setPriceProduct(null); setPriceScan(""); setPriceOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const visible = useMemo(() => state.products
    .filter((product) => product.active && [product.name, product.barcode, product.sku, product.category, product.brand].join(" ").toLowerCase().includes(query.toLowerCase()))
    .slice(0, 36), [state.products, query]);
  const favorites = useMemo(() => state.products.filter((product) => product.active && product.favorite).slice(0, 10), [state.products]);
  const selectedCustomer = state.customers.find((customer) => customer.id === customerId);
  const customerMatches = useMemo(() => {
    const normalized = normalizePhone(customerQuery);
    return state.customers.filter((customer) => {
      const haystack = `${customer.name} ${customer.phone} ${customer.email || ""}`.toLowerCase();
      return haystack.includes(customerQuery.toLowerCase()) || (normalized && normalizePhone(customer.phone).includes(normalized));
    }).slice(0, 12);
  }, [state.customers, customerQuery]);

  const focusScanner = () => window.setTimeout(() => state.scannerSettings.autoFocus && scanner.current?.focus(), 70);

  const addItem = (product: Product, mode: CartItem["mode"] = product.kind === "combo" ? "combo" : "unit", doseMl?: number, unitPrice?: number, quantity = 1) => {
    const qty = Math.max(1, Math.floor(quantity || 1));
    const key = `${product.id}_${mode}_${doseMl || 0}`;
    const existing = cart.find((item) => item.id === key)?.quantity || 0;
    const availability = canAddQuantity(state.products, product, mode, existing + qty, doseMl);
    if (!availability.ok) { toast.error(availability.message); focusScanner(); return; }
    setCart((items) => {
      const found = items.find((item) => item.id === key);
      if (found) return items.map((item) => item.id === key ? { ...item, quantity: item.quantity + qty } : item);
      return [...items, { id: key, productId: product.id, name: product.name + (doseMl ? ` · ${doseMl} ml` : ""), mode, quantity: qty, unitPrice: unitPrice ?? product.price, doseMl }];
    });
    toast.success(`${qty}× ${product.name} adicionado.`);
    focusScanner();
  };

  const processBarcode = (raw: string) => {
    const code = raw.trim();
    if (!code) return;
    const now = Date.now();
    if (lastScan.current?.code === code && now - lastScan.current.at < state.scannerSettings.duplicateWindowMs) {
      setScanCode("");
      toast.error("Leitura repetida muito rápido. Bipe novamente se quiser adicionar outra unidade.");
      focusScanner();
      return;
    }
    lastScan.current = { code, at: now };
    const match = findProductByBarcode(state.products.filter((product) => product.active), code);
    if (!match) { setLinkProductId(""); setUnknownBarcode(code); setScanCode(""); return; }
    const quantity = Math.max(1, scanQty) * match.multiplier;
    if (match.product.kind === "volume" && match.multiplier === 1) setDoseProduct(match.product);
    else addItem(match.product, match.product.kind === "combo" ? "combo" : "unit", undefined, undefined, quantity);
    setScanQty(1);
    setScanCode("");
  };

  const changeQty = (id: string, delta: number) => {
    const item = cart.find((row) => row.id === id);
    if (!item) return;
    if (delta > 0) {
      const product = state.products.find((row) => row.id === item.productId);
      if (!product) return;
      const availability = canAddQuantity(state.products, product, item.mode, item.quantity + delta, item.doseMl);
      if (!availability.ok) { toast.error(availability.message); return; }
    }
    setCart((items) => items.map((row) => row.id === id ? { ...row, quantity: row.quantity + delta } : row).filter((row) => row.quantity > 0));
  };

  const openPayment = (method?: PaymentMethod) => {
    if (!cart.length) { toast.error("Adicione pelo menos um produto."); return; }
    if (state.cashSession?.status !== "open") { toast.error("Abra o caixa antes de vender."); return; }
    const selectedMethod = method || (paymentLines[0]?.method ?? "PIX");
    setPaymentLines([{ method: selectedMethod, amount: totals.total }]);
    setCashReceived(totals.total);
    setPaymentKey(uid("payment"));
    setPaymentOpen(true);
  };

  const complete = () => {
    if (completing) return;
    setCompleting(true);
    try {
      const id = finishSale({ items: cart, discount, payments: paymentLines, customerId: customerId || undefined, idempotencyKey: paymentKey || uid("payment") });
      setCart([]); setDiscount(0); setCustomerId(""); setPaymentLines([{ method: "PIX", amount: 0 }]); setPaymentOpen(false); setPaymentKey("");
      try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* noop */ }
      toast.success(`Venda concluída. Código ${id.slice(-6).toUpperCase()}.`);
      focusScanner();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível finalizar a venda.");
    } finally {
      window.setTimeout(() => setCompleting(false), 250);
    }
  };

  const holdCurrentSale = () => {
    try {
      suspendSale({ name: holdName || `Cliente ${state.suspendedSales.length + 1}`, items: cart, discount, customerId: customerId || undefined });
      setCart([]); setDiscount(0); setCustomerId(""); setHoldName(""); setHoldOpen(false);
      toast.success("Venda suspensa e liberada para o próximo cliente.");
      focusScanner();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível suspender."); }
  };

  const resumeHold = (id: string) => {
    const hold = state.suspendedSales.find((item) => item.id === id);
    if (!hold) return;
    if (cart.length && !window.confirm("Existe uma venda em andamento. Deseja substituí-la pela venda suspensa?")) return;
    setCart(hold.items); setDiscount(hold.discount); setCustomerId(hold.customerId || ""); removeSuspendedSale(id); setHoldsOpen(false); focusScanner();
  };

  const paymentTotal = paymentLines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
  const paymentDifference = totals.total - paymentTotal;
  const hasCash = paymentLines.some((line) => line.method === "Dinheiro");
  const cashAmount = paymentLines.filter((line) => line.method === "Dinheiro").reduce((sum, line) => sum + line.amount, 0);
  const change = hasCash ? Math.max(0, cashReceived - cashAmount) : 0;

  return <>
    <PageHeader title="PDV · Operação rápida" description="Bipe, receba e siga para o próximo cliente. O sistema cuida do estoque, caixa e histórico." actions={<div className="flex flex-wrap gap-2"><button className="btn-ghost" onClick={() => setHoldsOpen(true)}><CirclePause size={17} /> Pendentes ({state.suspendedSales.length})</button><div className={`badge ${state.cashSession?.status === "open" ? "border-lime/30 bg-lime/10 text-lime" : "border-red-500/30 bg-red-500/10 text-red-300"}`}><span className="h-2 w-2 rounded-full bg-current" /> Caixa {state.cashSession?.status === "open" ? "aberto" : "fechado"}</div></div>} />

    <div className="grid gap-6 2xl:grid-cols-[1fr_430px]">
      <section className="space-y-4">
        <div className="panel overflow-hidden p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm font-bold text-lime"><ScanBarcode size={19} /> Leitor pronto <span className="badge ml-auto border-line text-slate-400">F3 scanner · F9 receber · F10 preço</span></div>
          <form className="grid gap-2 sm:grid-cols-[96px_1fr_auto]" onSubmit={(event) => { event.preventDefault(); processBarcode(scanCode); }}>
            <label><span className="sr-only">Quantidade</span><input className="input h-14 text-center text-lg font-black" type="number" min="1" max="999" value={scanQty} onChange={(event) => setScanQty(Math.max(1, Number(event.target.value) || 1))} title="Quantidade do próximo bip" /></label>
            <div className="relative"><Barcode className="absolute left-4 top-1/2 -translate-y-1/2 text-brand" size={24} /><input ref={scanner} className="input h-14 pl-12 text-lg font-mono" value={scanCode} onChange={(event) => setScanCode(event.target.value)} placeholder="Bipe o código de barras" autoComplete="off" /></div>
            <button className="btn-primary px-6"><Plus size={20} /> Adicionar</button>
          </form>
          <p className="mt-2 text-xs text-slate-500">Para 12 unidades: digite <strong className="text-white">12</strong> e bipe uma vez. Códigos de caixa/pack também podem ter multiplicador automático.</p>
        </div>

        {favorites.length > 0 && <section className="panel p-4"><div className="mb-3 flex items-center gap-2"><Star size={18} className="text-amber-300" fill="currentColor" /><h2 className="font-bold">Favoritos</h2><span className="text-xs text-slate-500">um toque</span></div><div className="flex gap-2 overflow-x-auto pb-1">{favorites.map((product) => <button key={product.id} className="min-w-40 rounded-xl border border-line bg-white/[0.03] p-3 text-left hover:border-brand/50" onClick={() => product.kind === "volume" ? setDoseProduct(product) : addItem(product)}><p className="truncate text-sm font-bold">{product.name}</p><p className="mt-1 text-sm font-black text-lime">{currency(product.price)}</p></button>)}</div></section>}

        <div className="panel p-4 md:p-5">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div className="relative max-w-lg flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} /><input ref={searchInput} className="input pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar nome, código, SKU, marca ou categoria (F2)" /></div><span className="text-xs text-slate-500">{visible.length} resultados</span></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{visible.map((product) => <button key={product.id} onClick={() => product.kind === "volume" ? setDoseProduct(product) : addItem(product)} className="panel-soft group min-h-28 p-4 text-left transition hover:-translate-y-0.5 hover:border-brand/50 hover:bg-brand/[0.04]"><div className="flex items-start justify-between gap-3"><div className={`rounded-xl p-2.5 ${product.kind === "volume" ? "bg-amber-500/10 text-amber-300" : product.kind === "combo" ? "bg-violet-500/10 text-violet-300" : "bg-brand/10 text-brand"}`}>{product.kind === "volume" ? <Wine size={20} /> : product.kind === "combo" ? <PackagePlus size={20} /> : <Beer size={20} />}</div><span className="text-xs text-slate-500">{product.kind === "combo" ? "Combo" : `${product.stock} un.`}</span></div><p className="mt-3 line-clamp-2 font-bold">{product.name}</p><div className="mt-2 flex items-end justify-between gap-3"><span className="truncate text-xs text-slate-500">{product.location || product.category}</span><span className="text-lg font-black text-lime">{currency(product.price)}</span></div></button>)}</div>
        </div>
      </section>

      <aside className="panel h-fit overflow-hidden 2xl:sticky 2xl:top-24">
        <div className="flex items-center justify-between border-b border-line px-5 py-4"><div className="flex items-center gap-2"><ShoppingCart className="text-brand" size={21} /><h2 className="font-bold">Carrinho</h2></div>{cart.length > 0 && <button className="text-xs font-semibold text-red-300 hover:text-red-200" onClick={() => { if (window.confirm("Limpar a venda atual?")) setCart([]); }}>Limpar</button>}</div>
        <div className="max-h-[40vh] min-h-64 overflow-y-auto p-4">{!cart.length ? <EmptyState icon={ShoppingCart} title="Carrinho vazio" description="Bipe um produto ou toque em um favorito." /> : <div className="space-y-3">{cart.map((item) => <div key={item.id} className="panel-soft p-3"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className="truncate font-semibold">{item.name}</p><p className="mt-0.5 text-sm text-lime">{currency(item.unitPrice)}</p></div><button onClick={() => setCart((items) => items.filter((row) => row.id !== item.id))} className="rounded-lg p-2 text-red-300 hover:bg-red-500/10"><Trash2 size={16} /></button></div><div className="mt-3 flex items-center justify-between"><div className="flex items-center rounded-lg border border-line"><button className="p-2 hover:bg-white/5" onClick={() => changeQty(item.id, -1)}><Minus size={14} /></button><span className="min-w-10 text-center text-sm font-bold">{item.quantity}</span><button className="p-2 hover:bg-white/5" onClick={() => changeQty(item.id, 1)}><Plus size={14} /></button></div><span className="font-black">{currency(item.unitPrice * item.quantity)}</span></div></div>)}</div>}</div>
        <div className="space-y-3 border-t border-line bg-black/10 p-4">
          <button className="flex w-full items-center justify-between rounded-xl border border-line bg-white/[0.03] p-3 text-left" onClick={() => setCustomerOpen(true)}><div className="flex items-center gap-2"><UserRound size={17} className="text-brand" /><div><p className="text-xs text-slate-500">Cliente (F4)</p><p className="text-sm font-semibold">{selectedCustomer?.name || "Consumidor final"}</p></div></div><span className="text-xs text-brand">Alterar</span></button>
          <div className="grid grid-cols-2 gap-3"><label><span className="mb-1 block text-xs text-slate-500">Desconto (F5)</span><input ref={discountInput} className="input" type="number" min="0" max={totals.subtotal} step="0.01" value={discount} onChange={(event) => setDiscount(Math.max(0, Number(event.target.value) || 0))} /></label><div className="rounded-xl border border-line bg-white/[0.03] p-3"><p className="text-xs text-slate-500">Itens</p><p className="mt-1 text-lg font-black">{cart.reduce((sum, item) => sum + item.quantity, 0)}</p></div></div>
          <div className="flex items-end justify-between border-t border-line pt-3"><div><p className="text-xs text-slate-500">Total</p><p className="text-3xl font-black text-lime">{currency(totals.total)}</p></div><button className="btn-ghost px-3" disabled={!cart.length} onClick={() => setHoldOpen(true)} title="Suspender venda (F8)"><CirclePause size={18} /></button></div>
          <div className="grid grid-cols-2 gap-2">{methods.map((method) => <button key={method} disabled={!cart.length || state.cashSession?.status !== "open"} onClick={() => openPayment(method)} className={method === "PIX" ? "btn-primary h-12" : "btn-ghost h-12"}>{methodIcon(method)} {method}</button>)}</div>
          <button className="btn-lime h-14 w-full text-base" disabled={!cart.length || state.cashSession?.status !== "open"} onClick={() => openPayment()}><ReceiptText size={20} /> Receber / dividir (F9)</button>
        </div>
      </aside>
    </div>

    <Modal open={Boolean(doseProduct)} onClose={() => { setDoseProduct(null); focusScanner(); }} title={doseProduct ? `Como vender ${doseProduct.name}?` : "Venda por dose"} width="max-w-lg">
      {doseProduct && <div className="space-y-3"><div className="panel-soft p-4"><p className="text-xs text-slate-500">Disponível</p><p className="mt-1 text-2xl font-black text-lime">{availableVolumeMl(doseProduct)} ml</p><p className="mt-1 text-xs text-slate-500">{doseProduct.stock} garrafas fechadas · {doseProduct.openVolumeMl || 0} ml na aberta</p></div><button className="btn-ghost w-full justify-between" onClick={() => { addItem(doseProduct, "unit"); setDoseProduct(null); }}><span>Garrafa inteira</span><strong>{currency(doseProduct.price)}</strong></button>{Object.entries(doseProduct.dosePrices || {}).filter(([, price]) => Number(price) > 0).sort((a, b) => Number(a[0]) - Number(b[0])).map(([ml, price]) => <button key={ml} className="btn-primary w-full justify-between" onClick={() => { addItem(doseProduct, "dose", Number(ml), Number(price)); setDoseProduct(null); }}><span>Dose {ml} ml</span><strong>{currency(Number(price))}</strong></button>)}</div>}
    </Modal>

    <Modal open={paymentOpen} onClose={() => { setPaymentOpen(false); focusScanner(); }} title="Receber venda" width="max-w-xl">
      <div className="space-y-4"><div className="rounded-2xl border border-lime/25 bg-lime/[0.05] p-4 text-center"><p className="text-xs font-bold uppercase tracking-widest text-slate-500">Total a receber</p><p className="mt-1 text-4xl font-black text-lime">{currency(totals.total)}</p></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{methods.map((method) => <button key={method} type="button" className="btn-ghost" onClick={() => { setPaymentLines([{ method, amount: totals.total }]); setCashReceived(totals.total); }}>{methodIcon(method)} {method}</button>)}</div>
        <div className="space-y-2">{paymentLines.map((line, index) => <div key={`${line.method}-${index}`} className="grid grid-cols-[1fr_140px_auto] gap-2"><select className="select" value={line.method} onChange={(event) => setPaymentLines((lines) => lines.map((item, i) => i === index ? { ...item, method: event.target.value as PaymentMethod } : item))}>{[...methods, "Outro" as PaymentMethod].map((method) => <option key={method}>{method}</option>)}</select><input className="input text-right font-bold" type="number" min="0" step="0.01" value={line.amount} onChange={(event) => setPaymentLines((lines) => lines.map((item, i) => i === index ? { ...item, amount: Number(event.target.value) || 0 } : item))} /><button className="btn-danger px-3" type="button" disabled={paymentLines.length === 1} onClick={() => setPaymentLines((lines) => lines.filter((_, i) => i !== index))}><Trash2 size={16} /></button></div>)}</div>
        <div className="flex flex-wrap gap-2"><button className="btn-ghost" type="button" onClick={() => { const used = paymentLines.reduce((sum, line) => sum + line.amount, 0); setPaymentLines((lines) => [...lines, { method: "Dinheiro", amount: Math.max(0, totals.total - used) }]); }}><Plus size={16} /> Dividir pagamento</button>{Math.abs(paymentDifference) > 0.009 && <span className={`badge ${paymentDifference > 0 ? "text-amber-300" : "text-red-300"}`}>{paymentDifference > 0 ? "Falta" : "Excede"} {currency(Math.abs(paymentDifference))}</span>}</div>
        {hasCash && <div className="grid gap-3 rounded-xl border border-line bg-white/[0.03] p-4 sm:grid-cols-2"><label><span className="mb-1 block text-xs text-slate-500">Dinheiro recebido</span><input className="input text-lg font-black" type="number" min={cashAmount} step="0.01" value={cashReceived} onChange={(event) => setCashReceived(Number(event.target.value) || 0)} /></label><div><p className="text-xs text-slate-500">Troco</p><p className="mt-2 text-3xl font-black text-lime">{currency(change)}</p></div></div>}
        <button className="btn-lime h-14 w-full text-base" disabled={completing || Math.abs(paymentDifference) > 0.009 || (hasCash && cashReceived < cashAmount)} onClick={complete}>{completing ? "Processando..." : "Confirmar venda"}</button>
      </div>
    </Modal>

    <Modal open={customerOpen} onClose={() => { setCustomerOpen(false); focusScanner(); }} title="Cliente da venda" width="max-w-xl">
      <div className="space-y-4"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} /><input className="input h-12 pl-10" autoFocus value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} placeholder="Nome ou telefone" /></div><button className="btn-ghost w-full justify-start" onClick={() => { setCustomerId(""); setCustomerOpen(false); focusScanner(); }}><UserRound size={17} /> Consumidor final</button><div className="max-h-72 space-y-2 overflow-auto">{customerMatches.map((customer) => <button key={customer.id} className="panel-soft flex w-full items-center justify-between p-3 text-left hover:border-brand/50" onClick={() => { setCustomerId(customer.id); setCustomerOpen(false); setCustomerQuery(""); focusScanner(); }}><div><p className="font-semibold">{customer.name}</p><p className="text-xs text-slate-500">{customer.phone}</p></div>{customer.cashback ? <span className="text-xs font-bold text-lime">{currency(customer.cashback)} cashback</span> : null}</button>)}</div>{customerQuery.trim().length >= 3 && !customerMatches.length && <div className="rounded-xl border border-line bg-white/[0.03] p-4"><p className="text-sm font-semibold">Cliente não encontrado</p><p className="mt-1 text-xs text-slate-500">Cadastre em dois campos e continue a venda.</p><button className="btn-primary mt-3 w-full" onClick={() => { const looksPhone = /\d{8,}/.test(customerQuery.replace(/\D/g, "")); const name = looksPhone ? "Cliente balcão" : customerQuery.trim(); const phone = looksPhone ? customerQuery : window.prompt("Telefone do cliente") || ""; try { const customer = addCustomer({ name, phone, consentMarketing: false, tags: [], cashback: 0 }); setCustomerId(customer.id); setCustomerOpen(false); setCustomerQuery(""); toast.success("Cliente vinculado à venda."); focusScanner(); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível cadastrar."); } }}><Plus size={17} /> Cadastro rápido</button></div>}</div>
    </Modal>

    <Modal open={holdOpen} onClose={() => setHoldOpen(false)} title="Suspender venda" width="max-w-md"><div className="space-y-4"><p className="text-sm text-slate-400">A venda fica salva para você atender o próximo cliente e retomar depois.</p><label><span className="mb-1.5 block text-sm font-semibold">Nome / referência</span><input className="input h-12" autoFocus value={holdName} onChange={(event) => setHoldName(event.target.value)} placeholder="Ex.: João / aguardando Pix" /></label><button className="btn-primary w-full" onClick={holdCurrentSale}><CirclePause size={17} /> Suspender e liberar PDV</button></div></Modal>

    <Modal open={holdsOpen} onClose={() => setHoldsOpen(false)} title="Vendas pendentes" width="max-w-2xl"><div className="space-y-3">{state.suspendedSales.map((hold) => <div key={hold.id} className="panel-soft flex flex-col gap-3 p-4 sm:flex-row sm:items-center"><div className="flex-1"><p className="font-bold">{hold.name}</p><p className="text-xs text-slate-500">{hold.items.reduce((sum, item) => sum + item.quantity, 0)} itens · {currency(calculateCart(hold.items, hold.discount).total)}</p></div><button className="btn-lime" onClick={() => resumeHold(hold.id)}>Retomar</button><button className="btn-danger" onClick={() => { if (window.confirm("Excluir esta venda suspensa?")) removeSuspendedSale(hold.id); }}>Excluir</button></div>)}{!state.suspendedSales.length && <EmptyState icon={CirclePause} title="Nenhuma venda pendente" description="Use F8 durante uma venda para suspendê-la." />}</div></Modal>

    <Modal open={priceOpen} onClose={() => { setPriceOpen(false); focusScanner(); }} title="Consulta rápida de preço" width="max-w-md"><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); const match = findProductByBarcode(state.products, priceScan); if (!match) { setPriceProduct(null); toast.error("Código não encontrado."); } else { setPriceProduct(match.product); setPriceScan(""); } }}><div className="relative"><Barcode className="absolute left-4 top-1/2 -translate-y-1/2 text-brand" size={22} /><input className="input h-14 pl-12 font-mono" autoFocus value={priceScan} onChange={(event) => setPriceScan(event.target.value)} placeholder="Bipe o produto" /></div>{priceProduct && <div className="rounded-2xl border border-lime/25 bg-lime/[0.05] p-5 text-center"><p className="font-bold">{priceProduct.name}</p><p className="mt-2 text-4xl font-black text-lime">{currency(priceProduct.price)}</p><p className="mt-2 text-xs text-slate-500">Estoque: {priceProduct.stock} · {priceProduct.location || priceProduct.category}</p></div>}</form></Modal>

    <Modal open={Boolean(unknownBarcode)} onClose={() => { setUnknownBarcode(null); focusScanner(); }} title="Código ainda não cadastrado" width="max-w-2xl">
      {unknownBarcode && <div className="space-y-4"><div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3"><p className="text-xs text-amber-200">Código lido</p><p className="mt-1 font-mono text-xl font-black">{unknownBarcode}</p></div><div className="rounded-xl border border-line bg-white/[0.02] p-4"><p className="font-semibold">O produto já existe na lista?</p><div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]"><select className="select" value={linkProductId} onChange={(event) => setLinkProductId(event.target.value)}><option value="">Selecione um produto...</option>{state.products.filter((product) => product.kind !== "combo").map((product) => <option key={product.id} value={product.id}>{product.name} · {product.sku}</option>)}</select><button className="btn-lime" disabled={!linkProductId} onClick={() => { try { bindBarcode(linkProductId, unknownBarcode, 1, "Unidade", true); toast.success("Código vinculado. Bipe novamente para vender."); setUnknownBarcode(null); setLinkProductId(""); focusScanner(); } catch (error) { toast.error(error instanceof Error ? error.message : "Falha ao vincular."); } }}><Link2 size={17} /> Vincular</button></div></div><div><p className="mb-2 text-sm font-semibold">Ou cadastre rapidamente um produto novo:</p><ProductForm quick initialBarcode={unknownBarcode} onCancel={() => { setUnknownBarcode(null); focusScanner(); }} onSave={(data) => { try { saveProduct(data); toast.success("Produto cadastrado e pronto para venda."); setUnknownBarcode(null); focusScanner(); } catch (error) { toast.error(error instanceof Error ? error.message : "Falha ao cadastrar produto."); } }} /></div></div>}
    </Modal>
  </>;
}
