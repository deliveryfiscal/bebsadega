"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { erroDefinitivo, mensagemErro, supabase } from "./supabase";
import { gravarFila, lerFila, type Operacao, type TipoOperacao } from "./fila";
import { useSessao } from "./sessao";
import type { Caixa, Codigo, ComboItem, Funcionario, Produto } from "./tipos";

type ResultadoEnvio =
  | { situacao: "enviada"; numero: number }
  | { situacao: "pendente" }
  | { situacao: "recusada"; erro: string };

type Tabela = "vendas" | "consumos" | "caixas" | "caixa_movimentos" | "produtos";

type Loja = {
  carregado: boolean;
  online: boolean;
  produtos: Produto[];
  produtoPorId: Map<string, Produto>;
  codigos: Codigo[];
  codigoPorTexto: Map<string, Codigo>;
  codigosPorProduto: Map<string, Codigo[]>;
  combos: ComboItem[];
  funcionarios: Funcionario[];
  caixa: Caixa | null;
  fila: Operacao[];
  ultimaSincronizacao: Date | null;
  recarregar: () => Promise<void>;
  enviarOperacao: (tipo: TipoOperacao, payload: Record<string, unknown>, resumo: string) => Promise<ResultadoEnvio>;
  reenviarFila: () => void;
  descartarOperacao: (id: string) => void;
  /** Avisa quando outra tela/aparelho mudou uma tabela. Retorna a função de cancelar. */
  aoMudar: (tabela: Tabela, fn: () => void) => () => void;
};

const Contexto = createContext<Loja | null>(null);

const CACHE = "bebs-v3-cache";

async function buscarTudo<T>(tabela: string, colunas = "*"): Promise<T[]> {
  const tamanho = 1000;
  const linhas: T[] = [];
  for (let de = 0; ; de += tamanho) {
    const { data, error } = await supabase().from(tabela).select(colunas).range(de, de + tamanho - 1);
    if (error) throw error;
    linhas.push(...((data || []) as T[]));
    if (!data || data.length < tamanho) break;
  }
  return linhas;
}

function nomeDispositivo() {
  if (typeof navigator === "undefined") return "";
  const ua = navigator.userAgent;
  const tipo = /android/i.test(ua) ? "Android" : /iphone|ipad/i.test(ua) ? "iPhone" : /windows/i.test(ua) ? "Windows" : /mac/i.test(ua) ? "Mac" : "Navegador";
  return `${tipo} · ${window.innerWidth}px`;
}

export function LojaProvider({ children }: { children: React.ReactNode }) {
  const { eu } = useSessao();
  const dono = eu?.papel === "dono";
  const [carregado, setCarregado] = useState(false);
  const [online, setOnline] = useState(true);
  const [produtosBase, setProdutos] = useState<Produto[]>([]);
  // Custo fica em tabela separada, legível só pelo dono.
  const [custos, setCustos] = useState<Map<string, number>>(new Map());
  const [codigos, setCodigos] = useState<Codigo[]>([]);
  const [combos, setCombos] = useState<ComboItem[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [caixa, setCaixa] = useState<Caixa | null>(null);
  const [fila, setFila] = useState<Operacao[]>([]);
  const [ultimaSincronizacao, setUltima] = useState<Date | null>(null);

  const filaRef = useRef<Operacao[]>([]);
  const enviandoRef = useRef(false);
  const ouvintes = useRef(new Map<Tabela, Set<() => void>>());
  const usuarioId = eu?.id;

  const avisar = useCallback((tabela: Tabela) => {
    ouvintes.current.get(tabela)?.forEach((fn) => {
      try { fn(); } catch { /* tela já fechada */ }
    });
  }, []);

  const aoMudar = useCallback<Loja["aoMudar"]>((tabela, fn) => {
    if (!ouvintes.current.has(tabela)) ouvintes.current.set(tabela, new Set());
    ouvintes.current.get(tabela)!.add(fn);
    return () => { ouvintes.current.get(tabela)?.delete(fn); };
  }, []);

  // ---------- Carga ----------
  const carregarCustos = useCallback(async () => {
    if (!dono) return;
    try {
      const linhas = await buscarTudo<{ produto_id: string; custo: number }>("produto_custos", "produto_id,custo");
      setCustos(new Map(linhas.map((l) => [l.produto_id, Number(l.custo)])));
    } catch { /* mantém os últimos custos conhecidos */ }
  }, [dono]);

  const recarregar = useCallback(async () => {
    if (!usuarioId) return;
    try {
      const [p, c, cb, f, cx] = await Promise.all([
        buscarTudo<Produto>("produtos"),
        buscarTudo<Codigo>("produto_codigos", "codigo,produto_id,multiplicador,descricao"),
        buscarTudo<ComboItem>("combo_itens"),
        buscarTudo<Funcionario>("funcionarios"),
        supabase().from("caixas").select("*").eq("status", "aberto").maybeSingle(),
      ]);
      if (cx.error) throw cx.error;
      const num = (x: Produto) => ({ ...x, preco: Number(x.preco) });
      setProdutos(p.map(num));
      if (dono) void carregarCustos();
      setCodigos(c);
      setCombos(cb);
      setFuncionarios(f);
      setCaixa((cx.data as Caixa | null) || null);
      setOnline(true);
      setUltima(new Date());
      setCarregado(true);
      try {
        localStorage.setItem(CACHE, JSON.stringify({ usuarioId, p, c, cb, f, cx: cx.data, em: Date.now() }));
      } catch { /* sem espaço */ }
    } catch (erro) {
      if (/conex|internet/i.test(mensagemErro(erro))) setOnline(false);
      // Sem internet na abertura: usa a última cópia deste aparelho.
      try {
        const cache = JSON.parse(localStorage.getItem(CACHE) || "null");
        if (cache && !carregado) {
          setProdutos(cache.p || []);
          setCodigos(cache.c || []);
          setCombos(cache.cb || []);
          setFuncionarios(cache.f || []);
          setCaixa(cache.cx || null);
          setCarregado(true);
        }
      } catch { /* ignore */ }
    }
  }, [usuarioId, carregado, dono, carregarCustos]);

  // ---------- Fila ----------
  const atualizarFila = useCallback((nova: Operacao[]) => {
    filaRef.current = nova;
    if (usuarioId) gravarFila(usuarioId, nova);
    setFila(nova);
  }, [usuarioId]);

  const enviarUma = useCallback(async (op: Operacao): Promise<ResultadoEnvio> => {
    const rpc = op.tipo === "venda" ? "finalizar_venda" : "registrar_consumo";
    const { data, error } = await supabase().rpc(rpc, { p: op.payload });
    if (error) {
      if (erroDefinitivo(error)) return { situacao: "recusada", erro: mensagemErro(error) };
      throw error;
    }
    return { situacao: "enviada", numero: Number((data as { numero: number }).numero) };
  }, []);

  // Quem está esperando o resultado de cada operação (a tela do PDV, por até 8 s).
  const aguardando = useRef(new Map<string, (r: ResultadoEnvio) => void>());

  const processarFila = useCallback(async () => {
    if (enviandoRef.current || !usuarioId) return;
    enviandoRef.current = true;
    const tentadas = new Set<string>();
    try {
      for (;;) {
        const op = filaRef.current.find((x) => !x.bloqueada && !tentadas.has(x.id));
        if (!op) break;
        tentadas.add(op.id);
        try {
          const r = await enviarUma(op);
          const quem = aguardando.current.get(op.id);
          if (r.situacao === "recusada" && !quem) {
            atualizarFila(filaRef.current.map((x) => x.id === op.id ? { ...x, bloqueada: true, erro: r.erro, tentativas: x.tentativas + 1 } : x));
          } else {
            // Enviada, ou recusada com alguém olhando a tela (ela corrige e tenta de novo).
            atualizarFila(filaRef.current.filter((x) => x.id !== op.id));
          }
          setOnline(true);
          quem?.(r);
          aguardando.current.delete(op.id);
        } catch (erro) {
          atualizarFila(filaRef.current.map((x) => x.id === op.id ? { ...x, erro: mensagemErro(erro), tentativas: x.tentativas + 1 } : x));
          setOnline(false);
          break; // sem conexão: tenta de novo daqui a pouco
        }
      }
    } finally {
      enviandoRef.current = false;
    }
  }, [usuarioId, enviarUma, atualizarFila]);

  const enviarOperacao = useCallback<Loja["enviarOperacao"]>(async (tipo, payload, resumo) => {
    const op: Operacao = {
      id: String(payload.id),
      tipo,
      payload: { ...payload, dispositivo: nomeDispositivo() },
      criadoEm: new Date().toISOString(),
      tentativas: 0,
      resumo,
    };
    // 1) Grava no aparelho antes de qualquer coisa.
    atualizarFila([...filaRef.current, op]);
    // 2) Envia agora; se em 8 s não houver resposta, a venda segue na fila sozinha.
    const resultado = new Promise<ResultadoEnvio>((resolve) => {
      aguardando.current.set(op.id, resolve);
      setTimeout(() => {
        if (aguardando.current.get(op.id) === resolve) {
          aguardando.current.delete(op.id);
          resolve({ situacao: "pendente" });
        }
      }, 8000);
    });
    if (enviandoRef.current) {
      // Já existe uma rodada de envio: ela pega esta operação em seguida.
    } else {
      void processarFila().then(() => {
        // Sem conexão: a rodada terminou sem enviar. Libera a tela imediatamente.
        const quem = aguardando.current.get(op.id);
        if (quem && filaRef.current.some((x) => x.id === op.id)) {
          aguardando.current.delete(op.id);
          quem({ situacao: "pendente" });
        }
      });
    }
    return resultado;
  }, [atualizarFila, processarFila]);

  const reenviarFila = useCallback(() => {
    atualizarFila(filaRef.current.map((x) => ({ ...x, bloqueada: false })));
    void processarFila();
  }, [atualizarFila, processarFila]);

  const descartarOperacao = useCallback((id: string) => {
    atualizarFila(filaRef.current.filter((x) => x.id !== id));
  }, [atualizarFila]);

  // Carrega fila e dados ao entrar.
  useEffect(() => {
    if (!usuarioId) {
      setCarregado(false);
      filaRef.current = [];
      setFila([]);
      return;
    }
    const salva = lerFila(usuarioId);
    filaRef.current = salva;
    setFila(salva);
    void recarregar().then(() => processarFila());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuarioId]);

  // Reenvio automático e rede de segurança contra eventos perdidos.
  useEffect(() => {
    if (!usuarioId) return;
    const aoVoltar = () => { void processarFila(); void recarregar(); };
    const t1 = setInterval(() => { if (filaRef.current.some((x) => !x.bloqueada)) void processarFila(); }, 5000);
    const t2 = setInterval(() => { if (!document.hidden) void recarregar(); }, 60000);
    const visivel = () => { if (!document.hidden) aoVoltar(); };
    window.addEventListener("online", aoVoltar);
    window.addEventListener("offline", () => setOnline(false));
    document.addEventListener("visibilitychange", visivel);
    return () => {
      clearInterval(t1);
      clearInterval(t2);
      window.removeEventListener("online", aoVoltar);
      document.removeEventListener("visibilitychange", visivel);
    };
  }, [usuarioId, processarFila, recarregar]);

  // ---------- Tempo real ----------
  useEffect(() => {
    if (!usuarioId) return;
    const canal: RealtimeChannel = supabase().channel(`loja-${usuarioId}-${Date.now()}`);
    const num = (x: Produto) => ({ ...x, preco: Number(x.preco) });
    let tCustos: ReturnType<typeof setTimeout> | undefined;

    canal
      .on("postgres_changes", { event: "*", schema: "public", table: "produtos" }, (e) => {
        if (e.eventType === "DELETE") {
          setProdutos((l) => l.filter((p) => p.id !== (e.old as Produto).id));
        } else {
          const novo = num(e.new as Produto);
          setProdutos((l) => {
            const i = l.findIndex((p) => p.id === novo.id);
            if (i < 0) return [...l, novo];
            const c = l.slice();
            c[i] = novo;
            return c;
          });
        }
        if (dono) { clearTimeout(tCustos); tCustos = setTimeout(() => void carregarCustos(), 600); }
        avisar("produtos");
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "produto_codigos" }, (e) => {
        if (e.eventType === "DELETE") {
          setCodigos((l) => l.filter((c) => c.codigo !== (e.old as Codigo).codigo));
        } else {
          const novo = e.new as Codigo;
          setCodigos((l) => [...l.filter((c) => c.codigo !== novo.codigo), novo]);
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "combo_itens" }, () => {
        void buscarTudo<ComboItem>("combo_itens").then(setCombos).catch(() => undefined);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "funcionarios" }, () => {
        void buscarTudo<Funcionario>("funcionarios").then(setFuncionarios).catch(() => undefined);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "caixas" }, () => {
        void supabase().from("caixas").select("*").eq("status", "aberto").maybeSingle()
          .then(({ data, error }) => { if (!error) setCaixa((data as Caixa | null) || null); });
        avisar("caixas");
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "caixa_movimentos" }, () => avisar("caixa_movimentos"))
      .on("postgres_changes", { event: "*", schema: "public", table: "vendas" }, () => avisar("vendas"))
      .on("postgres_changes", { event: "*", schema: "public", table: "consumos" }, () => avisar("consumos"))
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void recarregar();
      });

    return () => { void supabase().removeChannel(canal); };
  }, [usuarioId, avisar, recarregar, dono, carregarCustos]);

  const produtos = useMemo(() => produtosBase.map((p) => ({ ...p, custo: custos.get(p.id) ?? 0 })), [produtosBase, custos]);
  const produtoPorId = useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos]);
  const codigoPorTexto = useMemo(() => new Map(codigos.map((c) => [c.codigo, c])), [codigos]);
  const codigosPorProduto = useMemo(() => {
    const m = new Map<string, Codigo[]>();
    for (const c of codigos) {
      if (!m.has(c.produto_id)) m.set(c.produto_id, []);
      m.get(c.produto_id)!.push(c);
    }
    return m;
  }, [codigos]);

  const valor: Loja = {
    carregado, online, produtos, produtoPorId, codigos, codigoPorTexto, codigosPorProduto, combos, funcionarios,
    caixa, fila, ultimaSincronizacao, recarregar, enviarOperacao, reenviarFila, descartarOperacao, aoMudar,
  };
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useLoja() {
  const c = useContext(Contexto);
  if (!c) throw new Error("useLoja fora do LojaProvider");
  return c;
}

/** Recarrega uma lista quando a tabela muda em qualquer aparelho (com pequena espera para agrupar eventos). */
export function useAoMudar(tabelas: Tabela[], fn: () => void) {
  const { aoMudar } = useLoja();
  const ref = useRef(fn);
  ref.current = fn;
  const chave = tabelas.join(",");
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const disparar = () => {
      clearTimeout(t);
      t = setTimeout(() => ref.current(), 400);
    };
    const cancelar = chave.split(",").map((tb) => aoMudar(tb as Tabela, disparar));
    return () => {
      clearTimeout(t);
      cancelar.forEach((c) => c());
    };
  }, [aoMudar, chave]);
}
