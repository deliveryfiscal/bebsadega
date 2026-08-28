# Correção Vercel v1.3

Corrigido erro de TypeScript no formulário de produtos relacionado a `dosePrices`.

## Causa
O estado do formulário era inferido como uma união entre `Record<string, number>` e um objeto literal com chaves `50`, `100` e `200`. Ao indexar com `String(ml)`, o TypeScript do build de produção recusava a operação.

## Correção
- Criado `ProductFormState` com `dosePrices: Record<string, number>`.
- `useState` agora possui tipo explícito.
- Criada função `toFormState()` para normalizar `dosePrices`, `comboItems`, `brand` e `bottleVolumeMl`.
- O campo `kind` agora é convertido explicitamente para `ProductKind`.
- A normalização também evita erro em runtime caso um produto antigo não possua `comboItems` ou `dosePrices`.
