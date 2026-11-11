"use client";

import { useState } from "react";

/** Foto do produto (leve, carrega sob demanda). Sem foto: iniciais do nome. */
export function Foto({ url, nome, className = "h-10 w-10" }: { url?: string | null; nome: string; className?: string }) {
  const [erro, setErro] = useState(false);
  const [carregou, setCarregou] = useState(false);
  if (!url || erro) {
    const iniciais = nome.replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
    return <div className={`${className} flex shrink-0 items-center justify-center rounded-lg bg-panel text-xs font-bold text-muted`} aria-hidden>{iniciais || "?"}</div>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" loading="lazy" decoding="async" onLoad={() => setCarregou(true)} onError={() => setErro(true)}
      className={`${className} shrink-0 rounded-lg object-contain transition-colors ${carregou ? "bg-white" : "animate-pulse bg-panel"}`} />
  );
}
