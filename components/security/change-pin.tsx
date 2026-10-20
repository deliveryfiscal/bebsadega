"use client";
import { useState } from "react";
import { KeyRound } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";

export function ChangePin() {
  const toast = useToast();
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  return <section className="panel mt-6 p-5" id="pin"><h2 className="section-title flex items-center gap-2"><KeyRound size={21} /> Trocar PIN do sistema</h2><p className="muted mt-2">O novo PIN vale imediatamente em todos os dispositivos. Informe o PIN atual para autorizar.</p><form className="mt-5 space-y-4" onSubmit={async (event) => {
    event.preventDefault();
    if (saving) return;
    if (newPin !== confirmation) { toast.error("A confirmação não confere."); return; }
    setSaving(true);
    try {
      const client = getSupabaseBrowserClient();
      const session = await client?.auth.getSession();
      const token = session?.data.session?.access_token;
      if (!token) throw new Error("Entre no sistema para trocar o PIN.");
      const response = await fetch("/api/manager-pin/change", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ currentPin, newPin }), cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Não foi possível trocar o PIN.");
      setCurrentPin(""); setNewPin(""); setConfirmation("");
      toast.success("PIN alterado no servidor. Use o novo PIN a partir de agora.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Falha ao trocar PIN."); }
    finally { setSaving(false); }
  }}><div className="grid gap-4 sm:grid-cols-3">{[{ label: "PIN atual", value: currentPin, set: setCurrentPin }, { label: "Novo PIN", value: newPin, set: setNewPin }, { label: "Confirme o novo PIN", value: confirmation, set: setConfirmation }].map((field) => <label key={field.label}><span className="mb-2 block text-sm font-semibold">{field.label}</span><input className="input" type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]{4}" required maxLength={4} value={field.value} disabled={saving} onChange={(event) => field.set(event.target.value.replace(/\D/g, "").slice(0, 4))} /></label>)}</div><button className="btn-primary" disabled={saving || currentPin.length !== 4 || newPin.length !== 4 || confirmation.length !== 4}>{saving ? "Alterando..." : "Salvar novo PIN"}</button></form></section>;
}
