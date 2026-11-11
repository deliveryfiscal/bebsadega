# Beb's Gestão 3.0

PDV e estoque da Beb's Adega e Tabacaria. Next.js + Supabase.

## Por que foi refeito

O sistema 2.x guardava a loja inteira num único JSON de ~2 MB, reenviado a cada ação. Um erro de
rede travava o PDV, dois aparelhos entravam em conflito e vendas se perdiam. O diagnóstico completo
está em `DIAGNOSTICO_2026-11-11.md`.

## Como funciona agora

- **Cada operação grava só o que mudou**, numa transação no servidor (`finalizar_venda`,
  `registrar_consumo`, `abrir_caixa`…). Vendas e consumos têm id gerado no aparelho: reenviar
  nunca duplica.
- **Sem internet não perde venda**: a operação é gravada no aparelho antes de ir para a nuvem e é
  reenviada sozinha (a cada 5 s e quando a conexão volta). Sobrevive a recarregar a página.
  O selo no topo mostra *Tudo salvo / Enviando / Sem internet*.
- **Todos os aparelhos se atualizam em tempo real** (Supabase Realtime) e, por segurança, recarregam
  os dados a cada 60 s e ao voltar para a aba.
- **Um caixa por loja**: todos os aparelhos vendem no mesmo caixa aberto.
- **Estoque com histórico**: toda venda, consumo, entrada e ajuste gera um movimento.
- Valores em `numeric(12,2)`; sem erro de centavos.

## Perfis

| | Dono | Atendente |
|---|---|---|
| Vender, caixa (abrir/fechar/sangria/suprimento) | ✔ | ✔ |
| Consumo interno, entrada de mercadoria, consultar produtos | ✔ | ✔ |
| Desconto, cancelar venda/consumo | ✔ | — |
| Preço, custo, cadastro de produto e código, ajuste de estoque | ✔ | — |
| Relatórios, histórico de estoque, ações importantes | ✔ | — |
| Criar acessos, trocar senhas (inclusive a própria), bloquear | ✔ | — |

As regras valem no banco (RLS + funções que conferem o perfil), não só na tela.

Login = **usuário + senha** (internamente `usuario@bebs.local` no Supabase Auth).
Só o dono cria acessos, define senhas e bloqueia acessos (em **Equipe**). Atendente não vê essas telas
e não consegue trocar a própria senha nem pela API do Supabase (trigger `proteger_login_funcionario`).

## Leitor de código de barras

O campo de busca do PDV recebe o leitor (modo teclado, com Enter). Atalhos:
`3*789…` soma 3 unidades · **F9** cobrar · **1–4** forma de pagamento · Enter confirma.
Código desconhecido bipado pelo dono abre a tela para vincular ao produto na hora.

## Banco

Migrações em `supabase/migrations/` (as do sistema antigo ficaram em `supabase/legado/`):

1. `20261111_100_sistema_novo.sql` — tabelas, RLS, funções de venda/caixa/estoque/relatório, realtime.
2. `20261111_101_funcionarios.sql` — logins e gestão da equipe.
3. `20261111_102_importar_legado.sql` — importação do sistema 2.x (`public.company_state`).
4. `20261111_103_senha_so_dono.sql` — só o dono altera senha/login.

### Importação dos dados antigos

```sql
select public.importar_legado();      -- acrescenta o que faltar (idempotente)
select public.importar_legado(true);  -- apaga os dados do sistema novo e importa do zero
                                      -- (recusado se já houver venda/consumo feito no sistema novo)
```

Traz produtos (com estoque e preço), códigos de barras, combos, vendas com itens e pagamentos,
consumos internos, caixas com sangrias/suprimentos. Conferido: vendas e faturamento por dia,
estoque e preço de todos os produtos idênticos ao sistema antigo.

Backup integral do sistema antigo: `backup.company_state_20261111` (schema sem acesso pela API).

## Rodar

```bash
cp .env.example .env.local   # URL e chave pública do Supabase
npm install
npm run dev
```

Na Vercel, `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` já estão configuradas.

## Testes

```bash
npm run typecheck
BEBS_SENHA_DONO=… BEBS_SENHA_ATENDENTE=… npm test   # regras e permissões contra o Supabase real
```

`tests/api.test.mjs` cria vendas de teste: rode apenas antes da virada e reimporte depois
(`truncate` das tabelas novas + `importar_legado()`).
