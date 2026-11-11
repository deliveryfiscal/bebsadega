"use client";

import { useState } from "react";
import { useSessao } from "@/lib/sessao";
import { supabase, mensagemErro } from "@/lib/supabase";
import { BotaoAcao, Titulo, useAviso } from "@/components/ui";

export default function Conta() {
  const { eu } = useSessao();
  const avisar = useAviso();
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  return (
    <div className="max-w-md space-y-4">
      <Titulo>Minha senha</Titulo>
      <div className="cartao space-y-3">
        <p className="text-sm text-muted">{eu?.nome} · usuário <span className="font-mono text-white">{eu?.usuario}</span></p>
        <input type="password" className="campo" placeholder="Nova senha (mínimo 6)" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" aria-label="Nova senha" />
        <input type="password" className="campo" placeholder="Repita a nova senha" value={confirma} onChange={(e) => setConfirma(e.target.value)} autoComplete="new-password" aria-label="Repita a senha" />
        <BotaoAcao className="btn-principal w-full" acao={async () => {
          if (senha.length < 6) throw new Error("A senha precisa ter pelo menos 6 caracteres.");
          if (senha !== confirma) throw new Error("As senhas não conferem.");
          const { error } = await supabase().auth.updateUser({ password: senha });
          if (error) throw new Error(mensagemErro(error));
          setSenha(""); setConfirma("");
          avisar("Senha alterada.");
        }}>Trocar senha</BotaoAcao>
      </div>
    </div>
  );
}
