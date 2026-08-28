# Correção Vercel v1.4

## Falha corrigida
A Vercel bloqueou o deploy porque o projeto usava `next@15.2.4`, versão sinalizada como vulnerável pelo aviso CVE-2025-66478.

## Alteração
- Next.js: `15.2.4` -> `15.2.6`
- Versão do projeto: `1.3.0` -> `1.4.0`

A atualização foi mantida dentro da mesma linha 15.2.x para minimizar risco de quebra de compatibilidade.

## Aviso `sharp@0.33.5`
A mensagem `npm warn allow-scripts ... sharp@0.33.5` é um aviso do npm sobre script de instalação. Ela não é a causa da falha mostrada pela Vercel.
