"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSessao } from "@/lib/sessao";
import { LojaProvider, useLoja } from "@/lib/loja";
import { Shell } from "@/components/shell";
import { Carregando } from "@/components/ui";

function Conteudo({ children }: { children: React.ReactNode }) {
  const { carregado } = useLoja();
  return <Shell>{carregado ? children : <Carregando />}</Shell>;
}

export default function AreaLogada({ children }: { children: React.ReactNode }) {
  const { carregando, eu } = useSessao();
  const router = useRouter();
  useEffect(() => {
    if (!carregando && !eu) router.replace("/login");
  }, [carregando, eu, router]);
  if (carregando || !eu) return <Carregando />;
  return (
    <LojaProvider>
      <Conteudo>{children}</Conteudo>
    </LojaProvider>
  );
}
