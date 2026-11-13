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
| Vender, caixa (abrir, sangria, suprimento, fechamento cego) | ✔ | ✔ |
| Ver vendas, totais e histórico do caixa, custos | ✔ | — |
| Consumo interno, entrada de mercadoria, consultar produtos | ✔ | ✔ |
| Desconto, preço diferente na venda, cancelar venda/consumo, corrigir pagamento | ✔ | — |
| Reabrir caixa, cancelar sangria/suprimento, restaurar produto excluído | ✔ | — |
| Preço, custo, cadastro de produto e código | ✔ | — |
| Lista de estoque (− / + e contagem) e histórico | ✔ | — |
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

## Fotos e base de códigos

- **Fotos dos produtos**: aparecem no PDV (atalhos, busca, carrinho) e na lista de produtos. Ficam no
  Storage do Supabase (bucket público `produtos`, só o dono envia), reduzidas para 320 px em WEBP
  (~10 KB cada). O dono troca a foto no cadastro do produto, inclusive tirando foto pelo celular.
- **Base de referência** (`catalogo_referencia`): 5,5 mil códigos de bebidas de fontes públicas
  (GO/SC) e dos catálogos de imagens. Ao bipar um código que a loja não tem:
  - dono: abre o cadastro já com nome, categoria e foto da base (falta só o preço). Se o código é de
    caixa e a unidade já existe na loja, um toque vincula a caixa (cada bipe soma N unidades);
  - atendente: vê o nome do produto da base e o aviso para chamar o dono.
- A base é referência: confira a embalagem antes de vender. Fotos que o pacote original marcou como
  "conferir antes de usar" não foram aplicadas aos produtos.

## Banco

Migrações em `supabase/migrations/` (as do sistema antigo ficaram em `supabase/legado/`):

1. `20261111_100_sistema_novo.sql` — tabelas, RLS, funções de venda/caixa/estoque/relatório, realtime.
2. `20261111_101_funcionarios.sql` — logins e gestão da equipe.
3. `20261111_102_importar_legado.sql` — importação do sistema 2.x (`public.company_state`).
4. `20261111_103_senha_so_dono.sql` — só o dono altera senha/login.
5. `20261111_104_imagens_e_base_codigos.sql` — fotos, base de referência de códigos e Storage.
6. `20261112_106_ajuste_rapido_estoque.sql` — ajuste rápido (− / +) do dono.
7. `20261112_107_atendente_sem_financeiro.sql` — vendas, caixa e custos só para o dono; fechamento cego.
8. `20261112_108_autonomia_do_dono.sql` — trava de preço e ferramentas de correção do dono.
9. `20261112_109_garrafas_e_doses.sql` — garrafas (ml da aberta) e doses que descontam ml automaticamente.
10. `20261113_110_combos_com_ml.sql` — combos/doses compostas dão baixa em vários itens (inclusive ml de garrafa).

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
