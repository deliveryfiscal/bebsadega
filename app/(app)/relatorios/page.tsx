"use client";

import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { rpc } from "@/lib/acoes";
import { useAoMudar } from "@/lib/loja";
import { brl, dataHora, diaCurto, hojeISO, intervalo, nomeForma, somarDias } from "@/lib/formato";
import { SomenteDono } from "@/components/shell";
import { BotaoAcao, Carregando, Numero, Titulo, Vazio } from "@/components/ui";

export type Relatorio = {
  vendas: number; faturamento: number; descontos: number; canceladas: number; valor_cancelado: number; itens: number;
  custo: number; itens_sem_custo: number; formas: Record<string, number>;
  por_dia: { dia: string; vendas: number; total: number; descontos: number }[];
  por_dia_forma: { dia: string; forma: string; total: number }[];
  por_hora: { hora: number; vendas: number; total: number }[];
  produtos: { chave: string; nome: string; quantidade: number; total: number; custo: number }[];
  funcionarios: { nome: string; vendas: number; total: number }[];
  consumos: number; consumo_valor: number; consumo_por_funcionario: { nome: string; consumos: number; valor: number }[];
};

function periodo(id: string): [string, string] {
  const h = hojeISO();
  if (id === "ontem") return [somarDias(h, -1), somarDias(h, -1)];
  if (id === "7") return [somarDias(h, -6), h];
  if (id === "30") return [somarDias(h, -29), h];
  if (id === "mes") return [h.slice(0, 8) + "01", h];
  if (id === "tudo") return ["2026-09-01", h];
  return [h, h];
}

function csv(linhas: (string | number)[][]) {
  return "﻿" + linhas.map((l) => l.map((c) => {
    const s = typeof c === "number" ? String(c).replace(".", ",") : String(c ?? "");
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(";")).join("\n");
}

function baixar(nome: string, conteudo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

type Auditoria = { id: number; criado_em: string; funcionario_nome: string; acao: string; detalhes: string };

export default function Relatorios() {
  const [preset, setPreset] = useState("hoje");
  const [[ini, fim], setPer] = useState(periodo("hoje"));
  const [r, setR] = useState<Relatorio | null>(null);
  const [aud, setAud] = useState<Auditoria[]>([]);

  const carregar = useCallback(async () => {
    setR(await rpc<Relatorio>("relatorio", { p_inicio: ini, p_fim: fim }));
    const { data } = await supabase().from("auditoria").select("*").order("criado_em", { ascending: false }).limit(100);
    setAud((data as Auditoria[]) || []);
  }, [ini, fim]);
  useEffect(() => { setR(null); void carregar().catch(() => undefined); }, [carregar]);
  useAoMudar(["vendas", "consumos"], () => { void carregar().catch(() => undefined); });

  const lucro = r ? r.faturamento - r.custo : 0;

  async function exportarItens() {
    const { de, ate } = intervalo(ini, fim);
    const linhas: (string | number)[][] = [["Venda", "Data", "Status", "Atendente", "Produto", "Quantidade", "Preço", "Total", "Pagamento"]];
    for (let pagina = 0; ; pagina++) {
      const { data, error } = await supabase().from("vendas")
        .select("numero,criado_em,status,funcionario_nome,venda_itens(nome,quantidade,preco_unitario,total),venda_pagamentos(forma,valor)")
        .gte("criado_em", de).lt("criado_em", ate).order("criado_em").range(pagina * 500, pagina * 500 + 499);
      if (error) throw error;
      for (const v of (data || []) as { numero: number; criado_em: string; status: string; funcionario_nome: string; venda_itens: { nome: string; quantidade: number; preco_unitario: number; total: number }[]; venda_pagamentos: { forma: string; valor: number }[] }[]) {
        const pg = v.venda_pagamentos.map((p) => `${nomeForma(p.forma)} ${Number(p.valor).toFixed(2)}`).join(" + ");
        for (const i of v.venda_itens) linhas.push([v.numero, dataHora(v.criado_em), v.status, v.funcionario_nome, i.nome, i.quantidade, Number(i.preco_unitario), Number(i.total), pg]);
      }
      if (!data || data.length < 500) break;
    }
    baixar(`vendas_${ini}_a_${fim}.csv`, csv(linhas));
  }

  return (
    <SomenteDono>
      <div className="space-y-5">
        <Titulo acoes={<BotaoAcao className="btn-secundario" acao={exportarItens}><Download size={16} /> Planilha das vendas</BotaoAcao>}>Relatórios</Titulo>
        <div className="flex flex-wrap items-center gap-2">
          {[["hoje", "Hoje"], ["ontem", "Ontem"], ["7", "7 dias"], ["30", "30 dias"], ["mes", "Este mês"], ["tudo", "Tudo"]].map(([id, nome]) => (
            <button key={id} onClick={() => { setPreset(id); setPer(periodo(id)); }} className={`rounded-lg px-3 py-1.5 text-sm ${preset === id ? "bg-brand text-white" : "bg-panel2 text-muted"}`}>{nome}</button>
          ))}
          <input type="date" className="campo w-40 py-1.5" value={ini} max={fim} onChange={(e) => { setPreset(""); setPer([e.target.value, fim]); }} aria-label="De" />
          <input type="date" className="campo w-40 py-1.5" value={fim} min={ini} max={hojeISO()} onChange={(e) => { setPreset(""); setPer([ini, e.target.value]); }} aria-label="Até" />
        </div>

        {!r ? <Carregando /> : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Numero titulo="Faturamento" valor={brl(r.faturamento)} destaque detalhe={`${r.vendas} venda(s) · ${r.itens} item(ns)`} />
              <Numero titulo="Ticket médio" valor={brl(r.vendas ? r.faturamento / r.vendas : 0)} />
              <Numero titulo="Lucro bruto estimado" valor={r.custo ? brl(lucro) : "—"} detalhe={r.itens_sem_custo ? `${r.itens_sem_custo} item(ns) vendidos sem custo cadastrado` : "custos completos"} />
              <Numero titulo="Cancelamentos" valor={brl(r.valor_cancelado)} detalhe={`${r.canceladas} venda(s)${r.descontos ? ` · descontos ${brl(r.descontos)}` : ""}`} />
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {(["dinheiro", "pix", "debito", "credito"] as const).map((f) => <Numero key={f} titulo={nomeForma(f)} valor={brl(r.formas[f] || 0)} />)}
              <Numero titulo="Consumo interno" valor={brl(r.consumo_valor)} detalhe={`${r.consumos} registro(s), a preço de venda`} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="cartao overflow-x-auto">
                <h2 className="mb-2 font-bold">Por dia</h2>
                {!r.por_dia.length ? <Vazio>Sem vendas.</Vazio> : (
                  <table className="tabela">
                    <thead><tr><th>Dia</th><th className="text-right">Vendas</th><th className="text-right">Dinheiro</th><th className="text-right">PIX</th><th className="text-right">Cartão</th><th className="text-right">Total</th></tr></thead>
                    <tbody>
                      {[...r.por_dia].reverse().map((d) => {
                        const f = (x: string) => r.por_dia_forma.filter((y) => y.dia === d.dia && y.forma === x).reduce((s, y) => s + Number(y.total), 0);
                        return (
                          <tr key={d.dia}><td>{diaCurto(d.dia)}</td><td className="text-right">{d.vendas}</td><td className="text-right">{brl(f("dinheiro"))}</td>
                            <td className="text-right">{brl(f("pix"))}</td><td className="text-right">{brl(f("debito") + f("credito"))}</td><td className="text-right font-bold">{brl(d.total)}</td></tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="cartao overflow-x-auto">
                <h2 className="mb-2 font-bold">Por atendente</h2>
                <table className="tabela"><tbody>
                  {r.funcionarios.map((f) => <tr key={f.nome}><td>{f.nome || "—"}</td><td className="text-right text-muted">{f.vendas} vendas</td><td className="text-right font-bold">{brl(f.total)}</td></tr>)}
                </tbody></table>
                <h2 className="mb-2 mt-4 font-bold">Horário de movimento</h2>
                <div className="flex h-28 items-end gap-1">
                  {Array.from({ length: 24 }, (_, h) => r.por_hora.find((x) => x.hora === h)).map((x, h) => {
                    const max = Math.max(1, ...r.por_hora.map((y) => Number(y.total)));
                    return <div key={h} title={`${h}h · ${x ? brl(x.total) : "R$ 0"}`} className="flex-1 rounded-t bg-brand/70" style={{ height: `${x ? Math.max(4, (Number(x.total) / max) * 100) : 0}%` }} />;
                  })}
                </div>
                <div className="flex justify-between text-xs text-muted"><span>0h</span><span>12h</span><span>23h</span></div>
              </div>
            </div>

            <div className="cartao overflow-x-auto">
              <h2 className="mb-2 font-bold">Produtos mais vendidos</h2>
              {!r.produtos.length ? <Vazio>Sem vendas.</Vazio> : (
                <table className="tabela">
                  <thead><tr><th>Produto</th><th className="text-right">Qtd</th><th className="text-right">Faturamento</th><th className="text-right">Lucro estimado</th></tr></thead>
                  <tbody>
                    {r.produtos.slice(0, 100).map((p) => (
                      <tr key={p.chave}><td>{p.nome}</td><td className="text-right">{p.quantidade}</td><td className="text-right font-semibold">{brl(p.total)}</td>
                        <td className="text-right text-muted">{Number(p.custo) > 0 ? brl(p.total - p.custo) : "sem custo"}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {r.consumo_por_funcionario.length > 0 && (
              <div className="cartao">
                <h2 className="mb-2 font-bold">Consumo interno por pessoa</h2>
                <table className="tabela"><tbody>
                  {r.consumo_por_funcionario.map((c) => <tr key={c.nome}><td>{c.nome}</td><td className="text-muted">{c.consumos} registro(s)</td><td className="text-right font-bold">{brl(c.valor)}</td></tr>)}
                </tbody></table>
              </div>
            )}

            <div className="cartao overflow-x-auto">
              <h2 className="mb-2 font-bold">Ações importantes (últimas 100)</h2>
              {!aud.length ? <p className="text-sm text-muted">Nada registrado ainda.</p> : (
                <table className="tabela"><tbody>
                  {aud.map((a) => <tr key={a.id}><td className="whitespace-nowrap">{dataHora(a.criado_em)}</td><td>{a.funcionario_nome}</td><td className="font-medium">{a.acao}</td><td className="text-muted">{a.detalhes}</td></tr>)}
                </tbody></table>
              )}
            </div>
          </>
        )}
      </div>
    </SomenteDono>
  );
}
