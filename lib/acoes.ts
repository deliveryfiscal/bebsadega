"use client";

import { supabase, mensagemErro } from "./supabase";
import type { Codigo, Produto, Referencia } from "./tipos";

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
  imagem_url?: string | null;
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
    imagem_url: produto.imagem_url,
    codigos: [...codigosAtuais.map((c) => ({ codigo: c.codigo, multiplicador: c.multiplicador, descricao: c.descricao })), { codigo, multiplicador, descricao }],
  });
}



/** Consulta a base pública de códigos (5,5 mil bebidas). */
export async function buscarReferencia(codigo: string): Promise<Referencia | null> {
  const { data, error } = await supabase().from("catalogo_referencia").select("*").eq("codigo", codigo.trim()).maybeSingle();
  if (error) return null;
  return data as Referencia | null;
}

/** Reduz a foto no próprio aparelho (máx. 320 px, WEBP) e envia. Devolve o endereço público. */
export async function enviarFoto(arquivo: File): Promise<string> {
  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(1, 320 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((ok, falha) => canvas.toBlob((b) => (b ? ok(b) : falha(new Error("Não foi possível ler a foto."))), "image/webp", 0.8));
  const caminho = `img/${crypto.randomUUID ? crypto.randomUUID() : Date.now()}.webp`;
  const { error } = await supabase().storage.from("produtos").upload(caminho, blob, { contentType: "image/webp", cacheControl: "31536000" });
  if (error) throw new Error(mensagemErro(error));
  return supabase().storage.from("produtos").getPublicUrl(caminho).data.publicUrl;
}
