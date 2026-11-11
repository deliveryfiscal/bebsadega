"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3, Boxes, CloudOff, CloudUpload, Coffee, Home, KeyRound, LogOut, Package, Receipt, ShoppingCart, Users, Wallet, Check,
} from "lucide-react";
import { useSessao } from "@/lib/sessao";
import { useLoja } from "@/lib/loja";
import { dataHora } from "@/lib/formato";
import { Janela } from "./ui";
import { LegadoNoAparelho } from "./legado-aparelho";

const MENU = [
  { href: "/inicio", nome: "Início", icone: Home, dono: true },
  { href: "/vender", nome: "Vender", icone: ShoppingCart },
  { href: "/caixa", nome: "Caixa", icone: Wallet },
  { href: "/vendas", nome: "Vendas", icone: Receipt },
  { href: "/consumo", nome: "Consumo", icone: Coffee },
  { href: "/produtos", nome: "Produtos", icone: Package },
  { href: "/estoque", nome: "Estoque", icone: Boxes },
  { href: "/relatorios", nome: "Relatórios", icone: BarChart3, dono: true },
  { href: "/equipe", nome: "Equipe", icone: Users, dono: true },
];

function StatusEnvio() {
  const { online, fila, reenviarFila, descartarOperacao } = useLoja();
  const { eu } = useSessao();
  const [aberta, setAberta] = useState(false);
  const pendentes = fila.length;
  const bloqueadas = fila.filter((f) => f.bloqueada).length;

  let classe = "bg-lime/15 text-lime";
  let conteudo = <><Check size={16} /> Tudo salvo</>;
  if (!online) {
    classe = "bg-amber-500/20 text-amber-300";
    conteudo = <><CloudOff size={16} /> Sem internet{pendentes ? ` · ${pendentes} aguardando` : ""}</>;
  } else if (bloqueadas) {
    classe = "bg-red-600/25 text-red-300";
    conteudo = <><CloudUpload size={16} /> {bloqueadas} com problema</>;
  } else if (pendentes) {
    classe = "bg-amber-500/20 text-amber-300";
    conteudo = <><CloudUpload size={16} /> Enviando {pendentes}…</>;
  }

  return (
    <>
      <button onClick={() => setAberta(true)} className={`etiqueta gap-1.5 px-3 py-1.5 text-sm ${classe}`} data-testid="status-envio">
        {conteudo}
      </button>
      <Janela titulo="Envios deste aparelho" aberta={aberta} aoFechar={() => setAberta(false)}>
        {!pendentes ? (
          <p className="text-muted">Tudo o que foi feito neste aparelho já está salvo na nuvem e aparece nos outros aparelhos.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              Estas operações estão guardadas neste aparelho e serão enviadas automaticamente assim que a internet voltar.
              Não limpe os dados do navegador.
            </p>
            {fila.map((op) => (
              <div key={op.id} className="rounded-xl border border-line p-3">
                <div className="flex justify-between gap-2">
                  <strong>{op.tipo === "venda" ? "Venda" : "Consumo"} · {op.resumo}</strong>
                  <span className="text-xs text-muted">{dataHora(op.criadoEm)}</span>
                </div>
                {op.erro && <p className={`mt-1 text-sm ${op.bloqueada ? "text-red-300" : "text-amber-300"}`}>{op.erro}</p>}
                {op.bloqueada && eu?.papel === "dono" && (
                  <button className="btn-secundario mt-2 py-1 text-sm" onClick={() => {
                    if (confirm("Descartar esta operação? Ela NÃO será registrada.")) descartarOperacao(op.id);
                  }}>Descartar</button>
                )}
              </div>
            ))}
            <button className="btn-principal w-full" onClick={reenviarFila}>Tentar enviar agora</button>
          </div>
        )}
      </Janela>
    </>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { eu, sair } = useSessao();
  const { fila } = useLoja();
  const rota = usePathname();
  const itens = MENU.filter((m) => !m.dono || eu?.papel === "dono");

  async function sairComCuidado() {
    if (fila.length && !confirm(`Há ${fila.length} operação(ões) ainda não enviadas. Elas ficam guardadas neste aparelho e serão enviadas quando ${eu?.nome} entrar de novo aqui. Sair mesmo assim?`)) return;
    await sair();
  }

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-line bg-panel/60 p-3 lg:flex">
        <div className="mb-4 flex items-center gap-2 px-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/bebs-logo-source.jpg" alt="" className="h-9 w-9 rounded-lg object-cover" />
          <strong>Beb&apos;s</strong>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {itens.map((m) => {
            const ativo = rota.startsWith(m.href);
            return (
              <Link key={m.href} href={m.href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${ativo ? "bg-brand text-white" : "text-muted hover:bg-white/5 hover:text-white"}`}>
                <m.icone size={19} /> {m.nome}
              </Link>
            );
          })}
        </nav>
        <div className="mt-4 border-t border-line pt-3 text-sm">
          <div className="px-2 font-semibold">{eu?.nome}</div>
          <div className="px-2 text-xs text-muted">{eu?.papel === "dono" ? "Dono" : "Atendente"}</div>
          <Link href="/conta" className="mt-2 flex items-center gap-2 rounded-lg px-2 py-1.5 text-muted hover:text-white"><KeyRound size={16} /> Minha senha</Link>
          <button onClick={sairComCuidado} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-muted hover:text-white"><LogOut size={16} /> Sair</button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 border-b border-line bg-ink/95 backdrop-blur">
          <div className="flex items-center justify-between gap-2 px-3 py-2 lg:px-6">
            <div className="flex items-center gap-2 lg:hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/bebs-logo-source.jpg" alt="" className="h-8 w-8 rounded-lg object-cover" />
              <span className="text-sm font-semibold">{eu?.nome}</span>
            </div>
            <div className="hidden lg:block" />
            <div className="flex items-center gap-2">
              <StatusEnvio />
              <Link href="/conta" className="rounded-lg p-2 text-muted lg:hidden" aria-label="Minha senha"><KeyRound size={18} /></Link>
              <button onClick={sairComCuidado} className="rounded-lg p-2 text-muted lg:hidden" aria-label="Sair"><LogOut size={18} /></button>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-2 pb-2 lg:hidden">
            {itens.map((m) => {
              const ativo = rota.startsWith(m.href);
              return (
                <Link key={m.href} href={m.href} className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm ${ativo ? "bg-brand text-white" : "bg-panel2 text-muted"}`}>
                  <m.icone size={16} /> {m.nome}
                </Link>
              );
            })}
          </nav>
        </header>
        <LegadoNoAparelho />
        <main className="mx-auto max-w-7xl p-3 lg:p-6">{children}</main>
      </div>
    </div>
  );
}

export function SomenteDono({ children }: { children: React.ReactNode }) {
  const { eu } = useSessao();
  if (eu?.papel !== "dono") return <div className="cartao text-center text-muted">Esta área é só do dono.</div>;
  return <>{children}</>;
}
