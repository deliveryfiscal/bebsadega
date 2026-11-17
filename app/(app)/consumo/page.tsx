"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useLoja, useAoMudar } from "@/lib/loja";
import { useSessao } from "@/lib/sessao";
import { supabase, mensagemErro } from "@/lib/supabase";
import { brl, dataHora, hojeISO, intervalo, novoId } from "@/lib/formato";
import type { Consumo, Produto } from "@/lib/tipos";
import { BuscaProduto, type BuscaRef } from "@/components/busca-produto";
import { BotaoAcao, Titulo, Vazio, useAviso } from "@/components/ui";

type Item = { produto_id: string; nome: string; quantidade: number; preco: number };

export default function ConsumoPagina() {
  const { eu } = useSessao();
  const { funcionarios, enviarOperacao } = useLoja();
  const avisar = useAviso();
  const dono = eu?.papel === "dono";
  const busca = useRef<BuscaRef>(null);
  const [quem, setQuem] = useState<string>(eu?.id || "");
  const [outro, setOutro] = useState("");
  const [obs, setObs] = useState("");
  const [itens, setItens] = useState<Item[]>([]);
  const [lista, setLista] = useState<Consumo[] | null>(null);
  const mes = hojeISO().slice(0, 8) + "01";

  const carregar = useCallback(async () => {
    const { de, ate } = intervalo(dono ? mes : hojeISO(), hojeISO());
    const { data } = await supabase().from("consumos").select("*, consumo_itens(nome,quantidade,preco_referencia)")
      .gte("criado_em", de).lt("criado_em", ate).order("criado_em", { ascending: false }).limit(500);
    setLista((data as Consumo[]) || []);
  }, [dono, mes]);
  useEffect(() => { void carregar(); }, [carregar]);
  useAoMudar(["consumos"], () => { void carregar(); });

  const ativos = funcionarios.filter((f) => f.ativo).sort((a, b) => a.nome.localeCompare(b.nome));
  const total = itens.reduce((s, i) => s + i.quantidade * i.preco, 0);

  const adicionar = (p: Produto, q: number) => setItens((l) => {
    const i = l.findIndex((x) => x.produto_id === p.id);
    if (i >= 0) return l.map((x, k) => k === i ? { ...x, quantidade: x.quantidade + q } : x);
    return [...l, { produto_id: p.id, nome: p.nome, quantidade: q, preco: p.preco }];
  });
  const mudar = (id: string, q: number) => setItens((l) => q <= 0 ? l.filter((x) => x.produto_id !== id) : l.map((x) => x.produto_id === id ? { ...x, quantidade: q } : x));

  const resumoMes = useMemo(() => {
    const m = new Map<string, { n: number; v: number }>();
    for (const c of lista || []) {
      if (c.status !== "ativo") continue;
      const x = m.get(c.funcionario_nome) || { n: 0, v: 0 };
      m.set(c.funcionario_nome, { n: x.n + 1, v: x.v + Number(c.valor_referencia) });
    }
    return [...m.entries()].sort((a, b) => b[1].v - a[1].v);
  }, [lista]);

  return (
    <div className="space-y-6">
      <Titulo>Consumo interno</Titulo>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="cartao space-y-3">
          <p className="text-sm text-muted">Produtos usados ou consumidos pela equipe. Sai do estoque, mas não entra como venda.</p>
          <div>
            <label className="rotulo" htmlFor="quem">Quem consumiu</label>
            <select id="quem" className="campo" value={quem} onChange={(e) => setQuem(e.target.value)}>
              {ativos.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              <option value="">Outra pessoa / uso da loja</option>
            </select>
            {!quem && <input className="campo mt-2" placeholder="Nome ou motivo (ex.: uso da casa, quebra)" value={outro} onChange={(e) => setOutro(e.target.value)} />}
          </div>
          <BuscaProduto ref={busca} aoEscolher={adicionar} placeholder="Bipe ou busque o produto consumido" />
          {itens.map((i) => (
            <div key={i.produto_id} className="flex items-center gap-2 rounded-xl bg-ink p-2">
              <div className="min-w-0 flex-1 truncate">{i.nome}</div>
              <button className="btn-secundario px-2 py-1" aria-label="Diminuir" onClick={() => mudar(i.produto_id, i.quantidade - 1)}><Minus size={14} /></button>
              <span className="w-8 text-center font-bold">{i.quantidade}</span>
              <button className="btn-secundario px-2 py-1" aria-label="Aumentar" onClick={() => mudar(i.produto_id, i.quantidade + 1)}><Plus size={14} /></button>
              <button className="p-1 text-muted hover:text-red-400" aria-label="Remover" onClick={() => mudar(i.produto_id, 0)}><Trash2 size={16} /></button>
            </div>
          ))}
          <input className="campo" placeholder="Observação (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} />
          {dono && <div className="flex items-center justify-between text-sm text-muted"><span>Valor de referência (preço de venda)</span><strong className="text-white">{brl(total)}</strong></div>}
          <BotaoAcao className="btn-principal w-full py-3" disabled={!itens.length} acao={async () => {
            const nome = quem ? ativos.find((f) => f.id === quem)?.nome : outro.trim();
            if (!nome) throw new Error("Informe quem consumiu.");
            const r = await enviarOperacao("consumo", {
              id: novoId(), criado_em: new Date().toISOString(), funcionario_id: quem || null, funcionario_nome: nome,
              observacao: obs, itens: itens.map((i) => ({ produto_id: i.produto_id, quantidade: i.quantidade })),
            }, `${nome} · ${itens.length} item(ns)`);
            if (r.situacao === "recusada") throw new Error(r.erro);
            avisar(r.situacao === "enviada" ? `Consumo #${r.numero} registrado.` : "Sem internet: consumo guardado e será enviado.", r.situacao === "enviada" ? "ok" : "info");
            setItens([]); setObs(""); setOutro("");
            busca.current?.focar();
          }}>Registrar consumo</BotaoAcao>
        </div>

        {dono && (
          <div className="cartao">
            <h2 className="mb-2 font-bold">Este mês por pessoa</h2>
            {!resumoMes.length ? <p className="text-sm text-muted">Nenhum consumo no mês.</p> : (
              <table className="tabela"><tbody>
                {resumoMes.map(([n, x]) => <tr key={n}><td>{n}</td><td className="text-muted">{x.n} registro(s)</td><td className="text-right font-bold">{brl(x.v)}</td></tr>)}
              </tbody></table>
            )}
          </div>
        )}
      </div>

      <div className="cartao overflow-x-auto">
        <h2 className="mb-2 font-bold">{dono ? "Consumos do mês" : "Consumos de hoje"}</h2>
        {!lista ? <p className="text-sm text-muted">Carregando…</p> : !lista.length ? <Vazio>Nenhum consumo registrado.</Vazio> : (
          <table className="tabela">
            <thead><tr><th>#</th><th>Quando</th><th>Quem</th><th>Itens</th><th>Registrado por</th>{dono && <th className="text-right">Valor ref.</th>}{dono && <th />}</tr></thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id} className={c.status === "cancelado" ? "opacity-50 line-through" : ""}>
                  <td>{c.numero}</td>
                  <td>{dataHora(c.criado_em)}</td>
                  <td>{c.funcionario_nome}</td>
                  <td className="max-w-[280px] truncate">{c.consumo_itens?.map((i) => `${i.quantidade}× ${i.nome}`).join(", ")}{c.observacao ? ` · ${c.observacao}` : ""}</td>
                  <td>{c.registrado_por_nome}</td>
                  {dono && <td className="text-right">{brl(c.valor_referencia)}</td>}
                  {dono && <td className="text-right">{c.status === "ativo" && (
                    <button className="text-xs text-muted underline hover:text-red-400" onClick={async () => {
                      if (!confirm(`Cancelar o consumo #${c.numero}? Os produtos voltam para o estoque.`)) return;
                      const { error } = await supabase().rpc("cancelar_consumo", { p_id: c.id });
                      if (error) avisar(mensagemErro(error), "erro"); else { avisar("Consumo cancelado."); void carregar(); }
                    }}>cancelar</button>
                  )}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
