"use client";

import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { ScanBarcode } from "lucide-react";
import { useLoja } from "@/lib/loja";
import { brl, normalizar } from "@/lib/formato";
import type { Produto } from "@/lib/tipos";
import { Foto } from "./foto";

let audio: AudioContext | null = null;
export function bip(ok = true) {
  try {
    audio = audio || new AudioContext();
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.frequency.value = ok ? 1200 : 220;
    g.gain.value = 0.06;
    o.connect(g).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + (ok ? 0.07 : 0.25));
  } catch { /* sem som */ }
}

export type BuscaRef = { focar: () => void };

type Props = {
  aoEscolher: (produto: Produto, quantidade: number) => void;
  aoCodigoDesconhecido?: (codigo: string) => void;
  somenteUnidade?: boolean;
  /** Aceita produtos e doses, mas não combos (itens de um combo). */
  semCombo?: boolean;
  /** Não mostra este produto (ex.: o próprio combo). */
  excluir?: string;
  incluirInativos?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
};

/** Campo único para bipar o código de barras ou digitar o nome. Aceita "3*codigo" para quantidade. */
export const BuscaProduto = forwardRef<BuscaRef, Props>(function BuscaProduto(
  { aoEscolher, aoCodigoDesconhecido, somenteUnidade, semCombo, excluir, incluirInativos, placeholder, autoFocus }, ref,
) {
  const { produtos, produtoPorId, codigoPorTexto } = useLoja();
  const [texto, setTexto] = useState("");
  const [destaque, setDestaque] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => ({ focar: () => input.current?.focus() }));

  const { qtd, termo } = useMemo(() => {
    const m = texto.match(/^\s*(\d{1,3})\s*[*xX]\s*(.+)$/);
    return m ? { qtd: Number(m[1]), termo: m[2].trim() } : { qtd: 1, termo: texto.trim() };
  }, [texto]);

  const resultados = useMemo(() => {
    if (termo.length < 2 || /^\d{6,}$/.test(termo)) return [];
    const palavras = normalizar(termo).split(/\s+/);
    return produtos
      .filter((p) => !p.arquivado && (incluirInativos || p.ativo) && (!somenteUnidade || p.tipo === "unidade") && (!semCombo || p.tipo !== "combo"))
      .filter((p) => p.id !== excluir)
      .filter((p) => {
        const n = normalizar(`${p.nome} ${p.categoria}`);
        return palavras.every((w) => n.includes(w));
      })
      // Mais exato primeiro: nome que começa com o que foi digitado, depois palavras inteiras, depois nomes curtos.
      .map((p) => {
        const n = normalizar(p.nome);
        const t = normalizar(termo);
        const nivel = n.startsWith(t) ? 0 : n.split(/[^a-z0-9]+/).some((w) => w.startsWith(palavras[0])) && n.includes(t) ? 1 : n.includes(t) ? 2 : 3;
        return { p, nivel };
      })
      .sort((a, b) => a.nivel - b.nivel || Number(b.p.favorito) - Number(a.p.favorito) || a.p.nome.length - b.p.nome.length || a.p.nome.localeCompare(b.p.nome))
      .map((x) => x.p)
      .slice(0, 8);
  }, [termo, produtos, somenteUnidade, semCombo, incluirInativos, excluir]);

  function escolher(p: Produto, quantidade: number) {
    if (!p.ativo && !incluirInativos) {
      bip(false);
      setErro(`"${p.nome}" está inativo.`);
      return;
    }
    if ((somenteUnidade && p.tipo !== "unidade") || (semCombo && p.tipo === "combo")) {
      bip(false);
      setErro("Combos não têm estoque próprio. Escolha os produtos do combo.");
      return;
    }
    bip(true);
    aoEscolher(p, quantidade);
    setTexto("");
    setErro(null);
    setDestaque(0);
    input.current?.focus();
  }

  function confirmar() {
    if (!termo) return;
    const cod = codigoPorTexto.get(termo);
    if (cod) {
      const p = produtoPorId.get(cod.produto_id);
      if (p && !p.arquivado) return escolher(p, qtd * cod.multiplicador);
    }
    if (resultados.length > 0) return escolher(resultados[Math.min(destaque, resultados.length - 1)], qtd);
    bip(false);
    if (/^\d{4,}$/.test(termo)) {
      // Com tratamento próprio (janela de cadastro ou aviso), não repete a mensagem embaixo do campo.
      if (aoCodigoDesconhecido) aoCodigoDesconhecido(termo);
      else setErro(`Código ${termo} não cadastrado.`);
    } else {
      setErro(`Nada encontrado para "${termo}".`);
    }
    setTexto("");
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-xl border-2 border-brand/70 bg-ink px-3 focus-within:border-brand">
        <ScanBarcode className="shrink-0 text-brand" size={22} />
        <input
          ref={input}
          autoFocus={autoFocus}
          value={texto}
          inputMode="search"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => { setTexto(e.target.value); setDestaque(0); setErro(null); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); confirmar(); }
            if (e.key === "ArrowDown") { e.preventDefault(); setDestaque((d) => Math.min(d + 1, resultados.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setDestaque((d) => Math.max(d - 1, 0)); }
            if (e.key === "Escape") setTexto("");
          }}
          placeholder={placeholder || "Bipe o código ou digite o nome"}
          className="w-full bg-transparent py-3 text-lg outline-none placeholder:text-muted"
          aria-label="Buscar produto"
        />
      </div>
      {erro && <div className="mt-1 text-sm font-semibold text-red-400">{erro}</div>}
      {resultados.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-line bg-panel2 shadow-2xl">
          {resultados.map((p, i) => (
            <li key={p.id}>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); escolher(p, qtd); }}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left ${i === destaque ? "bg-brand/20" : "hover:bg-white/5"}`}>
                <Foto url={p.imagem_url} nome={p.nome} className="h-10 w-10" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.nome}</span>
                  <span className="text-xs text-muted">{p.categoria || "Sem categoria"}{p.tipo === "unidade" ? ` · estoque ${p.estoque}` : " · combo"}{!p.ativo ? " · inativo" : ""}</span>
                </span>
                <span className="shrink-0 font-bold tabular-nums">{brl(p.preco)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
