# Entrega — Beb's Gestão v1.1.0

Esta versão inclui o catálogo transcrito das listas da Beb's:

- 146 produtos;
- 17 combos;
- base Excel original em `data/base_produtos_bebs.xlsx`;
- base JSON em `data/catalogo-bebs.json`;
- migration Supabase em `supabase/migrations/002_client_catalog.sql`.

Os códigos de barras não foram inventados: durante a implantação, bipe o produto com o leitor A4003 e use a opção **Vincular código** para associar o EAN real ao cadastro já existente.

Estoque e custo inicial estão zerados porque esses dados não constavam nas folhas. Os combos permanecem inativos até a composição ser conferida e vinculada aos produtos do estoque.

Consulte `README.md` e `VALIDACAO.md` antes do deploy.
