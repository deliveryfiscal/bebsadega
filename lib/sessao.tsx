"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { DOMINIO_LOGIN, mensagemErro, supabase } from "./supabase";
import type { Funcionario } from "./tipos";

type Sessao = {
  carregando: boolean;
  eu: Funcionario | null;
  aviso: string | null;
  entrar: (usuario: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
};

const Contexto = createContext<Sessao | null>(null);

async function buscarFuncionario(id: string): Promise<Funcionario | null> {
  const { data, error } = await supabase().from("funcionarios").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Funcionario | null;
}

const CACHE = "bebs-v3-eu";

export function SessaoProvider({ children }: { children: React.ReactNode }) {
  const [carregando, setCarregando] = useState(true);
  const [eu, setEu] = useState<Funcionario | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setEu(null);
      return;
    }
    try {
      const f = await buscarFuncionario(userId);
      if (!f || !f.ativo) {
        setAviso("Este acesso está bloqueado. Fale com o Roberto.");
        await supabase().auth.signOut();
        setEu(null);
        return;
      }
      setEu(f);
      try { localStorage.setItem(CACHE, JSON.stringify(f)); } catch { /* sem armazenamento */ }
    } catch (erro) {
      // Sem internet: usa o último perfil conhecido deste aparelho para continuar vendendo.
      try {
        const cache = JSON.parse(localStorage.getItem(CACHE) || "null") as Funcionario | null;
        if (cache?.id === userId) {
          setEu(cache);
          return;
        }
      } catch { /* ignore */ }
      setAviso(mensagemErro(erro));
      setEu(null);
    }
  }, []);

  useEffect(() => {
    let ativo = true;
    supabase().auth.getSession().then(async ({ data }) => {
      await carregar(data.session?.user.id);
      if (ativo) setCarregando(false);
    });
    const { data } = supabase().auth.onAuthStateChange((evento, sessao) => {
      if (evento === "SIGNED_OUT") setEu(null);
      if (evento === "SIGNED_IN" || evento === "USER_UPDATED") void carregar(sessao?.user.id);
    });
    return () => {
      ativo = false;
      data.subscription.unsubscribe();
    };
  }, [carregar]);

  const entrar = useCallback(async (usuario: string, senha: string) => {
    setAviso(null);
    const login = usuario.trim().toLowerCase();
    if (!login || !senha) throw new Error("Informe usuário e senha.");
    const email = login.includes("@") ? login : `${login}@${DOMINIO_LOGIN}`;
    const { data, error } = await supabase().auth.signInWithPassword({ email, password: senha });
    if (error) {
      if (/invalid login credentials/i.test(error.message)) throw new Error("Usuário ou senha incorretos.");
      throw new Error(mensagemErro(error));
    }
    await carregar(data.user?.id);
  }, [carregar]);

  const sair = useCallback(async () => {
    await supabase().auth.signOut();
    try { localStorage.removeItem(CACHE); } catch { /* ignore */ }
    setEu(null);
  }, []);

  return <Contexto.Provider value={{ carregando, eu, aviso, entrar, sair }}>{children}</Contexto.Provider>;
}

export function useSessao() {
  const c = useContext(Contexto);
  if (!c) throw new Error("useSessao fora do SessaoProvider");
  return c;
}
