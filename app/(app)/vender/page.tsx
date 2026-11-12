"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Minus, Plus, Star, Trash2, Wallet } from "lucide-react";
import { useLoja } from "@/lib/loja";
import { useSessao } from "@/lib/sessao";
import { brl, centavos, FORMAS, lerValor, nomeForma, normalizar, novoId } from "@/lib/formato";
import type { FormaPagamento, ItemCarrinho, Produto, Referencia } from "@/lib/tipos";
import { BuscaProduto, bip, type BuscaRef } from "@/components/busca-produto";
import { BotaoAcao, Janela, useAviso } from "@/components/ui";
import { supabase, mensagemErro } from "@/lib/supabase";
import { buscarReferencia, vincularCodigo } from "@/lib/acoes";
import { ProdutoEditor } from "@/components/produto-editor";
import { Foto } from "@/components/foto";

type Linha = { forma: FormaPagamento; valor: string };
type Confirmada = { numero?: number; total: number; troco: number; pendente: boolean };

const ehToque = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

/** Junta variações do mesmo nome de categoria ("Conveniência", "conveniência", "Conveniências"…). */
const chaveCategoria = (c: string) => normalizar(c || "Sem categoria").replace(/\s+/g, "").replace(/s$/, "");

function AbrirCaixaRapido() {
  const [valor, setValor] = useState("");
  const avisar = useAviso();
  const { recarregar } = useLoja();
  return (
    <div className="cartao mb-3 flex flex-wrap items-end gap-3 border-amber-500/60 bg-amber-500/10">
      <div className="flex-1">
        <div className="font-bold text-amber-300">O caixa está fechado</div>
        <div className="text-sm text-muted">Abra o caixa para começar a vender. Informe o dinheiro que está na gaveta.</div>
      </div>
      <input className="campo w-36" inputMode="decimal" placeholder="R$ 0,00" value={valor} onChange={(e) => setValor(e.target.value)} aria-label="Valor inicial" />
      <BotaoAcao acao={async () => {
        const v = lerValor(valor);
        if (!Number.isFinite(v) || v < 0) throw new Error("Valor inválido.");
        const { error } = await supabase().rpc("abrir_caixa", { p_valor: v });
        if (error) throw new Error(mensagemErro(error));
        await recarregar();
        avisar("Caixa aberto.");
      }}><Wallet size={18} /> Abrir caixa</BotaoAcao>
    </div>
  );
}

export default function Vender() {
  const { eu } = useSessao();
  const { produtos, produtoPorId, caixa, online, enviarOperacao } = useLoja();
  const avisar = useAviso();
  const busca = useRef<BuscaRef>(null);
  const chaveCarrinho = `bebs-v3-carrinho:${eu?.id}`;
  const [itens, setItens] = useState<ItemCarrinho[]>([]);
  const [desconto, setDesconto] = useState("");
  const [pagando, setPagando] = useState(false);
  const [confirmada, setConfirmada] = useState<Confirmada | null>(null);
  const [desconhecido, setDesconhecido] = useState<string | null>(null);
  const [categoria, setCategoria] = useState<string | null>(null);
  const [carrinhoAberto, setCarrinhoAberto] = useState(false);

  // Carrinho sobrevive a recarregar a página.
  useEffect(() => {
    try { setItens(JSON.parse(localStorage.getItem(chaveCarrinho) || "[]")); } catch { /* ignore */ }
  }, [chaveCarrinho]);
  useEffect(() => {
    try { localStorage.setItem(chaveCarrinho, JSON.stringify(itens)); } catch { /* ignore */ }
  }, [itens, chaveCarrinho]);

  const subtotal = useMemo(() => centavos(itens.reduce((s, i) => s + centavos(i.quantidade * i.preco_unitario), 0)), [itens]);
  const valorDesconto = eu?.papel === "dono" ? Math.min(Math.max(lerValor(desconto) || 0, 0), subtotal) : 0;
  const total = centavos(subtotal - valorDesconto);
  const qtdItens = itens.reduce((s, i) => s + i.quantidade, 0);
  const podeCobrar = itens.length > 0 && !!caixa && !itens.some((i) => i.quantidade <= 0);

  // No computador o leitor de código fica sempre pronto; no celular não abre o teclado sozinho.
  const focarBusca = useCallback(() => { if (!ehToque()) busca.current?.focar(); }, []);

  const fecharConfirmacao = useCallback(() => { setConfirmada(null); focarBusca(); }, [focarBusca]);

  const adicionar = useCallback((p: Produto, qtd: number) => {
    setItens((l) => {
      const i = l.findIndex((x) => x.produto_id === p.id);
      if (i >= 0) {
        const c = l.slice();
        c[i] = { ...c[i], quantidade: c[i].quantidade + qtd };
        return c;
      }
      return [...l, { produto_id: p.id, nome: p.nome, quantidade: qtd, preco_unitario: p.preco }];
    });
  }, []);

  const mudarQtd = (id: string, qtd: number) => {
    setItens((l) => qtd <= 0 ? l.filter((x) => x.produto_id !== id) : l.map((x) => x.produto_id === id ? { ...x, quantidade: qtd } : x));
  };

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "F9" && podeCobrar) { e.preventDefault(); setPagando(true); }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [podeCobrar]);

  // Produtos à venda e categorias (unificando nomes parecidos).
  const aVenda = useMemo(() => produtos.filter((p) => p.ativo && !p.arquivado).sort((a, b) => a.nome.localeCompare(b.nome)), [produtos]);
  const { categorias, categoriaDe } = useMemo(() => {
    const m = new Map<string, { total: number; nomes: Map<string, number> }>();
    for (const p of aVenda) {
      const k = chaveCategoria(p.categoria);
      const nome = p.categoria || "Sem categoria";
      const c = m.get(k) || { total: 0, nomes: new Map<string, number>() };
      c.total++;
      c.nomes.set(nome, (c.nomes.get(nome) || 0) + 1);
      m.set(k, c);
    }
    // Categoria pequena (até 3 itens) cujo nome é o começo de outra maior entra nela ("cigarros" → "Cigarros, tabaco…").
    const apelidos = new Map<string, string>();
    for (const [k, c] of [...m.entries()].sort((a, b) => a[1].total - b[1].total)) {
      if (c.total > 3) continue;
      const destino = [...m.entries()].find(([k2, c2]) => k2 !== k && c2.total > c.total && k2.startsWith(k));
      if (!destino) continue;
      destino[1].total += c.total;
      apelidos.set(k, destino[0]);
      m.delete(k);
    }
    const lista = [...m.entries()]
      .map(([chave, c]) => ({ chave, total: c.total, nome: [...c.nomes.entries()].sort((a, b) => b[1] - a[1])[0][0] }))
      .sort((a, b) => b.total - a.total);
    const de = (p: Produto) => { const k = chaveCategoria(p.categoria); return apelidos.get(k) ?? k; };
    return { categorias: lista, categoriaDe: de };
  }, [aVenda]);
  const temAtalhos = aVenda.some((p) => p.favorito);
  const filtroAtual = categoria ?? (temAtalhos ? "atalhos" : "todos");
  const vitrine = useMemo(() => {
    if (filtroAtual === "atalhos") return aVenda.filter((p) => p.favorito);
    if (filtroAtual === "todos") return aVenda;
    return aVenda.filter((p) => categoriaDe(p) === filtroAtual);
  }, [aVenda, filtroAtual, categoriaDe]);
  const qtdNoCarrinho = useMemo(() => new Map(itens.map((i) => [i.produto_id, i.quantidade])), [itens]);

  async function concluir(pagamentos: { forma: FormaPagamento; valor: number }[], troco: number) {
    const id = novoId();
    const payload = {
      id,
      criado_em: new Date().toISOString(),
      caixa_id: caixa?.id || null,
      desconto: valorDesconto,
      troco,
      itens: itens.map((i) => ({ produto_id: i.produto_id, nome: i.nome, quantidade: i.quantidade, preco_unitario: i.preco_unitario })),
      pagamentos,
    };
    const r = await enviarOperacao("venda", payload, `${brl(total)} · ${itens.length} item(ns)`);
    if (r.situacao === "recusada") {
      bip(false);
      throw new Error(r.erro);
    }
    setItens([]);
    setDesconto("");
    setPagando(false);
    setCarrinhoAberto(false);
    setConfirmada({ numero: r.situacao === "enviada" ? r.numero : undefined, total, troco, pendente: r.situacao === "pendente" });
  }

  const carrinho = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-bold">Venda atual</h2>
        {itens.length > 0 && (
          <button className="text-sm text-muted hover:text-red-400" onClick={() => { if (confirm("Limpar a venda atual?")) { setItens([]); setDesconto(""); } }}>Limpar</button>
        )}
      </div>
      <div className="min-h-[100px] flex-1 space-y-2 overflow-y-auto" data-testid="carrinho">
        {!itens.length && <p className="py-8 text-center text-muted">Toque nos produtos ou bipe o código.</p>}
        {itens.map((i) => {
          const p = produtoPorId.get(i.produto_id);
          const semEstoque = p?.tipo === "unidade" && p.estoque < i.quantidade;
          return (
            <div key={i.produto_id} className="rounded-xl bg-ink p-2.5">
              <div className="flex items-center justify-between gap-2">
                <Foto url={p?.imagem_url} nome={i.nome} className="h-11 w-11" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{i.nome}</div>
                  <div className="text-xs text-muted">{brl(i.preco_unitario)} cada{semEstoque ? <span className="text-amber-300"> · estoque {p?.estoque}</span> : null}</div>
                </div>
                <div className="font-bold tabular-nums">{brl(i.quantidade * i.preco_unitario)}</div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button className="btn-secundario px-3 py-1.5" aria-label="Diminuir" onClick={() => mudarQtd(i.produto_id, i.quantidade - 1)}><Minus size={16} /></button>
                <input className="campo w-16 py-1.5 text-center" inputMode="numeric" value={i.quantidade} aria-label="Quantidade"
                  onChange={(e) => { const n = parseInt(e.target.value.replace(/\D/g, "") || "0", 10); setItens((l) => l.map((x) => x.produto_id === i.produto_id ? { ...x, quantidade: n } : x)); }}
                  onBlur={(e) => { if (!parseInt(e.target.value || "0", 10)) mudarQtd(i.produto_id, 0); }} />
                <button className="btn-secundario px-3 py-1.5" aria-label="Aumentar" onClick={() => mudarQtd(i.produto_id, i.quantidade + 1)}><Plus size={16} /></button>
                <button className="ml-auto rounded-lg p-2 text-muted hover:text-red-400" aria-label="Remover" onClick={() => mudarQtd(i.produto_id, 0)}><Trash2 size={18} /></button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 space-y-2 border-t border-line pt-3">
        {eu?.papel === "dono" && itens.length > 0 && (
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted">Desconto</span>
            <input className="campo w-32 py-1.5 text-right" inputMode="decimal" placeholder="R$ 0,00" value={desconto} onChange={(e) => setDesconto(e.target.value)} />
          </div>
        )}
        <div className="flex items-end justify-between">
          <span className="text-muted">Total</span>
          <span className="text-4xl font-black tabular-nums" data-testid="total">{brl(total)}</span>
        </div>
        <button className="btn-verde w-full py-4 text-xl" disabled={!podeCobrar} onClick={() => setPagando(true)} data-testid="cobrar">
          Cobrar <span className="hidden text-sm opacity-70 lg:inline">(F9)</span>
        </button>
        {!caixa && itens.length > 0 && <p className="text-center text-xs text-amber-300">Abra o caixa para cobrar.</p>}
        {!online && <p className="text-center text-xs text-amber-300">Sem internet: as vendas ficam guardadas e são enviadas sozinhas.</p>}
      </div>
    </div>
  );

  return (
    <div className="pb-24 lg:pb-0">
      {!caixa && <AbrirCaixaRapido />}
      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        <section className="min-w-0 space-y-3">
          <BuscaProduto ref={busca} autoFocus={!ehToque()} aoEscolher={(p, q) => { adicionar(p, q); focarBusca(); }}
            aoCodigoDesconhecido={eu?.papel === "dono" ? setDesconhecido : async (c) => {
              const r = await buscarReferencia(c);
              avisar(r ? `Código ${c} não cadastrado na loja (na base: ${r.nome}). Chame o Roberto para cadastrar.` : `Código ${c} não cadastrado. Chame o Roberto para cadastrar.`, "info");
            }} />

          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" data-testid="categorias">
            {temAtalhos && (
              <button onClick={() => setCategoria("atalhos")} className={`flex shrink-0 items-center gap-1 rounded-full px-4 py-2 text-sm font-semibold ${filtroAtual === "atalhos" ? "bg-brand text-white" : "bg-panel2 text-muted"}`}>
                <Star size={14} /> Atalhos
              </button>
            )}
            <button onClick={() => setCategoria("todos")} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${filtroAtual === "todos" ? "bg-brand text-white" : "bg-panel2 text-muted"}`}>Todos</button>
            {categorias.map((c) => (
              <button key={c.chave} onClick={() => setCategoria(c.chave)}
                className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${filtroAtual === c.chave ? "bg-brand text-white" : "bg-panel2 text-muted"}`}>
                {c.nome}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5" data-testid="vitrine">
            {vitrine.map((p) => {
              const noCarrinho = qtdNoCarrinho.get(p.id);
              return (
                <button key={p.id} onClick={() => { bip(); adicionar(p, 1); focarBusca(); }}
                  className={`relative flex flex-col items-center rounded-xl border bg-panel2 p-2 text-center active:scale-[.97] ${noCarrinho ? "border-brand" : "border-line hover:border-muted"}`}>
                  {noCarrinho ? <span className="absolute right-1 top-1 z-10 min-w-6 rounded-full bg-brand px-1.5 text-xs font-bold leading-6 text-white">{noCarrinho}</span> : null}
                  <Foto url={p.imagem_url} nome={p.nome} className="h-16 w-16" />
                  <div className="mt-1.5 line-clamp-2 min-h-[2.5em] text-xs font-medium leading-tight sm:text-sm">{p.nome}</div>
                  <div className="mt-0.5 text-sm font-bold text-brand">{brl(p.preco)}</div>
                </button>
              );
            })}
          </div>
          {!vitrine.length && <p className="py-6 text-center text-muted">Nenhum produto nesta categoria.</p>}
        </section>

        <section className="cartao hidden flex-col lg:sticky lg:top-20 lg:flex lg:max-h-[calc(100dvh-7rem)]">{carrinho}</section>
      </div>

      {/* Celular: barra fixa com o total e acesso rápido à venda. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink/95 p-3 backdrop-blur lg:hidden" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <div className="flex items-center gap-2">
          <button className="flex flex-1 items-center justify-between rounded-xl bg-panel2 px-3 py-3 text-left" onClick={() => setCarrinhoAberto(true)} data-testid="ver-venda">
            <span className="text-sm text-muted">{qtdItens ? `${qtdItens} ${qtdItens === 1 ? "item" : "itens"} · ver venda` : "Venda vazia"}</span>
            <span className="text-lg font-black tabular-nums">{brl(total)}</span>
          </button>
          <button className="btn-verde px-6 py-3 text-lg" disabled={!podeCobrar} onClick={() => setPagando(true)} data-testid="cobrar-celular">Cobrar</button>
        </div>
      </div>
      <Janela titulo="Venda atual" aberta={carrinhoAberto} aoFechar={() => setCarrinhoAberto(false)}>
        <div className="flex max-h-[75dvh] flex-col">{carrinho}</div>
      </Janela>

      <VincularCodigo codigo={desconhecido} aoFechar={() => { setDesconhecido(null); focarBusca(); }}
        aoVincular={(p, q) => { adicionar(p, q); setDesconhecido(null); focarBusca(); }} />
      <Pagamento aberta={pagando} total={total} aoFechar={() => { setPagando(false); focarBusca(); }} aoConcluir={concluir} />
      <VendaConfirmada venda={confirmada} aoFechar={fecharConfirmacao} />
    </div>
  );
}

function VendaConfirmada({ venda, aoFechar }: { venda: Confirmada | null; aoFechar: () => void }) {
  // Sem troco, fecha sozinha em 4 s; com troco, espera o operador conferir.
  useEffect(() => {
    if (!venda || venda.troco > 0) return;
    const t = setTimeout(aoFechar, 4000);
    return () => clearTimeout(t);
  }, [venda, aoFechar]);
  if (!venda) return null;
  return (
    <Janela titulo={venda.pendente ? "Venda guardada" : "Venda confirmada"} aberta={!!venda} aoFechar={aoFechar} largura="max-w-sm">
      <div className="space-y-4 text-center" data-testid="venda-confirmada">
        <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ${venda.pendente ? "bg-amber-500/20 text-amber-300" : "bg-lime/20 text-lime"}`}>
          <Check size={44} strokeWidth={3} />
        </div>
        <div>
          <div className="text-2xl font-black">{venda.pendente ? "Venda guardada" : "Venda confirmada!"}</div>
          <div className="text-muted">{venda.pendente ? "Sem internet agora. Ela será enviada sozinha." : `Venda #${venda.numero}`}</div>
        </div>
        <div className="text-3xl font-black tabular-nums">{brl(venda.total)}</div>
        {venda.troco > 0 && (
          <div className="rounded-xl bg-lime/15 p-3">
            <div className="text-sm text-muted">Troco</div>
            <div className="text-4xl font-black text-lime tabular-nums">{brl(venda.troco)}</div>
          </div>
        )}
        <button className="btn-principal w-full py-3 text-lg" autoFocus onClick={aoFechar}>Nova venda</button>
      </div>
    </Janela>
  );
}

function VincularCodigo({ codigo, aoFechar, aoVincular }: { codigo: string | null; aoFechar: () => void; aoVincular: (p: Produto, qtd: number) => void }) {
  const { codigosPorProduto, codigoPorTexto, produtoPorId } = useLoja();
  const avisar = useAviso();
  const [criar, setCriar] = useState(false);
  const [ref, setRef] = useState<Referencia | null | undefined>(undefined);

  useEffect(() => {
    setRef(undefined);
    setCriar(false);
    if (codigo) void buscarReferencia(codigo).then(setRef);
  }, [codigo]);

  async function vincular(p: Produto, multiplicador = 1) {
    try {
      await vincularCodigo(p, codigosPorProduto.get(p.id) || [], codigo!, multiplicador, multiplicador > 1 ? `Caixa com ${multiplicador}` : "Unidade");
      avisar(`Código vinculado a ${p.nome}${multiplicador > 1 ? ` (caixa com ${multiplicador})` : ""}.`);
      aoVincular(p, multiplicador);
    } catch (e) { avisar(e instanceof Error ? e.message : String(e), "erro"); }
  }

  if (criar) {
    return <ProdutoEditor produto={null} novo={{ codigo: codigo || undefined }} aoFechar={() => { setCriar(false); aoFechar(); }}
      aoSalvar={async (id) => {
        setCriar(false);
        const { data } = await supabase().from("produtos").select("*").eq("id", id).single();
        const p = (data as Produto | null) || produtoPorId.get(id);
        if (p) aoVincular({ ...p, preco: Number(p.preco), custo: 0 }, ref?.unidades && ref.unidades > 1 ? ref.unidades : 1);
      }} />;
  }

  const unidade = ref?.codigo_unidade ? codigoPorTexto.get(ref.codigo_unidade) : undefined;
  const produtoUnidade = unidade ? produtoPorId.get(unidade.produto_id) : undefined;

  return (
    <Janela titulo={`Código ${codigo} não cadastrado`} aberta={!!codigo} aoFechar={aoFechar}>
      <div className="space-y-3">
        {ref === undefined && <p className="text-sm text-muted">Procurando na base de códigos…</p>}
        {ref && (
          <div className="rounded-xl border border-lime/50 bg-lime/10 p-3" data-testid="referencia">
            <div className="flex items-center gap-3">
              <Foto url={ref.imagem_url} nome={ref.nome} className="h-16 w-16" />
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase text-lime">Encontrado na base de códigos</div>
                <div className="font-bold">{ref.nome}</div>
                <div className="text-xs text-muted">{[ref.categoria, ref.fabricante, ref.embalagem, ref.unidades > 1 ? `caixa com ${ref.unidades}` : null].filter(Boolean).join(" · ")}</div>
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {produtoUnidade && ref.unidades > 1 && (
                <button className="btn-verde w-full" onClick={() => vincular(produtoUnidade, ref.unidades)}>
                  Vincular como caixa com {ref.unidades} de “{produtoUnidade.nome}”
                </button>
              )}
              <button className={produtoUnidade ? "btn-secundario w-full" : "btn-verde w-full"} onClick={() => setCriar(true)}>Cadastrar com estes dados</button>
            </div>
          </div>
        )}
        {ref === null && <p className="text-sm text-muted">Não está na base de códigos. Cadastre o produto ou vincule a um que já existe.</p>}
        <p className="text-sm text-muted">{ref ? "Ou vincule a um produto que a loja já tem:" : "Vincular a um produto que a loja já tem:"}</p>
        <BuscaProduto autoFocus incluirInativos placeholder="Digite o nome do produto" aoEscolher={(p) => vincular(p)} />
        {!ref && <button className="btn-secundario w-full" onClick={() => setCriar(true)}>É um produto novo: cadastrar</button>}
      </div>
    </Janela>
  );
}

function Pagamento({ aberta, total, aoFechar, aoConcluir }: {
  aberta: boolean; total: number; aoFechar: () => void;
  aoConcluir: (p: { forma: FormaPagamento; valor: number }[], troco: number) => Promise<void>;
}) {
  const [forma, setForma] = useState<FormaPagamento | null>(null);
  const [recebido, setRecebido] = useState("");
  const [dividir, setDividir] = useState(false);
  const [linhas, setLinhas] = useState<Linha[]>([{ forma: "dinheiro", valor: "" }, { forma: "pix", valor: "" }]);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (aberta) { setForma(null); setRecebido(""); setDividir(false); setErro(null); setLinhas([{ forma: "dinheiro", valor: "" }, { forma: "pix", valor: "" }]); }
  }, [aberta]);

  useEffect(() => {
    if (!aberta || dividir) return;
    const tecla = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      const f = FORMAS[Number(e.key) - 1];
      if (f) { e.preventDefault(); setForma(f.id); }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aberta, dividir]);

  const valorRecebido = lerValor(recebido);
  const troco = forma === "dinheiro" && valorRecebido > total ? centavos(valorRecebido - total) : 0;
  const somaLinhas = centavos(linhas.reduce((s, l) => s + (lerValor(l.valor) || 0), 0));
  const falta = centavos(total - somaLinhas);

  async function confirmar(pagamentos: { forma: FormaPagamento; valor: number }[], trocoFinal: number) {
    setErro(null);
    setOcupado(true);
    try { await aoConcluir(pagamentos, trocoFinal); } catch (e) { setErro(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); }
  }

  function confirmarSimples() {
    if (!forma) return;
    if (forma === "dinheiro" && recebido && valorRecebido < total) { setErro("Valor recebido menor que o total."); return; }
    void confirmar([{ forma, valor: total }], troco);
  }

  return (
    <Janela titulo={`Cobrar ${brl(total)}`} aberta={aberta} aoFechar={aoFechar}>
      {!dividir ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {FORMAS.map((f, i) => (
              <button key={f.id} onClick={() => setForma(f.id)} data-testid={`forma-${f.id}`}
                className={`rounded-xl border-2 p-4 text-lg font-bold ${forma === f.id ? "border-brand bg-brand/20" : "border-line bg-panel2"}`}>
                <span className="mr-1 text-xs text-muted">{i + 1}</span> {f.nome}
              </button>
            ))}
          </div>
          {forma === "dinheiro" && (
            <div>
              <label className="rotulo" htmlFor="recebido">Valor recebido (opcional, para calcular o troco)</label>
              <input id="recebido" className="campo text-xl" inputMode="decimal" autoFocus value={recebido} onChange={(e) => setRecebido(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") confirmarSimples(); }} placeholder={brl(total)} />
              {troco > 0 && <div className="mt-2 text-right text-2xl font-black text-lime">Troco {brl(troco)}</div>}
            </div>
          )}
          {erro && <p className="rounded-lg bg-red-600/20 p-2 text-sm text-red-300">{erro}</p>}
          <button className="btn-verde w-full py-4 text-xl" disabled={!forma || ocupado} onClick={confirmarSimples} data-testid="confirmar-pagamento">
            {ocupado ? "Salvando…" : "Confirmar venda"}
          </button>
          <button className="w-full text-sm text-muted underline" onClick={() => setDividir(true)}>Dividir em mais de uma forma</button>
        </div>
      ) : (
        <div className="space-y-3">
          {linhas.map((l, i) => (
            <div key={i} className="flex gap-2">
              <select className="campo w-36" value={l.forma} onChange={(e) => setLinhas((x) => x.map((y, j) => j === i ? { ...y, forma: e.target.value as FormaPagamento } : y))}>
                {FORMAS.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
              <input className="campo" inputMode="decimal" placeholder="R$ 0,00" value={l.valor}
                onChange={(e) => setLinhas((x) => x.map((y, j) => j === i ? { ...y, valor: e.target.value } : y))} />
              <button className="btn-secundario px-2" aria-label="Preencher o restante" title="Preencher o restante"
                onClick={() => setLinhas((x) => x.map((y, j) => j === i ? { ...y, valor: String(centavos((lerValor(y.valor) || 0) + falta)).replace(".", ",") } : y))}>=</button>
            </div>
          ))}
          <button className="text-sm text-muted underline" onClick={() => setLinhas((x) => [...x, { forma: "credito", valor: "" }])}>+ outra forma</button>
          <div className={`text-right font-bold ${Math.abs(falta) < 0.01 ? "text-lime" : "text-amber-300"}`}>
            {Math.abs(falta) < 0.01 ? "Valores conferem" : falta > 0 ? `Falta ${brl(falta)}` : `Passou ${brl(-falta)}`}
          </div>
          {erro && <p className="rounded-lg bg-red-600/20 p-2 text-sm text-red-300">{erro}</p>}
          <button className="btn-verde w-full py-4 text-xl" disabled={Math.abs(falta) >= 0.01 || ocupado}
            onClick={() => confirmar(linhas.map((l) => ({ forma: l.forma, valor: lerValor(l.valor) || 0 })).filter((l) => l.valor > 0), 0)}>
            {ocupado ? "Salvando…" : "Confirmar venda"}
          </button>
          <button className="w-full text-sm text-muted underline" onClick={() => setDividir(false)}>Voltar para forma única</button>
          <p className="text-xs text-muted">Formas: {linhas.map((l) => nomeForma(l.forma)).join(" + ")}</p>
        </div>
      )}
    </Janela>
  );
}
