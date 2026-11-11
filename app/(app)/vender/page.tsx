"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Minus, Plus, Star, Trash2, Wallet } from "lucide-react";
import { useLoja } from "@/lib/loja";
import { useSessao } from "@/lib/sessao";
import { brl, centavos, FORMAS, lerValor, nomeForma, novoId } from "@/lib/formato";
import type { FormaPagamento, ItemCarrinho, Produto } from "@/lib/tipos";
import { BuscaProduto, bip, type BuscaRef } from "@/components/busca-produto";
import { BotaoAcao, Janela, useAviso } from "@/components/ui";
import { supabase, mensagemErro } from "@/lib/supabase";
import { vincularCodigo } from "@/lib/acoes";
import { ProdutoEditor } from "@/components/produto-editor";

type Linha = { forma: FormaPagamento; valor: string };
type Ultima = { numero?: number; total: number; troco: number; pendente: boolean };

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
  const [ultima, setUltima] = useState<Ultima | null>(null);
  const [desconhecido, setDesconhecido] = useState<string | null>(null);

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

  const adicionar = useCallback((p: Produto, qtd: number) => {
    setUltima(null);
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
    busca.current?.focar();
  };

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "F9" && itens.length && caixa) { e.preventDefault(); setPagando(true); }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [itens.length, caixa]);

  const favoritos = useMemo(() => produtos.filter((p) => p.favorito && p.ativo && !p.arquivado).sort((a, b) => a.nome.localeCompare(b.nome)).slice(0, 24), [produtos]);

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
    setUltima({ numero: r.situacao === "enviada" ? r.numero : undefined, total, troco, pendente: r.situacao === "pendente" });
    if (r.situacao === "enviada") avisar(`Venda #${r.numero} salva.`);
    else avisar("Sem internet: venda guardada neste aparelho e será enviada sozinha.", "info");
    setTimeout(() => busca.current?.focar(), 50);
  }

  return (
    <div>
      {!caixa && <AbrirCaixaRapido />}
      <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
        <section className="space-y-4">
          <BuscaProduto ref={busca} autoFocus aoEscolher={adicionar} aoCodigoDesconhecido={eu?.papel === "dono" ? setDesconhecido : undefined} />
          {ultima && (
            <div className={`cartao ${ultima.pendente ? "border-amber-500/60" : "border-lime/60"}`} data-testid="ultima-venda">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm text-muted">{ultima.pendente ? "Venda guardada (aguardando internet)" : `Venda #${ultima.numero} salva`}</div>
                  <div className="text-xl font-bold">{brl(ultima.total)}</div>
                </div>
                {ultima.troco > 0 && (
                  <div className="text-right">
                    <div className="text-sm text-muted">Troco</div>
                    <div className="text-3xl font-black text-lime">{brl(ultima.troco)}</div>
                  </div>
                )}
              </div>
            </div>
          )}
          {favoritos.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-1 text-sm text-muted"><Star size={14} /> Atalhos</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                {favoritos.map((p) => (
                  <button key={p.id} onClick={() => { bip(); adicionar(p, 1); busca.current?.focar(); }}
                    className="rounded-xl border border-line bg-panel2 p-3 text-left hover:border-brand active:scale-[.98]">
                    <div className="line-clamp-2 text-sm font-medium leading-tight">{p.nome}</div>
                    <div className="mt-1 font-bold text-brand">{brl(p.preco)}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {eu?.papel === "dono" && !favoritos.length && (
            <p className="text-sm text-muted">Dica: marque produtos como <strong>atalho</strong> em <Link href="/produtos" className="underline">Produtos</Link> para vender com um toque (doses, gelo, copão…).</p>
          )}
        </section>

        <section className="cartao flex flex-col lg:sticky lg:top-20 lg:max-h-[calc(100dvh-7rem)]">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-bold">Venda atual</h2>
            {itens.length > 0 && (
              <button className="text-sm text-muted hover:text-red-400" onClick={() => { if (confirm("Limpar a venda atual?")) { setItens([]); setDesconto(""); } }}>Limpar</button>
            )}
          </div>
          <div className="min-h-[120px] flex-1 space-y-2 overflow-y-auto" data-testid="carrinho">
            {!itens.length && <p className="py-8 text-center text-muted">Bipe ou busque um produto.</p>}
            {itens.map((i) => {
              const p = produtoPorId.get(i.produto_id);
              const semEstoque = p?.tipo === "unidade" && p.estoque < i.quantidade;
              return (
                <div key={i.produto_id} className="rounded-xl bg-ink p-2.5">
                  <div className="flex justify-between gap-2">
                    <div className="min-w-0">
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
            <button className="btn-verde w-full py-4 text-xl" disabled={!itens.length || !caixa || itens.some((i) => i.quantidade <= 0)}
              onClick={() => setPagando(true)} data-testid="cobrar">
              Cobrar <span className="text-sm opacity-70">(F9)</span>
            </button>
            {!online && <p className="text-center text-xs text-amber-300">Sem internet: as vendas ficam guardadas e são enviadas sozinhas.</p>}
          </div>
        </section>
      </div>

      <VincularCodigo codigo={desconhecido} aoFechar={() => { setDesconhecido(null); busca.current?.focar(); }}
        aoVincular={(p) => { adicionar(p, 1); setDesconhecido(null); busca.current?.focar(); }} />
      <Pagamento aberta={pagando} total={total} aoFechar={() => { setPagando(false); busca.current?.focar(); }} aoConcluir={concluir} />
    </div>
  );
}

function VincularCodigo({ codigo, aoFechar, aoVincular }: { codigo: string | null; aoFechar: () => void; aoVincular: (p: Produto) => void }) {
  const { codigosPorProduto, produtoPorId } = useLoja();
  const avisar = useAviso();
  const [criar, setCriar] = useState(false);
  if (criar) {
    return <ProdutoEditor produto={null} novo={{ codigo: codigo || undefined }} aoFechar={() => { setCriar(false); aoFechar(); }}
      aoSalvar={(id) => { setCriar(false); const p = produtoPorId.get(id); if (p) aoVincular(p); }} />;
  }
  return (
    <Janela titulo={`Código ${codigo} não cadastrado`} aberta={!!codigo} aoFechar={aoFechar}>
      <div className="space-y-3">
        <p className="text-sm text-muted">Escolha o produto deste código. Ele fica salvo e da próxima vez é só bipar.</p>
        <BuscaProduto autoFocus incluirInativos placeholder="Digite o nome do produto" aoEscolher={async (p) => {
          try {
            await vincularCodigo(p, codigosPorProduto.get(p.id) || [], codigo!);
            avisar(`Código vinculado a ${p.nome}.`);
            aoVincular(p);
          } catch (e) { avisar(e instanceof Error ? e.message : String(e), "erro"); }
        }} />
        <button className="btn-secundario w-full" onClick={() => setCriar(true)}>É um produto novo: cadastrar</button>
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
