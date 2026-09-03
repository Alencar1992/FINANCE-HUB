# Issue #4 — autenticação, MFA e RLS

## Diagnóstico de produção (somente leitura)

- As 24 tabelas públicas estão com RLS habilitada.
- As 51 policies públicas combinam propriedade por `auth.uid()` com uma policy restritiva que exige usuário identificado e `aal2`.
- Nenhuma policy usa `user_metadata` para autorização.
- O bucket privado `finance-assets` isola objetos pelo primeiro segmento do caminho, mas ainda não exige MFA no banco.
- O papel `anon` possui privilégios desnecessários nas tabelas públicas e em duas RPCs.
- Há duas identidades anônimas antigas. Uma possui perfil e 68 registros de histórico/backup/fechamento; os dados não devem ser apagados nem receber outro proprietário.
- O Security Advisor informa que a proteção contra senhas vazadas está desativada.

## Estratégia

1. Preservar as identidades e os dados anônimos para permitir a conversão da conta no mesmo UUID.
2. Remover todos os privilégios do papel de banco `anon` no schema `public`.
3. Remover `TRUNCATE`, `REFERENCES` e `TRIGGER` de `authenticated`, pois não são usados pelo cliente e `TRUNCATE` não passa por RLS.
4. Exigir usuário identificado e sessão `aal2` no bucket `finance-assets`, além do isolamento existente por pasta/UUID.
5. Manter CRUD normal para usuários identificados com MFA.

## Validação em homologação

Execute, nesta ordem:

1. Aplicar `20260903050000_harden_auth_mfa_rls.sql` em um branch Supabase sem dados de produção.
2. Executar `supabase/tests/issue_4_security.sql`.
3. Validar no aplicativo: cadastro, confirmação de e-mail, login, MFA, recuperação de senha e renovação de sessão.
4. Testar usuário A contra dados do usuário B em SELECT, INSERT, UPDATE e DELETE.
5. Testar sessão sem autenticação, identidade anônima, sessão `aal1` e sessão `aal2`.
6. Testar upload, leitura, substituição e exclusão de avatar e imagem de fundo.
7. Executar novamente o Security Advisor e registrar alertas residuais justificados.
8. Ativar manualmente **Auth → Password security → Leaked password protection** no painel do Supabase e repetir cadastro/troca/recuperação de senha.

## Rollback

Se a homologação bloquear um fluxo legítimo:

1. Remover apenas a policy `finance_assets_named_mfa` do `storage.objects`.
2. Restaurar ao papel `anon` somente os privilégios específicos comprovadamente necessários; não restaurar `TRUNCATE`, `REFERENCES` ou `TRIGGER`.
3. Não excluir usuários anônimos nem alterar `owner_id` durante o rollback.

