import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkPinRate, clearPinRate, matchesPin, readPin } from "@/lib/manager-pin-server";

const schema = z.object({ pin: z.string().regex(/^\d{4}$/), scope: z.string().trim().min(1).max(120).optional() });
const headers = { "Cache-Control": "no-store, max-age=0" };
export async function POST(request: NextRequest) {
  if (!checkPinRate(request)) return NextResponse.json({ ok: false, error: "Muitas tentativas. Aguarde cinco minutos." }, { status: 429, headers });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Digite os 4 dígitos do PIN." }, { status: 422, headers });
  try {
    if (!matchesPin(parsed.data.pin, await readPin())) return NextResponse.json({ ok: false, error: "PIN incorreto." }, { status: 401, headers });
    clearPinRate(request);
    return NextResponse.json({ ok: true, scope: parsed.data.scope || "gerencial" }, { headers });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Validação indisponível." }, { status: 503, headers });
  }
}
