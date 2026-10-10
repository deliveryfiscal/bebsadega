export const currency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

export const dateTime = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));

export const dateOnly = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value));

export const uid = (prefix = "id") =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const todayIso = () => new Date().toISOString().slice(0, 10);

/** Escape text before inserting dynamic values in printable HTML templates. */
const htmlEntities: Record<string, string> = {
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
};
export const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => htmlEntities[char] || char);
