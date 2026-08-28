"use client";

import { Banknote, Barcode, Beer, CheckCircle2, CreditCard, Link2, Minus, PackagePlus, Plus, QrCode, ScanBarcode, Search, ShoppingCart, Trash2, UserRound, Wine } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ProductForm } from "@/components/products/product-form";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { availableVolumeMl, calculateCart } from "@/lib/business";
import { useStore } from "@/lib/store";
import type { CartItem, PaymentLine, PaymentMethod, Product } from "@/lib/types";
import { currency, uid } from "@/lib/utils";

const paymentIcons: Record<PaymentMethod, React.ReactNode> = { Dinheiro: <Banknote size={18} />, PIX: <QrCode size={18} />, Débito: <CreditCard size={18} />, Crédito: <CreditCard size={18} />, Outro: <CreditCard size={18} /> };

export default function PosPage() {
  const { state, saveProduct, bindBarcode, finishSale } = useStore();
  const toast = useToast();
  const scanner = useRef<HTMLInputElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [scanCode, setScanCode] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [customerId, setCustomerId] = useState("");
  const [unknownBarcode, setUnknownBarcode] = useState<string | null>(null);
  const [linkProductId, setLinkProductId] = useState("");
  const [doseProduct, setDoseProduct] = useState<Product | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([{ method: "PIX", amount: 0 }]);
  const totals = calculateCart(cart, discount);

  useEffect(() => { const timer = window.setTimeout(() => scanner.current?.focus(), 250); return () => window.clearTimeout(timer); }, []);
  useEffect(() => setPaymentLines((lines) => lines.length === 1 ? [{ ...lines[0], amount: totals.total }] : lines), [totals.total]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "F2") { event.preventDefault(); searchInput.current?.focus(); }
      if (event.key === "F3") { event.preventDefault(); scanner.current?.focus(); }
      if (event.key === "F9") {
        event.preventDefault();
        if (cart.length && state.cashSession?.status === "open") setPaymentOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cart.length, state.cashSession?.status]);

  const visible = useMemo(() => state.products.filter((p) => p.active && [p.name, p.barcode, p.category, p.brand].join(" ").toLowerCase().includes(query.toLowerCase())).slice(0, 30), [state.products, query]);

  const addItem = (product: Product, mode: CartItem["mode"] = product.kind === "combo" ? "combo" : "unit", doseMl?: number, unitPrice?: number) => {
    if (mode === "dose" && availableVolumeMl(product) < (doseMl || 0)) { toast.error("Não há volume suficiente para esta dose."); return; }
    if (mode !== "dose" && product.kind !== "combo" && product.stock <= 0) { toast.error("Produto sem estoque."); return; }
    const key = `${product.id}_${mode}_${doseMl || 0}`;
    setCart((items) => {
      const found = items.find((item) => item.id === key);
      if (found) return items.map((item) => item.id === key ? { ...item, quantity: item.quantity + 1 } : item);
      return [...items, { id: key, productId: product.id, name: product.name + (doseMl ? ` · ${doseMl}ml` : ""), mode, quantity: 1, unitPrice: unitPrice ?? product.price, doseMl }];
    });
    toast.success(`${product.name} adicionado.`);
    window.setTimeout(() => scanner.current?.focus(), 80);
  };

  const processBarcode = (raw: string) => {
    const code = raw.trim();
    if (!code) return;
    const product = state.products.find((p) => p.active && p.barcode === code);
    if (!product) { setLinkProductId(""); setUnknownBarcode(code); setScanCode(""); return; }
    if (product.kind === "volume") setDoseProduct(product); else addItem(product);
    setScanCode("");
  };

  const changeQty = (id: string, delta: number) => setCart((items) => items.map((item) => item.id === id ? { ...item, quantity: item.quantity + delta } : item).filter((item) => item.quantity > 0));

  const complete = () => {
    try {
      const id = finishSale({ items: cart, discount, payments: paymentLines, customerId: customerId || undefined });
      setCart([]); setDiscount(0); setCustomerId(""); setPaymentLines([{ method: "PIX", amount: 0 }]); setPaymentOpen(false);
      toast.success(`Venda concluída com sucesso. Código ${id.slice(-6).toUpperCase()}.`);
      window.setTimeout(() => scanner.current?.focus(), 120);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível finalizar a venda."); }
  };

  return <>
    <PageHeader title="PDV · Venda rápida" description="Bipe o produto, confira o carrinho e finalize. O estoque é baixado automaticamente." actions={<div className={`badge ${state.cashSession?.status === "open" ? "border-lime/30 bg-lime/10 text-lime" : "border-red-500/30 bg-red-500/10 text-red-300"}`}><span className="h-2 w-2 rounded-full bg-current" /> Caixa {state.cashSession?.status === "open" ? "aberto" : "fechado"}</div>} />
    <div className="grid gap-6 2xl:grid-cols-[1fr_430px]">
      <section className="space-y-4">
        <div className="panel overflow-hidden p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-lime"><ScanBarcode size={19} /> Leitor pronto</div>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); processBarcode(scanCode); }}><div className="relative flex-1"><Barcode className="absolute left-4 top-1/2 -translate-y-1/2 text-brand" size={24} /><input ref={scanner} className="input h-14 pl-12 text-lg font-mono" value={scanCode} onChange={(e) => setScanCode(e.target.value)} placeholder="Bipe o código de barras ou digite e pressione Enter" autoComplete="off" /></div><button className="btn-primary px-6"><Plus size={20} /> Adicionar</button></form>
          <p className="mt-2 text-xs text-slate-500">Compatível com leitores USB/Bluetooth em modo teclado. Atalhos: F2 pesquisa, F3 leitor, F9 pagamento. O foco retorna automaticamente após cada bip.</p>
        </div>
        <div className="panel p-4 md:p-5">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div className="relative max-w-lg flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} /><input ref={searchInput} className="input pl-10" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Pesquisar produto, categoria ou marca (F2)" /></div><div className="text-xs text-slate-500">Clique para adicionar • garrafas abrem escolha de dose</div></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{visible.map((product) => <button key={product.id} onClick={() => product.kind === "volume" ? setDoseProduct(product) : addItem(product)} className="panel-soft group min-h-32 p-4 text-left transition hover:-translate-y-0.5 hover:border-brand/50 hover:bg-brand/[0.04]"><div className="flex items-start justify-between gap-3"><div className={`rounded-xl p-2.5 ${product.kind === "volume" ? "bg-amber-500/10 text-amber-300" : product.kind === "combo" ? "bg-violet-500/10 text-violet-300" : "bg-brand/10 text-brand"}`}>{product.kind === "volume" ? <Wine size={21} /> : product.kind === "combo" ? <PackagePlus size={21} /> : <Beer size={21} />}</div><span className="text-xs text-slate-500">{product.kind === "combo" ? "Combo" : `${product.stock} un.`}</span></div><p className="mt-3 line-clamp-2 font-bold">{product.name}</p><div className="mt-3 flex items-end justify-between"><span className="text-xs text-slate-500">{product.category}</span><span className="text-lg font-black text-lime">{currency(product.price)}</span></div></button>)}</div>
        </div>
      </section>

      <aside className="panel h-fit overflow-hidden 2xl:sticky 2xl:top-24">
        <div className="flex items-center justify-between border-b border-line px-5 py-4"><div className="flex items-center gap-2"><ShoppingCart className="text-brand" size={21} /><h2 className="font-bold">Carrinho</h2></div>{cart.length > 0 && <button className="text-xs font-semibold text-red-300 hover:text-red-200" onClick={() => setCart([])}>Limpar</button>}</div>
        <div className="max-h-[44vh] min-h-72 overflow-y-auto p-4">
          {!cart.length ? <EmptyState icon={ShoppingCart} title="Carrinho vazio" description="Bipe um produto ou selecione um item da grade." /> : <div className="space-y-3">{cart.map((item) => <div key={item.id} className="panel-soft p-3"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className="truncate font-semibold">{item.name}</p><p className="mt-0.5 text-sm text-lime">{currency(item.unitPrice)}</p></div><button onClick={() => setCart((items) => items.filter((x) => x.id !== item.id))} className="rounded-lg p-2 text-red-300 hover:bg-red-500/10"><Trash2 size={16} /></button></div><div className="mt-3 flex items-center justify-between"><div className="flex items-center rounded-lg border border-line"><button className="p-2 hover:bg-white/5" onClick={() => changeQty(item.id, -1)}><Minus size={14} /></button><span className="min-w-9 text-center text-sm font-bold">{item.quantity}</span><button className="p-2 hover:bg-white/5" onClick={() => changeQty(item.id, 1)}><Plus size={14} /></button></div><span className="font-black">{currency(item.unitPrice * item.quantity)}</span></div></div>)}</div>}
        </div>
        <div className="space-y-3 border-t border-line bg-black/10 p-4">
          <label><span className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-slate-400"><UserRound size={15} /> Cliente</span><select className="select" value={customerId} onChange={(e) => setCustomerId(e.target.value)}><option value="">Consumidor final</option>{state.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label><span className="mb-1.5 block text-xs font-semibold text-slate-400">Desconto em R$</span><input className="input" type="number" min="0" max={totals.subtotal} step="0.01" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} /></label>
          <div className="space-y-2 border-t border-line pt-3 text-sm"><div className="flex justify-between text-slate-400"><span>Subtotal</span><span>{currency(totals.subtotal)}</span></div><div className="flex justify-between text-slate-400"><span>Desconto</span><span>- {currency(totals.discount)}</span></div><div className="flex items-end justify-between"><span className="font-bold">Total</span><span className="text-3xl font-black text-lime">{currency(totals.total)}</span></div></div>
          <button className="btn-primary h-14 w-full text-base" disabled={!cart.length || state.cashSession?.status !== "open"} onClick={() => setPaymentOpen(true)}><CheckCircle2 size={20} /> Finalizar venda (F9)</button>
        </div>
      </aside>
    </div>

    <Modal open={Boolean(unknownBarcode)} onClose={() => setUnknownBarcode(null)} title="Código ainda não vinculado">
      <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
        O código <strong className="font-mono">{unknownBarcode}</strong> ainda não está ligado a nenhum produto.
      </div>

      <div className="mb-5 rounded-xl border border-line bg-white/[0.03] p-4">
        <div className="mb-3 flex items-center gap-2 font-semibold"><Link2 size={17} className="text-cyan-300" /> Produto já cadastrado</div>
        <p className="mb-3 text-xs text-slate-400">Selecione um item do catálogo da Beb's para gravar este código real do fabricante. Depois disso, os próximos bips serão automáticos.</p>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <select className="select" value={linkProductId} onChange={(e) => setLinkProductId(e.target.value)}>
            <option value="">Selecione um produto sem código...</option>
            {state.products.filter((p) => !p.barcode && p.kind !== "combo").sort((a, b) => a.name.localeCompare(b.name)).map((p) => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}
          </select>
          <button type="button" className="btn-lime" disabled={!linkProductId} onClick={() => {
            if (!unknownBarcode || !linkProductId) return;
            try {
              const selected = state.products.find((p) => p.id === linkProductId);
              bindBarcode(linkProductId, unknownBarcode);
              setUnknownBarcode(null);
              setLinkProductId("");
              if (selected) {
                if (selected.kind === "volume") setDoseProduct({ ...selected, barcode: unknownBarcode });
                else addItem({ ...selected, barcode: unknownBarcode });
              }
              toast.success("Código vinculado ao produto.");
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Não foi possível vincular o código.");
            }
          }}><Link2 size={16} /> Vincular código</button>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-3 text-xs text-slate-500"><span className="h-px flex-1 bg-line" /> OU CADASTRE UM PRODUTO NOVO <span className="h-px flex-1 bg-line" /></div>
      <ProductForm initialBarcode={unknownBarcode || ""} onCancel={() => setUnknownBarcode(null)} onSave={(data) => {
        try {
          const p = saveProduct(data);
          setUnknownBarcode(null);
          addItem(p);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Erro no cadastro.");
        }
      }} />
    </Modal>

    <Modal open={Boolean(doseProduct)} onClose={() => setDoseProduct(null)} title={`Venda por dose · ${doseProduct?.name || ""}`} width="max-w-xl">{doseProduct && <div><div className="panel-soft mb-5 p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-400">Volume disponível</p><p className="mt-1 text-3xl font-black text-lime">{availableVolumeMl(doseProduct)} ml</p></div><Wine className="text-brand" size={42} /></div><p className="mt-2 text-xs text-slate-500">{doseProduct.stock} garrafas fechadas · {doseProduct.openVolumeMl || 0} ml na garrafa aberta</p></div><div className="grid gap-3 sm:grid-cols-2">{Object.entries(doseProduct.dosePrices || { "50": 15, "100": 28, "200": 52 }).map(([ml, price]) => <button key={ml} className="panel-soft p-4 text-left hover:border-brand/50" onClick={() => { addItem(doseProduct, "dose", Number(ml), Number(price)); setDoseProduct(null); }}><p className="text-sm text-slate-400">Dose</p><p className="mt-1 text-2xl font-black">{ml} ml</p><p className="mt-2 font-bold text-lime">{currency(Number(price))}</p></button>)}<button className="panel-soft p-4 text-left hover:border-brand/50" onClick={() => { addItem(doseProduct, "unit"); setDoseProduct(null); }}><p className="text-sm text-slate-400">Garrafa inteira</p><p className="mt-1 text-2xl font-black">{doseProduct.bottleVolumeMl} ml</p><p className="mt-2 font-bold text-lime">{currency(doseProduct.price)}</p></button></div></div>}</Modal>

    <Modal open={paymentOpen} onClose={() => setPaymentOpen(false)} title="Finalizar pagamento" width="max-w-xl"><div className="space-y-5"><div className="panel-soft p-4 text-center"><p className="text-sm text-slate-400">Total a receber</p><p className="mt-1 text-4xl font-black text-lime">{currency(totals.total)}</p></div><div><div className="mb-2 flex items-center justify-between"><p className="text-sm font-semibold">Formas de pagamento</p><button className="btn-ghost py-2" onClick={() => setPaymentLines((lines) => [...lines, { method: "Dinheiro", amount: 0 }])}><Plus size={16} /> Adicionar forma</button></div><div className="space-y-2">{paymentLines.map((line, index) => <div key={`${line.method}-${index}`} className="grid grid-cols-[1fr_150px_38px] gap-2"><select className="select" value={line.method} onChange={(e) => setPaymentLines((lines) => lines.map((x, i) => i === index ? { ...x, method: e.target.value as PaymentMethod } : x))}>{(["PIX", "Dinheiro", "Débito", "Crédito", "Outro"] as PaymentMethod[]).map((method) => <option key={method} value={method}>{method}</option>)}</select><input className="input font-bold" type="number" min="0" step="0.01" value={line.amount} onChange={(e) => setPaymentLines((lines) => lines.map((x, i) => i === index ? { ...x, amount: Number(e.target.value) } : x))} /><button className="rounded-xl border border-line text-red-300 hover:bg-red-500/10 disabled:opacity-30" disabled={paymentLines.length === 1} onClick={() => setPaymentLines((lines) => lines.filter((_, i) => i !== index))}><Trash2 size={16} className="mx-auto" /></button></div>)}</div></div><div className="panel-soft flex items-center justify-between p-3"><span className="text-sm text-slate-400">Total informado</span><strong className={Math.abs(paymentLines.reduce((s, p) => s + Number(p.amount), 0) - totals.total) < .01 ? "text-lime" : "text-amber-300"}>{currency(paymentLines.reduce((s, p) => s + Number(p.amount), 0))}</strong></div><button className="btn-lime h-14 w-full text-base" onClick={complete} disabled={Math.abs(paymentLines.reduce((s, p) => s + Number(p.amount), 0) - totals.total) >= .01}><CheckCircle2 size={20} /> Confirmar e concluir</button></div></Modal>
  </>;
}
