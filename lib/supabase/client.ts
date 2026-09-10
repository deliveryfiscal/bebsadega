"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

export function getDataMode(): "local" | "supabase" {
  const configured = process.env.NEXT_PUBLIC_DATA_MODE?.trim().toLowerCase();
  if (configured === "local") return "local";
  if (configured === "supabase") return "supabase";

  // Em produção, se as credenciais públicas existem e o modo não foi definido,
  // prefere Supabase para não cair silenciosamente no modo demonstração/local.
  const hasSupabase = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL
    && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  return hasSupabase ? "supabase" : "local";
}

export function getSupabaseBrowserClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!browserClient) browserClient = createBrowserClient(url, key);
  return browserClient;
}
