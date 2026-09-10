# Entrega Beb's Gestão v2.1

## Incluído

- Código-fonte Next.js + TypeScript + Tailwind.
- Catálogo real transcrito da Beb's: 146 produtos e 17 combos.
- PDV scanner-first.
- Cadastro por bipagem com múltiplos barcodes e multiplicadores.
- Entrada rápida e inventário express.
- Consulta de preço.
- Estoque, doses e garrafas abertas.
- Compras e fornecedores.
- Caixa, financeiro, CRM e vendas.
- Alertas, auditoria, implantação e resumo diário.
- Estrutura de iFood/99Food.
- Modo local e modo Supabase com login/sincronização centralizada.
- SQLs `001` a `004`.
- `.env.example`.

## Banco — ordem

`001 → 002 → 003 → 004`

Depois, crie o usuário no Supabase Auth e vincule o UUID dele a `public.profiles` com a empresa correta.
