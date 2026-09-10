# Validação — Beb's Gestão v2.1

## Validações executadas no pacote

- Verificação estrutural de arquivos obrigatórios.
- Parse/sintaxe de todos os arquivos `.ts` e `.tsx` pelo compilador TypeScript.
- Verificação de imports locais.
- Verificação de JSON (`package.json` e `tsconfig.json`).
- Typecheck auxiliar com stubs apenas para isolar tipos internos do projeto, já que as dependências npm não estavam disponíveis neste ambiente.
- 15 testes de regras de negócio executados e aprovados: normalização de barcode, busca de códigos, multiplicador de caixa, carrinho/desconto, baixa e estorno de unidade, dose, volume insuficiente, combo, disponibilidade de combo, telefone, estoque baixo, implantação e alertas.
- Verificação de catálogo: 146 produtos + 17 combos preservados.

## Limitação de validação local

O `npm install` não concluiu neste ambiente por indisponibilidade/timeout de acesso ao registry, portanto o `next build` real deve ser executado na Vercel ou em uma máquina com as dependências instaladas.

## Testes físicos obrigatórios antes de operação

1. A4003: unidade, caixa/pack e leitura repetida.
2. Impressora térmica 58/80 mm no navegador/equipamento real.
3. Venda em Dinheiro, PIX, Débito, Crédito e pagamento dividido.
4. Cancelamento com devolução de estoque e ajuste de caixa/financeiro.
5. Dose consumindo garrafa aberta e abrindo nova garrafa.
6. Combo baixando todos os componentes.
7. Inventário e entrada rápida.
8. Login de cada perfil quando `NEXT_PUBLIC_DATA_MODE=supabase`.
9. Duas sessões simultâneas para validar detecção de conflito de sincronização.
10. iFood/99Food somente após credenciais e homologação oficiais.
