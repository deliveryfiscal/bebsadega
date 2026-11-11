"use client";

import { supabase, mensagemErro } from "./supabase";
import type { Codigo, Produto } from "./tipos";

export async function rpc<T = unknown>(nome: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase().rpc(nome, args);
  if (error) throw new Error(mensagemErro(error));
  return data as T;
}

export type ProdutoForm = {
  id?: string;
  nome: string;
  categoria: string;
  tipo: "unidade" | "combo";
  preco: number;
  custo: number;
  estoque_minimo: number;
  favorito: boolean;
  ativo: boolean;
  estoque_inicial?: number;
  codigos: Pick<Codigo, "codigo" | "multiplicador" | "descricao">[];
  combo?: { produto_id: string; quantidade: number }[];
};

export const salvarProduto = (p: ProdutoForm) => rpc<string>("salvar_produto", { p });

/** Acrescenta um código de barras a um produto existente, mantendo os demais. */
export async function vincularCodigo(produto: Produto, codigosAtuais: Codigo[], codigo: string, multiplicador = 1, descricao = "Unidade") {
  return salvarProduto({
    id: produto.id, nome: produto.nome, categoria: produto.categoria, tipo: produto.tipo, preco: produto.preco, custo: produto.custo,
    estoque_minimo: produto.estoque_minimo, favorito: produto.favorito, ativo: produto.ativo,
    codigos: [...codigosAtuais.map((c) => ({ codigo: c.codigo, multiplicador: c.multiplicador, descricao: c.descricao })), { codigo, multiplicador, descricao }],
  });
}
