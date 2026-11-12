// Testes de regras e permissões contra o Supabase real.
// Uso: BEBS_SENHA_DONO=... BEBS_SENHA_ATENDENTE=... NODE_USE_ENV_PROXY=1 node --test tests/api.test.mjs
// ATENÇÃO: cria vendas de teste. Rode só antes da virada e reimporte os dados depois.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n").filter(Boolean).map((l) => l.split(/=(.*)/s).slice(0, 2)));
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const novo = () => createClient(URL_, KEY, { auth: { persistSession: false } });

async function entrar(usuario, senha) {
  const c = novo();
  const { error } = await c.auth.signInWithPassword({ email: `${usuario}@bebs.local`, password: senha });
  assert.ifError(error);
  return c;
}

const dono = await entrar("roberto", process.env.BEBS_SENHA_DONO);
const atendente = await entrar("vitoria", process.env.BEBS_SENHA_ATENDENTE);
const anonimo = novo();

const { data: produtos } = await dono.from("produtos").select("id,nome,preco,estoque").eq("ativo", true).eq("tipo", "unidade").gt("preco", 0).order("nome").limit(3);
const [p1, p2] = produtos;
const estoque = async (id) => (await dono.from("produtos").select("estoque").eq("id", id).single()).data.estoque;
const venda = (itens, extra = {}) => {
  const total = itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);
  return { id: randomUUID(), criado_em: new Date().toISOString(), itens, pagamentos: [{ forma: "pix", valor: Math.round(total * 100) / 100 }], ...extra };
};

test("anônimo não lê nada", async () => {
  const { data } = await anonimo.from("produtos").select("id").limit(1);
  assert.equal((data || []).length, 0);
  const v = await anonimo.rpc("finalizar_venda", { p: venda([{ produto_id: p1.id, nome: p1.nome, quantidade: 1, preco_unitario: Number(p1.preco) }]) });
  assert.ok(v.error, "anônimo não pode vender");
});

test("venda baixa estoque e reenvio não duplica", async () => {
  const antes = await estoque(p1.id);
  const v = venda([{ produto_id: p1.id, nome: p1.nome, quantidade: 2, preco_unitario: Number(p1.preco) }]);
  const r1 = await atendente.rpc("finalizar_venda", { p: v });
  assert.ifError(r1.error);
  const r2 = await atendente.rpc("finalizar_venda", { p: v });
  assert.ifError(r2.error);
  assert.equal(r2.data.duplicada, true);
  assert.equal(r2.data.numero, r1.data.numero);
  assert.equal(await estoque(p1.id), antes - 2);
  const { count } = await dono.from("vendas").select("id", { count: "exact", head: true }).eq("id", v.id);
  assert.equal(count, 1);
});

test("20 vendas simultâneas de 2 aparelhos: números únicos e estoque exato", async () => {
  const antes = await estoque(p2.id);
  const vendas = Array.from({ length: 20 }, () => venda([{ produto_id: p2.id, nome: p2.nome, quantidade: 1, preco_unitario: Number(p2.preco) }]));
  const rs = await Promise.all(vendas.map((v, i) => (i % 2 ? dono : atendente).rpc("finalizar_venda", { p: v })));
  rs.forEach((r) => assert.ifError(r.error));
  const numeros = new Set(rs.map((r) => r.data.numero));
  assert.equal(numeros.size, 20);
  assert.equal(await estoque(p2.id), antes - 20);
});

test("pagamento diferente do total é recusado", async () => {
  const v = venda([{ produto_id: p1.id, nome: p1.nome, quantidade: 1, preco_unitario: Number(p1.preco) }]);
  v.pagamentos[0].valor += 1;
  const r = await atendente.rpc("finalizar_venda", { p: v });
  assert.match(r.error?.message || "", /Pagamentos/);
});

test("atendente: sem desconto, sem cancelar, sem mexer em produto/estoque/relatório/equipe", async () => {
  const v = venda([{ produto_id: p1.id, nome: p1.nome, quantidade: 1, preco_unitario: Number(p1.preco) }], { desconto: 0.5 });
  v.pagamentos[0].valor = Math.round((Number(p1.preco) - 0.5) * 100) / 100;
  assert.match((await atendente.rpc("finalizar_venda", { p: v })).error?.message || "", /desconto/i);
  const { data: qualquer } = await dono.from("vendas").select("id").limit(1).single();
  for (const [fn, args] of [
    ["cancelar_venda", { p_id: qualquer.id, p_motivo: "teste" }],
    ["salvar_produto", { p: { id: p1.id, nome: "hack", preco: 0 } }],
    ["ajustar_estoque", { p_produto: p1.id, p_novo_saldo: 999, p_motivo: "x" }],
    ["relatorio", { p_inicio: "2026-11-01", p_fim: "2026-11-11" }],
    ["criar_funcionario", { p_nome: "x", p_usuario: "xxx", p_senha: "123456", p_papel: "dono" }],
  ]) {
    const r = await atendente.rpc(fn, args);
    assert.match(r.error?.message || "", /Somente o dono/, fn);
  }
  const ins = await atendente.from("vendas").insert({ id: randomUUID(), subtotal: 1, total: 1 });
  assert.ok(ins.error, "insert direto bloqueado");
  const upd = await atendente.from("produtos").update({ preco: 0 }).eq("id", p1.id).select();
  assert.ok(upd.error || !upd.data?.length, "update direto bloqueado");
  const aud = await atendente.from("auditoria").select("id").limit(1);
  assert.equal((aud.data || []).length, 0, "atendente não lê auditoria");
});

test("dono cancela venda e o estoque volta", async () => {
  const antes = await estoque(p1.id);
  const v = venda([{ produto_id: p1.id, nome: p1.nome, quantidade: 3, preco_unitario: Number(p1.preco) }]);
  assert.ifError((await atendente.rpc("finalizar_venda", { p: v })).error);
  assert.equal(await estoque(p1.id), antes - 3);
  assert.ifError((await dono.rpc("cancelar_venda", { p_id: v.id, p_motivo: "teste automático" })).error);
  assert.equal(await estoque(p1.id), antes);
});

test("sangria maior que o dinheiro do caixa é recusada", async () => {
  const r = await atendente.rpc("movimentar_caixa", { p_tipo: "sangria", p_valor: 999999, p_descricao: "teste" });
  assert.match(r.error?.message || "", /Sangria maior/);
});

test("consumo interno baixa estoque e reenvio não duplica", async () => {
  const antes = await estoque(p1.id);
  const c = { id: randomUUID(), funcionario_nome: "Teste", itens: [{ produto_id: p1.id, quantidade: 1 }] };
  assert.ifError((await atendente.rpc("registrar_consumo", { p: c })).error);
  assert.equal((await atendente.rpc("registrar_consumo", { p: c })).data.duplicada, true);
  assert.equal(await estoque(p1.id), antes - 1);
});

test("só o dono troca senha: atendente não troca nem a própria", async () => {
  const r = await atendente.auth.updateUser({ password: "outrasenha123" });
  assert.ok(r.error, "atendente não pode trocar a própria senha");
  const ainda = await novo().auth.signInWithPassword({ email: "vitoria@bebs.local", password: process.env.BEBS_SENHA_ATENDENTE });
  assert.ifError(ainda.error, "a senha antiga continua valendo");
  const { data: eu } = await atendente.auth.getUser();
  // Dono redefine a senha da atendente (para a mesma senha, mantendo o acesso de teste).
  assert.ifError((await dono.rpc("redefinir_senha", { p_funcionario: eu.user.id, p_senha: process.env.BEBS_SENHA_ATENDENTE })).error);
  // Dono troca a própria senha e volta para a original.
  assert.ifError((await dono.auth.updateUser({ password: process.env.BEBS_SENHA_DONO + "x" })).error);
  assert.ifError((await dono.auth.updateUser({ password: process.env.BEBS_SENHA_DONO })).error);
  const login = await novo().auth.signInWithPassword({ email: "vitoria@bebs.local", password: process.env.BEBS_SENHA_ATENDENTE });
  assert.ifError(login.error);
});

test("estoque: atendente só dá entrada; dono soma/subtrai", async () => {
  const antes = await estoque(p1.id);
  assert.match((await atendente.rpc("movimentar_estoque", { p_produto: p1.id, p_delta: -1, p_motivo: "x" })).error?.message || "", /Somente o dono/);
  assert.ok((await atendente.rpc("entrada_estoque", { p_itens: [{ produto_id: p1.id, quantidade: -1 }], p_observacao: "x" })).error, "entrada negativa recusada");
  const r1 = await dono.rpc("movimentar_estoque", { p_produto: p1.id, p_delta: 1, p_motivo: "teste" });
  assert.equal(r1.data, antes + 1);
  const r2 = await dono.rpc("movimentar_estoque", { p_produto: p1.id, p_delta: -1, p_motivo: "teste" });
  assert.equal(r2.data, antes);
});

test("atendente não vê vendas nem dados financeiros", async () => {
  for (const tabela of ["vendas", "venda_itens", "venda_pagamentos", "caixa_movimentos", "produto_custos", "auditoria", "estoque_movimentos"]) {
    const { data } = await atendente.from(tabela).select("*").limit(1);
    assert.equal((data || []).length, 0, `atendente leu ${tabela}`);
  }
  const { data: dv } = await dono.from("vendas").select("id").limit(1);
  assert.equal(dv.length, 1, "dono continua lendo vendas");
  const { data: fechados } = await atendente.from("caixas").select("id").eq("status", "fechado").limit(1);
  assert.equal((fechados || []).length, 0, "atendente não vê caixas fechados");
  const { data: cx } = await dono.from("caixas").select("id").limit(1).single();
  assert.match((await atendente.rpc("resumo_caixa", { p_caixa: cx.id })).error?.message || "", /Somente o dono/);
  assert.match((await atendente.rpc("relatorio", { p_inicio: "2026-11-01", p_fim: "2026-11-12" })).error?.message || "", /Somente o dono/);
  const semCusto = await atendente.from("produtos").select("custo").limit(1);
  assert.ok(semCusto.error, "coluna custo não existe mais em produtos");
});

test("só o dono vende com preço diferente do cadastrado", async () => {
  const barato = venda([{ produto_id: p1.id, nome: p1.nome, quantidade: 1, preco_unitario: 0.01 }]);
  assert.match((await atendente.rpc("finalizar_venda", { p: barato })).error?.message || "", /Somente o dono pode alterar preço/);
  // Funções novas exclusivas do dono
  for (const [fn, args] of [
    ["alterar_pagamento_venda", { p_id: randomUUID(), p_pagamentos: [], p_motivo: "" }],
    ["reabrir_caixa", { p_caixa: randomUUID() }],
    ["cancelar_movimento_caixa", { p_id: randomUUID() }],
    ["restaurar_produto", { p_id: randomUUID() }],
  ]) {
    assert.match((await atendente.rpc(fn, args)).error?.message || "", /Somente o dono/, fn);
  }
});
