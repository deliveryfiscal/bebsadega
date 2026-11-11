"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSessao } from "@/lib/sessao";
import { Carregando } from "@/components/ui";

export default function Inicio() {
  const { carregando, eu } = useSessao();
  const router = useRouter();
  useEffect(() => {
    if (carregando) return;
    router.replace(!eu ? "/login" : eu.papel === "dono" ? "/inicio" : "/vender");
  }, [carregando, eu, router]);
  return <Carregando />;
}
