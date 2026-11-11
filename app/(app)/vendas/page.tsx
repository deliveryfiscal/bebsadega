"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLoja, useAoMudar } from "@/lib/loja";
import { useSessao } from "@/lib/sessao";
import { supabase, mensagemErro } from "@/lib/supabase";
import { brl, dataHora, diaCurto, hojeISO, hora, intervalo, nomeForma, somarDias } from "@/lib/formato";
import type { Venda } from "@/lib/tipos";
import { BotaoAcao, Carregando, Janela, Numero, Titulo, Vazio, useAviso } from "@/components/ui";

export default function Vendas() {
  const { eu } = useSessao();
  const { fila } = useLoja();
  const dono = eu?.papel === "dono";
  const [dia, setDia] = useState(hojeISO());
  const [vendas, setVendas] = useState<Venda[] | null>(null);
  const [aberta, setAberta] = useState<Venda | null>(null);
  const [filtro, setFiltro] = useState("");

  const carregar = useCallback(async () => {
    const { de, ate } = intervalo(dia);
    const { data, error } = await supabase().from("vendas")
      .select("*, venda_itens(produto_id,nome,quantidade,preco_unitario,total), venda_pagamentos(forma,valor)")
      .gte("criado_em", de).lt("criado_em", ate).order("criado_em", { ascending: false }).limit(1000);
    if (error) throw error;
    setVendas((data as Venda[]) || []);
  }, [dia]);

  useEffect(() => { setVendas(null); void carregar().catch(() => setVendas([])); }, [carregar]);
  useAoMudar(["vendas"], () => { void carregar().catch(() => undefined); });

  const pendentes = fila.filter((f) => f.tipo === "venda");
  const lista = useMemo(() => {
    const f = filtro.trim().toLowerCase();
    return (vendas || []).filter((v) => !f || String(v.numero).includes(f) || v.funcionario_nome.toLowerCase().includes(f)
      || v.venda_itens?.some((i) => i.nome.toLowerCase().includes(f)));
  }, [vendas, filtro]);

  const ok = (vendas || []).filter((v) => v.status === "concluida");
  const total = ok.reduce((s, v) => s + Number(v.total), 0);
  const porForma = ok.flatMap((v) => v.venda_pagamentos || []).reduce<Record<string, number>>((m, p) => ({ ...m, [p.forma]: (m[p.forma] || 0) + Number(p.valor) }), {});

  return (
    <div className="space-y-4">
      <Titulo acoes={
        <div className="flex items-center gap-2">
          {dono && <button className="btn-secundario px-3" onClick={() => setDia(somarDias(dia, -1))} aria-label="Dia anterior">‹</button>}
          {dono ? <input type="date" className="campo w-44" value={dia} max={hojeISO()} onChange={(e) => e.target.value && setDia(e.target.value)} aria-label="Dia" />
            : <span className="text-muted">Hoje</span>}
          {dono && <button className="btn-secundario px-3" disabled={dia >= hojeISO()} onClick={() => setDia(somarDias(dia, 1))} aria-label="Próximo dia">›</button>}
        </div>
      }>Vendas · {diaCurto(dia)}</Titulo>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Numero titulo="Total do dia" valor={brl(total)} destaque detalhe={`${ok.length} venda(s)`} />
        {(["dinheiro", "pix", "debito", "credito"] as const).map((f) => <Numero key={f} titulo={nomeForma(f)} valor={brl(porForma[f] || 0)} />)}
      </div>

      {pendentes.length > 0 && (
        <div className="cartao border-amber-500/60">
          <div className="font-bold text-amber-300">{pendentes.length} venda(s) deste aparelho aguardando internet</div>
          <ul className="mt-1 text-sm text-muted">{pendentes.map((p) => <li key={p.id}>{dataHora(p.criadoEm)} · {p.resumo}{p.erro ? ` · ${p.erro}` : ""}</li>)}</ul>
        </div>
      )}

      <input className="campo" placeholder="Filtrar por número, produto ou atendente" value={filtro} onChange={(e) => setFiltro(e.target.value)} />

      {vendas === null ? <Carregando /> : !lista.length ? <Vazio>Nenhuma venda neste dia.</Vazio> : (
        <div className="cartao overflow-x-auto p-0">
          <table className="tabela">
            <thead><tr><th>#</th><th>Hora</th><th>Itens</th><th>Pagamento</th><th>Atendente</th><th className="text-right">Total</th></tr></thead>
            <tbody>
              {lista.map((v) => (
                <tr key={v.id} className={`cursor-pointer hover:bg-white/5 ${v.status === "cancelada" ? "opacity-50 line-through" : ""}`} onClick={() => setAberta(v)}>
                  <td className="font-semibold">{v.numero}</td>
                  <td>{hora(v.criado_em)}</td>
                  <td className="max-w-[320px] truncate">{v.venda_itens?.map((i) => `${i.quantidade}× ${i.nome}`).join(", ")}</td>
                  <td>{v.venda_pagamentos?.map((p) => nomeForma(p.forma)).join(" + ")}</td>
                  <td>{v.funcionario_nome}</td>
                  <td className="text-right font-bold tabular-nums">{brl(v.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Detalhe venda={aberta} aoFechar={() => setAberta(null)} podeCancelar={dono} aoCancelar={async () => { setAberta(null); await carregar(); }} />
    </div>
  );
}

function Detalhe({ venda, aoFechar, podeCancelar, aoCancelar }: { venda: Venda | null; aoFechar: () => void; podeCancelar: boolean; aoCancelar: () => Promise<void> }) {
  const [motivo, setMotivo] = useState("");
  const avisar = useAviso();
  useEffect(() => setMotivo(""), [venda]);
  if (!venda) return null;
  return (
    <Janela titulo={`Venda #${venda.numero}`} aberta={!!venda} aoFechar={aoFechar}>
      <div className="space-y-3 text-sm">
        <div className="text-muted">{dataHora(venda.criado_em)} · {venda.funcionario_nome}{venda.dispositivo ? ` · ${venda.dispositivo}` : ""}</div>
        {venda.status === "cancelada" && (
          <div className="rounded-lg bg-red-600/20 p-2 text-red-200">Cancelada por {venda.cancelada_por_nome || "—"} em {dataHora(venda.cancelada_em)} · {venda.motivo_cancelamento}</div>
        )}
        <table className="tabela">
          <tbody>
            {venda.venda_itens?.map((i, k) => (
              <tr key={k}><td>{i.quantidade}×</td><td>{i.nome}</td><td className="text-right">{brl(i.preco_unitario)}</td><td className="text-right font-semibold">{brl(i.total)}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="space-y-1 text-right">
          {Number(venda.desconto) > 0 && <div>Subtotal {brl(venda.subtotal)} · Desconto −{brl(venda.desconto)}</div>}
          <div className="text-xl font-bold">Total {brl(venda.total)}</div>
          <div className="text-muted">{venda.venda_pagamentos?.map((p) => `${nomeForma(p.forma)} ${brl(p.valor)}`).join(" + ")}</div>
          {Number(venda.troco) > 0 && <div className="text-muted">Troco {brl(venda.troco)}</div>}
        </div>
        {podeCancelar && venda.status === "concluida" && (
          <div className="space-y-2 border-t border-line pt-3">
            <input className="campo" placeholder="Motivo do cancelamento" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            <BotaoAcao className="btn-perigo w-full" acao={async () => {
              if (!motivo.trim()) throw new Error("Informe o motivo.");
              if (!confirm(`Cancelar a venda #${venda.numero}? Os produtos voltam para o estoque.`)) return;
              const { error } = await supabase().rpc("cancelar_venda", { p_id: venda.id, p_motivo: motivo });
              if (error) throw new Error(mensagemErro(error));
              avisar(`Venda #${venda.numero} cancelada.`);
              await aoCancelar();
            }}>Cancelar venda</BotaoAcao>
          </div>
        )}
      </div>
    </Janela>
  );
}
