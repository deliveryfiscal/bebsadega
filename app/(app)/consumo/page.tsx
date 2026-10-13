"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, Undo2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { NumberInput } from "@/components/ui/number-input";
import { useToast } from "@/components/ui/toast";
import { useManagerPin } from "@/components/security/manager-pin";
import { availableVolumeMl, comboAvailability } from "@/lib/business";
import { useStore } from "@/lib/store";
import type { CartItem } from "@/lib/types";
import { currency, dateTime, uid } from "@/lib/utils";

export default function ConsumptionPage() {
  const { state, recordConsumption, reverseConsumption, settleConsumptionCharge } = useStore();
  const toast = useToast();
  const pin = useManagerPin();
  const [employeeId, setEmployeeId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [volumeMl, setVolumeMl] = useState(50);
  const [settlement, setSettlement] = useState<"house" | "employee_charge">("house");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<CartItem[]>([]);
  const [query, setQuery] = useState("");
  const products = useMemo(() => state.products.filter((p) => p.active && !p.deletedAt && !p.doseSourceProductId), [state.products]);
  const employees = state.employees.filter((person) => person.active);
  const selected = products.find((product) => product.id === productId);
  const history = state.consumptions.filter((item) => [item.employeeName, item.number, ...item.items.map((part) => part.name)].join(" ").toLowerCase().includes(query.toLowerCase()));
  const reference = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  const add = () => {
    if (!selected) return toast.error("Selecione um produto.");
    const qty = Number(quantity);
    const ml = Number(volumeMl);
    if (!Number.isFinite(qty) || !Number.isInteger(qty) || qty <= 0) return toast.error("Quantidade inválida.");
    if (selected.kind === "volume" && (!Number.isFinite(ml) || ml <= 0)) return toast.error("Informe os ml servidos.");
    const mode: CartItem["mode"] = selected.kind === "combo" ? "combo" : selected.kind === "volume" ? "dose" : "unit";
    const maxAvailable = mode === "dose" ? availableVolumeMl(selected) / ml : mode === "combo" ? comboAvailability(selected, state.products).available : selected.stock;
    if (qty > maxAvailable) return toast.error("Estoque insuficiente para esse consumo.");
    const perUnit = mode === "dose" ? (selected.price / Math.max(1, selected.bottleVolumeMl || 1)) * ml : selected.price;
    setItems((current) => [...current, { id: uid("cons_cart"), productId: selected.id, name: selected.name, mode, quantity: qty, unitPrice: Number(perUnit.toFixed(2)), doseMl: mode === "dose" ? ml : undefined }]);
    setProductId("");
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
          <label className="block"><span className="mb-1 block text-sm">Produto / garrafa</span><select className="select" value={productId} onChange={(event) => setProductId(event.target.value)}>
            <option value="">Selecione um item...</option>
            {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
          </select></label>
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
              <div className="mt-2 flex flex-wrap gap-4 text-sm"><span>Custo: <strong>{currency(row.totalCost)}</strong></span><span>Referência: <strong>{currency(row.saleEquivalent)}</strong></span></div>
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
