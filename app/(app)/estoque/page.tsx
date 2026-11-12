"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useLoja } from "@/lib/loja";
import { useSessao } from "@/lib/sessao";
import { supabase } from "@/lib/supabase";
import { brl, dataHora, lerValor, normalizar } from "@/lib/formato";
import { rpc } from "@/lib/acoes";
import type { Produto } from "@/lib/tipos";
import { BuscaProduto } from "@/components/busca-produto";
import { BotaoAcao, Titulo, Vazio, useAviso } from "@/components/ui";
import { Foto } from "@/components/foto";

type Aba = "lista" | "entrada" | "baixo" | "historico";

export default function Estoque() {
  const { eu } = useSessao();
  const dono = eu?.papel === "dono";
  const [aba, setAba] = useState<Aba>(dono ? "lista" : "entrada");
  const abas: { id: Aba; nome: string }[] = [
    ...(dono ? [{ id: "lista" as Aba, nome: "Lista de estoque" }] : []),
    { id: "entrada", nome: "Entrada de mercadoria" },
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
      {aba === "lista" && dono && <Lista />}
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

const MOTIVOS = ["Correção", "Contagem", "Quebra / perda", "Vencido", "Entrada de mercadoria"];

/** Lista do dono: − / + soma ou subtrai do saldo atual; "Contado" grava a quantidade exata. */
function Lista() {
  const { produtos } = useLoja();
  const avisar = useAviso();
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("");
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [ocupado, setOcupado] = useState<Set<string>>(new Set());
  const [saldo, setSaldo] = useState<Record<string, number>>({});
  const [contagem, setContagem] = useState<Record<string, string>>({});

  const itens = useMemo(() => produtos.filter((p) => !p.arquivado && p.tipo === "unidade"), [produtos]);
  // Quando o valor chega pelo tempo real, deixa de usar o valor local.
  useEffect(() => {
    setSaldo((s) => {
      const novo = { ...s };
      for (const p of itens) if (novo[p.id] === p.estoque) delete novo[p.id];
      return novo;
    });
  }, [itens]);
  const categorias = useMemo(() => [...new Set(itens.map((p) => p.categoria).filter(Boolean))].sort(), [itens]);
  const lista = useMemo(() => {
    const palavras = normalizar(busca).split(/\s+/).filter(Boolean);
    return itens
      .filter((p) => !categoria || p.categoria === categoria)
      .filter((p) => !palavras.length || palavras.every((w) => normalizar(p.nome).includes(w)))
      .sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome));
  }, [itens, busca, categoria]);

  async function executar(p: Produto, fazer: () => Promise<number>) {
    setOcupado((s) => new Set(s).add(p.id));
    try {
      const novo = await fazer();
      setSaldo((s) => ({ ...s, [p.id]: novo }));
    } catch (e) {
      avisar(e instanceof Error ? e.message : String(e), "erro");
    } finally {
      setOcupado((s) => { const n = new Set(s); n.delete(p.id); return n; });
    }
  }
  const mover = (p: Produto, delta: number) => executar(p, () => rpc<number>("movimentar_estoque", { p_produto: p.id, p_delta: delta, p_motivo: motivo }));
  const contar = (p: Produto) => {
    const v = contagem[p.id];
    if (v === undefined || v.trim() === "" || !Number.isFinite(Number(v))) return;
    setContagem((c) => { const n = { ...c }; delete n[p.id]; return n; });
    return executar(p, async () => {
      await rpc("ajustar_estoque", { p_produto: p.id, p_novo_saldo: Math.round(Number(v)), p_motivo: "Contagem" });
      return Math.round(Number(v));
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input className="campo min-w-[200px] flex-1" placeholder="Buscar produto" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar produto" />
        <select className="campo w-auto" value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="Categoria">
          <option value="">Todas as categorias</option>
          {categorias.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select className="campo w-auto" value={motivo} onChange={(e) => setMotivo(e.target.value)} aria-label="Motivo">
          {MOTIVOS.map((m) => <option key={m}>{m}</option>)}
        </select>
      </div>
      <p className="text-xs text-muted">− e + somam ou tiram 1 do estoque com o motivo escolhido. Em “Contado”, digite a quantidade da prateleira e aperte Enter. Tudo fica no Histórico.</p>
      <div className="cartao divide-y divide-line/60 p-0" data-testid="lista-estoque">
        {lista.map((p) => {
          const atual = saldo[p.id] ?? p.estoque;
          const preso = ocupado.has(p.id);
          return (
            <div key={p.id} className={`flex flex-wrap items-center gap-2 px-3 py-2 ${p.ativo ? "" : "opacity-60"}`} data-testid="linha-estoque">
              <Foto url={p.imagem_url} nome={p.nome} className="h-10 w-10" />
              <div className="min-w-0 flex-1 basis-[calc(100%-3.5rem)] sm:basis-0">
                <div className="font-medium leading-tight sm:truncate">{p.nome}</div>
                <div className="text-xs text-muted">{p.categoria}{!p.ativo ? " · inativo" : ""}</div>
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <button className="btn-secundario h-10 w-10 p-0" disabled={preso} aria-label={`Diminuir ${p.nome}`} onClick={() => mover(p, -1)}><Minus size={18} /></button>
                <span className={`w-12 text-center text-lg font-bold tabular-nums ${atual < 0 ? "text-red-400" : atual <= p.estoque_minimo ? "text-amber-300" : ""}`} data-testid="saldo">{atual}</span>
                <button className="btn-secundario h-10 w-10 p-0" disabled={preso} aria-label={`Aumentar ${p.nome}`} onClick={() => mover(p, 1)}><Plus size={18} /></button>
                <input className="campo ml-2 w-24 py-2 text-center" inputMode="numeric" placeholder="Contado" aria-label={`Quantidade contada de ${p.nome}`}
                  value={contagem[p.id] ?? ""} disabled={preso}
                  onChange={(e) => setContagem((c) => ({ ...c, [p.id]: e.target.value.replace(/[^\d-]/g, "") }))}
                  onKeyDown={(e) => { if (e.key === "Enter") void contar(p); }}
                  onBlur={() => void contar(p)} />
              </div>
            </div>
          );
        })}
        {!lista.length && <div className="p-6 text-center text-muted">Nenhum produto.</div>}
      </div>
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
