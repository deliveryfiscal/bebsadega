"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { useLoja } from "@/lib/loja";
import { brl, lerValor } from "@/lib/formato";
import { rpc, salvarProduto, type ProdutoForm } from "@/lib/acoes";
import type { Produto } from "@/lib/tipos";
import { BuscaProduto } from "./busca-produto";
import { BotaoAcao, Janela, useAviso } from "./ui";

type Props = { produto: Produto | null; novo?: { codigo?: string; nome?: string } | null; aoFechar: () => void; aoSalvar?: (id: string) => void };

export function ProdutoEditor({ produto, novo, aoFechar, aoSalvar }: Props) {
  const { produtos, produtoPorId, codigosPorProduto, codigoPorTexto, combos } = useLoja();
  const avisar = useAviso();
  const aberta = !!produto || !!novo;

  const [f, setF] = useState({ nome: "", categoria: "", tipo: "unidade" as "unidade" | "combo", preco: "", custo: "", minimo: "0", estoque: "0", favorito: false, ativo: true });
  const [codigos, setCodigos] = useState<{ codigo: string; multiplicador: number; descricao: string }[]>([]);
  const [combo, setCombo] = useState<{ produto_id: string; quantidade: number }[]>([]);
  const [novoCodigo, setNovoCodigo] = useState("");
  const [mult, setMult] = useState("1");

  useEffect(() => {
    if (!aberta) return;
    const br = (v: number) => String(v).replace(".", ",");
    if (produto) {
      setF({ nome: produto.nome, categoria: produto.categoria, tipo: produto.tipo, preco: br(produto.preco), custo: br(produto.custo),
        minimo: String(produto.estoque_minimo), estoque: String(produto.estoque), favorito: produto.favorito, ativo: produto.ativo });
      setCodigos((codigosPorProduto.get(produto.id) || []).map((c) => ({ codigo: c.codigo, multiplicador: c.multiplicador, descricao: c.descricao })));
      setCombo(combos.filter((c) => c.combo_id === produto.id).map((c) => ({ produto_id: c.produto_id, quantidade: c.quantidade })));
    } else {
      setF({ nome: novo?.nome || "", categoria: "", tipo: "unidade", preco: "", custo: "", minimo: "0", estoque: "0", favorito: false, ativo: true });
      setCodigos(novo?.codigo ? [{ codigo: novo.codigo, multiplicador: 1, descricao: "Unidade" }] : []);
      setCombo([]);
    }
    setNovoCodigo("");
    setMult("1");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta, produto?.id]);

  const categorias = useMemo(() => [...new Set(produtos.filter((p) => !p.arquivado).map((p) => p.categoria).filter(Boolean))].sort(), [produtos]);

  function addCodigo() {
    const c = novoCodigo.trim();
    if (!c) return;
    const dono = codigoPorTexto.get(c);
    if (dono && dono.produto_id !== produto?.id) {
      avisar(`Esse código já está em "${produtoPorId.get(dono.produto_id)?.nome}".`, "erro");
      return;
    }
    if (codigos.some((x) => x.codigo === c)) { setNovoCodigo(""); return; }
    const m = Math.max(parseInt(mult, 10) || 1, 1);
    setCodigos((l) => [...l, { codigo: c, multiplicador: m, descricao: m === 1 ? "Unidade" : `Pacote com ${m}` }]);
    setNovoCodigo("");
  }

  async function salvar() {
    const preco = lerValor(f.preco);
    const custo = lerValor(f.custo || "0");
    if (!f.nome.trim()) throw new Error("Informe o nome.");
    if (!Number.isFinite(preco) || preco < 0) throw new Error("Preço inválido.");
    if (!Number.isFinite(custo) || custo < 0) throw new Error("Custo inválido.");
    if (f.tipo === "combo" && !combo.length) throw new Error("Adicione os produtos que compõem o combo.");
    const dados: ProdutoForm = {
      id: produto?.id, nome: f.nome.trim(), categoria: f.categoria.trim(), tipo: f.tipo, preco, custo,
      estoque_minimo: Math.max(parseInt(f.minimo, 10) || 0, 0), favorito: f.favorito, ativo: f.ativo,
      estoque_inicial: produto ? undefined : parseInt(f.estoque, 10) || 0,
      codigos, combo,
    };
    const id = await salvarProduto(dados);
    avisar(produto ? "Produto salvo." : "Produto cadastrado.");
    aoSalvar?.(id);
    aoFechar();
  }

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((x) => ({ ...x, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));

  return (
    <Janela titulo={produto ? "Editar produto" : "Novo produto"} aberta={aberta} aoFechar={aoFechar} largura="max-w-2xl">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="rotulo" htmlFor="pnome">Nome</label>
            <input id="pnome" className="campo" value={f.nome} onChange={set("nome")} autoFocus={!produto} />
          </div>
          <div>
            <label className="rotulo" htmlFor="pcat">Categoria</label>
            <input id="pcat" className="campo" list="categorias" value={f.categoria} onChange={set("categoria")} />
            <datalist id="categorias">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <div>
            <label className="rotulo" htmlFor="ptipo">Tipo</label>
            <select id="ptipo" className="campo" value={f.tipo} onChange={set("tipo")}>
              <option value="unidade">Produto comum</option>
              <option value="combo">Combo (baixa o estoque dos itens)</option>
            </select>
          </div>
          <div>
            <label className="rotulo" htmlFor="ppreco">Preço de venda</label>
            <input id="ppreco" className="campo" inputMode="decimal" placeholder="0,00" value={f.preco} onChange={set("preco")} />
          </div>
          <div>
            <label className="rotulo" htmlFor="pcusto">Custo (quanto paga)</label>
            <input id="pcusto" className="campo" inputMode="decimal" placeholder="0,00" value={f.custo} onChange={set("custo")} />
          </div>
          {f.tipo === "unidade" && (
            <>
              <div>
                <label className="rotulo" htmlFor="pmin">Estoque mínimo (avisar abaixo de)</label>
                <input id="pmin" className="campo" inputMode="numeric" value={f.minimo} onChange={set("minimo")} />
              </div>
              <div>
                <label className="rotulo" htmlFor="pest">Estoque atual</label>
                {produto ? <div className="campo text-muted">{produto.estoque} un. <span className="text-xs">(mude em Estoque → Ajuste)</span></div>
                  : <input id="pest" className="campo" inputMode="numeric" value={f.estoque} onChange={set("estoque")} />}
              </div>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={f.favorito} onChange={set("favorito")} /> Atalho no PDV</label>
          <label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={f.ativo} onChange={set("ativo")} /> À venda (ativo)</label>
        </div>

        <div className="rounded-xl border border-line p-3">
          <div className="mb-2 font-semibold">Códigos de barras</div>
          <div className="flex flex-wrap gap-2">
            <input className="campo min-w-0 flex-1" placeholder="Bipe o código aqui" value={novoCodigo} onChange={(e) => setNovoCodigo(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCodigo(); } }} aria-label="Novo código" />
            <select className="campo w-36" value={mult} onChange={(e) => setMult(e.target.value)} aria-label="Embalagem">
              <option value="1">Unidade</option>
              <option value="6">Pacote 6</option>
              <option value="12">Caixa 12</option>
              <option value="15">Caixa 15</option>
              <option value="24">Caixa 24</option>
            </select>
            <button className="btn-secundario" onClick={addCodigo}>Adicionar</button>
          </div>
          <ul className="mt-2 space-y-1">
            {codigos.map((c) => (
              <li key={c.codigo} className="flex items-center justify-between rounded-lg bg-ink px-3 py-1.5 text-sm">
                <span className="font-mono">{c.codigo}</span>
                <span className="text-muted">{c.multiplicador === 1 ? "Unidade" : `${c.multiplicador} un.`}</span>
                <button className="p-1 text-muted hover:text-red-400" aria-label="Remover código" onClick={() => setCodigos((l) => l.filter((x) => x.codigo !== c.codigo))}><Trash2 size={15} /></button>
              </li>
            ))}
            {!codigos.length && <li className="text-sm text-muted">Sem código: o produto só é encontrado pelo nome.</li>}
          </ul>
        </div>

        {f.tipo === "combo" && (
          <div className="rounded-xl border border-line p-3">
            <div className="mb-2 font-semibold">Itens do combo</div>
            <BuscaProduto somenteUnidade aoEscolher={(p, q) => setCombo((l) => {
              const i = l.findIndex((x) => x.produto_id === p.id);
              return i >= 0 ? l.map((x, k) => k === i ? { ...x, quantidade: x.quantidade + q } : x) : [...l, { produto_id: p.id, quantidade: q }];
            })} placeholder="Adicionar produto ao combo" />
            <ul className="mt-2 space-y-1">
              {combo.map((c) => (
                <li key={c.produto_id} className="flex items-center gap-2 rounded-lg bg-ink px-3 py-1.5 text-sm">
                  <input className="campo w-16 py-1 text-center" inputMode="numeric" value={c.quantidade} aria-label="Quantidade no combo"
                    onChange={(e) => setCombo((l) => l.map((x) => x.produto_id === c.produto_id ? { ...x, quantidade: Math.max(parseInt(e.target.value, 10) || 1, 1) } : x))} />
                  <span className="flex-1">{produtoPorId.get(c.produto_id)?.nome}</span>
                  <span className="text-muted">{brl(produtoPorId.get(c.produto_id)?.preco)}</span>
                  <button className="p-1 text-muted hover:text-red-400" aria-label="Remover item" onClick={() => setCombo((l) => l.filter((x) => x.produto_id !== c.produto_id))}><Trash2 size={15} /></button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap justify-between gap-2">
          {produto ? (
            <BotaoAcao className="btn-secundario text-red-300" acao={async () => {
              if (!confirm(`Excluir "${produto.nome}"? Ele some das buscas, mas o histórico de vendas continua.`)) return;
              await rpc("arquivar_produto", { p_id: produto.id });
              avisar("Produto excluído.");
              aoFechar();
            }}>Excluir produto</BotaoAcao>
          ) : <span />}
          <BotaoAcao acao={salvar}>Salvar</BotaoAcao>
        </div>
      </div>
    </Janela>
  );
}
