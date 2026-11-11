"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { useLoja } from "@/lib/loja";
import { useSessao } from "@/lib/sessao";
import { supabase } from "@/lib/supabase";
import { brl, dataHora, lerValor } from "@/lib/formato";
import { rpc } from "@/lib/acoes";
import type { Produto } from "@/lib/tipos";
import { BuscaProduto } from "@/components/busca-produto";
import { BotaoAcao, Titulo, Vazio, useAviso } from "@/components/ui";

type Aba = "entrada" | "ajuste" | "baixo" | "historico";

export default function Estoque() {
  const { eu } = useSessao();
  const dono = eu?.papel === "dono";
  const [aba, setAba] = useState<Aba>("entrada");
  const abas: { id: Aba; nome: string }[] = [
    { id: "entrada", nome: "Entrada de mercadoria" },
    ...(dono ? [{ id: "ajuste" as Aba, nome: "Ajuste / contagem" }] : []),
    { id: "baixo", nome: "Estoque baixo" },
    ...(dono ? [{ id: "historico" as Aba, nome: "Histórico" }] : []),
  ];
  return (
    <div className="space-y-4">
      <Titulo>Estoque</Titulo>
      <div className="flex gap-2 overflow-x-auto">
        {abas.map((a) => (
          <button key={a.id} onClick={() => setAba(a.id)} className={`shrink-0 rounded-lg px-3 py-2 text-sm ${aba === a.id ? "bg-brand text-white" : "bg-panel2 text-muted"}`}>{a.nome}</button>
        ))}
      </div>
      {aba === "entrada" && <Entrada dono={dono} />}
      {aba === "ajuste" && dono && <Ajuste />}
      {aba === "baixo" && <Baixo />}
      {aba === "historico" && dono && <Historico />}
    </div>
  );
}

function Entrada({ dono }: { dono: boolean }) {
  const avisar = useAviso();
  const [itens, setItens] = useState<{ p: Produto; qtd: number; custo: string }[]>([]);
  const [obs, setObs] = useState("");
  const total = itens.reduce((s, i) => s + i.qtd, 0);
  return (
    <div className="cartao space-y-3">
      <p className="text-sm text-muted">Bipe cada produto que chegou. Se bipar o código da caixa (ex.: caixa com 12), entram 12 unidades. Digite <strong>10*</strong> antes do código para somar 10 de uma vez.</p>
      <BuscaProduto somenteUnidade incluirInativos autoFocus aoEscolher={(p, q) => setItens((l) => {
        const i = l.findIndex((x) => x.p.id === p.id);
        return i >= 0 ? l.map((x, k) => k === i ? { ...x, qtd: x.qtd + q } : x) : [{ p, qtd: q, custo: "" }, ...l];
      })} />
      {!itens.length ? <Vazio>Nenhum item ainda.</Vazio> : (
        <table className="tabela">
          <thead><tr><th>Produto</th><th className="text-right">Estoque atual</th><th>Quantidade</th>{dono && <th>Custo unitário</th>}<th /></tr></thead>
          <tbody>
            {itens.map((i) => (
              <tr key={i.p.id}>
                <td>{i.p.nome}</td>
                <td className="text-right text-muted">{i.p.estoque}</td>
                <td><input className="campo w-24 py-1" inputMode="numeric" value={i.qtd} aria-label="Quantidade"
                  onChange={(e) => setItens((l) => l.map((x) => x.p.id === i.p.id ? { ...x, qtd: parseInt(e.target.value.replace(/\D/g, "") || "0", 10) } : x))} /></td>
                {dono && <td><input className="campo w-28 py-1" inputMode="decimal" placeholder={i.p.custo ? brl(i.p.custo) : "R$"} value={i.custo} aria-label="Custo"
                  onChange={(e) => setItens((l) => l.map((x) => x.p.id === i.p.id ? { ...x, custo: e.target.value } : x))} /></td>}
                <td><button className="p-1 text-muted hover:text-red-400" aria-label="Remover" onClick={() => setItens((l) => l.filter((x) => x.p.id !== i.p.id))}><Trash2 size={16} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <input className="campo" placeholder="Fornecedor / nota (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} />
      <BotaoAcao className="btn-principal w-full py-3" disabled={!itens.length} acao={async () => {
        if (itens.some((i) => i.qtd <= 0)) throw new Error("Há item com quantidade zero.");
        await rpc("entrada_estoque", {
          p_itens: itens.map((i) => ({ produto_id: i.p.id, quantidade: i.qtd, custo: dono && i.custo ? lerValor(i.custo) : null })),
          p_observacao: obs,
        });
        avisar(`Entrada registrada: ${total} unidade(s).`);
        setItens([]);
        setObs("");
      }}>Confirmar entrada ({total} un.)</BotaoAcao>
    </div>
  );
}

function Ajuste() {
  const avisar = useAviso();
  const { produtoPorId } = useLoja();
  const [id, setId] = useState<string | null>(null);
  const [contado, setContado] = useState("");
  const [motivo, setMotivo] = useState("Contagem");
  const p = id ? produtoPorId.get(id) : undefined;
  return (
    <div className="cartao max-w-xl space-y-3">
      <p className="text-sm text-muted">Use para corrigir o estoque depois de contar a prateleira, ou registrar quebra/perda.</p>
      <BuscaProduto somenteUnidade incluirInativos autoFocus aoEscolher={(x) => { setId(x.id); setContado(""); }} />
      {p && (
        <div className="space-y-3 rounded-xl border border-line p-3">
          <div className="flex justify-between"><strong>{p.nome}</strong><span>Sistema: <strong>{p.estoque}</strong></span></div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="rotulo" htmlFor="contado">Quantidade real</label>
              <input id="contado" className="campo text-xl" inputMode="numeric" value={contado} onChange={(e) => setContado(e.target.value.replace(/[^\d-]/g, ""))} autoFocus />
            </div>
            <div>
              <label className="rotulo" htmlFor="motivo">Motivo</label>
              <select id="motivo" className="campo" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
                <option>Contagem</option><option>Quebra / perda</option><option>Vencido</option><option>Correção de lançamento</option>
              </select>
            </div>
          </div>
          {contado !== "" && <div className="text-sm text-muted">Diferença: {Number(contado) - p.estoque > 0 ? "+" : ""}{Number(contado) - p.estoque}</div>}
          <BotaoAcao className="btn-principal w-full" acao={async () => {
            if (contado === "" || !Number.isFinite(Number(contado))) throw new Error("Informe a quantidade real.");
            await rpc("ajustar_estoque", { p_produto: p.id, p_novo_saldo: Number(contado), p_motivo: motivo });
            avisar(`${p.nome}: estoque ajustado para ${contado}.`);
            setId(null);
            setContado("");
          }}>Salvar ajuste</BotaoAcao>
        </div>
      )}
    </div>
  );
}

function Baixo() {
  const { produtos } = useLoja();
  const lista = useMemo(() => produtos.filter((p) => !p.arquivado && p.ativo && p.tipo === "unidade" && (p.estoque <= p.estoque_minimo || p.estoque < 0))
    .sort((a, b) => a.estoque - b.estoque), [produtos]);
  if (!lista.length) return <Vazio>Nenhum produto abaixo do mínimo.</Vazio>;
  return (
    <div className="cartao overflow-x-auto p-0">
      <table className="tabela">
        <thead><tr><th>Produto</th><th>Categoria</th><th className="text-right">Estoque</th><th className="text-right">Mínimo</th></tr></thead>
        <tbody>
          {lista.map((p) => (
            <tr key={p.id}><td>{p.nome}</td><td className="text-muted">{p.categoria}</td>
              <td className={`text-right font-bold ${p.estoque < 0 ? "text-red-400" : "text-amber-300"}`}>{p.estoque}</td><td className="text-right text-muted">{p.estoque_minimo}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Mov = { id: number; produto_id: string; criado_em: string; tipo: string; quantidade: number; saldo_apos: number; observacao: string | null; funcionario_nome: string };
const TIPOS: Record<string, string> = { implantacao: "Saldo inicial", venda: "Venda", cancelamento_venda: "Venda cancelada", consumo: "Consumo", cancelamento_consumo: "Consumo cancelado", entrada: "Entrada", ajuste: "Ajuste" };

function Historico() {
  const { produtoPorId } = useLoja();
  const [produto, setProduto] = useState<Produto | null>(null);
  const [movs, setMovs] = useState<Mov[] | null>(null);
  const [tipo, setTipo] = useState("todos");
  const carregar = useCallback(async () => {
    let q = supabase().from("estoque_movimentos").select("*").order("criado_em", { ascending: false }).limit(300);
    if (produto) q = q.eq("produto_id", produto.id);
    if (tipo !== "todos") q = q.eq("tipo", tipo);
    const { data } = await q;
    setMovs((data as Mov[]) || []);
  }, [produto, tipo]);
  useEffect(() => { void carregar(); }, [carregar]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="min-w-[260px] flex-1"><BuscaProduto somenteUnidade incluirInativos aoEscolher={(p) => setProduto(p)} placeholder="Filtrar por produto" /></div>
        <select className="campo w-48" value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo">
          <option value="todos">Todos os tipos</option>
          {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {produto && <button className="btn-secundario" onClick={() => setProduto(null)}>Limpar: {produto.nome}</button>}
      </div>
      {!movs ? null : !movs.length ? <Vazio>Sem movimentos.</Vazio> : (
        <div className="cartao overflow-x-auto p-0">
          <table className="tabela">
            <thead><tr><th>Quando</th><th>Produto</th><th>Tipo</th><th className="text-right">Qtd</th><th className="text-right">Saldo</th><th>Quem</th><th>Obs.</th></tr></thead>
            <tbody>
              {movs.map((m) => (
                <tr key={m.id}>
                  <td>{dataHora(m.criado_em)}</td><td>{produtoPorId.get(m.produto_id)?.nome}</td><td>{TIPOS[m.tipo] || m.tipo}</td>
                  <td className={`text-right font-semibold ${m.quantidade < 0 ? "text-red-300" : "text-lime"}`}>{m.quantidade > 0 ? "+" : ""}{m.quantidade}</td>
                  <td className="text-right">{m.saldo_apos}</td><td>{m.funcionario_nome}</td><td className="text-muted">{m.observacao}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
