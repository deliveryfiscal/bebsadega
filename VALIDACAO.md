# Validação — Beb's Gestão v1.1.0

Data da revisão: 28/08/2026.

## Catálogo incorporado

- 146 produtos das listas físicas do cliente.
- 17 combos.
- 163 SKUs únicos validados.
- Preços de venda transcritos para o sistema.
- Código de barras, custo e estoque mantidos sem invenção quando não constavam nas folhas.
- Combos importados como inativos até a vinculação dos componentes reais.
- Base fonte incluída em `data/base_produtos_bebs.xlsx`.
- Base estruturada incluída em `data/catalogo-bebs.json`.

## Fluxo do leitor A4003

O PDV aceita leitor em modo teclado/HID. Quando um EAN ainda não estiver cadastrado, a tela permite vincular o código bipado a um produto que já existe no catálogo, sem recriar o item.

## Correções aplicadas nesta revisão

- Código de barras vazio deixou de gerar conflito falso de duplicidade.
- Cadastro aceita produto ainda sem EAN.
- Caixa registra como numerário apenas a parcela paga em dinheiro.
- Cancelamento de venda remove o movimento em dinheiro associado.
- F9 abre a finalização da venda.
- Produtos importados podem ser ativados/desativados no cadastro.
- Combos sem composição não podem ser salvos como operacionais.
- Funções críticas `SECURITY DEFINER` tiveram permissões de execução restritas.
- Migration `002_client_catalog.sql` adicionada para popular o catálogo no Supabase.

## Verificações executadas

- `npm run verify`: 29 arquivos TypeScript/TSX, imports locais e JSON sem erro de sintaxe.
- Compilação isolada de `lib/types.ts`, `lib/business.ts` e `lib/catalog-data.ts` com TypeScript: OK.
- Validação do catálogo: 163 registros, SKUs únicos e preços não negativos: OK.
- Regras de negócio executadas em teste: venda unitária, venda por dose, baixa de combo e restauração de combo: 4/4 OK.

## Validação que depende do ambiente de implantação

O pacote não inclui `node_modules`. O `next build` completo deve ser executado após `npm install` no computador/CI de implantação. Também é necessário testar fisicamente o leitor A4003 e, quando configurado, o banco Supabase e as credenciais oficiais de iFood/99Food.

A integração oficial com iFood/99Food não pode ser considerada homologada sem as credenciais e o processo oficial das plataformas.
