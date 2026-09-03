# Issue #7 — Reconciliação do schema e das migrations

## Resultado

O histórico versionado agora possui as mesmas 28 versões e nomes registrados em
`supabase_migrations.schema_migrations` na produção. A cadeia foi reconstruída do zero em
PostgreSQL local e produziu um catálogo público quantitativamente equivalente ao ambiente real.

Nenhuma migration foi aplicada ao projeto de produção nesta issue. Todas as consultas remotas
foram somente leitura e não foi criado projeto, branch ou recurso pago no Supabase.

## Divergências encontradas e corrigidas

- O repositório tinha 26 migrations, enquanto produção tinha 28.
- A migration inicial local possuía apenas comentários e não recriava as sete tabelas-base.
- `restrict_rls_admin_function` existia apenas no histórico remoto.
- `optimize_expense_plan_rls` existia apenas no histórico remoto.
- Os 26 arquivos locais usavam timestamps diferentes das versões efetivamente aplicadas.
- Quatro migrations iniciais estavam encurtadas. Isso removia backfill, constraints, grants e a
  definição de `advance_obligation_installment(uuid)` da reconstrução do zero.

Os conteúdos ausentes foram recuperados do campo `statements` do histórico oficial do Supabase,
e os arquivos foram renomeados para os timestamps remotos. As migrations que já correspondiam à
produção foram preservadas, mudando somente o nome do arquivo.

## Equivalência validada

| Objeto | Produção | Reconstrução local |
| --- | ---: | ---: |
| Migrations | 28 | 28 |
| Tabelas públicas | 24 | 24 |
| Colunas públicas | 273 | 273 |
| Constraints públicas | 127 | 127 |
| Índices públicos | 56 | 56 |
| Políticas RLS públicas | 51 | 51 |
| Triggers públicos | 22 | 22 |
| Funções `public` + `private` | 11 | 11 |

Todas as 24 tabelas públicas reconstruídas estão com RLS habilitado.

## Testes reproduzíveis

Execute:

```bash
npm ci
npm run test:schema
npm run build
```

`test:schema` usa PGlite, uma distribuição local e gratuita de PostgreSQL. O bootstrap cria
somente simuladores mínimos dos componentes gerenciados pelo Supabase (`auth`, `storage` e
`cron`); as 28 migrations da aplicação são então aplicadas, em ordem, sem adaptações de schema.
As únicas instruções omitidas localmente são `CREATE EXTENSION pgcrypto` e `CREATE EXTENSION
pg_cron`, porque esses componentes são fornecidos pelo ambiente hospedado.

Além da contagem do catálogo, o teste confirma:

- CRUD de proprietário e movimentação com sessão AAL2;
- bloqueio de escrita com sessão AAL1;
- isolamento de leitura entre dois proprietários;
- unicidade dos 28 timestamps;
- falha imediata quando qualquer migration não pode ser aplicada.

O workflow de publicação executa esse teste antes do build, impedindo deploy se a cadeia voltar
a ficar incompleta.

## Integridade dos dados de produção

As contagens foram capturadas antes e depois da auditoria e permaneceram idênticas:

| Tabela | Antes | Depois |
| --- | ---: | ---: |
| owners | 4 | 4 |
| transactions | 6 | 6 |
| obligations | 8 | 8 |
| cards | 3 | 3 |
| subscriptions | 2 | 2 |
| card_purchases | 2 | 2 |
| debtor_contacts | 1 | 1 |
| investments | 1 | 1 |
| investment_snapshots | 2 | 2 |
| subscription_charges | 14 | 14 |
| monthly_closures | 12 | 12 |
| finance_backups | 30 | 30 |
| financial_goals | 1 | 1 |
| expense_plan_settings | 1 | 1 |
| expense_plan_items | 14 | 14 |
| streaming_access_profiles | 5 | 5 |
| streaming_access_devices | 2 | 2 |
| streaming_access_events | 3 | 3 |

As seis tabelas não listadas têm zero registros antes e depois. `audit_log` permaneceu com 400
registros, comprovando que a própria auditoria não disparou escrita em produção.

## Advisors

Os Advisors foram executados em modo somente leitura. Não apareceu uma nova falha causada por
esta issue. Permanecem avisos já conhecidos:

- o Advisor interpreta o login anônimo habilitado como possível acesso, embora as tabelas não
  concedam privilégios ao papel `anon` e usem política restritiva para usuário nomeado com AAL2;
- algumas políticas antigas ainda podem otimizar chamadas de `auth.jwt()` com um `SELECT` externo;
- índices ainda não usados aparecem como informativos e não devem ser removidos sem dados de uso
  representativos.

Referências: [Database Advisors](https://supabase.com/docs/guides/database/database-advisors) e
[otimização de RLS](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select).

## Ordem, dependências e rollback

Os arquivos devem sempre ser aplicados pela ordem lexicográfica do timestamp. A base pressupõe
um projeto Supabase vazio, que já fornece `auth.users`, Storage e as extensões habilitáveis. As
rotinas de cron dependem de `pg_cron`; as políticas de ativos dependem de `storage.objects`.

Como a mudança desta issue é apenas de reconciliação no Git, o rollback é reverter o commit/PR.
Não se deve criar uma migration reversa nem alterar a tabela de histórico em produção. Depois que
esta PR for mesclada, migrations históricas não devem ser editadas; novos ajustes devem usar um
novo timestamp e uma nova migration progressiva.
