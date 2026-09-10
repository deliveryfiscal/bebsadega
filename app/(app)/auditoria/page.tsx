"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { useStore } from "@/lib/store";
import { dateTime } from "@/lib/utils";

export default function AuditPage() {
  const { state } = useStore();
  const [query, setQuery] = useState("");
  const [entity, setEntity] = useState("Todos");
  const entities = useMemo(() => ["Todos", ...Array.from(new Set(state.auditLogs.map((log) => log.entity))).sort()], [state.auditLogs]);
  const logs = useMemo(() => state.auditLogs.filter((log) => {
    if (entity !== "Todos" && log.entity !== entity) return false;
    return [log.action, log.entity, log.details, log.operator].join(" ").toLowerCase().includes(query.toLowerCase());
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [state.auditLogs, query, entity]);

  return <>
    <PageHeader title="Auditoria" description="Histórico legível das ações importantes: preço, estoque, caixa, vendas, usuários e cadastros." />
    <section className="panel p-4 md:p-5">
      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_220px]"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} /><input className="input pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar ação, item ou operador" /></div><select className="select" value={entity} onChange={(event) => setEntity(event.target.value)}>{entities.map((item) => <option key={item}>{item}</option>)}</select></div>
      <div className="table-wrap"><table className="table"><thead><tr><th>Data</th><th>Operador</th><th>Ação</th><th>Área</th><th>Detalhes</th></tr></thead><tbody>{logs.map((log) => <tr key={log.id}><td>{dateTime(log.createdAt)}</td><td className="font-semibold">{log.operator}</td><td><span className="badge">{log.action}</span></td><td>{log.entity}</td><td className="max-w-xl text-sm text-slate-400">{log.details}</td></tr>)}</tbody></table>{!logs.length && <div className="grid min-h-52 place-items-center text-sm text-slate-500">Nenhuma ação encontrada.</div>}</div>
    </section>
  </>;
}
