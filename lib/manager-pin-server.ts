import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

type PinRecord = { pin_hash: string; salt: string };
const attempts = new Map<string, { count: number; resetAt: number }>();
export function pinClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configuração do PIN indisponível no servidor.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (url, options) => fetch(url, { ...options, cache: "no-store" }) } });
}
export function checkPinRate(request: NextRequest) {
  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const now = Date.now();
  for (const [k, value] of attempts) if (value.resetAt <= now) attempts.delete(k);
  const bucket = attempts.get(key) || { count: 0, resetAt: now + 300000 };
  if (bucket.count >= 8) return false;
  bucket.count++;
  attempts.set(key, bucket);
  return true;
}
export function clearPinRate(request: NextRequest) {
  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  attempts.delete(key);
}
export async function readPin(): Promise<PinRecord | null> {
  const { data, error } = await pinClient().from("manager_pin_settings").select("pin_hash,salt").eq("id", 1).maybeSingle();
  if (error) throw new Error("Não foi possível consultar o PIN. Tente novamente.");
  return data;
}
export function matchesPin(pin: string, record: PinRecord | null) {
  const expected = record ? Buffer.from(record.pin_hash, "hex") : Buffer.from(process.env.MANAGER_PIN?.trim() || "");
  const actual = record ? scryptSync(pin, record.salt, 64) : Buffer.from(pin);
  if (!expected.length) throw new Error("PIN gerencial não configurado no servidor.");
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}
export async function changePin(pin: string, previous: PinRecord | null, userId: string) {
  const salt = randomBytes(32).toString("hex");
  const values = { pin_hash: scryptSync(pin, salt, 64).toString("hex"), salt, updated_at: new Date().toISOString(), updated_by: userId };
  const db = pinClient();
  const result = previous
    ? await db.from("manager_pin_settings").update(values).eq("id", 1).eq("pin_hash", previous.pin_hash).select("id")
    : await db.from("manager_pin_settings").insert({ id: 1, ...values }).select("id");
  if (result.error || !result.data?.length) throw new Error("O PIN não foi alterado. Confira o PIN atual e tente novamente.");
}
