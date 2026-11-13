"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { useLoja } from "@/lib/loja";
import { rpc } from "@/lib/acoes";
import type { Produto } from "@/lib/tipos";
import { BuscaProduto } from "./busca-produto";
import { Foto } from "./foto";
import { BotaoAcao, Janela, useAviso } from "./ui";

type Item = { produto_id: string; quantidade: number; ml: number | null };

/** Define o que sai do estoque a cada venda do combo. Usado pelos funcionários (o dono usa o editor completo). */
export function ComboItensEditor({ produto, aoFechar }: { produto: Produto | null; aoFechar: () => void }) {
  const { combos, produtoPorId } = useLoja();
  const avisar = useAviso();
  const [itens, setItens] = useState<Item[]>([]);
  const [garrafas, setGarrafas] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!produto) return;
    setItens(combos.filter((c) => c.combo_id === produto.id).map((c) => ({ produto_id: c.produto_id, quantidade: c.quantidade, ml: c.ml ?? null })));
    void rpc<{ produto_id: string }[]>("garrafas_para_combo", {}).then((l) => setGarrafas(new Set(l.map((g) => g.produto_id)))).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produto?.id]);

  if (!produto) return null;
  const mudar = (id: string, patch: Partial<Item>) => setItens((l) => l.map((x) => x.produto_id === id ? { ...x, ...patch } : x));

  return (
    <Janela titulo={produto.tipo === "combo" ? "Itens do combo" : "Transformar em combo"} aberta={!!produto} aoFechar={aoFechar}>
      <div className="space-y-3" data-testid="itens-combo">
        <div className="flex items-center gap-3 rounded-xl bg-ink p-2">
          <Foto url={produto.imagem_url} nome={produto.nome} className="h-10 w-10" />
          <strong className="leading-tight">{produto.nome}</strong>
        </div>
        <p className="text-sm text-muted">
          O que sai do estoque a cada venda. Ex.: 100 ml do gin + 1 energético + 1 copo + 1 gelo. Garrafas saem em ml da garrafa aberta.
          {produto.tipo !== "combo" && " Ao salvar, este produto passa a dar baixa nesses itens (o estoque próprio dele deixa de contar)."}
        </p>
        <BuscaProduto semCombo excluir={produto.id} placeholder="Adicionar item (garrafa, energético, copo, gelo…)" aoEscolher={(p, q) => setItens((l) => {
          const i = l.findIndex((x) => x.produto_id === p.id);
          if (i >= 0) return l.map((x, k) => k === i ? { ...x, quantidade: x.quantidade + q } : x);
          return [...l, { produto_id: p.id, quantidade: q, ml: garrafas.has(p.id) ? 100 : null }];
        })} />
        <ul className="space-y-1">
          {itens.map((c) => (
            <li key={c.produto_id} className="flex flex-wrap items-center gap-2 rounded-lg bg-ink px-3 py-1.5 text-sm">
              <input className="campo w-14 py-1 text-center" inputMode="numeric" value={c.quantidade} aria-label="Quantidade"
                onChange={(e) => mudar(c.produto_id, { quantidade: Math.max(parseInt(e.target.value.replace(/\D/g, ""), 10) || 1, 1) })} />
              {c.ml !== null && (
                <span className="flex items-center gap-1">
                  <span className="text-muted">×</span>
                  <input className="campo w-20 py-1 text-center" inputMode="numeric" value={c.ml} aria-label="ml"
                    onChange={(e) => mudar(c.produto_id, { ml: Math.max(parseInt(e.target.value.replace(/\D/g, ""), 10) || 1, 1) })} />
                  <span className="text-muted">ml</span>
                </span>
              )}
              <span className="min-w-0 flex-1">{produtoPorId.get(c.produto_id)?.nome || "produto"}</span>
              {garrafas.has(c.produto_id) && (
                <button className="text-xs text-muted underline" onClick={() => mudar(c.produto_id, { ml: c.ml === null ? 100 : null })}>
                  {c.ml === null ? "usar ml" : "garrafa inteira"}
                </button>
              )}
              <button className="p-1 text-muted hover:text-red-400" aria-label="Remover item" onClick={() => setItens((l) => l.filter((x) => x.produto_id !== c.produto_id))}><Trash2 size={15} /></button>
            </li>
          ))}
          {!itens.length && <li className="text-sm text-amber-300">Nenhum item ainda.</li>}
        </ul>
        <BotaoAcao className="btn-principal w-full" disabled={!itens.length} acao={async () => {
          await rpc("salvar_itens_combo", { p_combo: produto.id, p_itens: itens });
          avisar("Itens do combo salvos.");
          aoFechar();
        }}>Salvar itens</BotaoAcao>
      </div>
    </Janela>
  );
}
