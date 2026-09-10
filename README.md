# Beb's Gestão v2.1 — Operação Pro

Sistema de PDV e gestão para a **Beb's Adega e Tabacaria**, desenhado para operação rápida de balcão com leitor A4003, estoque, doses, combos, caixa, financeiro, CRM, compras/fornecedores e estrutura de integração com iFood e 99Food.

## Catálogo incluído

O projeto preserva a base transcrita das listas físicas enviadas:

- **146 produtos**;
- **17 combos**;
- preços de venda transcritos;
- SKUs internos;
- itens duvidosos marcados para revisão;
- estoque inicial e custo em zero quando a informação não foi fornecida;
- códigos de barras vazios até serem cadastrados com os produtos físicos.

Arquivos de apoio:

- `data/catalogo-bebs.json`
- `data/base_produtos_bebs.xlsx`

## Principais módulos

- `/pdv` — PDV scanner-first, favoritos, dose, combo, cliente rápido, venda suspensa, atalhos e pagamento dividido.
- `/consulta-preco` — bipagem para consulta instantânea de preço.
- `/codigos` — cadastro ultrarrápido de códigos e packs/caixas.
- `/recebimento` — entrada de mercadoria por quantidade + bip.
- `/inventario` — inventário express por bipagem.
- `/produtos` — cadastro e revisão de produtos.
- `/estoque` — saldo, mínimo, localização e ajustes.
- `/garrafas` — conferência de garrafas abertas e perdas em ml.
- `/vendas` — histórico, comprovante e cancelamento.
- `/caixa` — abertura, sangria, suprimento e fechamento.
- `/financeiro` — receitas, despesas, contas e indicadores.
- `/clientes` — CRM.
- `/compras` — compras e fornecedores.
- `/integracoes` — estrutura iFood/99Food.
- `/relatorios` — relatórios.
- `/alertas` — pendências que exigem ação.
- `/auditoria` — registro das ações críticas.
- `/implantacao` — checklist de prontidão.
- `/resumo-dia` — resumo operacional diário.
- `/configuracoes` — empresa, perfil e scanner.

## Fluxo do leitor A4003

A4003 deve operar como teclado/HID e, preferencialmente, enviar **Enter** após a leitura.

### Venda

`bip → produto no carrinho → F9 → pagamento → confirmar → próximo cliente`

### Cadastro inicial dos códigos

`produto destacado → bip → salva automaticamente → próximo`

Também é possível salvar códigos adicionais para embalagem:

- unidade: `x1`;
- pack: `x6`;
- caixa: `x12`, `x24` ou outro multiplicador.

Na entrada de estoque, bipar uma caixa `x24` adiciona 24 unidades automaticamente.

## Atalhos do PDV

- `F2` busca;
- `F3` scanner;
- `F4` cliente;
- `F5` desconto;
- `F8` suspender venda;
- `F9` pagamento;
- `F10` consulta de preço.

## Modos de dados

### Local

```env
NEXT_PUBLIC_DATA_MODE=local
```

Usado para demonstração. Os dados permanecem apenas no navegador atual.

### Supabase

```env
NEXT_PUBLIC_DATA_MODE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICA
```

Nesse modo há login pelo Supabase Auth e persistência centralizada em `public.company_state` com controle otimista de versão. Se outro dispositivo alterar a base primeiro, o sistema sinaliza conflito em vez de sobrescrever silenciosamente.

> A sincronização centralizada da v2.1 é voltada a permitir a operação compartilhada sem depender do `localStorage`. As tabelas normalizadas também permanecem no banco para evolução da camada transacional. Operações concorrentes intensas devem ser homologadas no ambiente real antes do uso em múltiplos caixas simultâneos.

## SQL — ordem correta

Em uma instalação nova, execute no Supabase SQL Editor:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_client_catalog.sql`
3. `supabase/migrations/003_mega_update_v2.sql`
4. `supabase/migrations/004_operacao_pro_v21.sql`

### Primeiro administrador

Depois de criar o usuário em **Authentication → Users**, pegue o UUID do usuário e o UUID da empresa Beb's e execute, ajustando os valores:

```sql
insert into public.profiles (id, company_id, name, role, active)
values (
  'UUID_DO_USUARIO',
  'UUID_DA_EMPRESA',
  'Administrador Bebs',
  'admin',
  true
)
on conflict (id) do update
set company_id = excluded.company_id,
    name = excluded.name,
    role = excluded.role,
    active = true;
```

Para localizar a empresa:

```sql
select id, name from public.companies
where name = 'Beb''s Adega e Tabacaria';
```

## Variáveis server-side para integrações

```env
SUPABASE_SERVICE_ROLE_KEY=SUA_CHAVE_SERVER_SIDE
INTEGRATION_WEBHOOK_SECRET=UM_SEGREDO_FORTE
```

A Service Role nunca deve ser colocada em variável `NEXT_PUBLIC_*`.

## iFood e 99Food

As integrações dependem de credenciais, permissões e homologação oficiais de cada plataforma. O projeto inclui endpoint interno normalizado:

```text
POST /api/integrations/orders
x-webhook-secret: <INTEGRATION_WEBHOOK_SECRET>
```

O projeto não utiliza credenciais inventadas nem scraping como substituto de API oficial.

## Rodar localmente

Requisitos: Node.js 20+.

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Deploy na Vercel

1. Suba o conteúdo desta pasta ao repositório.
2. Importe o repositório na Vercel.
3. Framework: **Next.js**.
4. Configure as variáveis do modo escolhido.
5. Rode o build/deploy.

Não há Cron Job obrigatório.

## Validação

```bash
npm run verify
```

O verificador analisa arquivos obrigatórios, JSON, imports locais e sintaxe TS/TSX.

Consulte também:

- `OPERACAO_PRO_V2.1.md`
- `VALIDACAO_V2.1.md`
- `ENTREGA_V2.1.md`

## Antes de operar valendo dinheiro

Homologue no equipamento real:

- A4003;
- impressora térmica;
- abertura/fechamento de caixa;
- venda em todas as formas de pagamento;
- pagamento dividido;
- cancelamento e estorno;
- dose e combo;
- entrada e inventário;
- dois usuários simultâneos se o modo Supabase estiver ativo;
- iFood e 99Food com credenciais oficiais.

O sistema não substitui emissão fiscal/tributária quando legalmente necessária; essa parte deve seguir a operação fiscal definida com o contador da empresa.
