import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const payloadSchema = z.object({
  platform: z.enum(["iFood", "99Food"]),
  externalId: z.string().min(1).max(120),
  status: z.string().default("completed"),
  createdAt: z.string().datetime().optional(),
  customer: z.object({ name: z.string().optional(), phone: z.string().optional() }).optional(),
  items: z.array(z.object({
    internalProductId: z.string().uuid().optional(),
    externalSku: z.string().optional(),
    name: z.string().min(1),
    quantity: z.number().positive(),
    unitPrice: z.number().nonnegative(),
    doseMl: z.number().positive().optional(),
  })).min(1),
  discount: z.number().nonnegative().default(0),
  total: z.number().nonnegative(),
  paymentMethod: z.string().default("Marketplace"),
});

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.INTEGRATION_WEBHOOK_SECRET;
  if (!expectedSecret) return NextResponse.json({ error: "INTEGRATION_WEBHOOK_SECRET não configurado." }, { status: 503 });
  if (request.headers.get("x-webhook-secret") !== expectedSecret) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Payload inválido.", details: parsed.error.flatten() }, { status: 422 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: "Supabase de produção não configurado." }, { status: 503 });

  const response = await fetch(`${url}/rest/v1/rpc/process_external_order`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ payload: parsed.data }),
    cache: "no-store",
  });

  const result = await response.json().catch(() => null);
  if (!response.ok) return NextResponse.json({ error: "Falha ao processar pedido no banco.", details: result }, { status: 502 });
  return NextResponse.json({ ok: true, result });
}
