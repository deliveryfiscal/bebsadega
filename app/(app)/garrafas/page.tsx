"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useLoja, useAoMudar } from "@/lib/loja";
import { supabase } from "@/lib/supabase";
import { rpc } from "@/lib/acoes";
import { brl, dataHora, lerValor, normalizar } from "@/lib/formato";
import type { Produto } from "@/lib/tipos";
import { SomenteDono } from "@/components/shell";
import { BuscaProduto } from "@/components/busca-produto";
import { Foto } from "@/components/foto";
import { BotaoAcao, Carregando, Janela, Titulo, Vazio, useAviso } from "@/components/ui";

type Garrafa = { produto_id: string; volume_ml: number; ml_aberto: number };
type Dose = { produto_id: string; garrafa_id: string; dose_ml: number };
type Mov = { id: number; criado_em: string; tipo: string; quantidade: number; ml: number | null; ml_apos: number | null; observacao: string | null; funcionario_nome: string };

/** "Smirnoff · 1 L" → 1000; "Jack 700 ml" → 700. */
function volumeDoNome(nome: string) {
  const ml = nome.match(/(\d+(?:[.,]\d+)?)\s*ml/i);
  if (ml) return Math.round(Number(ml[1].replace(",", ".")));
  const l = nome.match(/(\d+(?:[.,]\d+)?)\s*l(?:itro)?s?\b/i);
  if (l) return Math.round(Number(l[1].replace(",", ".")) * 1000);
  return 1000;
}

export default function GarrafasPagina() {
  return <SomenteDono><Garrafas /></SomenteDono>;
}

function Garrafas() {
  const { produtoPorId, produtos } = useLoja();
  const avisar = useAviso();
  const [garrafas, setGarrafas] = useState<Garrafa[] | null>(null);
  const [doses, setDoses] = useState<Dose[]>([]);
  const [busca, setBusca] = useState("");
  const [adicionar, setAdicionar] = useState(false);
  const [editarDose, setEditarDose] = useState<{ garrafa: Garrafa; dose?: Dose } | null>(null);
  const [ajustar, setAjustar] = useState<Garrafa | null>(null);
  const [historico, setHistorico] = useState<Garrafa | null>(null);

  const carregar = useCallback(async () => {
    const [g, d] = await Promise.all([
      supabase().from("garrafas").select("produto_id,volume_ml,ml_aberto"),
      supabase().from("doses").select("produto_id,garrafa_id,dose_ml"),
    ]);
    setGarrafas((g.data as Garrafa[]) || []);
    setDoses((d.data as Dose[]) || []);
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);
  // Vendas de dose mudam os ml: atualiza em tempo real.
  useAoMudar(["produtos", "vendas"], () => { void carregar(); });
  useEffect(() => {
    const canal = supabase().channel(`garrafas-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "garrafas" }, () => void carregar())
      .subscribe();
    return () => { void supabase().removeChannel(canal); };
  }, [carregar]);

  const lista = useMemo(() => {
    const palavras = normalizar(busca).split(/\s+/).filter(Boolean);
    return (garrafas || [])
      .map((g) => ({ g, p: produtoPorId.get(g.produto_id) }))
      .filter((x): x is { g: Garrafa; p: Produto } => !!x.p && !x.p.arquivado)
      .filter((x) => !palavras.length || palavras.every((w) => normalizar(x.p.nome).includes(w)))
      .sort((a, b) => Number(b.g.ml_aberto > 0) - Number(a.g.ml_aberto > 0) || a.p.nome.localeCompare(b.p.nome));
  }, [garrafas, produtoPorId, busca]);

  // Produtos que parecem dose mas ainda não estão ligados a uma garrafa.
  const dosesSoltas = useMemo(() => produtos.filter((p) => !p.arquivado && p.ativo && p.tipo === "unidade"
    && /dose/i.test(`${p.nome} ${p.categoria}`) && !(garrafas || []).some((g) => g.produto_id === p.id)), [produtos, garrafas]);

  if (!garrafas) return <Carregando />;

  return (
    <div className="space-y-4">
      <Titulo acoes={<button className="btn-principal" onClick={() => setAdicionar(true)}><Plus size={18} /> Adicionar garrafa</button>}>Garrafas e doses</Titulo>
      <p className="-mt-2 text-sm text-muted">
        Ao vender uma dose, o sistema tira os ml da garrafa aberta. Só abre uma garrafa nova (e baixa 1 do estoque) quando o que sobrou não dá para a dose.
        Esta tela é só sua; os atendentes apenas vendem a dose.
      </p>

      {dosesSoltas.length > 0 && (
        <details className="cartao border-amber-500/50 text-sm">
          <summary className="cursor-pointer">
            <strong className="text-amber-300">{dosesSoltas.length} produto(s) de dose ainda sem garrafa ligada</strong>
            <span className="text-muted"> — vendem normalmente, mas não descontam ml. Toque para ver.</span>
          </summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {dosesSoltas.map((p) => <span key={p.id} className="etiqueta bg-panel2 py-1 text-muted">{p.nome}</span>)}
          </div>
          <p className="mt-2 text-muted">Para ligar, abra a garrafa abaixo e use “Nova dose → usar produto que já existe”.</p>
        </details>
      )}

      <input className="campo" placeholder="Buscar garrafa" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar garrafa" />

      {!lista.length ? <Vazio>Nenhuma garrafa. Toque em “Adicionar garrafa”.</Vazio> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="garrafas">
          {lista.map(({ g, p }) => {
            const ds = doses.filter((d) => d.garrafa_id === g.produto_id);
            const pct = Math.min(100, Math.round((g.ml_aberto / g.volume_ml) * 100));
            const menorDose = ds.length ? Math.min(...ds.map((d) => d.dose_ml)) : 100;
            return (
              <div key={g.produto_id} className="cartao space-y-3" data-testid="garrafa">
                <div className="flex items-center gap-3">
                  <Foto url={p.imagem_url} nome={p.nome} className="h-14 w-14" />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold leading-tight">{p.nome}</div>
                    <div className="text-xs text-muted">{g.volume_ml} ml · <span className={p.estoque <= 0 ? "text-amber-300" : ""}>{p.estoque} fechada(s)</span></div>
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-muted">Garrafa aberta</span>
                    <strong className="tabular-nums" data-testid="ml-aberto">{g.ml_aberto} ml</strong>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-ink">
                    <div className={`h-full rounded-full ${pct > 30 ? "bg-lime" : pct > 10 ? "bg-amber-400" : "bg-red-500"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {g.ml_aberto > 0 ? `Dá ${Math.floor(g.ml_aberto / menorDose)} dose(s) de ${menorDose} ml` : "Nenhuma garrafa aberta — a próxima dose abre uma."}
                  </div>
                </div>
                <div className="space-y-1">
                  {ds.map((d) => {
                    const dp = produtoPorId.get(d.produto_id);
                    return (
                      <button key={d.produto_id} onClick={() => setEditarDose({ garrafa: g, dose: d })}
                        className="flex w-full items-center justify-between rounded-lg bg-ink px-3 py-2 text-left text-sm hover:bg-white/5">
                        <span>{dp?.nome || "Dose"} · <span className="text-muted">{d.dose_ml} ml</span></span>
                        <strong>{brl(dp?.preco)}</strong>
                      </button>
                    );
                  })}
                  {!ds.length && <p className="text-xs text-muted">Nenhuma dose ligada.</p>}
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                  <button className="btn-secundario py-1.5" onClick={() => setEditarDose({ garrafa: g })}>+ Nova dose</button>
                  <button className="btn-secundario py-1.5" onClick={() => setAjustar(g)}>Conferir aberta</button>
                  <button className="btn-secundario py-1.5" onClick={() => setHistorico(g)}>Histórico</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AdicionarGarrafa aberta={adicionar} jaSao={new Set((garrafas || []).map((g) => g.produto_id))} aoFechar={() => setAdicionar(false)} aoSalvar={carregar} />
      <DoseJanela dados={editarDose} aoFechar={() => setEditarDose(null)} aoSalvar={carregar} />
      <AjustarJanela garrafa={ajustar} aoFechar={() => setAjustar(null)} aoSalvar={carregar} />
      <HistoricoJanela garrafa={historico} aoFechar={() => setHistorico(null)} />
    </div>
  );
}

function AdicionarGarrafa({ aberta, jaSao, aoFechar, aoSalvar }: { aberta: boolean; jaSao: Set<string>; aoFechar: () => void; aoSalvar: () => Promise<void> }) {
  const avisar = useAviso();
  const [p, setP] = useState<Produto | null>(null);
  const [vol, setVol] = useState("1000");
  useEffect(() => { if (!aberta) { setP(null); setVol("1000"); } }, [aberta]);
  return (
    <Janela titulo="Adicionar garrafa" aberta={aberta} aoFechar={aoFechar}>
      <div className="space-y-3">
        <p className="text-sm text-muted">Escolha a bebida (o produto da garrafa inteira). O estoque dele passa a contar as garrafas fechadas.</p>
        <BuscaProduto somenteUnidade incluirInativos autoFocus placeholder="Nome da garrafa" aoEscolher={(x) => {
          if (jaSao.has(x.id)) { avisar(`${x.nome} já está em Garrafas.`, "info"); return; }
          setP(x); setVol(String(volumeDoNome(x.nome)));
        }} />
        {p && (
          <>
            <div className="flex items-center gap-3 rounded-xl bg-ink p-2"><Foto url={p.imagem_url} nome={p.nome} className="h-10 w-10" /><strong>{p.nome}</strong></div>
            <div>
              <label className="rotulo" htmlFor="vol">Volume da garrafa (ml)</label>
              <input id="vol" className="campo" inputMode="numeric" value={vol} onChange={(e) => setVol(e.target.value.replace(/\D/g, ""))} />
            </div>
            <BotaoAcao className="btn-principal w-full" acao={async () => {
              await rpc("configurar_garrafa", { p_produto: p.id, p_volume_ml: Number(vol) });
              avisar(`${p.nome} adicionada.`);
              aoFechar();
              await aoSalvar();
            }}>Adicionar</BotaoAcao>
          </>
        )}
      </div>
    </Janela>
  );
}

function DoseJanela({ dados, aoFechar, aoSalvar }: { dados: { garrafa: Garrafa; dose?: Dose } | null; aoFechar: () => void; aoSalvar: () => Promise<void> }) {
  const { produtoPorId } = useLoja();
  const avisar = useAviso();
  const garrafaP = dados ? produtoPorId.get(dados.garrafa.produto_id) : undefined;
  const doseP = dados?.dose ? produtoPorId.get(dados.dose.produto_id) : undefined;
  const [existente, setExistente] = useState<Produto | null>(null);
  const [nome, setNome] = useState("");
  const [ml, setMl] = useState("100");
  const [preco, setPreco] = useState("");
  useEffect(() => {
    if (!dados) return;
    setExistente(null);
    setNome(doseP?.nome || `Dose ${garrafaP?.nome.split("·")[0].trim() || ""}`.trim());
    setMl(String(dados.dose?.dose_ml || 100));
    setPreco(doseP ? String(doseP.preco).replace(".", ",") : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados]);
  if (!dados) return null;
  const id = dados.dose?.produto_id || existente?.id;
  return (
    <Janela titulo={dados.dose ? "Editar dose" : `Nova dose · ${garrafaP?.nome || ""}`} aberta={!!dados} aoFechar={aoFechar}>
      <div className="space-y-3">
        {!dados.dose && (
          <div className="rounded-xl border border-line p-3">
            <div className="mb-1 text-sm text-muted">Usar produto que já existe (opcional)</div>
            {existente ? (
              <div className="flex items-center justify-between text-sm"><strong>{existente.nome}</strong><button className="underline" onClick={() => setExistente(null)}>trocar</button></div>
            ) : (
              <BuscaProduto incluirInativos placeholder="Ex.: dose de Tanqueray" aoEscolher={(x) => {
                setExistente(x); setNome(x.nome); setPreco(String(x.preco).replace(".", ","));
              }} />
            )}
          </div>
        )}
        <div><label className="rotulo" htmlFor="dnome">Nome no PDV</label><input id="dnome" className="campo" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="rotulo" htmlFor="dml">ml por dose</label><input id="dml" className="campo" inputMode="numeric" value={ml} onChange={(e) => setMl(e.target.value.replace(/\D/g, ""))} /></div>
          <div><label className="rotulo" htmlFor="dpreco">Preço da dose</label><input id="dpreco" className="campo" inputMode="decimal" placeholder="0,00" value={preco} onChange={(e) => setPreco(e.target.value)} /></div>
        </div>
        <BotaoAcao className="btn-principal w-full" acao={async () => {
          const v = lerValor(preco);
          if (!Number.isFinite(v) || v < 0 || !preco.trim()) throw new Error("Informe o preço da dose.");
          await rpc("salvar_dose", { p: { id: id || null, garrafa_id: dados.garrafa.produto_id, nome, preco: v, dose_ml: Number(ml) || 100 } });
          avisar("Dose salva. Ela aparece no PDV.");
          aoFechar();
          await aoSalvar();
        }}>Salvar dose</BotaoAcao>
        {dados.dose && (
          <BotaoAcao className="btn-secundario w-full text-red-300" acao={async () => {
            if (!confirm(`Desligar "${doseP?.nome}" da garrafa? Ela continua à venda, mas deixa de descontar ml.`)) return;
            await rpc("desligar_dose", { p_produto: dados.dose!.produto_id });
            avisar("Dose desligada.");
            aoFechar();
            await aoSalvar();
          }}>Desligar da garrafa</BotaoAcao>
        )}
      </div>
    </Janela>
  );
}

function AjustarJanela({ garrafa, aoFechar, aoSalvar }: { garrafa: Garrafa | null; aoFechar: () => void; aoSalvar: () => Promise<void> }) {
  const { produtoPorId } = useLoja();
  const avisar = useAviso();
  const p = garrafa ? produtoPorId.get(garrafa.produto_id) : undefined;
  const [ml, setMl] = useState("");
  const [vol, setVol] = useState("");
  useEffect(() => { setMl(garrafa ? String(garrafa.ml_aberto) : ""); setVol(garrafa ? String(garrafa.volume_ml) : ""); }, [garrafa]);
  if (!garrafa) return null;
  return (
    <Janela titulo={`Conferir · ${p?.nome || ""}`} aberta={!!garrafa} aoFechar={aoFechar}>
      <div className="space-y-3">
        <p className="text-sm text-muted">Olhe a garrafa aberta e informe quantos ml ainda tem (0 se não houver garrafa aberta). Para mudar as garrafas fechadas, use Estoque → Lista de estoque.</p>
        <div><label className="rotulo" htmlFor="mlab">ml na garrafa aberta</label><input id="mlab" className="campo text-xl" inputMode="numeric" value={ml} onChange={(e) => setMl(e.target.value.replace(/\D/g, ""))} autoFocus /></div>
        <BotaoAcao className="btn-principal w-full" acao={async () => {
          await rpc("ajustar_ml_aberto", { p_produto: garrafa.produto_id, p_ml: Number(ml), p_motivo: "Conferência" });
          avisar("Garrafa aberta ajustada.");
          aoFechar();
          await aoSalvar();
        }}>Salvar</BotaoAcao>
        <details className="text-sm">
          <summary className="cursor-pointer text-muted">Volume da garrafa ou remover do controle</summary>
          <div className="mt-2 flex gap-2">
            <input className="campo" inputMode="numeric" value={vol} onChange={(e) => setVol(e.target.value.replace(/\D/g, ""))} aria-label="Volume (ml)" />
            <BotaoAcao className="btn-secundario" acao={async () => {
              await rpc("configurar_garrafa", { p_produto: garrafa.produto_id, p_volume_ml: Number(vol) });
              avisar("Volume atualizado."); aoFechar(); await aoSalvar();
            }}>Salvar volume</BotaoAcao>
          </div>
          <BotaoAcao className="mt-2 text-red-300 underline" acao={async () => {
            if (!confirm("Remover esta garrafa do controle de doses?")) return;
            await rpc("configurar_garrafa", { p_produto: garrafa.produto_id, p_volume_ml: null });
            avisar("Removida do controle."); aoFechar(); await aoSalvar();
          }}>Remover do controle de garrafas</BotaoAcao>
        </details>
      </div>
    </Janela>
  );
}

function HistoricoJanela({ garrafa, aoFechar }: { garrafa: Garrafa | null; aoFechar: () => void }) {
  const { produtoPorId } = useLoja();
  const [movs, setMovs] = useState<Mov[] | null>(null);
  useEffect(() => {
    setMovs(null);
    if (!garrafa) return;
    void supabase().from("estoque_movimentos").select("id,criado_em,tipo,quantidade,ml,ml_apos,observacao,funcionario_nome")
      .eq("produto_id", garrafa.produto_id).order("criado_em", { ascending: false }).limit(100)
      .then(({ data }) => setMovs((data as Mov[]) || []));
  }, [garrafa]);
  if (!garrafa) return null;
  return (
    <Janela titulo={`Histórico · ${produtoPorId.get(garrafa.produto_id)?.nome || ""}`} aberta={!!garrafa} aoFechar={aoFechar} largura="max-w-2xl">
      {!movs ? <Carregando /> : !movs.length ? <Vazio>Sem movimentos.</Vazio> : (
        <table className="tabela">
          <thead><tr><th>Quando</th><th>O quê</th><th className="text-right">ml</th><th className="text-right">Aberta</th><th>Quem</th></tr></thead>
          <tbody>
            {movs.map((m) => (
              <tr key={m.id}>
                <td className="whitespace-nowrap">{dataHora(m.criado_em)}</td>
                <td>{m.observacao || m.tipo}{m.quantidade ? <span className={m.quantidade < 0 ? " text-amber-300" : " text-lime"}> · {m.quantidade > 0 ? "+" : ""}{m.quantidade} garrafa(s)</span> : null}</td>
                <td className={`text-right ${Number(m.ml) < 0 ? "text-red-300" : "text-lime"}`}>{m.ml != null ? `${m.ml > 0 ? "+" : ""}${m.ml}` : ""}</td>
                <td className="text-right">{m.ml_apos ?? ""}</td>
                <td>{m.funcionario_nome}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Janela>
  );
}
