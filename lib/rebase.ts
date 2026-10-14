import type { AppState, CashSession } from "./types";

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const collectionKeys = [
  "products", "customers", "sales", "suspendedSales", "cashHistory",
  "financialEntries", "suppliers", "purchases", "integrations",
  "auditLogs", "employees", "consumptions",
] as const;

type Entity = { id?: string; platform?: string };
const identity = (entity: Entity) => entity.id || entity.platform || "";
function mergeArray<T extends Entity>(base: T[], mine: T[], remote: T[]): T[] | null {
  if ([...base, ...mine, ...remote].some((x) => !identity(x))) return null;
  const b = new Map(base.map((x) => [identity(x), x]));
  const m = new Map(mine.map((x) => [identity(x), x]));
  const r = new Map(remote.map((x) => [identity(x), x]));
  const changed = new Map<string, T>();
  const removed = new Set<string>();
  for (const [id, old] of b) {
    const desired = m.get(id);
    if (desired && same(desired, old)) continue;
    const now = r.get(id);
    if (!same(now, old) && !same(now, desired)) return null;
    if (desired) changed.set(id, desired);
    else removed.add(id);
  }
  for (const [id, desired] of m) {
    if (b.has(id)) continue;
    const existing = r.get(id);
    if (existing && !same(existing, desired)) return null;
    changed.set(id, desired);
  }
  const result = remote.filter((x) => !removed.has(identity(x))).map((x) => changed.get(identity(x)) || x);
  const fresh = mine.filter((x) => !b.has(identity(x)) && !r.has(identity(x)));
  return [...fresh, ...result];
}

function mergeCashSession(base: CashSession | null, mine: CashSession | null, remote: CashSession | null): CashSession | null | undefined {
  if (same(base, mine)) return remote;
  if (same(base, remote)) return mine;
  // Duas operacoes adicionaram movimentacoes ao MESMO caixa aberto.
  // Se houve fechamento, reabertura ou alteracao nas movimentacoes antigas,
  // nao ha merge seguro: falhar sem perda silenciosa.
  if (!base || !mine || !remote || base.id !== mine.id || base.id !== remote.id
    || base.status !== "open" || mine.status !== "open" || remote.status !== "open") return undefined;
  const plain = (x: CashSession) => ({ ...x, movements: [] });
  if (!same(plain(base), plain(mine)) || !same(plain(base), plain(remote))) return undefined;
  const b = new Map(base.movements.map((m) => [m.id, m]));
  for (const movement of [...mine.movements, ...remote.movements]) {
    if (b.has(movement.id) && !same(b.get(movement.id), movement)) return undefined;
  }
  const merged = mergeArray(base.movements, mine.movements, remote.movements);
  return merged ? { ...remote, movements: merged } : undefined;
}

/**
 * Reaplica SOMENTE os registros que este terminal editou. Uma edição
 * concorrente do MESMO registro não é adivinhada: retorna null (conflito).
 * Nunca transfere perfis operacionais locais para outro computador.
 */
export function rebaseSnapshot(base: AppState, mine: AppState, remote: AppState): AppState | null {
  const result = { ...remote } as AppState;
  for (const key of collectionKeys) {
    const before = base[key] as Entity[];
    const after = mine[key] as Entity[];
    if (same(before, after)) continue;
    const merged = mergeArray(before, after, remote[key] as Entity[]);
    if (!merged) return null;
    (result as unknown as Record<string, unknown>)[key] = merged;
  }
  const cash = mergeCashSession(base.cashSession, mine.cashSession, remote.cashSession);
  if (cash === undefined) return null;
  result.cashSession = cash;
  for (const key of ["catalogRevision","scannerSettings","company"] as const) {
    if (same(base[key],mine[key])) continue;
    if (!same(base[key],remote[key]) && !same(mine[key],remote[key])) return null;
    (result as unknown as Record<string, unknown>)[key] = mine[key];
  }
  // Operador é sempre identificado por sessão: nunca regrava nome de outro PC.
  result.currentOperator = mine.currentOperator;
  return result;
}
