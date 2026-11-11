const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const brl = (v: number | string | null | undefined) => moeda.format(Number(v || 0));

/** Arredonda para centavos sem erro de ponto flutuante. */
export const centavos = (v: number) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;

/** Converte "12,50" ou "12.50" em número. */
export function lerValor(texto: string): number {
  const limpo = String(texto ?? "").trim().replace(/\s/g, "").replace(/R\$/i, "");
  if (!limpo) return 0;
  const normal = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  const n = Number(normal);
  return Number.isFinite(n) ? centavos(n) : NaN;
}

const TZ = "America/Sao_Paulo";

/** Data de hoje (AAAA-MM-DD) no horário de Brasília. */
export function hojeISO(base = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(base);
}

export function somarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00-03:00`);
  d.setUTCDate(d.getUTCDate() + n);
  return hojeISO(d);
}

/** Intervalo [início, fim) em ISO para um dia ou período em Brasília (UTC-3, sem horário de verão). */
export function intervalo(inicio: string, fim = inicio) {
  return { de: `${inicio}T00:00:00-03:00`, ate: `${somarDias(fim, 1)}T00:00:00-03:00` };
}

export function dataHora(iso: string | null | undefined) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function hora(iso: string | null | undefined) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function diaCurto(dia: string) {
  const d = new Date(`${dia}T12:00:00-03:00`);
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "short", day: "2-digit", month: "2-digit" }).format(d);
}

export const FORMAS: { id: "dinheiro" | "pix" | "debito" | "credito"; nome: string }[] = [
  { id: "dinheiro", nome: "Dinheiro" },
  { id: "pix", nome: "PIX" },
  { id: "debito", nome: "Débito" },
  { id: "credito", nome: "Crédito" },
];

export const nomeForma = (f: string) => ({ dinheiro: "Dinheiro", pix: "PIX", debito: "Débito", credito: "Crédito", outro: "Outro" } as Record<string, string>)[f] || f;

export function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function novoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  const b = new Uint8Array(16);
  (globalThis.crypto as Crypto).getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
