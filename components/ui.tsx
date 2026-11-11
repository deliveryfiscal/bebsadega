"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

// ---------- Avisos rápidos ----------
type Aviso = { id: number; texto: string; tipo: "ok" | "erro" | "info" };
const AvisoCtx = createContext<(texto: string, tipo?: Aviso["tipo"]) => void>(() => undefined);

export function AvisosProvider({ children }: { children: React.ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const avisar = useCallback((texto: string, tipo: Aviso["tipo"] = "ok") => {
    const id = Date.now() + Math.random();
    setAvisos((l) => [...l, { id, texto, tipo }]);
    setTimeout(() => setAvisos((l) => l.filter((a) => a.id !== id)), tipo === "erro" ? 7000 : 3500);
  }, []);
  return (
    <AvisoCtx.Provider value={avisar}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4">
        {avisos.map((a) => (
          <div key={a.id} role="status"
            className={`pointer-events-auto max-w-lg rounded-xl px-4 py-3 text-sm font-semibold shadow-2xl ${a.tipo === "erro" ? "bg-red-600 text-white" : a.tipo === "info" ? "bg-panel2 text-white border border-line" : "bg-lime text-ink"}`}>
            {a.texto}
          </div>
        ))}
      </div>
    </AvisoCtx.Provider>
  );
}
export const useAviso = () => useContext(AvisoCtx);

// ---------- Janela ----------
export function Janela({ titulo, aberta, aoFechar, children, largura = "max-w-lg" }: {
  titulo: string; aberta: boolean; aoFechar: () => void; children: React.ReactNode; largura?: string;
}) {
  useEffect(() => {
    if (!aberta) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") aoFechar(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [aberta, aoFechar]);
  if (!aberta) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) aoFechar(); }}>
      <div role="dialog" aria-label={titulo} className={`max-h-[94dvh] w-full ${largura} overflow-y-auto rounded-t-2xl border border-line bg-panel p-5 sm:rounded-2xl`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">{titulo}</h2>
          <button className="rounded-lg p-1 text-muted hover:text-white" onClick={aoFechar} aria-label="Fechar"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------- Botão com "carregando" e tratamento de erro ----------
export function BotaoAcao({ acao, children, className = "btn-principal", disabled, type = "button", ...resto }: {
  acao: () => Promise<unknown> | unknown; children: React.ReactNode; className?: string; disabled?: boolean; type?: "button" | "submit";
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "type">) {
  const [ocupado, setOcupado] = useState(false);
  const avisar = useAviso();
  const montado = useRef(true);
  useEffect(() => () => { montado.current = false; }, []);
  return (
    <button {...resto} type={type} className={className} disabled={disabled || ocupado} onClick={async () => {
      setOcupado(true);
      try { await acao(); } catch (e) { avisar(e instanceof Error ? e.message : String(e), "erro"); }
      finally { if (montado.current) setOcupado(false); }
    }}>
      {ocupado ? "Aguarde…" : children}
    </button>
  );
}

export function Titulo({ children, acoes }: { children: React.ReactNode; acoes?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">{children}</h1>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </div>
  );
}

export function Numero({ titulo, valor, detalhe, destaque }: { titulo: string; valor: React.ReactNode; detalhe?: React.ReactNode; destaque?: boolean }) {
  return (
    <div className={`cartao ${destaque ? "border-brand/60" : ""}`}>
      <div className="text-sm text-muted">{titulo}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{valor}</div>
      {detalhe && <div className="mt-1 text-xs text-muted">{detalhe}</div>}
    </div>
  );
}

export function Vazio({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">{children}</div>;
}

export function Carregando() {
  return <div className="p-8 text-center text-muted">Carregando…</div>;
}
