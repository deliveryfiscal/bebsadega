import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { changePin, checkPinRate, clearPinRate, matchesPin, pinClient, readPin } from "@/lib/manager-pin-server";
const schema = z.object({ currentPin: z.string().regex(/^\d{4}$/), newPin: z.string().regex(/^\d{4}$/) });
const headers = { "Cache-Control": "no-store, max-age=0" };
export async function POST(request: NextRequest) {
  if (!checkPinRate(request)) return NextResponse.json({ ok: false, error: "Muitas tentativas. Aguarde cinco minutos." }, { status: 429, headers });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Informe PINs de 4 dígitos." }, { status: 422, headers });
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ ok: false, error: "Entre no sistema para trocar o PIN." }, { status: 401, headers });
    const db = pinClient();
    const { data: auth, error } = await db.auth.getUser(token);
    if (error || !auth.user) return NextResponse.json({ ok: false, error: "Sessão expirada. Entre novamente." }, { status: 401, headers });
    const { data: profile } = await db.from("profiles").select("role,active").eq("id", auth.user.id).single();
    if (!profile?.active || !["admin", "manager"].includes(profile.role)) return NextResponse.json({ ok: false, error: "Somente administrador ou gerente pode trocar o PIN." }, { status: 403, headers });
    const previous = await readPin();
    if (!matchesPin(parsed.data.currentPin, previous)) return NextResponse.json({ ok: false, error: "PIN atual incorreto." }, { status: 401, headers });
    if (parsed.data.currentPin === parsed.data.newPin) return NextResponse.json({ ok: false, error: "Escolha um PIN diferente do atual." }, { status: 422, headers });
    await changePin(parsed.data.newPin, previous, auth.user.id);
    clearPinRate(request);
    return NextResponse.json({ ok: true }, { headers });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Não foi possível trocar o PIN." }, { status: 503, headers });
  }
}
