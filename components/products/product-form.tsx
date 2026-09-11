"use client";

import { ChevronDown, ChevronUp, Hash, Minus, Plus, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NumberInput } from "@/components/ui/number-input";
import { generateInternalCode } from "@/lib/business";
import { useStore } from "@/lib/store";
import type { ComboComponent, Product, ProductKind } from "@/lib/types";

type ProductFormMode = ProductKind | "dose";

export type ProductFormState = {
  name: string;
  barcode: string;
  barcodeType: "ean" | "internal";
  sku: string;
  category: string;
  brand: string;
  mode: ProductFormMode;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  active: boolean;
  favorite: boolean;
  location: string;
  bottleVolumeMl: number;
  doseSourceProductId: string;
  comboItems: ComboComponent[];
};

const empty: ProductFormState = {
  name: "",
  barcode: "",
  barcodeType: "ean",
  sku: "",
  category: "Bebidas",
  brand: "",
  mode: "unit",
  price: 0,
  cost: 0,
  stock: 0,
  minStock: 0,
  active: true,
  favorite: false,
  location: "",
  bottleVolumeMl: 1000,
  doseSourceProductId: "",
  comboItems: [],
};

function toFormState(product?: Product, initialBarcode?: string): ProductFormState {
  const barcode = initialBarcode || product?.barcode || "";
  return {
    ...empty,
    ...(product || {}),
    barcode,
    barcodeType: product?.barcodeType || (barcode.length === 4 ? "internal" : "ean"),
    brand: product?.brand || "",
    location: product?.location || "",
    favorite: Boolean(product?.favorite),
    mode: product?.doseSourceProductId ? "dose" : product?.kind || "unit",
    bottleVolumeMl: product?.bottleVolumeMl ?? empty.bottleVolumeMl,
    doseSourceProductId: product?.doseSourceProductId || "",
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

  const bottles = useMemo(() => state.products
    .filter((item) => item.kind === "volume" && item.id !== product?.id && item.active)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")), [state.products, product?.id]);

  useEffect(() => {
    setForm(toFormState(product, initialBarcode));
    setAdvanced(!quick && Boolean(product));
  }, [product, initialBarcode, quick]);

  const set = <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  const generateCode = () => {
    try {
      const code = generateInternalCode(state.products.filter((item) => item.id !== product?.id));
      setForm((current) => ({ ...current, barcode: code, barcodeType: "internal" }));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Não foi possível gerar o código interno.");
    }
  };

  const submit = () => {
    if (form.mode === "combo" && form.active && !form.comboItems.length) {
      window.alert("Adicione pelo menos um componente antes de ativar o combo.");
      return;
    }
    if (form.mode === "dose" && !form.doseSourceProductId) {
      window.alert("Selecione a garrafa que fornecerá os ml deste Produto Dose.");
      return;
    }
    if (form.mode === "volume" && form.bottleVolumeMl <= 0) {
      window.alert("Informe o volume total da garrafa em ml.");
      return;
    }

    const kind: ProductKind = form.mode === "dose" ? "unit" : form.mode;
    onSave({
      id: product?.id,
      name: form.name,
      barcode: form.barcode,
      barcodeType: form.barcodeType,
      sku: form.sku,
      category: form.category,
      brand: form.brand,
      kind,
      price: form.mode === "dose" ? Math.max(0, Number(form.price)) : Number(form.price),
      cost: form.mode === "dose" ? 0 : Number(form.cost),
      stock: form.mode === "dose" ? 0 : Number(form.stock),
      minStock: form.mode === "dose" ? 0 : Number(form.minStock),
      active: form.active ?? product?.active ?? true,
      favorite: form.favorite,
      location: form.location,
      bottleVolumeMl: form.mode === "volume" ? Number(form.bottleVolumeMl) : undefined,
      dosePrices: form.mode === "volume" ? {} : undefined,
      doseSourceProductId: form.mode === "dose" ? form.doseSourceProductId : "",
      comboItems: form.mode === "combo" ? form.comboItems : undefined,
    });
  };

  return (
    <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <div className="rounded-xl border border-lime/20 bg-lime/[0.04] p-3 text-xs text-slate-300">
        Produto sem EAN? Use <strong className="text-white">Gerar código</strong>. O sistema cria um código interno único de 4 dígitos que pode ser digitado ou lido no PDV.
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="md:col-span-2">
          <span className="mb-1.5 block text-sm font-semibold">Nome do produto</span>
          <input className="input h-12" required value={form.name} onChange={(event) => set("name", event.target.value)} placeholder="Ex.: Buchanan's 1 L" />
        </label>

        <div>
          <span className="mb-1.5 block text-sm font-semibold">Código de barras / EAN / interno</span>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              className="input h-12 font-mono"
              autoFocus={Boolean(initialBarcode)}
              value={form.barcode}
              onChange={(event) => setForm((current) => ({ ...current, barcode: event.target.value, barcodeType: event.target.value.trim().length === 4 ? "internal" : "ean" }))}
              placeholder="Bipe, digite ou gere"
            />
            <button type="button" className="btn-ghost h-12 whitespace-nowrap" onClick={generateCode}><Hash size={17} /> Gerar código</button>
          </div>
          {form.barcode && <span className={`mt-1.5 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold ${form.barcodeType === "internal" ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-300" : "border-line text-slate-500"}`}>{form.barcodeType === "internal" ? "Código interno · 4 dígitos" : "EAN / código informado"}</span>}
        </div>

        <label>
          <span className="mb-1.5 block text-sm font-semibold">Tipo do produto</span>
          <select className="select h-12" value={form.mode} onChange={(event) => set("mode", event.target.value as ProductFormMode)}>
            <option value="unit">Produto normal</option>
            <option value="volume">Garrafa · pode vender inteira ou em ml</option>
            <option value="dose">Produto Dose · atalho para uma garrafa</option>
            <option value="combo">Combo</option>
          </select>
        </label>

        <label>
          <span className="mb-1.5 block text-sm font-semibold">{form.mode === "dose" ? "Preço de referência (opcional)" : "Preço de venda"}</span>
          <NumberInput className="input h-12 text-lg font-bold" min={0} step={0.01} required={form.mode !== "dose"} value={form.price} onValueChange={(value) => set("price", value)} placeholder={form.mode === "dose" ? "O valor será perguntado no PDV" : "Ex.: 29,90"} />
        </label>

        <label>
          <span className="mb-1.5 block text-sm font-semibold">Categoria</span>
          <input className="input" required value={form.category} onChange={(event) => set("category", event.target.value)} />
        </label>

        {form.mode !== "dose" && form.mode !== "combo" && <label>
          <span className="mb-1.5 block text-sm font-semibold">Estoque inicial {form.mode === "volume" ? "(garrafas fechadas)" : ""}</span>
          <NumberInput className="input" min={0} step={1} value={form.stock} onValueChange={(value) => set("stock", value)} placeholder="0" />
        </label>}

        {form.mode === "volume" && <label>
          <span className="mb-1.5 block text-sm font-semibold">Volume completo da garrafa (ml)</span>
          <NumberInput className="input" min={1} step={1} emptyWhenZero={false} value={form.bottleVolumeMl} onValueChange={(value) => set("bottleVolumeMl", value)} placeholder="Ex.: 1000" />
          <span className="mt-1 block text-xs text-slate-500">Esse volume alimenta automaticamente a aba Garrafas e as vendas por ml.</span>
        </label>}

        {form.mode === "dose" && <label className="md:col-span-2">
          <span className="mb-1.5 block text-sm font-semibold">Garrafa vinculada</span>
          <select className="select h-12" required value={form.doseSourceProductId} onChange={(event) => set("doseSourceProductId", event.target.value)}>
            <option value="">Selecione a garrafa...</option>
            {bottles.map((bottle) => <option key={bottle.id} value={bottle.id}>{bottle.name} · {bottle.bottleVolumeMl || 0} ml</option>)}
          </select>
          <span className="mt-1 block text-xs text-slate-500">Produto Dose não cria estoque próprio. Toda venda baixa os ml da garrafa escolhida.</span>
        </label>}
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

        {form.mode !== "dose" && form.mode !== "combo" && <label>
          <span className="mb-1.5 block text-sm font-semibold">Preço de custo</span>
          <NumberInput className="input" min={0} step={0.01} value={form.cost} onValueChange={(value) => set("cost", value)} placeholder="Ex.: 20,00" />
        </label>}
        {form.mode !== "dose" && form.mode !== "combo" && <label>
          <span className="mb-1.5 block text-sm font-semibold">Estoque mínimo</span>
          <NumberInput className="input" min={0} step={1} value={form.minStock} onValueChange={(value) => set("minStock", value)} placeholder="Ex.: 5" />
        </label>}

        {form.mode === "volume" && <div className="md:col-span-2 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.04] p-4">
          <p className="font-semibold text-cyan-200">Venda por ml livre</p>
          <p className="mt-1 text-xs text-slate-400">Não existe preço fixo de 50/100 ml. No PDV, o operador informa quantos ml serviu e o valor cobrado naquela dose. A garrafa aberta é atualizada automaticamente.</p>
        </div>}

        {form.mode === "combo" && <div className="md:col-span-2 rounded-xl border border-line bg-black/20 p-4">
          <p className="mb-3 text-sm font-semibold">Composição do combo</p>
          <div className="grid gap-2 sm:grid-cols-[1fr_110px_auto]">
            <select className="select" value={componentId} onChange={(event) => setComponentId(event.target.value)}><option value="">Selecione um produto</option>{state.products.filter((item) => item.kind !== "combo" && !item.doseSourceProductId && item.id !== product?.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
            <NumberInput className="input" min={1} step={1} emptyWhenZero={false} value={componentQty} onValueChange={setComponentQty} />
            <button type="button" className="btn-primary" onClick={() => { if (!componentId || componentQty <= 0) return; setForm((current) => ({ ...current, comboItems: [...current.comboItems.filter((item) => item.productId !== componentId), { productId: componentId, quantity: componentQty }] })); setComponentId(""); setComponentQty(1); }}><Plus size={16} /> Incluir</button>
          </div>
          <div className="mt-3 space-y-2">{form.comboItems.map((item) => { const target = state.products.find((productItem) => productItem.id === item.productId); return <div key={item.productId} className="flex items-center justify-between rounded-lg border border-line bg-black/20 px-3 py-2 text-sm"><span>{item.quantity}× {target?.name || "Produto removido"}</span><button type="button" className="rounded-lg p-1.5 text-red-300 hover:bg-red-500/10" onClick={() => setForm((current) => ({ ...current, comboItems: current.comboItems.filter((component) => component.productId !== item.productId) }))}><Minus size={15} /></button></div>; })}{!form.comboItems.length && <p className="text-xs text-slate-500">Adicione os produtos que serão baixados automaticamente ao vender o combo.</p>}</div>
        </div>}

        <label className="flex items-center justify-between rounded-xl border border-line bg-white/[0.03] p-4">
          <div><span className="block text-sm font-semibold">Favorito no PDV</span><span className="mt-1 block text-xs text-slate-500">Útil especialmente para itens sem EAN e Produtos Dose.</span></div>
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
