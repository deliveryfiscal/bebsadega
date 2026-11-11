"use client";

import { useMemo, useState } from "react";
import { Plus, Star } from "lucide-react";
import { useLoja } from "@/lib/loja";
import { useSessao } from "@/lib/sessao";
import { brl, normalizar } from "@/lib/formato";
import type { Produto } from "@/lib/tipos";
import { ProdutoEditor } from "@/components/produto-editor";
import { Janela, Titulo, Vazio } from "@/components/ui";

const FILTROS = [
  { id: "ativos", nome: "À venda" },
  { id: "sem_codigo", nome: "Sem código" },
  { id: "baixo", nome: "Estoque baixo" },
  { id: "sem_custo", nome: "Sem custo" },
  { id: "combos", nome: "Combos" },
  { id: "inativos", nome: "Inativos" },
] as const;

export default function Produtos() {
  const { eu } = useSessao();
  const dono = eu?.papel === "dono";
  const { produtos, codigosPorProduto, codigoPorTexto, produtoPorId } = useLoja();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["id"]>("ativos");
  const [editando, setEditando] = useState<Produto | null>(null);
  const [novo, setNovo] = useState<{ codigo?: string } | null>(null);
  const [vendo, setVendo] = useState<Produto | null>(null);

  const lista = useMemo(() => {
    const termo = busca.trim();
    const porCodigo = termo ? codigoPorTexto.get(termo) : undefined;
    if (porCodigo) {
      const p = produtoPorId.get(porCodigo.produto_id);
      return p ? [p] : [];
    }
    const palavras = normalizar(termo).split(/\s+/).filter(Boolean);
    return produtos
      .filter((p) => !p.arquivado)
      .filter((p) => {
        if (filtro === "ativos") return p.ativo;
        if (filtro === "inativos") return !p.ativo;
        if (filtro === "sem_codigo") return p.ativo && p.tipo === "unidade" && !codigosPorProduto.get(p.id)?.length;
        if (filtro === "baixo") return p.ativo && p.tipo === "unidade" && p.estoque <= p.estoque_minimo;
        if (filtro === "sem_custo") return p.ativo && p.tipo === "unidade" && !p.custo;
        if (filtro === "combos") return p.tipo === "combo";
        return true;
      })
      .filter((p) => !palavras.length || palavras.every((w) => normalizar(`${p.nome} ${p.categoria}`).includes(w)))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [produtos, busca, filtro, codigosPorProduto, codigoPorTexto, produtoPorId]);

  return (
    <div className="space-y-4">
      <Titulo acoes={dono && <button className="btn-principal" onClick={() => setNovo({})}><Plus size={18} /> Novo produto</button>}>Produtos</Titulo>
      <input className="campo text-lg" placeholder="Buscar pelo nome ou bipar o código" value={busca} onChange={(e) => setBusca(e.target.value)} autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter" && dono && /^\d{4,}$/.test(busca.trim()) && !codigoPorTexto.get(busca.trim())) setNovo({ codigo: busca.trim() });
        }} />
      {dono && /^\d{4,}$/.test(busca.trim()) && !codigoPorTexto.get(busca.trim()) && (
        <p className="text-sm text-amber-300">Código {busca.trim()} não cadastrado. Aperte Enter para cadastrar um produto novo com ele, ou abra um produto e adicione o código.</p>
      )}
      <div className="flex gap-2 overflow-x-auto">
        {FILTROS.filter((x) => dono || ["ativos", "baixo", "combos"].includes(x.id)).map((x) => (
          <button key={x.id} onClick={() => setFiltro(x.id)} className={`shrink-0 rounded-lg px-3 py-1.5 text-sm ${filtro === x.id ? "bg-brand text-white" : "bg-panel2 text-muted"}`}>{x.nome}</button>
        ))}
      </div>
      <div className="text-sm text-muted">{lista.length} produto(s)</div>
      {!lista.length ? <Vazio>Nenhum produto.</Vazio> : (
        <div className="cartao overflow-x-auto p-0">
          <table className="tabela">
            <thead><tr><th>Produto</th><th>Categoria</th><th className="text-right">Preço</th>{dono && <th className="text-right">Custo</th>}<th className="text-right">Estoque</th><th>Códigos</th></tr></thead>
            <tbody>
              {lista.map((p) => {
                const cods = codigosPorProduto.get(p.id) || [];
                const baixo = p.tipo === "unidade" && p.estoque <= p.estoque_minimo;
                return (
                  <tr key={p.id} className="cursor-pointer hover:bg-white/5" onClick={() => dono ? setEditando(p) : setVendo(p)}>
                    <td className="font-medium">{p.favorito && <Star size={13} className="mr-1 inline text-brand" />}{p.nome}{!p.ativo && <span className="etiqueta ml-2 bg-white/10 text-muted">inativo</span>}</td>
                    <td className="text-muted">{p.categoria}</td>
                    <td className="text-right font-semibold tabular-nums">{brl(p.preco)}</td>
                    {dono && <td className={`text-right tabular-nums ${p.custo ? "" : "text-muted"}`}>{p.custo ? brl(p.custo) : "—"}</td>}
                    <td className={`text-right tabular-nums ${p.tipo === "combo" ? "text-muted" : p.estoque < 0 ? "text-red-400" : baixo ? "text-amber-300" : ""}`}>{p.tipo === "combo" ? "combo" : p.estoque}</td>
                    <td className="text-xs text-muted">{cods.length ? cods.map((c) => c.codigo).join(", ") : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {dono && <ProdutoEditor produto={editando} novo={novo} aoFechar={() => { setEditando(null); setNovo(null); }} />}
      <Janela titulo={vendo?.nome || ""} aberta={!!vendo} aoFechar={() => setVendo(null)}>
        {vendo && (
          <div className="space-y-2">
            <div className="text-3xl font-black">{brl(vendo.preco)}</div>
            <div className="text-muted">{vendo.categoria} · {vendo.tipo === "combo" ? "combo" : `estoque ${vendo.estoque}`}</div>
            <div className="text-sm">Códigos: {(codigosPorProduto.get(vendo.id) || []).map((c) => c.codigo).join(", ") || "nenhum"}</div>
          </div>
        )}
      </Janela>
    </div>
  );
}
