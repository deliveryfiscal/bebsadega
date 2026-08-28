# Beb's Gestão

Sistema de gestão da **Beb's Adega e Tabacaria**, com PDV, leitura de código de barras, estoque, venda por dose, combos, caixa, financeiro, CRM, relatórios e estrutura de integração com iFood e 99Food. Esta versão já inclui o catálogo transcrito das listas físicas enviadas pelo cliente.



## Catálogo real incluído

Esta versão carrega **146 produtos** e **17 combos** transcritos das folhas enviadas pela Beb's.

- preços de venda foram incorporados ao cadastro;
- SKUs internos foram preservados conforme a base organizada;
- estoque inicial permanece em `0` porque a contagem física não foi enviada;
- preço de custo permanece em `0` até o levantamento de compras/custos;
- códigos de barras permanecem vazios porque os EANs não aparecem nas folhas;
- combos ficam **inativos** até a composição ser vinculada aos produtos reais do estoque;
- itens cuja escrita/preço estavam duvidosos permanecem marcados para revisão.

A base original organizada também está em `data/base_produtos_bebs.xlsx` e a versão estruturada em `data/catalogo-bebs.json`.

### Vincular os códigos com o leitor A4003

O fluxo de implantação foi preparado para não inventar EAN:

1. abra o PDV;
2. bipe um produto com o A4003;
3. quando o código ainda não existir, escolha **Produto já cadastrado**;
4. selecione o item correspondente do catálogo;
5. clique em **Vincular código**;
6. o mesmo produto passa a ser reconhecido automaticamente nos próximos bips.

Isso permite cadastrar os códigos reais diretamente na loja durante o inventário.


## O que já funciona

- PDV com campo de leitura contínua para leitores USB/Bluetooth em modo teclado.
- Busca por EAN, SKU, nome, marca e categoria.
- Cadastro rápido quando um código bipado ainda não existe.
- Carrinho, alteração de quantidade, desconto, cliente e múltiplas formas de pagamento.
- Baixa automática de estoque ao concluir a venda.
- Venda por dose com controle em mililitros e abertura automática de nova garrafa.
- Combos com baixa dos componentes.
- Produtos, preços, custos, margens e códigos de barras.
- Estoque mínimo, alertas e ajustes auditados.
- CRM com perfil, consentimento e histórico de compras.
- Abertura, sangria, suprimento e fechamento de caixa.
- Financeiro, lançamentos, fluxo, DRE simplificada e relatórios CSV.
- Backup e restauração dos dados do modo demonstração.
- Endpoint seguro para pedidos externos normalizados.
- Migration SQL normalizada para Supabase.

## Rodar localmente

1. Instale Node.js 20 ou superior.
2. Na pasta do projeto, execute:

```bash
npm install
npm run dev
```

3. Abra `http://localhost:3000`.

O projeto inicia em `NEXT_PUBLIC_DATA_MODE=demo` e salva os dados no navegador. Não é necessário configurar banco para apresentar o sistema.

## Leitor de código de barras

A maioria dos leitores USB funciona como teclado. Configure o leitor para enviar **Enter** após o código.

No PDV:

1. mantenha o cursor no campo “Bipe o código de barras”;
2. passe o produto;
3. o sistema adicionará o item automaticamente;
4. caso o EAN não exista, abrirá o cadastro rápido com o código preenchido.


## Deploy na Vercel

1. Suba esta pasta para um repositório GitHub.
2. Importe o repositório na Vercel.
3. Framework Preset: **Next.js**.
4. Root Directory: a pasta que contém este `package.json`.
5. Não há Cron Job nem configuração que exija plano Pro.
6. Para uma apresentação, mantenha `NEXT_PUBLIC_DATA_MODE=demo`.

### Limitação do modo demonstração

Os dados ficam no navegador usado. Para operação real com vários computadores, autenticação, banco central e backup em nuvem, conecte o front-end ao Supabase usando a migration incluída em `supabase/migrations/001_initial_schema.sql`.

## Supabase

1. Crie um projeto Supabase.
2. Execute `supabase/migrations/001_initial_schema.sql` no SQL Editor.
3. Execute `supabase/migrations/002_client_catalog.sql` para inserir o catálogo real da Beb's.
4. Cadastre o usuário administrador no Supabase Auth.
5. Vincule o usuário em `public.profiles` à empresa criada.
6. Preencha `.env.local` a partir de `.env.example`.

A migration cria produtos, clientes, vendas, itens, pagamentos, estoque, caixa, financeiro, integrações, auditoria e a função `process_external_order`.

## iFood e 99Food

A integração oficial depende de credenciais, aprovação e permissões fornecidas por cada plataforma. O projeto não utiliza scraping, automação não autorizada ou credenciais inventadas.

O endpoint interno é:

```text
POST /api/integrations/orders
x-webhook-secret: <INTEGRATION_WEBHOOK_SECRET>
```

Exemplo de payload normalizado:

```json
{
  "platform": "iFood",
  "externalId": "pedido-123",
  "items": [
    {
      "externalSku": "HEI-330",
      "name": "Heineken Long Neck 330ml",
      "quantity": 2,
      "unitPrice": 7.5
    }
  ],
  "discount": 0,
  "total": 15,
  "paymentMethod": "Marketplace"
}
```

Antes de processar, vincule o `externalSku` a um produto interno na tabela `external_product_links` e ative a integração na tabela `integrations`.

## Verificação do pacote

Execute:

```bash
npm run verify
```

O script verifica JSON, estrutura obrigatória, imports locais e sintaxe TypeScript/TSX.

## Segurança para produção

Antes de usar em uma loja real:

- implemente autenticação Supabase no front-end;
- use perfis e permissões por usuário;
- não exponha a Service Role Key no navegador;
- use HTTPS e segredo forte no webhook;
- configure backups do banco;
- teste leitor, impressora e fluxo de caixa no equipamento real;
- valide tributação, emissão fiscal e regras da operação com contador;
- homologue integrações com iFood e 99Food usando documentação e credenciais oficiais.


## Ajustes desta versão

Além do catálogo, esta revisão corrige pontos encontrados na auditoria anterior:

- caixa considera como numerário apenas pagamentos em **Dinheiro**;
- cancelamento remove o movimento em dinheiro associado à venda;
- códigos de barras vazios não geram falso conflito de duplicidade;
- produto pode ser cadastrado sem EAN e receber o código depois pelo leitor;
- atalho **F9** abre a finalização da venda;
- funções críticas `SECURITY DEFINER` da migration tiveram permissões restritas;
- catálogo de clientes usa uma nova chave local (`bebs-gestao-v2`) para evitar que um navegador com a versão antiga esconda os novos cadastros.

### Importante

O front-end ainda possui um modo local para demonstração e testes. Para operação multiusuário real, autenticação centralizada e persistência em nuvem, a camada de dados do front-end deve ser ligada ao Supabase usando as migrations incluídas. As integrações oficiais com iFood e 99Food continuam dependendo das credenciais e homologações de cada plataforma.

---

## Novidades v1.5

A versão 1.5 adiciona três módulos operacionais: **Códigos de barras**, **Entrada rápida** e **Vendas**. Consulte `MEGAUPDATE_V1.5.md` para o fluxo completo.

Para cadastrar os códigos reais rapidamente, acesse `/codigos`, use o modo **Fila rápida** e mantenha o A4003 configurado como teclado/HID com Enter ao final da leitura.
