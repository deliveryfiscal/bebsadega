"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "bebs-v3-auth" },
    realtime: { params: { eventsPerSecond: 20 } },
  });
  return client;
}

export const DOMINIO_LOGIN = "bebs.local";

/** Mensagem amigável para erros do Supabase / rede. */
export function mensagemErro(erro: unknown): string {
  if (!erro) return "Erro desconhecido.";
  const e = erro as { message?: string; code?: string };
  const msg = e.message || String(erro);
  if (/failed to fetch|network|load failed|fetch failed/i.test(msg)) return "Sem conexão com a internet.";
  if (erroDeSessao(erro)) return "Sua sessão terminou. Entre novamente — nada foi perdido.";
  return msg;
}

/** Erro de regra de negócio (não adianta reenviar). Erros de rede/servidor podem ser reenviados. */
export function erroDefinitivo(erro: unknown): boolean {
  const e = erro as { code?: string; message?: string };
  if (!e?.code) return false;
  if (erroDeSessao(erro)) return false; // sessão caiu: guarda e reenvia depois de entrar de novo
  return e.code === "P0001" || e.code.startsWith("22") || e.code.startsWith("23");
}

/** Pedido chegou sem login válido (sessão encerrada/expirada). */
export function erroDeSessao(erro: unknown): boolean {
  const e = erro as { code?: string; message?: string; status?: number };
  const msg = e?.message || "";
  return e?.code === "42501" || e?.code === "PGRST301" || e?.code === "PGRST302" || e?.status === 401
    || /permission denied for function|jwt expired|invalid jwt|refresh token/i.test(msg);
}
