/**
 * Fila de operações do aparelho (vendas e consumos).
 * A operação é gravada no aparelho ANTES de ir para a nuvem; se a internet cair,
 * ela fica aqui e é reenviada sozinha. O servidor ignora reenvios (mesmo id).
 */
export type TipoOperacao = "venda" | "consumo";

export type Operacao = {
  id: string;
  tipo: TipoOperacao;
  payload: Record<string, unknown>;
  criadoEm: string;
  tentativas: number;
  erro?: string;
  /** Erro de regra: não adianta reenviar sem alguém olhar. */
  bloqueada?: boolean;
  resumo: string;
};

const chave = (usuarioId: string) => `bebs-v3-fila:${usuarioId}`;

export function lerFila(usuarioId: string): Operacao[] {
  if (typeof window === "undefined") return [];
  try {
    const bruto = window.localStorage.getItem(chave(usuarioId));
    const lista = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

export function gravarFila(usuarioId: string, fila: Operacao[]) {
  try {
    window.localStorage.setItem(chave(usuarioId), JSON.stringify(fila));
  } catch {
    // Armazenamento cheio/bloqueado: a operação continua em memória e segue para a nuvem.
  }
}
