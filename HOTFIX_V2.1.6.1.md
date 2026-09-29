# Beb's Gestão — Hotfix v2.1.6.1

Corrige o erro de build:

`Module not found: Can't resolve './employees'`

## Arquivo
Copie `lib/employees.ts` para a pasta `lib` do projeto.

O arquivo é necessário porque `lib/store.tsx` da v2.1.6 importa as regras de funcionários e permissões através de `./employees`.

Nenhum SQL novo é necessário.
