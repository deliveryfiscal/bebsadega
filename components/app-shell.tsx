"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  Building2,
  CircleDollarSign,
  Cloud,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageCheck,
  PackageSearch,
  PlugZap,
  ReceiptText,
  RefreshCw,
  ScanBarcode,
  Search,
  Settings,
  ShoppingCart,
  Users,
  WalletCards,
  Wine,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { UserRole } from "@/lib/types";
import { useStore } from "@/lib/store";
import { ToastProvider } from "./ui/toast";
import { ManagerPinGate } from "./security/manager-pin";

const nav: Array<{ href: string; label: string; icon: typeof LayoutDashboard; roles: UserRole[] }> = [
  { href: "/dashboard", label: "Visão geral", icon: LayoutDashboard, roles: ["admin", "manager", "finance", "stock"] },
  { href: "/pdv", label: "PDV", icon: ShoppingCart, roles: ["admin", "manager", "cashier"] },
  { href: "/consulta-preco", label: "Consultar preço", icon: Search, roles: ["admin", "manager", "cashier", "stock"] },
  { href: "/vendas", label: "Vendas", icon: ReceiptText, roles: ["admin", "manager", "cashier", "finance"] },
  { href: "/codigos", label: "Cadastrar códigos", icon: ScanBarcode, roles: ["admin", "manager", "stock"] },
  { href: "/produtos", label: "Produtos", icon: PackageSearch, roles: ["admin", "manager", "stock"] },
  { href: "/estoque", label: "Estoque", icon: Boxes, roles: ["admin", "manager", "stock"] },
  { href: "/recebimento", label: "Entrada rápida", icon: PackageCheck, roles: ["admin", "manager", "stock"] },
  { href: "/inventario", label: "Inventário express", icon: PackageCheck, roles: ["admin", "manager", "stock"] },
  { href: "/garrafas", label: "Garrafas abertas", icon: Wine, roles: ["admin", "manager", "cashier", "stock"] },
  { href: "/compras", label: "Compras / fornecedores", icon: Building2, roles: ["admin", "manager", "stock", "finance"] },
  { href: "/clientes", label: "Clientes / CRM", icon: Users, roles: ["admin", "manager", "cashier"] },
  { href: "/financeiro", label: "Financeiro", icon: CircleDollarSign, roles: ["admin", "manager", "finance"] },
  { href: "/caixa", label: "Caixa", icon: WalletCards, roles: ["admin", "manager", "cashier"] },
  { href: "/integracoes", label: "iFood / 99Food", icon: PlugZap, roles: ["admin", "manager"] },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3, roles: ["admin", "manager", "finance"] },
  { href: "/resumo-dia", label: "Resumo do dia", icon: ReceiptText, roles: ["admin", "manager", "finance"] },
  { href: "/alertas", label: "Alertas", icon: AlertTriangle, roles: ["admin", "manager", "stock", "finance"] },
  { href: "/auditoria", label: "Auditoria", icon: ReceiptText, roles: ["admin", "manager"] },
  { href: "/implantacao", label: "Implantação", icon: PackageCheck, roles: ["admin", "manager"] },
  { href: "/configuracoes", label: "Configurações", icon: Settings, roles: ["admin", "manager", "stock"] },
];

const roleLabels: Record<UserRole, string> = {
  admin: "Administrador",
  manager: "Gerente",
  cashier: "Caixa",
  stock: "Estoquista",
  finance: "Financeiro",
};

const protectedScreens: Record<string, string> = {
  "/financeiro": "Financeiro",
  "/relatorios": "Relatórios",
  "/auditoria": "Auditoria",
  "/vendas": "Vendas",
  "/resumo-dia": "Resumo do dia",
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "BG";
}

function syncLabel(status: ReturnType<typeof useStore>["syncStatus"], dataMode: "local" | "supabase") {
  if (dataMode === "local") return "Local";
  if (status === "saving") return "Salvando";
  if (status === "synced") return "Nuvem OK";
  if (status === "conflict") return "Conflito";
  if (status === "error") return "Falha de sync";
  return "Conectando";
}

function ShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state, dataMode, authReady, signedIn, syncStatus, syncError, signOut, refreshRemote } = useStore();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [online, setOnline] = useState(true);
  const role = state.currentOperator?.role || "admin";
  const visibleNav = useMemo(() => nav.filter((item) => item.roles.includes(role)), [role]);

  useEffect(() => {
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, []);

  useEffect(() => {
    if (dataMode === "supabase" && authReady && !signedIn) router.replace("/login");
  }, [dataMode, authReady, signedIn, router]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [] as Array<{ id: string; title: string; hint: string; href: string }>;
    const rows: Array<{ id: string; title: string; hint: string; href: string }> = [];
    state.products.filter((product) => [product.name, product.sku, product.barcode, product.category, product.brand].join(" ").toLowerCase().includes(q)).slice(0, 4).forEach((product) => rows.push({ id: `p_${product.id}`, title: product.name, hint: `Produto · ${product.sku} · estoque ${product.stock}`, href: "/produtos" }));
    state.customers.filter((customer) => [customer.name, customer.phone, customer.email].join(" ").toLowerCase().includes(q)).slice(0, 3).forEach((customer) => rows.push({ id: `c_${customer.id}`, title: customer.name, hint: `Cliente · ${customer.phone}`, href: "/clientes" }));
    state.sales.filter((sale) => [sale.number, sale.externalId, sale.channel, ...sale.items.map((item) => item.name)].join(" ").toLowerCase().includes(q)).slice(0, 3).forEach((sale) => rows.push({ id: `s_${sale.id}`, title: `Venda #${sale.number}`, hint: `${sale.channel} · ${sale.status === "completed" ? "Concluída" : "Cancelada"}`, href: "/vendas" }));
    state.suppliers.filter((supplier) => [supplier.name, supplier.phone, supplier.document].join(" ").toLowerCase().includes(q)).slice(0, 2).forEach((supplier) => rows.push({ id: `f_${supplier.id}`, title: supplier.name, hint: "Fornecedor", href: "/compras" }));
    return rows.slice(0, 10);
  }, [query, state.products, state.customers, state.sales, state.suppliers]);

  if (dataMode === "supabase" && (!authReady || !signedIn)) {
    return <div className="grid min-h-screen place-items-center bg-[#070a12] p-6 text-center text-white"><div><RefreshCw className="mx-auto mb-4 animate-spin text-brand" size={30} /><p className="font-bold">Conectando ao sistema...</p><p className="mt-2 text-sm text-slate-500">Validando sessão e dados da loja.</p></div></div>;
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[258px_1fr]">
      {open && <button className="fixed inset-0 z-30 bg-black/70 lg:hidden" onClick={() => setOpen(false)} aria-label="Fechar menu" />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[258px] flex-col border-r border-line bg-[#090c17] transition-transform lg:sticky lg:top-0 lg:h-screen ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="flex h-20 items-center gap-3 border-b border-line px-5">
          <div className="relative h-12 w-12 overflow-hidden rounded-full border border-brand/40"><Image src="/brand/bebs-logo-source.jpg" alt="Beb's" fill className="object-cover" /></div>
          <div><p className="font-black tracking-tight">Beb&apos;s Gestão</p><p className="text-xs text-slate-500">Operação Pro v2.1</p></div>
          <button onClick={() => setOpen(false)} className="ml-auto lg:hidden" aria-label="Fechar menu"><X size={20} /></button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {visibleNav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${active ? "bg-brand text-white shadow-lg shadow-brand/10" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}><item.icon size={19} />{item.label}</Link>;
          })}
        </nav>
        <div className="m-3 rounded-xl border border-line bg-white/[0.03] p-3 text-xs text-slate-400">
          <div className="mb-1 flex items-center justify-between gap-2"><span className={`font-bold ${syncStatus === "error" || syncStatus === "conflict" ? "text-amber-300" : "text-lime"}`}>{syncLabel(syncStatus, dataMode)}</span><span className={online ? "text-lime" : "text-red-300"}>{online ? "Online" : "Offline"}</span></div>
          {syncError ? <p className="line-clamp-2 text-amber-200">{syncError}</p> : <p>{dataMode === "supabase" ? "Dados centralizados com controle de versão." : "Dados salvos neste navegador."}</p>}
          {dataMode === "supabase" && (syncStatus === "error" || syncStatus === "conflict") && <button className="mt-2 flex items-center gap-1.5 font-bold text-white" onClick={() => refreshRemote()}><RefreshCw size={13} /> Recarregar nuvem</button>}
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-[#080b15]/90 px-4 backdrop-blur-xl md:px-6">
          <button className="rounded-xl border border-line p-2.5 lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menu"><Menu size={20} /></button>
          <div className="hidden items-center gap-2 text-sm text-slate-400 xl:flex"><Building2 size={17} /><span>{state.company.name}</span></div>
          <div className="relative mx-auto w-full max-w-xl xl:mx-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={17} />
            <input className="input h-10 pl-9" value={query} onFocus={() => setSearchOpen(true)} onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }} placeholder="Buscar produto, cliente, venda ou fornecedor" />
            {searchOpen && query.trim().length >= 2 && <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-2xl border border-line bg-[#0d1120] shadow-2xl">
              {results.length ? results.map((result) => <Link key={result.id} href={result.href} onClick={() => { setQuery(""); setSearchOpen(false); }} className="block border-b border-line px-4 py-3 last:border-b-0 hover:bg-white/5"><p className="truncate text-sm font-bold">{result.title}</p><p className="mt-0.5 truncate text-xs text-slate-500">{result.hint}</p></Link>) : <p className="p-4 text-sm text-slate-500">Nenhum resultado.</p>}
            </div>}
          </div>
          <Link href="/alertas" className="relative rounded-xl border border-line p-2.5 text-slate-300 hover:bg-white/5" title="Alertas"><AlertTriangle size={18} /></Link>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block"><p className="text-sm font-semibold">{state.currentOperator.name}</p><p className="text-xs text-slate-500">{roleLabels[role]}</p></div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-brand font-bold">{initials(state.currentOperator.name)}</div>
            {dataMode === "supabase" && <button className="rounded-xl border border-line p-2.5 text-slate-400 hover:bg-white/5 hover:text-white" title="Sair" onClick={async () => { await signOut(); router.replace("/login"); }}><LogOut size={17} /></button>}
          </div>
        </header>
        <main className="p-4 md:p-6 lg:p-8">
          {protectedScreens[pathname] ? (
            <ManagerPinGate key={pathname} scope={pathname} label={protectedScreens[pathname]}>
              {children}
            </ManagerPinGate>
          ) : children}
        </main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return <ToastProvider><ShellContent>{children}</ShellContent></ToastProvider>;
}
