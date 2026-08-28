# Correção Vercel — v1.2.0

Esta versão corrige os dois bloqueadores de compilação reportados no deploy:

1. `CashRegister` não existe em `lucide-react@0.468.0`. O menu Caixa agora usa `WalletCards`, ícone disponível nessa versão.
2. A classe Tailwind `bg-panel-2/80` não existia no `tailwind.config.ts`. Foi criado o token `panel2` e a classe foi alterada para `bg-panel2/80`.

## Validação realizada

- `node scripts/verify-project.mjs`: aprovado.
- Busca por `CashRegister`: nenhuma ocorrência restante.
- Busca por `bg-panel-2/80`: nenhuma ocorrência restante.
- 29 arquivos TS/TSX analisados pelo verificador interno, com imports locais e JSON válidos.

O ambiente local desta sessão não conseguiu baixar as dependências npm, então o `next build` completo deve ser executado pela Vercel após subir esta versão.
