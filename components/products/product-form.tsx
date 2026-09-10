"use client";

import { ChevronDown, ChevronUp, Minus, Plus, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import type { ComboComponent, Product, ProductKind } from "@/lib/types";

export type ProductFormState = {
  name: string;
  barcode: string;
  sku: string;
  category: string;
  brand: string;
  kind: ProductKind;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  active: boolean;
  favorite: boolean;
  location: string;
  bottleVolumeMl: number;
  dosePrices: Record<string, number>;
  comboItems: ComboComponent[];
};

const empty: ProductFormState = {
  name: "",
  barcode: "",
  sku: "",
  category: "Bebidas",
  brand: "",
  kind: "unit",
  price: 0,
  cost: 0,
  stock: 0,
  minStock: 0,
  active: true,
  favorite: false,
  location: "",
  bottleVolumeMl: 1000,
  dosePrices: { "50": 15, "100": 28, "200": 52 },
  comboItems: [],
};

function toFormState(product?: Product, initialBarcode?: string): ProductFormState {
  return {
    ...empty,
    ...(product || {}),
    barcode: initialBarcode || product?.barcode || "",
    brand: product?.brand || "",
    location: product?.location || "",
    favorite: Boolean(product?.favorite),
    bottleVolumeMl: product?.bottleVolumeMl ?? empty.bottleVolumeMl,
    dosePrices: product?.dosePrices ?? empty.dosePrices,
    comboItems: product?.comboItems ?? [],
  };
}

export function ProductForm({
  product,
  initialBarcode,
  quick = false,
  onSave,
  onCancel,
}: {
  product?: Product;
  initialBarcode?: string;
  quick?: boolean;
  onSave: (data: Partial<Product> & Pick<Product, "name" | "barcode" | "category" | "price" | "cost">) => void;
  onCancel: () => void;
}) {
  const { state } = useStore();
  const [form, setForm] = useState<ProductFormState>(() => toFormState(product, initialBarcode));
  const [advanced, setAdvanced] = useState(!quick && Boolean(product));
  const [componentId, setComponentId] = useState("");
  const [componentQty, setComponentQty] = useState(1);

  useEffect(() => {
    setForm(toFormState(product, initialBarcode));
    setAdvanced(!quick && Boolean(product));
  }, [product, initialBarcode, quick]);

  const set = <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  const submit = () => {
    if (form.kind === "combo" && form.active && !form.comboItems.length) {
      window.alert("Adicione pelo menos um componente antes de ativar o combo.");
      return;
    }
    onSave({
      ...form,
      id: product?.id,
      active: form.active ?? product?.active ?? true,
      price: Number(form.price),
      cost: Number(form.cost),
      stock: Number(form.stock),
      minStock: Number(form.minStock),
      bottleVolumeMl: form.kind === "volume" ? Number(form.bottleVolumeMl) : undefined,
      dosePrices: form.kind === "volume" ? form.dosePrices : undefined,
      comboItems: form.kind === "combo" ? form.comboItems : undefined,
    });
  };

  return (
    <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <div className="rounded-xl border border-lime/20 bg-lime/[0.04] p-3 text-xs text-slate-300">
        Para cadastro rápido, basta <strong className="text-white">nome, categoria, preço e código</strong>. Custos, localização, estoque mínimo e regras especiais podem ser completados depois.
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="md:col-span-2">
          <span className="mb-1.5 block text-sm font-semibold">Nome do produto</span>
          <input className="input h-12" required value={form.name} onChange={(event) => set("name", event.target.value)} placeholder="Ex.: Heineken Long Neck 330 ml" />
        </label>
        <label>
          <span className="mb-1.5 block text-sm font-semibold">Código de barras</span>
          <input className="input h-12 font-mono" autoFocus={Boolean(initialBarcode)} value={form.barcode} onChange={(event) => set("barcode", event.target.value)} placeholder="Bipe ou digite o EAN" />
        </label>
        <label>
          <span className="mb-1.5 block text-sm font-semibold">Preço de venda</span>
          <input className="input h-12 text-lg font-bold" type="number" min="0" step="0.01" required value={form.price} onChange={(event) => set("price", Number(event.target.value))} />
        </label>
        <label>
          <span className="mb-1.5 block text-sm font-semibold">Categoria</span>
          <input className="input" required value={form.category} onChange={(event) => set("category", event.target.value)} />
        </label>
        <label>
          <span className="mb-1.5 block text-sm font-semibold">Estoque inicial</span>
          <input className="input" type="number" min="0" step="1" value={form.stock} onChange={(event) => set("stock", Number(event.target.value))} />
        </label>
      </div>

      <button type="button" className="btn-ghost w-full justify-between" onClick={() => setAdvanced((value) => !value)}>
        <span>Configurações avançadas</span>{advanced ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
      </button>

      {advanced && <div className="grid gap-4 rounded-2xl border border-line bg-white/[0.02] p-4 md:grid-cols-2">
        <label>
          <span className="mb-1.5 block text-sm font-semibold">SKU interno</span>
          <input className="input" value={form.sku} onChange={(event) => set("sku", event.target.value)} placeholder="Gerado automaticamente" />
        </label>
        <label>
          <span className="mb-1.5 block text-sm font-semibold">Marca</span>
          <input className="input" value={form.brand} onChange={(event) => set("brand", event.target.value)} />
        </label>
        <label>
          <span className="mb-1.5 block text-sm font-semibold">Localização física</span>
          <input className="input" value={form.location} onChange={(event) => set("location", event.target.value)} placeholder="Ex.: Geladeira 1 / Prateleira A" />
        </label>
        <label>
          <span className="mb-1.5 block text-sm font-semibold">Tipo de controle</span>
          <select className="select" value={form.kind} onChange={(event) => set("kind", event.target.value as ProductKind)}><option value="unit">Unidade</option><option value="volume">Garrafa / dose</option><option value="combo">Combo</option></select>
        </label>
        <label>
          <span className="mb-1.5 block text-sm font-semibold">Preço de custo</span>
          <input className="input" type="number" min="0" step="0.01" value={form.cost} onChange={(event) => set("cost", Number(event.target.value))} />
        </label>
        {form.kind !== "combo" && <label>
          <span className="mb-1.5 block text-sm font-semibold">Estoque mínimo</span>
          <input className="input" type="number" min="0" step="1" value={form.minStock} onChange={(event) => set("minStock", Number(event.target.value))} />
        </label>}

        {form.kind === "volume" && <>
          <label>
            <span className="mb-1.5 block text-sm font-semibold">Volume da garrafa (ml)</span>
            <input className="input" type="number" min="1" value={form.bottleVolumeMl || 1000} onChange={(event) => set("bottleVolumeMl", Number(event.target.value))} />
          </label>
          <div className="md:col-span-2 rounded-xl border border-line bg-black/20 p-4">
            <p className="mb-3 text-sm font-semibold">Preços por dose</p>
            <div className="grid gap-3 sm:grid-cols-3">{[50, 100, 200].map((ml) => <label key={ml}><span className="mb-1.5 block text-xs text-slate-400">Dose {ml} ml</span><input className="input" type="number" min="0" step="0.01" value={form.dosePrices[String(ml)] || 0} onChange={(event) => setForm((current) => ({ ...current, dosePrices: { ...current.dosePrices, [String(ml)]: Number(event.target.value) } }))} /></label>)}</div>
          </div>
        </>}

        {form.kind === "combo" && <div className="md:col-span-2 rounded-xl border border-line bg-black/20 p-4">
          <p className="mb-3 text-sm font-semibold">Composição do combo</p>
          <div className="grid gap-2 sm:grid-cols-[1fr_110px_auto]">
            <select className="select" value={componentId} onChange={(event) => setComponentId(event.target.value)}><option value="">Selecione um produto</option>{state.products.filter((item) => item.kind !== "combo" && item.id !== product?.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
            <input className="input" type="number" min="1" step="1" value={componentQty} onChange={(event) => setComponentQty(Number(event.target.value))} />
            <button type="button" className="btn-primary" onClick={() => { if (!componentId || componentQty <= 0) return; setForm((current) => ({ ...current, comboItems: [...current.comboItems.filter((item) => item.productId !== componentId), { productId: componentId, quantity: componentQty }] })); setComponentId(""); setComponentQty(1); }}><Plus size={16} /> Incluir</button>
          </div>
          <div className="mt-3 space-y-2">{form.comboItems.map((item) => { const target = state.products.find((productItem) => productItem.id === item.productId); return <div key={item.productId} className="flex items-center justify-between rounded-lg border border-line bg-black/20 px-3 py-2 text-sm"><span>{item.quantity}× {target?.name || "Produto removido"}</span><button type="button" className="rounded-lg p-1.5 text-red-300 hover:bg-red-500/10" onClick={() => setForm((current) => ({ ...current, comboItems: current.comboItems.filter((component) => component.productId !== item.productId) }))}><Minus size={15} /></button></div>; })}{!form.comboItems.length && <p className="text-xs text-slate-500">Adicione os produtos que serão baixados automaticamente ao vender o combo.</p>}</div>
        </div>}

        <label className="flex items-center justify-between rounded-xl border border-line bg-white/[0.03] p-4">
          <div><span className="block text-sm font-semibold">Favorito no PDV</span><span className="mt-1 block text-xs text-slate-500">Aparece nos atalhos de venda rápida.</span></div>
          <button type="button" className={`rounded-xl p-2 ${form.favorite ? "bg-amber-400/10 text-amber-300" : "bg-white/5 text-slate-500"}`} onClick={() => set("favorite", !form.favorite)}><Star size={20} fill={form.favorite ? "currentColor" : "none"} /></button>
        </label>
        <label className="flex items-center justify-between rounded-xl border border-line bg-white/[0.03] p-4">
          <div><span className="block text-sm font-semibold">Produto ativo no PDV</span><span className="mt-1 block text-xs text-slate-500">Desative durante conferências.</span></div>
          <input type="checkbox" className="h-5 w-5 accent-fuchsia-500" checked={Boolean(form.active)} onChange={(event) => set("active", event.target.checked)} />
        </label>
      </div>}

      <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onCancel}>Cancelar</button><button className="btn-primary px-6">Salvar produto</button></div>
    </form>
  );
}
