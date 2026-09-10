"use client";

import Image from "next/image";
import { Cloud, Loader2, LockKeyhole, LogIn, Monitor } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";

export default function LoginPage() {
  const router = useRouter();
  const { dataMode, authReady, signedIn, signIn, syncError } = useStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authReady && signedIn) router.replace("/dashboard");
  }, [authReady, signedIn, router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn(email, password);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  };

  return <main className="min-h-screen bg-[#070a12] p-4 text-white">
    <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-5xl place-items-center">
      <div className="grid w-full overflow-hidden rounded-3xl border border-line bg-[#0d1120] shadow-2xl lg:grid-cols-[1.05fr_.95fr]">
        <section className="relative hidden min-h-[620px] overflow-hidden border-r border-line lg:block">
          <Image src="/brand/bebs-poster.jpg" alt="Beb's Adega e Tabacaria" fill className="object-cover opacity-45" priority />
          <div className="absolute inset-0 bg-gradient-to-t from-[#090c17] via-[#090c17]/70 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-10">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-lime/30 bg-lime/10 px-3 py-1.5 text-xs font-bold text-lime"><Cloud size={15} /> Operação Pro v2.1</div>
            <h1 className="max-w-md text-4xl font-black tracking-tight">Venda rápido. Controle tudo sem complicação.</h1>
            <p className="mt-4 max-w-lg leading-7 text-slate-300">PDV, scanner, estoque, caixa, financeiro, CRM, compras e integrações em um único fluxo.</p>
          </div>
        </section>

        <section className="flex min-h-[620px] items-center p-6 sm:p-10">
          <div className="w-full">
            <div className="mb-8 flex items-center gap-3">
              <div className="relative h-14 w-14 overflow-hidden rounded-full border border-brand/40"><Image src="/brand/bebs-logo-source.jpg" alt="Beb's" fill className="object-cover" /></div>
              <div><p className="text-xl font-black">Beb&apos;s Gestão</p><p className="text-sm text-slate-500">Acesso ao sistema</p></div>
            </div>

            {dataMode === "local" ? <div className="space-y-5">
              <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.05] p-5">
                <div className="flex items-center gap-3 text-cyan-300"><Monitor size={22} /><strong>Modo local de demonstração</strong></div>
                <p className="mt-2 text-sm leading-6 text-slate-400">Os dados ficam neste navegador. Para operação multiusuário, defina <code>NEXT_PUBLIC_DATA_MODE=supabase</code> e configure as variáveis do Supabase.</p>
              </div>
              <button className="btn-lime h-12 w-full" onClick={() => router.push("/dashboard")}><LogIn size={18} /> Entrar no modo local</button>
            </div> : <form className="space-y-4" onSubmit={submit}>
              <label><span className="mb-1.5 block text-sm font-semibold">E-mail</span><input className="input h-12" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="seu@email.com" /></label>
              <label><span className="mb-1.5 block text-sm font-semibold">Senha</span><div className="relative"><LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} /><input className="input h-12 pl-10" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></div></label>
              {(error || syncError) && <div className="rounded-xl border border-red-500/25 bg-red-500/[0.06] p-3 text-sm text-red-200">{error || syncError}</div>}
              <button className="btn-lime h-12 w-full" disabled={loading || !authReady}>{loading ? <Loader2 className="animate-spin" size={18} /> : <LogIn size={18} />} Entrar</button>
              <p className="text-center text-xs text-slate-500">O primeiro usuário deve existir no Supabase Auth e estar vinculado em <code>public.profiles</code>.</p>
            </form>}
          </div>
        </section>
      </div>
    </div>
  </main>;
}
