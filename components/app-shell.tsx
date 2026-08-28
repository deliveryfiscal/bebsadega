"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Boxes, Building2, CircleDollarSign, LayoutDashboard, Menu, PackageSearch, PlugZap, Settings, ShoppingCart, Users, WalletCards, X } from "lucide-react";
import { useState } from "react";
import { ToastProvider } from "./ui/toast";

const nav = [
  { href: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { href: "/pdv", label: "PDV", icon: ShoppingCart },
  { href: "/produtos", label: "Produtos", icon: PackageSearch },
  { href: "/estoque", label: "Estoque", icon: Boxes },
  { href: "/clientes", label: "Clientes / CRM", icon: Users },
  { href: "/financeiro", label: "Financeiro", icon: CircleDollarSign },
  { href: "/caixa", label: "Caixa", icon: WalletCards },
  { href: "/integracoes", label: "Integrações", icon: PlugZap },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <ToastProvider>
      <div className="min-h-screen lg:grid lg:grid-cols-[258px_1fr]">
        {open && <button className="fixed inset-0 z-30 bg-black/70 lg:hidden" onClick={() => setOpen(false)} aria-label="Fechar menu" />}
        <aside className={`fixed inset-y-0 left-0 z-40 flex w-[258px] flex-col border-r border-line bg-[#090c17] transition-transform lg:sticky lg:top-0 lg:h-screen ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
          <div className="flex h-20 items-center gap-3 border-b border-line px-5">
            <div className="relative h-12 w-12 overflow-hidden rounded-full border border-brand/40"><Image src="/brand/bebs-logo-source.jpg" alt="Beb's" fill className="object-cover" /></div>
            <div><p className="font-black tracking-tight">Beb&apos;s Gestão</p><p className="text-xs text-slate-500">PDV & operação</p></div>
            <button onClick={() => setOpen(false)} className="ml-auto lg:hidden"><X size={20} /></button>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto p-3">
            {nav.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${active ? "bg-brand text-white shadow-lg shadow-brand/10" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}><item.icon size={19} />{item.label}</Link>;
            })}
          </nav>
          <div className="m-3 rounded-xl border border-line bg-white/[0.03] p-3 text-xs text-slate-400">
            <div className="mb-1 flex items-center gap-2 font-bold text-lime"><span className="h-2 w-2 rounded-full bg-lime" /> Sistema ativo</div>
            Catálogo real carregado. No modo local, os dados ficam neste navegador.
          </div>
        </aside>
        <div className="min-w-0">
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-[#080b15]/90 px-4 backdrop-blur-xl md:px-6">
            <button className="rounded-xl border border-line p-2.5 lg:hidden" onClick={() => setOpen(true)}><Menu size={20} /></button>
            <div className="flex items-center gap-2 text-sm text-slate-400"><Building2 size={17} /><span>Beb&apos;s Adega e Tabacaria</span></div>
            <div className="ml-auto flex items-center gap-3">
              <div className="hidden text-right sm:block"><p className="text-sm font-semibold">Pedro Silva</p><p className="text-xs text-slate-500">Administrador</p></div>
              <div className="grid h-9 w-9 place-items-center rounded-full bg-brand font-bold">PS</div>
            </div>
          </header>
          <main className="p-4 md:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
