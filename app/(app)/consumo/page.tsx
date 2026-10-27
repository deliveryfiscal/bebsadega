"use client";

import { useMemo, useState } from "react";
import { Plus, Search, Trash2, Undo2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { NumberInput } from "@/components/ui/number-input";
import { useToast } from "@/components/ui/toast";
import { useManagerPin } from "@/components/security/manager-pin";
import { applyCartToStock } from "@/lib/business";
import { useStore } from "@/lib/store";
import type { CartItem } from "@/lib/types";
import { currency, dateTime, uid } from "@/lib/utils";

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}

export default function ConsumptionPage() {
  const { state, recordConsumption, reverseConsumption, settleConsumptionCharge } = useStore();
  const toast = useToast();
  const pin = useManagerPin();
  const [employeeId, setEmployeeId] = useState("");
  const [productId, setProductId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);
  const [highlightedSuggestion, setHighlightedSuggestion] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [volumeMl, setVolumeMl] = useState(50);
  const [settlement, setSettlement] = useState<"house" | "employee_charge">("house");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<CartItem[]>([]);
  const [query, setQuery] = useState("");
  const products = useMemo(() => state.products.filter((p) => p.active && !p.deletedAt && !p.doseSourceProductId), [state.products]);
  const employees = state.employees.filter((person) => person.active);
  const selected = products.find((product) => product.id === productId);
  const matchingProducts = useMemo(() => {
    const term = normalizeSearch(productSearch);
    const filtered = term
      ? products.filter((product) => normalizeSearch([product.name, product.barcode, product.sku, product.category].join(" ")).includes(term))
      : products.filter((product) => product.favorite);
    return filtered.sort((a, b) => Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)) || a.name.localeCompare(b.name, "pt-BR")).slice(0, 12);
  }, [products, productSearch]);
  const selectProduct = (id: string) => {
    const product = products.find((item) => item.id === id);
    if (!product) return;
    setProductId(id);
    setProductSearch(product.name);
    setShowProductSuggestions(false);
    setHighlightedSuggestion(0);
  };
  const history = state.consumptions.filter((item) => [item.employeeName, item.number, ...item.items.map((part) => part.name)].join(" ").toLowerCase().includes(query.toLowerCase()));
  const reference = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  const add = () => {
    if (!selected) return toast.error("Selecione um produto.");
    const qty = Number(quantity);
    const ml = Number(volumeMl);
    if (!Number.isFinite(qty) || !Number.isInteger(qty) || qty <= 0) return toast.error("Quantidade inválida.");
    if (selected.kind === "volume" && (!Number.isFinite(ml) || ml <= 0)) return toast.error("Informe os ml servidos.");
    const mode: CartItem["mode"] = selected.kind === "combo" ? "combo" : selected.kind === "volume" ? "dose" : "unit";
    const perUnit = mode === "dose" ? (selected.price / Math.max(1, selected.bottleVolumeMl || 1)) * ml : selected.price;
    const candidate: CartItem = { id: uid("cons_cart"), productId: selected.id, name: selected.name, mode, quantity: qty, unitPrice: Number(perUnit.toFixed(2)), doseMl: mode === "dose" ? ml : undefined };
    // Validar o carrinho COMPLETO, não apenas cada lançamento isolado. Impede que
    // duas inclusões ultrapassem o saldo e que combos consumam a mesma unidade.
    try {
      applyCartToStock(state.products, [...items, candidate]);
    } catch (error) {
      return toast.error(error instanceof Error ? error.message : "Estoque insuficiente para o consumo.");
    }
    setItems((current) => [...current, candidate]);
    setProductId("");
    setProductSearch("");
    setShowProductSuggestions(false);
    setHighlightedSuggestion(0);
    setQuantity(1);
  };

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (!employeeId) throw new Error("Selecione um funcionário.");
      if (!items.length) throw new Error("Adicione produtos.");
      recordConsumption({ employeeId, items, settlement, note });
      toast.success("Consumo registrado. Estoque atualizado.");
      setItems([]);
      setNote("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao registrar consumo.";
      if (message.startsWith("LIMITE_CONSUMO:")) return toast.error("Limite mensal de consumo excedido. Solicite ajuste ao gerente.");
      toast.error(message);
    }
  };

  const reverse = async (id: string) => {
    const reason = window.prompt("Informe o motivo do estorno do consumo:");
    if (!reason?.trim()) return;
    const authorized = await pin.request({ scope: "consumo:estorno", title: "Autorizar estorno", description: "O estorno devolve os itens e ml ao estoque. Informe o PIN gerencial." });
    if (!authorized) return;
    try { reverseConsumption(id, reason); toast.success("Consumo estornado com auditoria."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível estornar."); }
  };

  const settle = async (id: string, status: "discounted" | "forgiven") => {
    if (!window.confirm(status === "discounted" ? "Confirmar desconto manual no pagamento?" : "Perdoar esta cobrança?")) return;
    const authorized = await pin.request({
      scope: "consumo:baixa-cobranca",
      title: "Autorizar baixa de cobrança",
      description: "A alteração de um valor devido pelo funcionário exige PIN gerencial.",
    });
    if (!authorized) return;
    try {
      settleConsumptionCharge(id, status);
      toast.success(status === "discounted" ? "Cobrança marcada como descontada." : "Cobrança perdoada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a cobrança.");
    }
  };

  return (
    <>
      <PageHeader title="Consumo interno" description="Controle de consumo dos funcionários, inclusive doses em ml, com baixa automática das garrafas." />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <form className="panel space-y-4 p-5" onSubmit={save}>
          <h2 className="section-title">Novo consumo</h2>
          <label className="block"><span className="mb-1 block text-sm">Funcionário</span><select className="select" required value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
            <option value="">Selecionar funcionário...</option>
            {employees.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select></label>
          <div className="relative" onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setShowProductSuggestions(false);
          }}>
            <label htmlFor="consumption-product-search" className="mb-1 block text-sm">Produto / garrafa</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input
                id="consumption-product-search"
                type="search"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={showProductSuggestions}
                aria-controls="consumption-product-options"
                className="input w-full pl-10"
                value={productSearch}
                placeholder="Buscar nome, código de barras ou SKU..."
                autoComplete="off"
                onFocus={() => setShowProductSuggestions(true)}
                onChange={(event) => {
                  setProductSearch(event.target.value);
                  setProductId("");
                  setShowProductSuggestions(true);
                  setHighlightedSuggestion(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setShowProductSuggestions(false);
                  } else if (event.key === "ArrowDown" && showProductSuggestions) {
                    event.preventDefault();
                    setHighlightedSuggestion((index) => Math.min(matchingProducts.length - 1, index + 1));
                  } else if (event.key === "ArrowUp" && showProductSuggestions) {
                    event.preventDefault();
                    setHighlightedSuggestion((index) => Math.max(0, index - 1));
                  } else if (event.key === "Enter") {
                    event.preventDefault();
                    if (showProductSuggestions && matchingProducts.length) selectProduct(matchingProducts[Math.max(0, highlightedSuggestion)]?.id || matchingProducts[0].id);
                  }
                }}
              />
            </div>
            {selected && !showProductSuggestions && <p className="mt-1 text-xs text-lime">Selecionado: {selected.name} · Estoque: {selected.stock} {selected.kind === "volume" ? "garrafas" : "un."}</p>}
            {showProductSuggestions && <div id="consumption-product-options" role="listbox" aria-label="Resultados de produtos" className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-line bg-[#111827] p-1 shadow-2xl">
              {matchingProducts.map((product, index) => <button
                key={product.id}
                type="button"
                role="option"
                aria-selected={highlightedSuggestion === index}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm ${highlightedSuggestion === index ? "bg-white/15" : "hover:bg-white/10"}`}
                onMouseEnter={() => setHighlightedSuggestion(index)}
                onClick={() => selectProduct(product.id)}
              >
                <span className="min-w-0"><span className="block truncate font-semibold">{product.name}</span><span className="block truncate text-xs text-slate-400">{product.sku}{product.barcode ? ` · ${product.barcode}` : ""}</span></span>
                <span className="shrink-0 text-xs text-slate-400">{product.stock} un.</span>
              </button>)}
              {!matchingProducts.length && <p className="p-3 text-sm text-slate-400">{productSearch.trim() ? "Nenhum produto encontrado. Confira o cadastro ou a grafia." : "Digite o nome, código ou SKU do produto."}</p>}
            </div>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label><span className="mb-1 block text-sm">Quantidade</span><NumberInput className="input" min={1} step={1} emptyWhenZero={false} value={quantity} onValueChange={setQuantity}/></label>
            {selected?.kind === "volume" && <label><span className="mb-1 block text-sm">ML por dose</span><NumberInput className="input" min={1} step={1} emptyWhenZero={false} value={volumeMl} onValueChange={setVolumeMl}/></label>}
          </div>
          <button className="btn-ghost w-full" type="button" onClick={add}><Plus size={16}/> Adicionar ao consumo</button>
          <div className="space-y-2">
            {items.map((item) => <div className="panel-soft flex items-center justify-between gap-2 p-3" key={item.id}>
              <div><p className="text-sm font-semibold">{item.name}</p><p className="text-xs text-slate-400">{item.quantity}x {item.doseMl ? `${item.doseMl} ml` : "unidade"} · referência {currency(item.unitPrice * item.quantity)}</p></div>
              <button type="button" className="text-red-300" aria-label="Remover item" onClick={() => setItems((current) => current.filter((row) => row.id !== item.id))}><Trash2 size={17}/></button>
            </div>)}
            {!items.length && <p className="rounded-xl border border-line p-3 text-sm text-slate-400">Nenhum item adicionado.</p>}
          </div>
          <p className="text-sm">Valor de venda de referência: <strong>{currency(reference)}</strong></p>
          {items.some((item) => {
            const p = state.products.find((product) => product.id === item.productId);
            return p && p.cost <= 0;
          }) && <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">Há itens sem custo cadastrado. O consumo será registrado, mas o custo financeiro ficará subestimado até que os cadastros sejam completados.</p>}
          <label className="block"><span className="mb-1 block text-sm">Como classificar</span><select className="select" value={settlement} onChange={(event) => setSettlement(event.target.value as typeof settlement)}><option value="house">Consumo da casa</option><option value="employee_charge">Cobrar do funcionário</option></select></label>
          <label className="block"><span className="mb-1 block text-sm">Observação</span><textarea className="input min-h-20" value={note} onChange={(event) => setNote(event.target.value)}/></label>
          <button className="btn-primary w-full" type="submit" disabled={!employeeId || !items.length}>Registrar consumo</button>
        </form>
        <section className="panel min-w-0 p-5">
          <h2 className="section-title">Histórico de consumo</h2>
          <input className="input my-4" placeholder="Buscar por funcionário ou item" value={query} onChange={(event) => setQuery(event.target.value)}/>
          <div className="max-h-[700px] space-y-3 overflow-y-auto">
            {history.map((row) => <article className="panel-soft p-4" key={row.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><p className="font-bold">#{row.number} · {row.employeeName}</p><p className="text-xs text-slate-400">{dateTime(row.createdAt)} · {row.operator}</p></div>
                <span className={row.status === "active" ? "text-xs font-bold text-lime" : "text-xs font-bold text-amber-300"}>{row.status === "active" ? "Registrado" : "Estornado"}</span>
              </div>
              <p className="mt-2 text-sm text-slate-300">{row.items.map((item) => `${item.quantity}x ${item.name}${item.doseMl ? ` (${item.doseMl} ml)` : ""}`).join(" · ")}</p>
              <div className="mt-2 flex flex-wrap gap-4 text-sm"><span>Custo: <strong>{currency(row.totalCost)}</strong>{row.totalCost === 0 && <span className="ml-1 text-xs text-amber-300">(não cadastrado)</span>}</span><span>Referência: <strong>{currency(row.saleEquivalent)}</strong></span></div>
              <p className="mt-2 text-xs text-slate-400">{row.settlement === "house" ? "Consumo da casa" : `Cobrança: ${row.chargeStatus} · ${currency(row.chargeAmount)}`}</p>
              {row.reverseReason && <p className="mt-2 text-xs text-amber-200">Estorno: {row.reverseReason}</p>}
              {row.status === "active" && <div className="mt-3 flex flex-wrap gap-2">
                {row.chargeStatus === "pending" && <>
                  <button className="btn-ghost" onClick={() => void settle(row.id, "discounted")}>Marcar descontado</button>
                  <button className="btn-ghost" onClick={() => void settle(row.id, "forgiven")}>Perdoar</button>
                </>}
                <button className="btn-ghost text-amber-200" onClick={() => void reverse(row.id)}><Undo2 size={15}/> Estornar</button>
              </div>}
            </article>)}
            {!history.length && <p className="py-12 text-center text-sm text-slate-400">Nenhum consumo registrado.</p>}
          </div>
        </section>
      </div>
      {pin.dialog}
    </>
  );
}
