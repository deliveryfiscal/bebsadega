# Diagnóstico completo — Beb's Gestão v2.1.10 (11/11/2026)

Base para a reconstrução do sistema. Este arquivo descreve **o que está errado e por quê**.
Os dados do cliente (vendas, faturamento, clientes, funcionários) **não** estão neste repositório,
que é **público**. O backup completo foi entregue fora do git.

---

## 0. Backup realizado

| Onde | O quê |
|---|---|
| Supabase `backup.company_state_20261111` | Cópia integral do estado (versão 3799) dentro do próprio banco. Schema `backup` sem acesso via API (`anon`/`authenticated` revogados). |
| Supabase `backup.company_state_events_20261111` | Histórico das 3.799 gravações (somente metadados — ver item 2.6). |
| Arquivos entregues fora do git | JSON integral (MD5 conferido byte a byte com o banco), planilha Excel com 17 abas e 16 CSVs. |

Conteúdo exportado: 575 produtos (466 não excluídos), 344 códigos de barras, estoque atual,
876 vendas / 1.333 itens vendidos (15/09 a 05/11), vendas por dia, vendas por produto,
18 consumos internos, 40 sessões de caixa, 293 movimentos de caixa, 882 lançamentos financeiros,
clientes, funcionários, fornecedores e 3.264 registros de auditoria.

---

## 1. Resumo executivo

O sistema não "cai" por um bug pontual. **A arquitetura é o problema.** A loja inteira —
produtos, vendas, caixa, financeiro, auditoria — vive em **um único JSON de ~2 MB**, numa única
linha do banco (`public.company_state`). **Toda ação** (bipar um código, vender uma lata, abrir
o caixa) reenvia os 2 MB inteiros. Quando qualquer gravação falha, o sistema entra em modo de
bloqueio e **para de aceitar vendas** até alguém resolver manualmente — e essa resolução
**descarta** o que estava só no navegador.

### Evidência nos dados de produção

* **Última venda gravada na nuvem: #1876, 05/11 às 20:03.** Desde então, nenhuma.
* **01, 02 e 03/11: zero vendas** gravadas (03/11 tem só uma sangria registrada).
* **08, 09 e 10/11: caixa aberto e fechado com "0 venda(s)"**, valor contado = valor de abertura.
  A loja abriu, mas as vendas não passaram pelo sistema (ou ficaram presas em algum navegador).
* **289 timeouts** do servidor de API (`Thread killed by timeout manager`) só nas últimas 24h;
  1.131 em 4 dias na revisão de 20/10.
* **2.347 consultas** de versão em 24h (polling de 12 s de cada aparelho aberto) para **2 gravações**.
* O JSON cresce ~45 KB por dia de operação: 112 KB em 11/09 → **1,99 MB** hoje.
  Os registros de auditoria sozinhos são 39% do tamanho.

---

## 2. Causa raiz — o "JSON único" (`company_state`)

### 2.1 Cada ação regrava a loja inteira
`lib/store.tsx` → `commitState()` → `enqueueRemoteSave()` → RPC `save_company_state_guarded`
recebe `p_state` com o estado completo. Uma venda de R$ 3,50 trafega ~2 MB, o Postgres calcula
MD5 de 2 MB, regrava a linha TOAST inteira e registra um evento. Em 4G/Wi-Fi fraco do balcão isso
estoura tempo e gera os timeouts.

### 2.2 Um único erro trava o PDV para sempre (espiral de bloqueio)
1. Qualquer falha na gravação define `lastRemoteErrorRef` (store.tsx ~l.300).
2. Esse erro **só é limpo** por uma gravação bem-sucedida ou recarga — mas nenhuma nova gravação
   é tentada automaticamente.
3. `finishSale()` recusa toda venda enquanto `lastRemoteErrorRef` existir
   ("Há alterações ainda não salvas…", l.1138).
4. Ao recarregar a página, o cache local tem `pendingRemote = true` → `hydrateRemote()` marca
   **conflito** (l.408) → `commitState()` lança erro para **qualquer** operação (l.314).
5. Resultado na prática: *"não registra venda", "as ações não salvam"*.

### 2.3 Dois aparelhos = conflito constante
A gravação exige `p_expected_version` igual à versão do servidor (CAS). Se o celular salva e o
computador do caixa ainda não fez o polling de 12 s, a próxima ação do caixa é rejeitada →
conflito → bloqueio total (2.2). 10 navegadores diferentes já gravaram nessa base.

### 2.4 "Resolver conflito" apaga as operações locais
`resolveSyncConflict()` baixa um `bebs-conflito-*.json` e **substitui** o estado local pelo da
nuvem. Vendas, ajustes e consumos feitos naquele aparelho só continuam existindo nesse arquivo
baixado — não há rotina para reaplicá-los.

### 2.5 Travamento da tela
Quando outro aparelho grava, o polling detecta versão nova e baixa os 2 MB, roda `migrateState()`
sobre tudo e re-renderiza o app inteiro. Em celular/PC fraco isso congela a tela por segundos.

### 2.6 Não há histórico recuperável
`company_state_events` guarda só hash e tamanho, **não o conteúdo**. Cada gravação sobrescreve a
anterior. Não existe como voltar a um estado de ontem nem reconstruir uma venda perdida pelo banco.

### 2.7 Duas fontes de verdade
As migrações 001–004 criaram tabelas normalizadas (`products`, `sales`, `sale_items`,
`stock_movements`, `cash_sessions`…) com índices e RLS — **todas vazias (0 linhas)**. O app nunca
as usa. Só confundem.

---

## 3. Erros de regra de negócio

| # | Problema | Evidência |
|---|---|---|
| 3.1 | **Sangria sem validação de saldo** (`cashMovement`, store.tsx l.1349). | Caixa de 31/10 com saldo esperado **–R$ 18,00**. |
| 3.2 | **Caixa pode ficar aberto por dias.** Sem fechamento obrigatório/diário. | Caixa aberto de 31/10 a 04/11; 5 sessões abertas por mais de 20 h. Diferença de +R$ 158 no fechamento. |
| 3.3 | **Venda não vinculada ao caixa.** `cashSessionId` ausente. | 735 de 876 vendas sem `cashSessionId`; fechamento calcula por janela de horário. |
| 3.4 | **Dinheiro em ponto flutuante.** | 34 totais de venda como `64.30000000000001`; diferenças de caixa `22.299999999999955`. Deve ser centavos inteiros. |
| 3.5 | **Estoque controlado por ajuste manual**, não por entradas. | 454 "alterações manuais de estoque por PIN"; **0 compras/entradas registradas**. O estoque não é confiável. |
| 3.6 | **Custo zero em 100% dos produtos.** | Margem, lucro e CMV dos relatórios são inválidos. |
| 3.7 | **Número da venda gerado no navegador** (`max(numero)+1`). | Só não duplica porque o CAS rejeita a 2ª gravação (o que causa 2.3). |
| 3.8 | **Cancelamento altera o lançamento original** (status `cancelled`) em vez de gerar estorno; versões antigas chegaram a apagá-lo. | A única venda cancelada (27/09) está sem lançamento financeiro. |
| 3.9 | **Venda aplicada localmente antes da confirmação** do servidor. | Se a nuvem falha, a venda existe na tela/estoque local mas não no banco. |
| 3.10 | **Login único compartilhado.** | 1 usuário no Supabase Auth para todos os funcionários; o "operador" é escolhido no navegador. Auditoria por pessoa não é confiável. |

## 4. Qualidade do cadastro (para limpar na migração)

* 80 produtos ativos sem código de barras (não-combo).
* 11 nomes duplicados (ex.: *bombom, balalaika, jurupinga, g7, halls*) e nome lixo (`"c"`).
* Preço com 3 casas: *DOSE DE BALY 450 ML* = 3,801.
* 32 combos sem composição (inativos); 4 produtos ativos marcados "precisa revisão".
* 109 produtos excluídos ainda carregados no JSON.
* Nenhum código de barras duplicado entre produtos ativos ✔. Nenhum estoque negativo ✔.

## 5. Segurança e código

* **Repositório público.** PINs gerenciais (4024, 1503) estão no histórico do git. O PIN atual já
  foi trocado e está em hash scrypt, mas o repositório precisa ficar privado.
* Supabase Advisors: proteção contra senha vazada desativada; funções `SECURITY DEFINER`
  executáveis por `authenticated`; 29 FKs sem índice (nas tabelas que nem são usadas).
* `lib/store.tsx` com 1.839 linhas concentra toda a lógica (vendas, caixa, estoque, sync).
* Catálogo embutido em código: `lib/catalog-v214.ts` (7.515 linhas) e `lib/catalog-data.ts` (3.220).
* 14 arquivos `PATCH_*/CORRECAO_*/VALIDACAO_*.md` na raiz; migrações com numeração misturada
  (`001…009` + timestamps), `tsconfig.tsbuildinfo` versionado.
* Testes cobrem regras de negócio puras, mas **nenhum teste de sincronização/concorrência**,
  que é exatamente onde o sistema quebra.
* Vercel Hobby: retenção de logs curta; erros de navegador não são coletados.
* Módulos sem uso real: integrações iFood/99 (sem credenciais), compras (0), fornecedores (2),
  CRM (5 clientes).

---

## 6. Arquitetura proposta para o novo sistema

**Princípio:** cada operação grava **só o que mudou**, numa transação no servidor, e o caixa
**nunca é impedido de vender**.

### 6.1 Banco (Postgres/Supabase, normalizado)
```
companies, users/employees (login ou PIN individual por funcionário)
products (preco_centavos, custo_centavos, tipo: unidade|garrafa|combo)
product_barcodes (code UNIQUE por empresa, multiplicador)
combo_items
stock_movements  ← livro-razão: entrada, venda, consumo, ajuste, perda, inventário
sales, sale_items, sale_payments (valores em centavos, idempotency_key UNIQUE)
cash_sessions (1 aberta por terminal), cash_movements
consumptions, consumption_items
financial_entries (estorno = novo lançamento, nunca exclusão)
audit_log (append-only, tabela própria, fora do estado)
```

### 6.2 Venda = uma RPC transacional
`finalizar_venda(payload)` (~1 KB): valida caixa aberto, insere venda/itens/pagamentos, gera o
número no servidor (sequence), baixa estoque via `stock_movements` com lock por produto e devolve
o comprovante. Chave de idempotência → reenvio seguro, nunca duplica.

### 6.3 Offline de verdade
Fila local (IndexedDB) de operações com idempotency key. Sem internet, a venda entra na fila e o
caixa continua; a fila reenvia sozinha. Sem "modo conflito": operações são independentes, não
snapshots concorrentes.

### 6.4 Atualização entre aparelhos
Supabase Realtime (ou consulta `updated_since`) trazendo só os registros alterados — nunca o
banco inteiro.

### 6.5 Regras corrigidas
Sangria ≤ saldo em dinheiro; venda sempre com `cash_session_id`; alerta/fechamento obrigatório
do caixa do dia; entrada de mercadoria como fluxo principal de estoque; custo obrigatório no
recebimento; cancelamento = estorno.

### 6.6 Migração
Script que lê o backup JSON e popula as tabelas novas, com conferência de totais por dia
(vendas, itens, pagamentos) e saldo de estoque por produto contra o backup.

### 6.7 Escopo do MVP (ordem)
1. Produtos + códigos de barras + estoque (ledger)
2. PDV com bipagem + caixa + fila offline
3. Consumo interno, entrada de mercadoria, inventário
4. Relatórios do dia / por produto / por período
5. Financeiro, CRM, integrações — só depois.

---

## 7. Ações imediatas (antes do sistema novo)

1. **Não limpar os dados do navegador** dos aparelhos da loja: o `localStorage` pode conter vendas
   que nunca chegaram à nuvem (chave `bebs-gestao-cache-v211:*`).
2. Procurar arquivos `bebs-conflito-*.json` na pasta Downloads de cada aparelho — contêm
   operações descartadas pela "resolução de conflito".
3. Até a virada, registrar as vendas também no relatório da maquininha/papel, já que o sistema
   não registrou vendas de 06/11 em diante.
4. Tornar o repositório GitHub **privado**.
