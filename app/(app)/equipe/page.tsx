"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useLoja } from "@/lib/loja";
import { useSessao } from "@/lib/sessao";
import { rpc } from "@/lib/acoes";
import type { Funcionario } from "@/lib/tipos";
import { SomenteDono } from "@/components/shell";
import { BotaoAcao, Janela, Titulo, useAviso } from "@/components/ui";

export default function Equipe() {
  const { funcionarios, recarregar } = useLoja();
  const { eu } = useSessao();
  const avisar = useAviso();
  const [novo, setNovo] = useState(false);
  const [senhaDe, setSenhaDe] = useState<Funcionario | null>(null);
  const lista = [...funcionarios].sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome));

  return (
    <SomenteDono>
      <div className="space-y-4">
        <Titulo acoes={<button className="btn-principal" onClick={() => setNovo(true)}><Plus size={18} /> Novo acesso</button>}>Equipe e acessos</Titulo>
        <div className="cartao text-sm text-muted">
          <p><strong className="text-white">Dono</strong>: acesso total (relatórios, preços, custos, cancelamentos, ajustes de estoque, equipe).</p>
          <p><strong className="text-white">Atendente</strong>: vender, abrir/fechar caixa, sangria, consumo interno, entrada de mercadoria e consulta de produtos. Não vê relatórios nem custos, não cancela vendas, não dá desconto e não altera preço ou estoque.</p>
        </div>
        <div className="cartao overflow-x-auto p-0">
          <table className="tabela">
            <thead><tr><th>Nome</th><th>Usuário</th><th>Perfil</th><th>Situação</th><th /></tr></thead>
            <tbody>
              {lista.map((f) => (
                <tr key={f.id} className={f.ativo ? "" : "opacity-60"}>
                  <td className="font-medium">{f.nome}{f.id === eu?.id && <span className="ml-2 text-xs text-muted">(você)</span>}</td>
                  <td className="font-mono">{f.usuario}</td>
                  <td>{f.papel === "dono" ? "Dono" : "Atendente"}</td>
                  <td>{f.ativo ? <span className="text-lime">Ativo</span> : <span className="text-red-300">Bloqueado</span>}</td>
                  <td className="space-x-3 whitespace-nowrap text-right">
                    <button className="text-sm underline" onClick={() => setSenhaDe(f)}>Trocar senha</button>
                    {f.id !== eu?.id && (
                      <BotaoAcao className="text-sm underline" acao={async () => {
                        if (!confirm(f.ativo ? `Bloquear o acesso de ${f.nome}? Ele(a) sai de todos os aparelhos.` : `Liberar o acesso de ${f.nome}?`)) return;
                        await rpc("definir_acesso", { p_funcionario: f.id, p_ativo: !f.ativo, p_papel: f.papel });
                        await recarregar();
                        avisar(f.ativo ? "Acesso bloqueado." : "Acesso liberado.");
                      }}>{f.ativo ? "Bloquear" : "Liberar"}</BotaoAcao>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <NovoAcesso aberta={novo} aoFechar={() => setNovo(false)} aoSalvar={recarregar} />
        <TrocarSenha f={senhaDe} aoFechar={() => setSenhaDe(null)} />
      </div>
    </SomenteDono>
  );
}

function NovoAcesso({ aberta, aoFechar, aoSalvar }: { aberta: boolean; aoFechar: () => void; aoSalvar: () => Promise<void> }) {
  const [nome, setNome] = useState("");
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [papel, setPapel] = useState<"atendente" | "dono">("atendente");
  const avisar = useAviso();
  const sugestao = (n: string) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/\s+/)[0]?.replace(/[^a-z0-9._-]/g, "") || "";
  return (
    <Janela titulo="Novo acesso" aberta={aberta} aoFechar={aoFechar}>
      <div className="space-y-3">
        <div><label className="rotulo" htmlFor="nnome">Nome</label>
          <input id="nnome" className="campo" value={nome} onChange={(e) => { setNome(e.target.value); if (!usuario || usuario === sugestao(nome)) setUsuario(sugestao(e.target.value)); }} autoFocus /></div>
        <div><label className="rotulo" htmlFor="nusuario">Usuário (para entrar)</label>
          <input id="nusuario" className="campo font-mono" autoCapitalize="none" value={usuario} onChange={(e) => setUsuario(e.target.value.toLowerCase())} /></div>
        <div><label className="rotulo" htmlFor="nsenha">Senha inicial (mínimo 6)</label>
          <input id="nsenha" className="campo" value={senha} onChange={(e) => setSenha(e.target.value)} /></div>
        <div><label className="rotulo" htmlFor="npapel">Perfil</label>
          <select id="npapel" className="campo" value={papel} onChange={(e) => setPapel(e.target.value as "atendente" | "dono")}>
            <option value="atendente">Atendente</option><option value="dono">Dono (acesso total)</option>
          </select></div>
        <BotaoAcao className="btn-principal w-full" acao={async () => {
          await rpc("criar_funcionario", { p_nome: nome, p_usuario: usuario, p_senha: senha, p_papel: papel });
          avisar(`Acesso criado. Usuário: ${usuario}`);
          setNome(""); setUsuario(""); setSenha(""); setPapel("atendente");
          aoFechar();
          await aoSalvar();
        }}>Criar acesso</BotaoAcao>
      </div>
    </Janela>
  );
}

function TrocarSenha({ f, aoFechar }: { f: Funcionario | null; aoFechar: () => void }) {
  const [senha, setSenha] = useState("");
  const avisar = useAviso();
  return (
    <Janela titulo={`Nova senha · ${f?.nome || ""}`} aberta={!!f} aoFechar={() => { setSenha(""); aoFechar(); }}>
      <div className="space-y-3">
        <input className="campo" placeholder="Nova senha (mínimo 6)" value={senha} onChange={(e) => setSenha(e.target.value)} autoFocus aria-label="Nova senha" />
        <BotaoAcao className="btn-principal w-full" acao={async () => {
          await rpc("redefinir_senha", { p_funcionario: f!.id, p_senha: senha });
          avisar("Senha alterada.");
          setSenha("");
          aoFechar();
        }}>Salvar senha</BotaoAcao>
      </div>
    </Janela>
  );
}
