"use client";

import { useMemo, useState } from "react";
import { Plus, Pencil, UserCheck, UserX, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { defaultPermissions, employeeConsumptionTotals, employeePositionLabels, employeePermissionLabels, ALL_EMPLOYEE_PERMISSIONS } from "@/lib/employees";
import { useStore } from "@/lib/store";
import type { Employee, EmployeePermission, EmployeePosition } from "@/lib/types";
import { currency } from "@/lib/utils";

const positions: EmployeePosition[] = ["manager", "cashier", "stock", "general"];

export default function EmployeesPage() {
  const { state, saveEmployee, setEmployeeActive, selectEmployee } = useStore();
  const toast = useToast();
  const [editing, setEditing] = useState<Employee | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [position, setPosition] = useState<EmployeePosition>("general");
  const [limit, setLimit] = useState("");
  const [permissions, setPermissions] = useState<EmployeePermission[]>(defaultPermissions("general"));
  const employees = useMemo(() => [...state.employees].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name)), [state.employees]);

  const start = (item?: Employee) => {
    setEditing(item || null);
    setName(item?.name || "");
    setNickname(item?.nickname || "");
    setPosition(item?.position || "general");
    setLimit(item?.monthlyConsumptionLimit ? String(item.monthlyConsumptionLimit) : "");
    setPermissions(item?.permissions || defaultPermissions("general"));
    setOpen(true);
  };

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const amount = limit.trim() === "" ? 0 : Number(limit);
      if (!Number.isFinite(amount) || amount < 0) throw new Error("Limite mensal inválido.");
      saveEmployee({
        ...editing,
        name,
        nickname,
        position,
        monthlyConsumptionLimit: amount,
        permissions,
      });
      toast.success(editing ? "Funcionário atualizado." : "Funcionário cadastrado.");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    }
  };

  return (
    <>
      <PageHeader title="Funcionários" description="Equipe, funções, permissões e controle de consumo interno." actions={<button className="btn-primary" onClick={() => start()}><Plus size={18} /> Novo funcionário</button>} />
      <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
        Os perfis aqui são operacionais. O acesso ao login continua controlado pelo Supabase Auth.
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {employees.map((employee) => {
          const totals = employeeConsumptionTotals(state, employee.id);
          return (
            <article className="panel p-4" key={employee.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand"><Users size={20}/></div>
                  <div className="min-w-0">
                    <p className="truncate font-bold">{employee.name}</p>
                    <p className="text-sm text-slate-400">{employeePositionLabels[employee.position] || employee.title}</p>
                  </div>
                </div>
                <span className={employee.active ? "text-xs font-bold text-lime" : "text-xs font-bold text-amber-300"}>{employee.active ? "Ativo" : "Inativo"}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="panel-soft p-3"><p className="text-xs text-slate-400">Consumo registrado</p><p className="mt-1 font-bold">{currency(totals.cost)}</p></div>
                <div className="panel-soft p-3"><p className="text-xs text-slate-400">Cobrança pendente</p><p className="mt-1 font-bold">{currency(totals.pendingCharge)}</p></div>
              </div>
              <p className="mt-3 text-xs text-slate-400">Limite mensal: {employee.monthlyConsumptionLimit ? currency(employee.monthlyConsumptionLimit) : "sem limite configurado"}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn-ghost" onClick={() => start(employee)}><Pencil size={15}/> Editar</button>
                {employee.active && <button className="btn-ghost" onClick={() => {
                  try { selectEmployee(employee.id); toast.success(`Operador: ${employee.name}`); }
                  catch (error) { toast.error(error instanceof Error ? error.message : "Erro ao trocar operador."); }
                }}>Usar operador</button>}
                {!employee.isOwner && employee.position !== "owner" && <button className="btn-ghost" onClick={() => {
                  if (!window.confirm(`${employee.active ? "Desativar" : "Reativar"} ${employee.name}?`)) return;
                  try { setEmployeeActive(employee.id, !employee.active); toast.success("Status alterado."); }
                  catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível alterar."); }
                }}>{employee.active ? <UserX size={15}/> : <UserCheck size={15}/>} {employee.active ? "Desativar" : "Reativar"}</button>}
              </div>
            </article>
          );
        })}
      </div>
      {!employees.length && <p className="panel p-6 text-slate-400">Nenhum funcionário cadastrado.</p>}
      {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3" role="dialog" aria-modal="true">
        <form className="panel max-h-[92vh] w-full max-w-xl space-y-4 overflow-y-auto p-5" onSubmit={save}>
          <h2 className="text-xl font-bold">{editing ? "Editar funcionário" : "Novo funcionário"}</h2>
          <label className="block"><span className="mb-1 block text-sm">Nome</span><input className="input" required maxLength={100} value={name} onChange={(event) => setName(event.target.value)}/></label>
          <label className="block"><span className="mb-1 block text-sm">Apelido (opcional)</span><input className="input" value={nickname} onChange={(event) => setNickname(event.target.value)}/></label>
          <label className="block"><span className="mb-1 block text-sm">Função</span><select className="select" value={position} disabled={editing?.isOwner || editing?.position === "owner"} onChange={(event) => { const next = event.target.value as EmployeePosition; setPosition(next); setPermissions(defaultPermissions(next)); }}>
            {editing?.isOwner && <option value="owner">Proprietário</option>}
            {positions.map((key) => <option key={key} value={key}>{employeePositionLabels[key]}</option>)}
          </select></label>
          <label className="block"><span className="mb-1 block text-sm">Limite mensal de consumo (R$; vazio = sem limite)</span><input className="input" inputMode="decimal" type="number" min="0" step="0.01" value={limit} onChange={(event) => setLimit(event.target.value)}/></label>
          <fieldset className="rounded-xl border border-line p-3">
            <legend className="px-2 text-sm font-bold">Permissões operacionais</legend>
            <div className="grid max-h-48 grid-cols-1 gap-2 overflow-auto sm:grid-cols-2">
              {ALL_EMPLOYEE_PERMISSIONS.map((permission) => (
                <label className="flex items-center gap-2 text-xs" key={permission}>
                  <input type="checkbox" disabled={Boolean(editing?.isOwner)} checked={Boolean(editing?.isOwner || permissions.includes(permission))} onChange={(event) => setPermissions((current) => event.target.checked ? [...new Set([...current, permission])] : current.filter((value) => value !== permission))}/>
                  {employeePermissionLabels[permission]}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex justify-end gap-2"><button className="btn-ghost" type="button" onClick={() => setOpen(false)}>Cancelar</button><button className="btn-primary" type="submit">Salvar</button></div>
        </form>
      </div>}
    </>
  );
}
