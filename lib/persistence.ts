import type { AppState } from "./types";

const LEGACY_STORAGE_KEY = "bebs-gestao-v2";
const CLIENT_ID_KEY = "bebs-gestao-client-id";
const CACHE_PREFIX = "bebs-gestao-cache-v211";

export type LocalStateEnvelope = {
  schema: 1;
  state: AppState;
  savedAt: string;
  remoteVersion: number;
  pendingRemote: boolean;
  clientId: string;
  companyId?: string;
  userId?: string;
};

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

export function getOrCreateClientId() {
  if (!canUseStorage()) return "server";
  const current = window.localStorage.getItem(CLIENT_ID_KEY);
  if (current) return current;
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `client_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(CLIENT_ID_KEY, id);
  return id;
}

export function localModeStorageKey() {
  return LEGACY_STORAGE_KEY;
}

export function companyStorageKey(companyId: string, userId?: string) {
  const company = companyId.trim() || "unknown-company";
  const user = userId?.trim() || "shared";
  return `${CACHE_PREFIX}:${company}:${user}`;
}

export function readLegacyState(): Partial<AppState> | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    return raw ? JSON.parse(raw) as Partial<AppState> : null;
  } catch {
    return null;
  }
}

export function readEnvelope(key: string): LocalStateEnvelope | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalStateEnvelope>;
    if (parsed.schema !== 1 || !parsed.state || !parsed.savedAt) return null;
    return {
      schema: 1,
      state: parsed.state as AppState,
      savedAt: String(parsed.savedAt),
      remoteVersion: Number(parsed.remoteVersion || 0),
      pendingRemote: Boolean(parsed.pendingRemote),
      clientId: String(parsed.clientId || getOrCreateClientId()),
      companyId: parsed.companyId,
      userId: parsed.userId,
    };
  } catch {
    return null;
  }
}

export function writeEnvelope(
  key: string,
  state: AppState,
  options?: {
    savedAt?: string;
    remoteVersion?: number;
    pendingRemote?: boolean;
    companyId?: string;
    userId?: string;
    clientId?: string;
  },
) {
  if (!canUseStorage()) return;
  const envelope: LocalStateEnvelope = {
    schema: 1,
    state,
    savedAt: options?.savedAt || new Date().toISOString(),
    remoteVersion: Math.max(0, Number(options?.remoteVersion || 0)),
    pendingRemote: Boolean(options?.pendingRemote),
    clientId: options?.clientId || getOrCreateClientId(),
    companyId: options?.companyId,
    userId: options?.userId,
  };
  window.localStorage.setItem(key, JSON.stringify(envelope));
}

export function writeLegacyState(state: AppState) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(state));
}

export function timestampMs(value?: string | null) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
