# Beb's Gestão v2.1.1 — Patch de Persistência

Este patch corrige o cenário em que uma ação parecia funcionar na tela, mas podia desaparecer após recarregar a página antes de a sincronização com o Supabase terminar.

## O que muda

- Toda alteração no `AppState` passa por **write-through**: primeiro é salva imediatamente no armazenamento local do navegador e só depois a interface é atualizada.
- Em modo Supabase, cada alteração entra imediatamente em uma **fila serial de gravação na nuvem**, sem o debounce antigo de 650 ms.
- O Supabase passa a manter um histórico em `company_state_events`, com `event_id` idempotente, cliente, motivo, snapshot, usuário e versão aplicada.
- Se a página for recarregada antes da nuvem responder, na próxima abertura o sistema compara o cache local com o snapshot remoto. Se o local for mais novo, ele é restaurado e reenviado automaticamente.
- Falha temporária de internet não apaga a alteração feita: o estado fica protegido localmente e é reenviado quando a conexão voltar.
- Reset da demonstração fica bloqueado em modo Supabase para evitar apagar a operação real acidentalmente.
- Ações que antes não geravam registro explícito (configuração do scanner, remover venda suspensa e dados da empresa) agora também entram na auditoria do estado.

## Arquivos do patch

Substituir:

- `lib/store.tsx`
- `lib/supabase/client.ts`

Adicionar:

- `lib/persistence.ts`
- `supabase/migrations/005_persistencia_duravel_v211.sql`

## SQL

Execute somente o novo SQL, depois dos anteriores:

`001 -> 002 -> 003 -> 004 -> 005`

Se 001–004 já foram executados, rode apenas:

`005_persistencia_duravel_v211.sql`

## Vercel

Em produção, use:

```env
NEXT_PUBLIC_DATA_MODE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICA
```

Não coloque a chave secreta/service-role em variável `NEXT_PUBLIC_*`.

## Teste rápido

1. Entre no sistema.
2. Cadastre um produto chamado `TESTE PERSISTENCIA`.
3. Confirme que o indicador muda de `Salvando` para `Nuvem OK`.
4. Pressione F5.
5. O produto deve continuar cadastrado.
6. Altere o estoque desse produto, atualize a página e confira novamente.
7. Repita com cliente, fornecedor, lançamento financeiro e configuração do scanner.

