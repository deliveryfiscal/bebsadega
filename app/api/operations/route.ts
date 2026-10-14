import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export const runtime = "nodejs";

const positiveMoney = z.number().finite().min(0).max(100000000);
const saleSchema = z.object({
  type: z.literal("sale"),
  idempotencyKey: z.string().min(8).max(120),
  items: z.array(z.object({
    id: z.string().max(150), productId: z.string().min(1).max(150),
    name: z.string().min(1).max(200), mode: z.enum(["unit", "dose", "combo"]),
    quantity: z.number().int().positive(), unitPrice: positiveMoney,
    doseMl: z.number().finite().positive().optional(),
  }).passthrough()).min(1).max(120),
  discount: positiveMoney,
  discountPin: z.string().regex(/^\d{4}$/).optional(),
  payments: z.array(z.object({
    method: z.enum(["Dinheiro", "PIX", "Débito", "Crédito", "Outro"]),
    amount: positiveMoney,
  })).min(1).max(12),
  customerId: z.string().max(150).nullish(),
  channel: z.enum(["Balcão", "iFood", "99Food"]).default("Balcão"),
  externalId: z.string().max(200).nullish(),
  note: z.string().max(1000).nullish(),
  operator: z.string().max(100).nullish(),
  clientId: z.string().min(1).max(200),
});

const cashSchema = z.object({
  type: z.literal("cash"),
  action: z.enum(["open", "withdrawal", "supply", "close"]),
  amount: positiveMoney,
  expectedAmount: positiveMoney.nullish(),
  description: z.string().max(240).nullish(),
  reason: z.string().max(500).nullish(),
  operator: z.string().max(100).nullish(),
  sessionId: z.string().max(150).nullish(),
  idempotencyKey: z.string().min(8).max(120),
  clientId: z.string().min(1).max(200),
  pin: z.string().regex(/^\d{4}$/),
});

const schema = z.discriminatedUnion("type", [saleSchema, cashSchema]);
const attempts = new Map<string, { count: number; until: number }>();
function json(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}
function checkPin(pin: string, expected: string) {
  const a = Buffer.from(pin);
  const b = Buffer.from(expected.trim());
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    if (origin && new URL(origin).host !== request.nextUrl.host) return json("Origem não autorizada.", 403);
    const bearer = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
    if (!bearer) return json("Faça login antes de operar o caixa.", 401);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serverKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anon || !serverKey) return json("Credenciais do servidor incompletas.", 503);
    const raw = await request.text();
    if (raw.length > 90000) return json("Operação muito grande.", 413);
    const parsed = schema.safeParse(JSON.parse(raw));
    if (!parsed.success) return json("Dados incompletos ou inválidos.", 422);
    const input = parsed.data;

    const authClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: userData, error: authError } = await authClient.auth.getUser(bearer);
    if (authError || !userData.user) return json("Sessão expirada. Entre novamente.", 401);
    const actorId = userData.user.id;
    if (input.type === "cash" || (input.type === "sale" && input.discount > 0)) {
      const configured = process.env.MANAGER_PIN;
      if (!configured || !/^\d{4}$/.test(configured.trim())) return json("PIN gerencial não configurado.", 503);
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      const key = actorId + ":" + ip;
      const time = Date.now();
      const previous = attempts.get(key);
      const bucket = previous && previous.until > time ? previous : { count: 0, until: time + 300000 };
      if (bucket.count >= 8) return json("Excesso de tentativas. Aguarde 5 minutos.", 429);
      const suppliedPin = input.type === "cash" ? input.pin : input.discountPin || "";
      if (!checkPin(suppliedPin, configured)) {
        attempts.set(key, { ...bucket, count: bucket.count + 1 });
        return json("PIN gerencial incorreto.", 403);
      }
      attempts.delete(key);
    }
    // Somente a rota Node.js tem a chave de serviço. As duas RPCs do
    // banco revogam EXECUTE de anon/authenticated e validam o perfil ativo.
    const admin = createClient(url, serverKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const params = input.type === "sale" ? {
      p_items: input.items,
      p_discount: input.discount,
      p_payments: input.payments,
      p_idempotency_key: input.idempotencyKey,
      p_operator: input.operator || null,
      p_customer_id: input.customerId || null,
      p_channel: input.channel,
      p_external_id: input.externalId || null,
      p_note: input.note || null,
      p_client_id: input.clientId,
      p_actor_user_id: actorId,
    } : {
      p_action: input.action,
      p_amount: input.amount,
      p_expected_amount: input.expectedAmount ?? null,
      p_description: input.description || null,
      p_reason: input.reason || null,
      p_operator: input.operator || null,
      p_session_id: input.sessionId || null,
      p_idempotency_key: input.idempotencyKey,
      p_client_id: input.clientId,
      p_actor_user_id: actorId,
    };
    const rpc = input.type === "sale" ? "bebs_finalize_sale_atomic" : "bebs_cash_action_atomic";
    const { data, error } = await admin.rpc(rpc, params);
    if (error) return json(error.message || "Operação rejeitada pelo banco.", 409);
    const entry = Array.isArray(data) ? data[0] : data;
    if (!entry) return json("Não foi possível confirmar a operação.", 502);
    return NextResponse.json({ result: entry }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return json("Erro ao processar a operação. Consulte o histórico antes de repetir.", 500);
  }
}
