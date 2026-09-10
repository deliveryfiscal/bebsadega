"use client";

import { Droplets, MinusCircle, Search, Wine } from "lucide-react";
import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { useToast } from "@/components/ui/toast";
import { availableVolumeMl } from "@/lib/business";
import { openBottleProducts } from "@/lib/operational";
import { useStore } from "@/lib/store";
import type { Product } from "@/lib/types";

export default function OpenBottlesPage() {
  const { state, setOpenBottleVolume, registerVolumeLoss } = useStore();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<Product | null>(null);
  const [mode, setMode] = useState<"count" | "loss">("count");
  const [volume, setVolume] = useState(0);
  const [reason, setReason] = useState("Conferência física");

  const volumeProducts = useMemo(() => state.products.filter((product) => product.kind === "volume" && product.active), [state.products]);
  const open = useMemo(() => openBottleProducts(volumeProducts), [volumeProducts]);
  const visible = useMemo(() => volumeProducts.filter((product) => [product.name, product.sku, product.category].join(" ").toLowerCase().includes(query.toLowerCase())), [volumeProducts, query]);
  const totalOpenMl = open.reduce((sum, product) => sum + Number(product.openVolumeMl || 0), 0);
  const totalAvailableMl = volumeProducts.reduce((sum, product) => sum + availableVolumeMl(product), 0);

  const openModal = (product: Product, nextMode: "count" | "loss") => {
    setTarget(product); setMode(nextMode); setVolume(nextMode === "count" ? Number(product.openVolumeMl || 0) : 0); setReason(nextMode === "count" ? "Conferência física" : "Perda / consumo interno");
  };

  return <>
    <PageHeader title="Garrafas abertas" description="O operador só informa o volume observado ou uma perda. O sistema mantém o restante do controle automaticamente." />

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Garrafas abertas" value={String(open.length)} icon={Wine} tone="violet" />
      <StatCard label="Volume aberto" value={`${Math.round(totalOpenMl)} ml`} icon={Droplets} tone="lime" />
      <StatCard label="Volume total disponível" value={`${Math.round(totalAvailableMl / 1000)} L`} icon={Droplets} />
      <StatCard label="Produtos por volume" value={String(volumeProducts.length)} icon={Wine} />
    </div>

    <section className="panel mt-6 p-4 md:p-5">
      <div className="relative mb-4"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} /><input className="input pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar bebida por nome, SKU ou categoria" /></div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visible.map((product) => {
        const bottle = Math.max(1, Number(product.bottleVolumeMl || 0));
        const openMl = Number(product.openVolumeMl || 0);
        const percent = Math.min(100, Math.round((openMl / bottle) * 100));
        const dose50 = Math.floor(availableVolumeMl(product) / 50);
        return <article key={product.id} className="panel-soft p-4">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-bold">{product.name}</p><p className="mt-1 text-xs text-slate-500">{product.sku} · {product.stock} fechada(s)</p></div><span className={`badge ${openMl > 0 ? "border-lime/30 bg-lime/10 text-lime" : ""}`}>{openMl > 0 ? "Aberta" : "Sem aberta"}</span></div>
          <div className="mt-4"><div className="mb-1 flex justify-between text-xs text-slate-500"><span>Volume aberto</span><strong className="text-white">{Math.round(openMl)} / {bottle} ml</strong></div><div className="h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-lime" style={{ width: `${percent}%` }} /></div></div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div className="rounded-lg border border-line bg-black/20 p-2"><span className="text-slate-500">Disponível</span><p className="mt-1 font-black">{Math.round(availableVolumeMl(product))} ml</p></div><div className="rounded-lg border border-line bg-black/20 p-2"><span className="text-slate-500">Doses 50 ml</span><p className="mt-1 font-black">{dose50}</p></div></div>
          <div className="mt-4 grid grid-cols-2 gap-2"><button className="btn-ghost" onClick={() => openModal(product, "count")}><Droplets size={16} /> Conferir</button><button className="btn-ghost text-amber-200" onClick={() => openModal(product, "loss")}><MinusCircle size={16} /> Perda</button></div>
        </article>;
      })}</div>
      {!visible.length && <div className="grid min-h-44 place-items-center text-sm text-slate-500">Nenhuma bebida encontrada.</div>}
    </section>

    <Modal open={Boolean(target)} onClose={() => setTarget(null)} title={mode === "count" ? "Conferir garrafa aberta" : "Registrar perda em ml"} width="max-w-lg">
      {target && <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); try { if (mode === "count") setOpenBottleVolume(target.id, volume, reason); else registerVolumeLoss(target.id, volume, reason); toast.success(mode === "count" ? "Volume conferido." : "Perda registrada."); setTarget(null); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar."); } }}>
        <div className="panel-soft p-4"><p className="font-bold">{target.name}</p><p className="mt-1 text-sm text-slate-500">Garrafa {target.bottleVolumeMl || 0} ml · aberto atualmente {target.openVolumeMl || 0} ml</p></div>
        <label><span className="mb-1.5 block text-sm font-semibold">{mode === "count" ? "Volume físico observado (ml)" : "Volume perdido (ml)"}</span><input className="input h-12 text-lg font-black" type="number" min="0" max={mode === "count" ? target.bottleVolumeMl || undefined : availableVolumeMl(target)} step="1" required value={volume} onChange={(event) => setVolume(Math.max(0, Number(event.target.value) || 0))} /></label>
        <label><span className="mb-1.5 block text-sm font-semibold">Motivo</span><select className="select" value={reason} onChange={(event) => setReason(event.target.value)}>{mode === "count" ? <><option>Conferência física</option><option>Ajuste de abertura</option><option>Correção de contagem</option></> : <><option>Perda / consumo interno</option><option>Derramamento</option><option>Quebra</option><option>Cortesia</option><option>Degustação</option></>}</select></label>
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setTarget(null)}>Cancelar</button><button className={mode === "loss" ? "btn-primary" : "btn-lime"}>Salvar</button></div>
      </form>}
    </Modal>
  </>;
}
