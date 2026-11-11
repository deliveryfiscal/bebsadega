"use client";

import { useEffect, useState } from "react";

/**
 * O sistema antigo (2.x) guardava uma cópia da loja no navegador. Se o aparelho tinha vendas que
 * nunca chegaram à nuvem, elas estão aqui. Oferece baixar a cópia para o Roberto conferir/importar.
 */
const PREFIXOS = ["bebs-gestao-cache-v211:", "bebs-gestao-v2"];
const BAIXADO = "bebs-v3-legado-baixado";

type Achado = { chave: string; vendas: number; pendente: boolean; salvoEm?: string };

function procurar(): Achado[] {
  const achados: Achado[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const chave = localStorage.key(i) || "";
      if (!PREFIXOS.some((p) => chave.startsWith(p))) continue;
      try {
        const bruto = JSON.parse(localStorage.getItem(chave) || "null");
        const estado = bruto?.state ?? bruto;
        const vendas = Array.isArray(estado?.sales) ? estado.sales.length : 0;
        achados.push({ chave, vendas, pendente: Boolean(bruto?.pendingRemote), salvoEm: bruto?.savedAt });
      } catch { /* conteúdo ilegível */ }
    }
  } catch { /* sem armazenamento */ }
  return achados;
}

export function LegadoNoAparelho() {
  const [achados, setAchados] = useState<Achado[]>([]);
  const [baixado, setBaixado] = useState(true);
  useEffect(() => {
    setAchados(procurar());
    try { setBaixado(localStorage.getItem(BAIXADO) === "1"); } catch { setBaixado(false); }
  }, []);
  if (!achados.length || baixado) return null;

  function baixar() {
    const dados: Record<string, unknown> = { exportadoEm: new Date().toISOString(), aparelho: navigator.userAgent };
    for (const a of achados) {
      try { dados[a.chave] = JSON.parse(localStorage.getItem(a.chave) || "null"); } catch { dados[a.chave] = localStorage.getItem(a.chave); }
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(dados)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `bebs-sistema-antigo-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    try { localStorage.setItem(BAIXADO, "1"); } catch { /* ignore */ }
    setBaixado(true);
  }

  const pendente = achados.some((a) => a.pendente);
  return (
    <div className="mx-3 mt-3 rounded-xl border border-amber-500/60 bg-amber-500/10 p-3 text-sm lg:mx-6">
      <strong className="text-amber-300">Este aparelho tem uma cópia do sistema antigo</strong>
      {pendente && <span className="text-amber-200"> com alterações que não chegaram à nuvem</span>}.
      {" "}Baixe a cópia e envie para o Roberto, para conferir se alguma venda ficou presa aqui. Os dados não são apagados.
      <div className="mt-2">
        <button className="btn-principal py-1.5 text-sm" onClick={baixar}>Baixar cópia do sistema antigo</button>
      </div>
    </div>
  );
}
