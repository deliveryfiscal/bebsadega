"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLoja, useAoMudar } from "@/lib/loja";
import { useSessao } from "@/lib/sessao";
import { rpc } from "@/lib/acoes";
import { brl, dataHora, hojeISO, nomeForma } from "@/lib/formato";
import { Numero, Titulo } from "@/components/ui";
import { SomenteDono } from "@/components/shell";
import type { Relatorio } from "../relatorios/page";

export default function Inicio() {
  const { eu } = useSessao();
  const { caixa, produtos, codigosPorProduto, fila } = useLoja();
  const [r, setR] = useState<Relatorio | null>(null);
  const carregar = useCallback(async () => {
    const h = hojeISO();
    setR(await rpc<Relatorio>("relatorio", { p_inicio: h, p_fim: h }));
  }, []);
  useEffect(() => { void carregar().catch(() => undefined); }, [carregar]);
  useAoMudar(["vendas", "consumos"], () => { void carregar().catch(() => undefined); });

  const alertas = useMemo(() => {
    const ativos = produtos.filter((p) => p.ativo && !p.arquivado && p.tipo === "unidade");
    return {
      baixo: ativos.filter((p) => p.estoque <= p.estoque_minimo && p.estoque_minimo > 0).length,
      negativo: ativos.filter((p) => p.estoque < 0).length,
      semCodigo: ativos.filter((p) => !codigosPorProduto.get(p.id)?.length).length,
      semCusto: ativos.filter((p) => !p.custo).length,
    };
  }, [produtos, codigosPorProduto]);

  return (
    <SomenteDono>
      <div className="space-y-5">
        <Titulo acoes={<Link href="/vender" className="btn-principal">Ir para o PDV</Link>}>Olá, {eu?.nome}</Titulo>
        <div className={`cartao ${caixa ? "border-lime/50" : "border-amber-500/60"}`}>
          {caixa ? <>Caixa <strong className="text-lime">aberto</strong> por {caixa.aberto_por_nome} desde {dataHora(caixa.aberto_em)}. <Link className="underline" href="/caixa">Ver caixa</Link></>
            : <>Caixa <strong className="text-amber-300">fechado</strong>. <Link className="underline" href="/caixa">Abrir caixa</Link></>}
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Numero titulo="Vendido hoje" valor={r ? brl(r.faturamento) : "…"} destaque detalhe={r ? `${r.vendas} venda(s)` : ""} />
          <Numero titulo="Ticket médio" valor={r ? brl(r.vendas ? r.faturamento / r.vendas : 0) : "…"} />
          <Numero titulo="Consumo interno hoje" valor={r ? brl(r.consumo_valor) : "…"} />
          <Numero titulo="Cancelado hoje" valor={r ? brl(r.valor_cancelado) : "…"} detalhe={r ? `${r.canceladas} venda(s)` : ""} />
        </div>
        {r && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {(["dinheiro", "pix", "debito", "credito"] as const).map((f) => <Numero key={f} titulo={nomeForma(f)} valor={brl(r.formas[f] || 0)} />)}
          </div>
        )}
        <div className="cartao space-y-1 text-sm">
          <h2 className="mb-1 font-bold">O que precisa de atenção</h2>
          {fila.length > 0 && <p className="text-amber-300">• {fila.length} operação(ões) deste aparelho aguardando internet.</p>}
          {alertas.negativo > 0 && <p>• <Link className="underline" href="/estoque">{alertas.negativo} produto(s) com estoque negativo</Link> — vendeu mais do que estava no sistema. Faça a contagem.</p>}
          {alertas.baixo > 0 && <p>• <Link className="underline" href="/estoque">{alertas.baixo} produto(s) abaixo do mínimo</Link>.</p>}
          {alertas.semCusto > 0 && <p>• <Link className="underline" href="/produtos">{alertas.semCusto} produto(s) sem custo</Link> — sem isso o lucro não aparece. Dá para preencher na entrada de mercadoria.</p>}
          {alertas.semCodigo > 0 && <p>• <Link className="underline" href="/produtos">{alertas.semCodigo} produto(s) sem código de barras</Link> — no PDV, bipe o código desconhecido para vincular na hora.</p>}
          {!fila.length && !alertas.negativo && !alertas.baixo && !alertas.semCusto && !alertas.semCodigo && <p className="text-lime">Tudo certo.</p>}
        </div>
        {r && r.produtos.length > 0 && (
          <div className="cartao">
            <h2 className="mb-2 font-bold">Mais vendidos hoje</h2>
            <table className="tabela"><tbody>
              {r.produtos.slice(0, 10).map((p) => <tr key={p.chave}><td>{p.nome}</td><td className="text-right">{p.quantidade}</td><td className="text-right font-semibold">{brl(p.total)}</td></tr>)}
            </tbody></table>
          </div>
        )}
      </div>
    </SomenteDono>
  );
}
