"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useLoja } from "@/lib/loja";
import { brl, normalizar } from "@/lib/formato";
import type { Produto } from "@/lib/tipos";
import { ProdutoEditor } from "@/components/produto-editor";
import { ComboItensEditor } from "@/components/combo-itens";
import { useSessao } from "@/lib/sessao";
import { BuscaProduto } from "@/components/busca-produto";
import { Foto } from "@/components/foto";
import { Janela, Titulo, Vazio } from "@/components/ui";

export default function CombosPagina() {
  return <Combos />;
}

function Combos() {
  const { produtos, produtoPorId, combos } = useLoja();
  const { eu } = useSessao();
  const dono = eu?.papel === "dono";
  // Funcionário: só define os itens (sem preço/nome/custo).
  const [itensDe, setItensDe] = useState<Produto | null>(null);
  const abrir = (produto: Produto | null, converter?: boolean) => {
    if (dono) setEditando({ produto, converter });
    else if (produto) setItensDe(produto);
  };
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<{ produto: Produto | null; converter?: boolean } | null>(null);
  const [transformar, setTransformar] = useState(false);

  const lista = useMemo(() => {
    const palavras = normalizar(busca).split(/\s+/).filter(Boolean);
    return produtos
      .filter((p) => p.tipo === "combo" && !p.arquivado)
      .filter((p) => !palavras.length || palavras.every((w) => normalizar(p.nome).includes(w)))
      .map((p) => ({ p, itens: combos.filter((c) => c.combo_id === p.id) }))
      .sort((a, b) => Number(a.itens.length > 0) - Number(b.itens.length > 0) || Number(b.p.ativo) - Number(a.p.ativo) || a.p.nome.localeCompare(b.p.nome));
  }, [produtos, combos, busca]);

  // Produtos que parecem drink montado mas ainda são vendidos como unidade (não baixam os itens).
  const candidatos = useMemo(() => produtos.filter((p) => !p.arquivado && p.ativo && p.tipo === "unidade"
    && /cop[aã]o|combo|caipi|drink|\+/i.test(p.nome)), [produtos]);

  const semItens = lista.filter((x) => !x.itens.length && x.p.ativo).length;

  return (
    <div className="space-y-4">
      <Titulo acoes={<>
        <button className="btn-secundario" onClick={() => setTransformar(true)}>Transformar produto em combo</button>
        {dono && <button className="btn-principal" onClick={() => setEditando({ produto: null })}><Plus size={18} /> Novo combo / dose</button>}
      </>}>Combos e doses com itens</Titulo>
      <p className="-mt-2 text-sm text-muted">
        Cada venda de um combo dá baixa em todos os itens dele: ml da garrafa aberta, energético, copo, gelo… Os atendentes só vendem; isto é configurado aqui.
      </p>

      {(semItens > 0 || candidatos.length > 0) && (
        <div className="cartao space-y-1 border-amber-500/50 text-sm">
          {semItens > 0 && <p><strong className="text-amber-300">{semItens} combo(s) à venda sem itens</strong> <span className="text-muted">— vendem, mas não dão baixa em nada. Estão no topo da lista.</span></p>}
          {candidatos.length > 0 && (
            <details>
              <summary className="cursor-pointer"><strong className="text-amber-300">{candidatos.length} produto(s) parecem drinks montados</strong> <span className="text-muted">(copões, combos) mas baixam só a si mesmos. Toque para ver e transformar.</span></summary>
              <div className="mt-2 flex flex-wrap gap-2">
                {candidatos.map((p) => (
                  <button key={p.id} className="etiqueta bg-panel2 py-1 text-muted hover:text-white" onClick={() => abrir(p, true)}>{p.nome}</button>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      <input className="campo" placeholder="Buscar combo" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar combo" />

      {!lista.length ? <Vazio>Nenhum combo ainda.</Vazio> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="combos">
          {lista.map(({ p, itens }) => (
            <button key={p.id} onClick={() => abrir(p)} data-testid="combo"
              className={`cartao text-left hover:border-brand ${!itens.length && p.ativo ? "border-amber-500/60" : ""} ${p.ativo ? "" : "opacity-60"}`}>
              <div className="flex items-center gap-3">
                <Foto url={p.imagem_url} nome={p.nome} className="h-12 w-12" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold leading-tight">{p.nome}</div>
                  <div className="text-sm text-brand">{brl(p.preco)}{!p.ativo ? <span className="text-muted"> · inativo</span> : null}</div>
                </div>
              </div>
              <ul className="mt-2 space-y-0.5 text-sm text-muted">
                {itens.map((c) => (
                  <li key={c.produto_id}>• {c.ml ? `${c.quantidade > 1 ? `${c.quantidade} × ` : ""}${c.ml} ml de ` : `${c.quantidade} × `}{produtoPorId.get(c.produto_id)?.nome || "produto removido"}</li>
                ))}
                {!itens.length && <li className="text-amber-300">Sem itens — toque para adicionar.</li>}
              </ul>
            </button>
          ))}
        </div>
      )}

      <ProdutoEditor
        produto={editando?.produto ?? null}
        novo={editando && !editando.produto ? { tipo: "combo" } : null}
        tipoInicial={editando?.converter ? "combo" : undefined}
        aoFechar={() => setEditando(null)} />

      <ComboItensEditor produto={itensDe} aoFechar={() => setItensDe(null)} />

      <Janela titulo="Transformar produto em combo" aberta={transformar} aoFechar={() => setTransformar(false)}>
        <div className="space-y-3">
          <p className="text-sm text-muted">Escolha o produto (ex.: um copão). Ele passa a ser combo: a cada venda, dá baixa nos itens que você escolher. O estoque próprio dele deixa de contar.</p>
          <BuscaProduto autoFocus somenteUnidade placeholder="Nome do produto" aoEscolher={(p) => { setTransformar(false); abrir(p, true); }} />
        </div>
      </Janela>
    </div>
  );
}
