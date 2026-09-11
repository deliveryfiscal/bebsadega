"use client";

import { KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";

type PromptOptions = {
  title?: string;
  description?: string;
  scope?: string;
};

type PinDialogProps = {
  open: boolean;
  title: string;
  description: string;
  scope: string;
  onClose: () => void;
  onAuthorized: () => void;
};

async function verifyPin(pin: string, scope: string) {
  const response = await fetch("/api/manager-pin/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin, scope }),
    cache: "no-store",
  });
  const result = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
  if (!response.ok || !result?.ok) throw new Error(result?.error || "Não foi possível validar o PIN.");
}

export function ManagerPinDialog({ open, title, description, scope, onClose, onAuthorized }: PinDialogProps) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPin("");
    const timer = window.setTimeout(() => inputRef.current?.focus(), 100);
    return () => window.clearTimeout(timer);
  }, [open]);

  const submit = async () => {
    if (!/^\d{4}$/.test(pin)) {
      toast.error("Digite os 4 dígitos do PIN gerencial.");
      return;
    }
    setLoading(true);
    try {
      await verifyPin(pin, scope);
      onAuthorized();
      setPin("");
    } catch (error) {
      setPin("");
      toast.error(error instanceof Error ? error.message : "PIN inválido.");
      window.setTimeout(() => inputRef.current?.focus(), 60);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={() => !loading && onClose()} title={title} width="max-w-md">
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <div className="flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] p-4">
          <LockKeyhole className="mt-0.5 shrink-0 text-amber-300" size={22} />
          <div>
            <p className="font-bold">Acesso gerencial</p>
            <p className="mt-1 text-sm text-slate-400">{description}</p>
          </div>
        </div>

        <label>
          <span className="mb-1.5 block text-sm font-semibold">PIN gerencial</span>
          <div className="relative">
            <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
            <input
              ref={inputRef}
              className="input h-14 pl-12 text-center text-2xl font-black tracking-[0.45em]"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="••••"
              disabled={loading}
            />
          </div>
        </label>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={loading}>Cancelar</button>
          <button className="btn-primary" disabled={loading || pin.length !== 4}>
            <ShieldCheck size={17} /> {loading ? "Validando..." : "Autorizar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function useManagerPin() {
  const resolverRef = useRef<((authorized: boolean) => void) | null>(null);
  const [options, setOptions] = useState<Required<PromptOptions> | null>(null);

  const request = (next?: PromptOptions) => new Promise<boolean>((resolve) => {
    resolverRef.current?.(false);
    resolverRef.current = resolve;
    setOptions({
      title: next?.title || "Ação protegida",
      description: next?.description || "Digite o PIN gerencial para continuar.",
      scope: next?.scope || "acao-gerencial",
    });
  });

  const finish = (authorized: boolean) => {
    const resolver = resolverRef.current;
    resolverRef.current = null;
    setOptions(null);
    resolver?.(authorized);
  };

  return {
    request,
    dialog: options ? (
      <ManagerPinDialog
        open
        title={options.title}
        description={options.description}
        scope={options.scope}
        onClose={() => finish(false)}
        onAuthorized={() => finish(true)}
      />
    ) : null,
  };
}

export function ManagerPinGate({
  scope,
  label,
  children,
}: {
  scope: string;
  label: string;
  children: React.ReactNode;
}) {
  const { recordAudit } = useStore();
  const pin = useManagerPin();
  const [unlocked, setUnlocked] = useState(false);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    setUnlocked(false);
    setAsking(false);
  }, [scope]);

  const unlock = async () => {
    if (asking) return;
    setAsking(true);
    const authorized = await pin.request({
      title: `Acessar ${label}`,
      description: `${label} contém informações protegidas. Informe o PIN gerencial para abrir esta tela.`,
      scope: `tela:${scope}`,
    });
    setAsking(false);
    if (!authorized) return;
    setUnlocked(true);
    recordAudit("Acesso autorizado por PIN", "Segurança", `${label} · PIN gerencial validado`);
  };

  if (unlocked) return <>{children}</>;

  return (
    <>
      <section className="panel mx-auto mt-6 max-w-xl p-8 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] text-amber-300">
          <LockKeyhole size={30} />
        </div>
        <h1 className="mt-5 text-2xl font-black">{label} protegido</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">Esta área exige autorização gerencial. O conteúdo só é carregado na tela depois da validação do PIN.</p>
        <button className="btn-primary mt-6" onClick={() => void unlock()} disabled={asking}>
          <KeyRound size={18} /> {asking ? "Aguardando PIN..." : "Digitar PIN"}
        </button>
      </section>
      {pin.dialog}
    </>
  );
}
