# Beb's Gestão v2.1.3 — PIN Gerencial

Base obrigatória: v2.1 + persistência v2.1.1 + garrafas/dose v2.1.2 + SQL 006 de correção de sync.

## O que este patch protege

As telas abaixo exigem PIN sempre que forem abertas:

- Financeiro
- Relatórios
- Auditoria
- Vendas
- Resumo do dia

Ao sair da tela e voltar, o PIN é solicitado novamente.

Também exige PIN antes de qualquer redução manual de estoque que não seja consequência de uma venda:

- ajuste negativo na tela Estoque;
- edição de produto reduzindo o estoque atual;
- inventário que aplique uma ou mais divergências negativas;
- perda em ml;
- conferência de garrafa que reduza o volume total disponível.

Não exige PIN para venda normal no PDV, venda de garrafa inteira, venda em ml, entrada de estoque ou cancelamento que devolva mercadoria.

## Configuração obrigatória na Vercel

Adicione a variável privada:

```env
MANAGER_PIN=4024
```

Não use `NEXT_PUBLIC_MANAGER_PIN`.

Depois de salvar a variável, faça um novo deploy para que a Route Handler server-side receba o valor.

## Segurança

O PIN não fica no JavaScript enviado ao navegador. A validação acontece em `/api/manager-pin/verify` no servidor. A comparação usa `timingSafeEqual`, há limite básico de tentativas por origem e as respostas não são cacheadas.

Autorizações de acesso a telas e reduções de estoque são registradas na Auditoria.

## SQL

Nenhum SQL novo é necessário. Mantenha a sequência já aplicada até o 006.
