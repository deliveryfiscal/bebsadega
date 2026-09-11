import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  pin: z.string().regex(/^\d{4}$/),
  scope: z.string().trim().min(1).max(120).optional(),
});

type AttemptBucket = { count: number; resetAt: number };
const attempts = new Map<string, AttemptBucket>();
const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function requestKey(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

function safeEqual(value: string, expected: string) {
  const a = Buffer.from(value, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const expectedPin = process.env.MANAGER_PIN;
  if (!expectedPin) {
    return NextResponse.json(
      { ok: false, error: "PIN gerencial não configurado no servidor." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const key = requestKey(request);
  const now = Date.now();
  const current = attempts.get(key);
  const bucket = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + WINDOW_MS }
    : current;

  if (bucket.count >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { ok: false, error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Digite os 4 dígitos do PIN." }, { status: 422 });
  }

  if (!safeEqual(parsed.data.pin, expectedPin.trim())) {
    bucket.count += 1;
    attempts.set(key, bucket);
    return NextResponse.json(
      { ok: false, error: "PIN incorreto." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  attempts.delete(key);
  return NextResponse.json(
    { ok: true, scope: parsed.data.scope || "gerencial" },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
