"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSessao } from "@/lib/sessao";

export default function Login() {
  const { eu, carregando, entrar, aviso } = useSessao();
  const router = useRouter();
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!carregando && eu) router.replace(eu.papel === "dono" ? "/inicio" : "/vender");
  }, [carregando, eu, router]);

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <form className="cartao w-full max-w-sm space-y-4 p-6" onSubmit={async (e) => {
        e.preventDefault();
        setErro(null);
        setOcupado(true);
        try { await entrar(usuario, senha); } catch (x) { setErro(x instanceof Error ? x.message : String(x)); } finally { setOcupado(false); }
      }}>
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/bebs-logo-source.jpg" alt="" className="h-14 w-14 rounded-xl object-cover" />
          <div>
            <h1 className="text-xl font-bold">Beb&apos;s Gestão</h1>
            <p className="text-sm text-muted">Entre com seu usuário</p>
          </div>
        </div>
        <div>
          <label className="rotulo" htmlFor="usuario">Usuário</label>
          <input id="usuario" className="campo" autoCapitalize="none" autoCorrect="off" autoComplete="username"
            value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="ex.: roberto" autoFocus />
        </div>
        <div>
          <label className="rotulo" htmlFor="senha">Senha</label>
          <input id="senha" type="password" className="campo" autoComplete="current-password"
            value={senha} onChange={(e) => setSenha(e.target.value)} />
        </div>
        {(erro || aviso) && <p className="rounded-lg bg-red-600/20 p-2 text-sm text-red-300">{erro || aviso}</p>}
        <button className="btn-principal w-full py-3 text-lg" disabled={ocupado}>{ocupado ? "Entrando…" : "Entrar"}</button>
      </form>
    </main>
  );
}
