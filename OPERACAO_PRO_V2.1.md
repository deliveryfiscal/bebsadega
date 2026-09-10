# Beb's Gestão v2.1 — Operação Pro

Patch focado em **velocidade no balcão, simplicidade de uso e confiabilidade operacional**.

## Fluxos principais

### Venda de balcão
1. Abra o caixa.
2. Entre no PDV.
3. Bipe o produto; bips repetidos aumentam a quantidade.
4. Para várias unidades, informe a quantidade antes do bip.
5. Use `F4` para localizar/cadastrar cliente, `F8` para suspender e `F9` para receber.
6. Escolha Dinheiro, PIX, Débito ou Crédito. Pagamento dividido também é suportado.
7. A venda baixa estoque, movimenta caixa somente quando houver dinheiro físico, cria o registro financeiro e mantém auditoria.

### Cadastro rápido de código de barras
Acesse **Cadastrar códigos** e use a Fila rápida:

`produto destacado → bip → salva → próximo produto`

O sistema também aceita códigos adicionais para pack/caixa com multiplicadores `x6`, `x12`, `x24` ou personalizados. Código duplicado é bloqueado.

### Entrada de mercadoria
Acesse **Entrada rápida**. Informe uma quantidade e bipe uma vez ou bipe repetidamente. Um código de caixa usa seu multiplicador automaticamente. Antes da confirmação, confira a lista completa.

### Inventário
Acesse **Inventário express**, faça a contagem por bipagem e confirme somente as divergências. O estoque só é ajustado no final.

### Consulta de preço
A tela **Consultar preço** mantém o foco no scanner, mostra o preço em destaque e volta automaticamente para a próxima consulta.

### Garrafas e doses
A tela **Garrafas abertas** mostra volume restante e quantidade aproximada de doses. Conferências e perdas em ml exigem motivo e ficam registradas na auditoria.

## Operação e gestão

- Busca global por produto, cliente, venda e fornecedor.
- Central de alertas com estoque, contas, integrações e implantação.
- Checklist de implantação com porcentagem de prontidão.
- Resumo do dia por canal e produtos mais vendidos.
- Caixa separa numerário físico de PIX/cartões.
- Compras e fornecedores com recebimento e geração de conta a pagar.
- CRM com histórico, ticket médio, tags e cashback.
- Vendas com comprovante térmico e cancelamento com estorno.
- Auditoria legível das ações críticas.
- Menu adaptado ao perfil: Administrador, Gerente, Caixa, Estoquista e Financeiro.

## Persistência

O sistema possui dois modos:

- `NEXT_PUBLIC_DATA_MODE=local`: demonstração e teste em um único navegador.
- `NEXT_PUBLIC_DATA_MODE=supabase`: login via Supabase Auth e estado centralizado da empresa com controle otimista de versão.

No modo Supabase, se outro dispositivo alterar a mesma base antes da sincronização local, o sistema marca **Conflito** em vez de sobrescrever silenciosamente. Use **Recarregar nuvem** para voltar à versão central.

## SQL

Em uma instalação nova, execute na ordem:

1. `001_initial_schema.sql`
2. `002_client_catalog.sql`
3. `003_mega_update_v2.sql`
4. `004_operacao_pro_v21.sql`

Os scripts 003 e 004 foram escritos de forma idempotente para atualizações do projeto.

## Integrações

iFood e 99Food continuam exigindo credenciais, permissões e homologação oficiais. O sistema inclui a estrutura interna, vínculos de SKU, endpoint normalizado e segurança server-side; nenhuma credencial é inventada.
