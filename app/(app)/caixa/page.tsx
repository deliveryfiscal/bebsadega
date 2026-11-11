"use client";

import { useCallback, useEffect, useState } from "react";
import { useLoja, useAoMudar } from "@/lib/loja";
import { useSessao } from "@/lib/sessao";
import { supabase } from "@/lib/supabase";
import { rpc } from "@/lib/acoes";
import { brl, dataHora, lerValor } from "@/lib/formato";
import type { Caixa, ResumoCaixa } from "@/lib/tipos";
import { BotaoAcao, Janela, Numero, Titulo, Vazio, useAviso } from "@/components/ui";

type Movimento = { id: string; tipo: "sangria" | "suprimento"; valor: number; descricao: string; criado_em: string; criado_por_nome: string };

export default function CaixaPagina() {
  const { caixa, recarregar } = useLoja();
  const { eu } = useSessao();
  const avisar = useAviso();
  const [resumo, setResumo] = useState<ResumoCaixa | null>(null);
  const [movs, setMovs] = useState<Movimento[]>([]);
  const [historico, setHistorico] = useState<Caixa[]>([]);
  const [valorAbrir, setValorAbrir] = useState("");
  const [mov, setMov] = useState<null | "sangria" | "suprimento">(null);
  const [fechar, setFechar] = useState(false);

  const carregar = useCallback(async () => {
    if (caixa) {
      const [r, m] = await Promise.all([
        rpc<ResumoCaixa>("resumo_caixa", { p_caixa: caixa.id }),
        supabase().from("caixa_movimentos").select("*").eq("caixa_id", caixa.id).order("criado_em", { ascending: false }),
      ]);
      setResumo(r);
      setMovs((m.data as Movimento[]) || []);
    } else {
      setResumo(null);
      setMovs([]);
    }
    const { data } = await supabase().from("caixas").select("*").eq("status", "fechado").order("aberto_em", { ascending: false })
      .limit(eu?.papel === "dono" ? 60 : 5);
    setHistorico((data as Caixa[]) || []);
  }, [caixa, eu?.papel]);

  useEffect(() => { void carregar().catch(() => undefined); }, [carregar]);
  useAoMudar(["vendas", "caixa_movimentos", "caixas"], () => { void carregar().catch(() => undefined); });

  if (!caixa) {
    return (
      <div className="space-y-6">
        <Titulo>Caixa</Titulo>
        <div className="cartao max-w-md space-y-3">
          <h2 className="text-lg font-bold">Abrir caixa</h2>
          <p className="text-sm text-muted">Conte o dinheiro da gaveta e informe o valor. O caixa é um só para a loja: todos os aparelhos vendem nele.</p>
          <input className="campo text-xl" inputMode="decimal" placeholder="R$ 0,00" value={valorAbrir} onChange={(e) => setValorAbrir(e.target.value)} aria-label="Valor inicial" />
          <BotaoAcao className="btn-principal w-full py-3" acao={async () => {
            const v = lerValor(valorAbrir);
            if (!Number.isFinite(v) || v < 0) throw new Error("Valor inválido.");
            await rpc("abrir_caixa", { p_valor: v });
            setValorAbrir("");
            await recarregar();
            avisar("Caixa aberto.");
          }}>Abrir caixa</BotaoAcao>
        </div>
        <Historico lista={historico} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Titulo acoes={<>
        <button className="btn-secundario" onClick={() => setMov("suprimento")}>+ Suprimento</button>
        <button className="btn-secundario" onClick={() => setMov("sangria")}>− Sangria</button>
        <button className="btn-principal" onClick={() => setFechar(true)}>Fechar caixa</button>
      </>}>Caixa aberto</Titulo>
      <p className="-mt-3 text-sm text-muted">Aberto por {caixa.aberto_por_nome} em {dataHora(caixa.aberto_em)} com {brl(caixa.valor_abertura)}.</p>

      {resumo && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Numero titulo="Dinheiro na gaveta" valor={brl(resumo.dinheiro_esperado)} destaque detalhe="abertura + dinheiro + suprimentos − sangrias" />
            <Numero titulo="Vendas" valor={brl(resumo.total_vendas)} detalhe={`${resumo.vendas} venda(s)${resumo.canceladas ? ` · ${resumo.canceladas} cancelada(s)` : ""}`} />
            <Numero titulo="Sangrias" valor={brl(resumo.sangrias)} />
            <Numero titulo="Suprimentos" valor={brl(resumo.suprimentos)} />
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Numero titulo="Dinheiro" valor={brl(resumo.dinheiro)} />
            <Numero titulo="PIX" valor={brl(resumo.pix)} />
            <Numero titulo="Débito" valor={brl(resumo.debito)} />
            <Numero titulo="Crédito" valor={brl(resumo.credito)} />
          </div>
        </>
      )}

      <div className="cartao">
        <h2 className="mb-2 font-bold">Sangrias e suprimentos</h2>
        {!movs.length ? <p className="text-sm text-muted">Nenhuma movimentação.</p> : (
          <table className="tabela">
            <tbody>
              {movs.map((m) => (
                <tr key={m.id}>
                  <td>{dataHora(m.criado_em)}</td>
                  <td>{m.tipo === "sangria" ? "Sangria" : "Suprimento"}</td>
                  <td>{m.descricao}</td>
                  <td>{m.criado_por_nome}</td>
                  <td className={`text-right font-semibold ${m.tipo === "sangria" ? "text-red-300" : "text-lime"}`}>{m.tipo === "sangria" ? "−" : "+"}{brl(m.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Historico lista={historico} />

      <MovimentoJanela tipo={mov} aoFechar={() => setMov(null)} aoSalvar={async () => { await carregar(); }} />
      <FecharJanela aberta={fechar} esperado={resumo?.dinheiro_esperado ?? 0} aoFechar={() => setFechar(false)}
        aoConcluir={async () => { setFechar(false); await recarregar(); await carregar(); }} />
    </div>
  );
}

function MovimentoJanela({ tipo, aoFechar, aoSalvar }: { tipo: null | "sangria" | "suprimento"; aoFechar: () => void; aoSalvar: () => Promise<void> }) {
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const avisar = useAviso();
  useEffect(() => { setValor(""); setDescricao(""); }, [tipo]);
  return (
    <Janela titulo={tipo === "sangria" ? "Sangria (retirar dinheiro)" : "Suprimento (colocar dinheiro)"} aberta={!!tipo} aoFechar={aoFechar}>
      <div className="space-y-3">
        <input className="campo text-xl" inputMode="decimal" placeholder="R$ 0,00" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus aria-label="Valor" />
        <input className="campo" placeholder={tipo === "sangria" ? "Motivo (ex.: pagamento fornecedor gelo)" : "Motivo (ex.: troco)"} value={descricao} onChange={(e) => setDescricao(e.target.value)} aria-label="Motivo" />
        <BotaoAcao className="btn-principal w-full py-3" acao={async () => {
          const v = lerValor(valor);
          if (!(v > 0)) throw new Error("Informe um valor maior que zero.");
          if (!descricao.trim()) throw new Error("Informe o motivo.");
          await rpc("movimentar_caixa", { p_tipo: tipo, p_valor: v, p_descricao: descricao });
          avisar(tipo === "sangria" ? "Sangria registrada." : "Suprimento registrado.");
          aoFechar();
          await aoSalvar();
        }}>Confirmar</BotaoAcao>
      </div>
    </Janela>
  );
}

function FecharJanela({ aberta, esperado, aoFechar, aoConcluir }: { aberta: boolean; esperado: number; aoFechar: () => void; aoConcluir: () => Promise<void> }) {
  const [contado, setContado] = useState("");
  const [obs, setObs] = useState("");
  const avisar = useAviso();
  const { fila } = useLoja();
  useEffect(() => { setContado(""); setObs(""); }, [aberta]);
  const v = lerValor(contado);
  const dif = Number.isFinite(v) && contado ? v - esperado : null;
  return (
    <Janela titulo="Fechar caixa" aberta={aberta} aoFechar={aoFechar}>
      <div className="space-y-3">
        {fila.length > 0 && (
          <p className="rounded-lg bg-amber-500/20 p-2 text-sm text-amber-200">
            Atenção: {fila.length} venda(s) deste aparelho ainda não foram enviadas. Espere a internet voltar antes de fechar.
          </p>
        )}
        <p className="text-sm text-muted">Conte o dinheiro da gaveta e informe o valor. O sistema compara com o esperado.</p>
        <input className="campo text-xl" inputMode="decimal" placeholder="R$ 0,00" value={contado} onChange={(e) => setContado(e.target.value)} autoFocus aria-label="Valor contado" />
        {dif !== null && (
          <div className={`rounded-lg p-2 text-center font-bold ${Math.abs(dif) < 0.01 ? "bg-lime/15 text-lime" : "bg-amber-500/20 text-amber-200"}`}>
            {Math.abs(dif) < 0.01 ? "Caixa confere" : dif > 0 ? `Sobrando ${brl(dif)}` : `Faltando ${brl(-dif)}`}
          </div>
        )}
        <input className="campo" placeholder="Observação (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} aria-label="Observação" />
        <BotaoAcao className="btn-principal w-full py-3" acao={async () => {
          if (!contado.trim() || !Number.isFinite(v) || v < 0) throw new Error("Informe o valor contado.");
          const r = await rpc<ResumoCaixa>("fechar_caixa", { p_contado: v, p_observacao: obs });
          avisar(`Caixa fechado. ${r.vendas} venda(s), ${brl(r.total_vendas)}.`);
          await aoConcluir();
        }}>Fechar caixa</BotaoAcao>
      </div>
    </Janela>
  );
}

function Historico({ lista }: { lista: Caixa[] }) {
  const [resumos, setResumos] = useState<Record<string, ResumoCaixa>>({});
  return (
    <div className="cartao overflow-x-auto">
      <h2 className="mb-2 font-bold">Caixas fechados</h2>
      {!lista.length ? <Vazio>Nenhum caixa fechado ainda.</Vazio> : (
        <table className="tabela">
          <thead><tr><th>Abertura</th><th>Fechamento</th><th>Quem fechou</th><th className="text-right">Esperado</th><th className="text-right">Contado</th><th className="text-right">Diferença</th><th /></tr></thead>
          <tbody>
            {lista.map((c) => (
              <tr key={c.id}>
                <td>{dataHora(c.aberto_em)}</td>
                <td>{dataHora(c.fechado_em)}</td>
                <td>{c.fechado_por_nome}</td>
                <td className="text-right">{c.valor_esperado != null ? brl(c.valor_esperado) : "—"}</td>
                <td className="text-right">{c.valor_contado != null ? brl(c.valor_contado) : "—"}</td>
                <td className={`text-right font-semibold ${Math.abs(Number(c.diferenca || 0)) < 0.01 ? "" : Number(c.diferenca) > 0 ? "text-lime" : "text-red-300"}`}>{c.diferenca != null ? brl(c.diferenca) : "—"}</td>
                <td className="text-right text-xs text-muted">
                  {resumos[c.id] ? `${resumos[c.id].vendas} vendas · ${brl(resumos[c.id].total_vendas)}` : (
                    <button className="underline" onClick={async () => {
                      const r = await rpc<ResumoCaixa>("resumo_caixa", { p_caixa: c.id });
                      setResumos((x) => ({ ...x, [c.id]: r }));
                    }}>ver vendas</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
