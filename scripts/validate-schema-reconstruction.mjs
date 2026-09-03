import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const migrationDirectory = new URL('../supabase/migrations/', import.meta.url);
const expectedFiles = [
  '20260716151519_initial_finance_hub_schema.sql',
  '20260716151925_restrict_rls_admin_function.sql',
  '20260716191948_add_debtor_contacts.sql',
  '20260716194440_unified_installment_support.sql',
  '20260717130013_card_purchase_history_and_payments.sql',
  '20260717131908_custom_module_entries.sql',
  '20260717140516_owner_branding_preferences.sql',
  '20260717142019_harden_multitenant_security.sql',
  '20260717160904_custom_module_automations.sql',
  '20260717161551_owner_visual_assets.sql',
  '20260717164430_custom_module_financial_rules.sql',
  '20260717170946_investment_portfolio.sql',
  '20260717191357_recurring_transactions.sql',
  '20260718030729_salary_automation.sql',
  '20260718032231_server_salary_cron.sql',
  '20260718033929_streaming_management.sql',
  '20260718035207_monthly_closures.sql',
  '20260718042617_weekly_backups_and_closure_destination.sql',
  '20260718042658_enhance_monthly_closure.sql',
  '20260718051446_financial_intelligence_foundation.sql',
  '20260718051620_harden_financial_intelligence.sql',
  '20260718051858_optimize_financial_intelligence_rls.sql',
  '20260721030143_expense_elimination_plan.sql',
  '20260721030223_optimize_expense_plan_rls.sql',
  '20260721041407_brand_logos.sql',
  '20260722192359_streaming_access_beta.sql',
  '20260722192525_cleanup_deleted_custom_modules.sql',
  '20260903050045_harden_auth_mfa_rls.sql',
  '20260903182636_atomic_salary_processing.sql',
  '20260903190230_atomic_universal_movement_edit.sql',
];
const expected = {
  migrations: 30,
  tables: 24,
  columns: 273,
  constraints: 127,
  indexes: 58,
  policies: 51,
  triggers: 22,
  functions: 14,
};

const bootstrap = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin;

  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid());
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable
    as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;

  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant execute on function auth.jwt() to anon, authenticated;

  create schema storage;
  create table storage.buckets (
    id text primary key,
    name text not null,
    public boolean not null default false,
    file_size_limit bigint,
    allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text not null references storage.buckets(id),
    name text not null,
    owner_id uuid
  );
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable
    as $$ select string_to_array(name, '/') $$;

  create schema cron;
  create table cron.job (jobid bigint generated always as identity primary key, jobname text unique);
  create function cron.schedule(job_name text, schedule text, command text) returns bigint
  language plpgsql as $$ declare new_id bigint; begin
    insert into cron.job(jobname) values (job_name)
    on conflict (jobname) do update set jobname = excluded.jobname
    returning jobid into new_id;
    return new_id;
  end $$;
  create function cron.unschedule(target_job bigint) returns boolean
  language plpgsql as $$ begin delete from cron.job where jobid = target_job; return found; end $$;

  create function public.rls_auto_enable() returns void language plpgsql security definer
    as $$ begin return; end $$;
`;

const normalizeForLocal = (sql) => sql
  .replace(/^create extension if not exists pgcrypto;\s*/mi, '')
  .replace(/^create extension if not exists pg_cron with schema pg_catalog;\s*/mi, '');

const scalar = async (db, query) => {
  const result = await db.query(query);
  return Number(Object.values(result.rows[0])[0]);
};

const files = (await readdir(migrationDirectory))
  .filter((name) => /^\d{14}_[a-z0-9_]+\.sql$/.test(name))
  .sort();

if (files.length !== expected.migrations) {
  throw new Error(`Esperadas ${expected.migrations} migrations; encontradas ${files.length}.`);
}

if (files.some((file, index) => file !== expectedFiles[index])) {
  throw new Error('Os nomes/versões locais divergem do histórico oficial do Supabase.');
}

const versions = files.map((name) => name.slice(0, 14));
if (new Set(versions).size !== versions.length) {
  throw new Error('Há timestamps de migration duplicados.');
}

const db = new PGlite();
await db.exec(bootstrap);

for (const file of files) {
  const sql = normalizeForLocal(await readFile(join(migrationDirectory.pathname, file), 'utf8'));
  try {
    await db.exec(`begin;\n${sql}\ncommit;`);
  } catch (error) {
    throw new Error(`Falha ao aplicar ${file}: ${error.message}`, { cause: error });
  }
}

const actual = {
  migrations: files.length,
  tables: await scalar(db, `select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'`),
  columns: await scalar(db, `select count(*) from information_schema.columns where table_schema='public'`),
  constraints: await scalar(db, `select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public'`),
  indexes: await scalar(db, `select count(*) from pg_indexes where schemaname='public'`),
  policies: await scalar(db, `select count(*) from pg_policies where schemaname='public'`),
  triggers: await scalar(db, `select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal`),
  functions: await scalar(db, `select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind='f'`),
};

const differences = Object.entries(expected)
  .filter(([key, value]) => actual[key] !== value)
  .map(([key, value]) => `${key}: esperado ${value}, obtido ${actual[key]}`);

if (differences.length) {
  throw new Error(`Schema reconstruído diverge da produção:\n${differences.join('\n')}`);
}

const salaryRpcSecurity = await db.query(`
  select
    not p.prosecdef as security_invoker,
    p.proconfig @> array['search_path=pg_catalog, public'] as fixed_search_path,
    has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
    not has_function_privilege('anon', p.oid, 'EXECUTE') as anon_blocked,
    not has_function_privilege('public', p.oid, 'EXECUTE') as public_blocked,
    pg_get_functiondef(p.oid) ilike '%for update%' as serialized
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'process_salary_for_owner'
`);
if (!salaryRpcSecurity.rows[0] || Object.values(salaryRpcSecurity.rows[0]).some(value => value !== true)) {
  throw new Error('Contrato de segurança ou serialização da RPC salarial está incorreto.');
}

const ownerA = '00000000-0000-4000-8000-000000000001';
const ownerB = '00000000-0000-4000-8000-000000000002';
await db.exec(`insert into auth.users(id) values ('${ownerA}'), ('${ownerB}');`);
await db.exec(`
  set role authenticated;
  select set_config('request.jwt.claim.sub', '${ownerA}', false);
  select set_config('request.jwt.claims', '{"sub":"${ownerA}","aal":"aal2","is_anonymous":false}', false);
  insert into public.owners(id,name) values ('${ownerA}','Usuário de teste');
  insert into public.transactions(owner_id,name,amount,total_amount,installment_amount,transaction_type,status)
  values ('${ownerA}','Teste de reconstrução',10,10,10,'expense','paid');
`);

const ownRows = await scalar(db, `select count(*) from public.transactions`);
if (ownRows !== 1) throw new Error('Smoke CRUD falhou para o proprietário autenticado com AAL2.');

await db.exec(`
  select set_config('request.jwt.claim.sub', '${ownerB}', false);
  select set_config('request.jwt.claims', '{"sub":"${ownerB}","aal":"aal2","is_anonymous":false}', false);
`);
const foreignRows = await scalar(db, `select count(*) from public.transactions`);
if (foreignRows !== 0) throw new Error('RLS permitiu leitura cruzada entre proprietários.');

await db.exec(`
  select set_config('request.jwt.claims', '{"sub":"${ownerB}","aal":"aal1","is_anonymous":false}', false);
`);
let aal1Blocked = false;
try {
  await db.exec(`insert into public.owners(id,name) values ('${ownerB}','Sessão sem MFA');`);
} catch {
  aal1Blocked = true;
}
if (!aal1Blocked) throw new Error('A política restritiva não bloqueou uma escrita com AAL1.');
await db.exec('reset role;');
await db.exec(`insert into public.owners(id,name) values ('${ownerB}','Usuário de rollback');`);

// Valida a operação salarial atômica: resultado completo, repetição e autorização.
await db.exec(`
  insert into public.salary_settings (
    owner_id, salary_amount, salary_day, salary_enabled,
    savings_enabled, savings_mode, savings_value, savings_recurring, savings_on_salary
  ) values ('${ownerA}', 5000, 1, true, true, 'percentage', 10, true, true);
  set role authenticated;
  select set_config('request.jwt.claim.sub', '${ownerA}', false);
  select set_config('request.jwt.claims', '{"sub":"${ownerA}","aal":"aal2","is_anonymous":false}', false);
`);
const firstSalaryRun = await scalar(db, `select public.process_salary_for_owner('${ownerA}')`);
const repeatedSalaryRun = await scalar(db, `select public.process_salary_for_owner('${ownerA}')`);
if (firstSalaryRun !== 2 || repeatedSalaryRun !== 0) {
  throw new Error('Processamento salarial não foi idempotente.');
}
const salaryEvents = await scalar(db, `select count(*) from public.salary_events where owner_id='${ownerA}'`);
const salaryTransactions = await scalar(db, `select count(*) from public.transactions where owner_id='${ownerA}' and category='Salário'`);
const savingsTransactions = await scalar(db, `select count(*) from public.transactions where owner_id='${ownerA}' and category='Investimentos'`);
const savingsContribution = await scalar(db, `select contribution from public.investment_snapshots where owner_id='${ownerA}'`);
if (salaryEvents !== 2 || salaryTransactions !== 1 || savingsTransactions !== 1 || savingsContribution !== 500) {
  throw new Error('Evento, movimentação, reserva e snapshot salarial ficaram inconsistentes.');
}
const savingsTransactionResult = await db.query(`
  select transaction_id from public.salary_events where owner_id='${ownerA}' and event_type='salary_savings'
`);
const savingsTransactionId = savingsTransactionResult.rows[0]?.transaction_id;
if (!savingsTransactionId) throw new Error('Aporte salarial ficou sem movimentação vinculada.');
const savingsEditPayload = '{"total_amount":600,"status":"paid","transaction_type":"expense"}';
await db.exec(`select public.update_financial_movement('${ownerA}','transaction','${savingsTransactionId}','${savingsEditPayload}'::jsonb)`);
await db.exec(`select public.update_financial_movement('${ownerA}','transaction','${savingsTransactionId}','${savingsEditPayload}'::jsonb)`);
const editedSavingsInvestment = await scalar(db, `select current_amount from public.investments where owner_id='${ownerA}' and name='Reserva de Poupança'`);
const editedSavingsSnapshot = await scalar(db, `select contribution from public.investment_snapshots where owner_id='${ownerA}'`);
if (editedSavingsInvestment !== 600 || editedSavingsSnapshot !== 600) {
  throw new Error('Edição repetida do aporte alterou investimento ou snapshot mais de uma vez.');
}

await db.exec(`
  select set_config('request.jwt.claim.sub', '${ownerB}', false);
  select set_config('request.jwt.claims', '{"sub":"${ownerB}","aal":"aal2","is_anonymous":false}', false);
`);
let crossOwnerSalaryBlocked = false;
try {
  await db.exec(`select public.process_salary_for_owner('${ownerA}')`);
} catch {
  crossOwnerSalaryBlocked = true;
}
if (!crossOwnerSalaryBlocked) throw new Error('RPC salarial permitiu processar outro proprietário.');
await db.exec('reset role;');

// Força falha na segunda tabela e confirma rollback completo da transação.
await db.exec(`
  insert into public.salary_settings (owner_id, salary_amount, salary_day, salary_enabled)
  values ('${ownerB}', 1000, 1, true);
  create function private.fail_salary_transaction_test() returns trigger language plpgsql as $$
  begin
    if new.owner_id = '${ownerB}' then raise exception 'forced transaction failure'; end if;
    return new;
  end $$;
  create trigger fail_salary_transaction_test before insert on public.transactions
  for each row execute function private.fail_salary_transaction_test();
  set role authenticated;
  select set_config('request.jwt.claim.sub', '${ownerB}', false);
  select set_config('request.jwt.claims', '{"sub":"${ownerB}","aal":"aal2","is_anonymous":false}', false);
`);
let salaryFailureRaised = false;
try {
  await db.exec(`select public.process_salary_for_owner('${ownerB}')`);
} catch {
  salaryFailureRaised = true;
}
await db.exec('reset role; drop trigger fail_salary_transaction_test on public.transactions; drop function private.fail_salary_transaction_test();');
if (!salaryFailureRaised) throw new Error('Teste não conseguiu simular falha intermediária.');
const rolledBackEvents = await scalar(db, `select count(*) from public.salary_events where owner_id='${ownerB}'`);
const rolledBackTransactions = await scalar(db, `select count(*) from public.transactions where owner_id='${ownerB}'`);
if (rolledBackEvents !== 0 || rolledBackTransactions !== 0) {
  throw new Error('Falha intermediária deixou dados salariais parciais.');
}

// Valida a edição universal: sincronização, repetição, rollback e isolamento.
const moduleId = '10000000-0000-4000-8000-000000000001';
const transactionId = '20000000-0000-4000-8000-000000000001';
const obligationId = '30000000-0000-4000-8000-000000000001';
const entryId = '40000000-0000-4000-8000-000000000001';
await db.exec(`
  insert into public.custom_modules(id,owner_id,name) values ('${moduleId}','${ownerA}','Teste transacional');
  insert into public.transactions(id,owner_id,name,category,amount,total_amount,installment_amount,transaction_type,transaction_date,status)
  values ('${transactionId}','${ownerA}','Origem antiga','Outros',100,100,100,'expense','2026-09-01','pending');
  insert into public.obligations(id,owner_id,direction,counterparty_name,description,total_amount,remaining_amount,installment_amount,next_due_date)
  values ('${obligationId}','${ownerA}','payable','Fornecedor','Origem antiga',100,100,100,'2026-09-01');
  insert into public.custom_module_entries(id,owner_id,module_id,data) values (
    '${entryId}','${ownerA}','${moduleId}',
    '{"_finance":{"transactionId":"${transactionId}","obligationId":"${obligationId}","amount":100,"direction":"expense","status":"pending"}}'
  );
  set role authenticated;
  select set_config('request.jwt.claim.sub', '${ownerA}', false);
  select set_config('request.jwt.claims', '{"sub":"${ownerA}","aal":"aal2","is_anonymous":false}', false);
`);
const editPayload = `{
  "name":"Origem atualizada","category":"Serviços","total_amount":240,
  "installment_count":1,"transaction_type":"expense","transaction_date":"2026-09-10",
  "status":"pending","is_recurring":false,"notes":"Edição atômica"
}`;
await db.exec(`select public.update_financial_movement('${ownerA}','transaction','${transactionId}','${editPayload}'::jsonb)`);
await db.exec(`select public.update_financial_movement('${ownerA}','transaction','${transactionId}','${editPayload}'::jsonb)`);
const editedTransaction = await scalar(db, `select total_amount from public.transactions where id='${transactionId}'`);
const editedObligation = await scalar(db, `select total_amount from public.obligations where id='${obligationId}'`);
const editedEntry = await scalar(db, `select (data #>> '{_finance,amount}')::numeric from public.custom_module_entries where id='${entryId}'`);
if (editedTransaction !== 240 || editedObligation !== 240 || editedEntry !== 240) {
  throw new Error('Edição universal repetida deixou origem e vínculos divergentes.');
}

await db.exec(`
  reset role;
  create function private.fail_universal_edit_test() returns trigger language plpgsql as $$
  begin
    if new.id = '${obligationId}' then raise exception 'forced linked update failure'; end if;
    return new;
  end $$;
  create trigger fail_universal_edit_test before update on public.obligations
  for each row execute function private.fail_universal_edit_test();
  set role authenticated;
  select set_config('request.jwt.claim.sub', '${ownerA}', false);
  select set_config('request.jwt.claims', '{"sub":"${ownerA}","aal":"aal2","is_anonymous":false}', false);
`);
let universalFailureRaised = false;
try {
  await db.exec(`select public.update_financial_movement('${ownerA}','transaction','${transactionId}',
    '{"total_amount":300}'::jsonb)`);
} catch {
  universalFailureRaised = true;
}
await db.exec('reset role; drop trigger fail_universal_edit_test on public.obligations; drop function private.fail_universal_edit_test();');
if (!universalFailureRaised) throw new Error('Teste não conseguiu simular falha na origem vinculada.');
const transactionAfterRollback = await scalar(db, `select total_amount from public.transactions where id='${transactionId}'`);
const entryAfterRollback = await scalar(db, `select (data #>> '{_finance,amount}')::numeric from public.custom_module_entries where id='${entryId}'`);
if (transactionAfterRollback !== 240 || entryAfterRollback !== 240) {
  throw new Error('Falha vinculada não desfez integralmente a edição universal.');
}

await db.exec(`
  set role authenticated;
  select set_config('request.jwt.claim.sub', '${ownerB}', false);
  select set_config('request.jwt.claims', '{"sub":"${ownerB}","aal":"aal2","is_anonymous":false}', false);
`);
let crossOwnerEditBlocked = false;
try {
  await db.exec(`select public.update_financial_movement('${ownerA}','transaction','${transactionId}','{}'::jsonb)`);
} catch {
  crossOwnerEditBlocked = true;
}
if (!crossOwnerEditBlocked) throw new Error('RPC universal permitiu editar outro proprietário.');

await db.exec(`
  select set_config('request.jwt.claim.sub', '${ownerA}', false);
  select set_config('request.jwt.claims', '{"sub":"${ownerA}","aal":"aal2","is_anonymous":false}', false);
  select public.remove_financial_movement('${ownerA}','transaction','${transactionId}');
  select public.remove_financial_movement('${ownerA}','transaction','${transactionId}');
`);
const cancelledSet = await scalar(db, `
  select count(*) from (
    select status from public.transactions where id='${transactionId}' and status='cancelled'
    union all select status from public.obligations where id='${obligationId}' and status='cancelled'
    union all select data #>> '{_finance,status}' from public.custom_module_entries where id='${entryId}' and data #>> '{_finance,status}'='cancelled'
  ) linked
`);
if (cancelledSet !== 3) throw new Error('Remoção universal deixou vínculo financeiro órfão.');
await db.exec('reset role;');

const universalRpcSecurity = await db.query(`
  select p.proname, not p.prosecdef as security_invoker,
    p.proconfig @> array['search_path=pg_catalog, public'] as fixed_search_path,
    has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
    not has_function_privilege('anon', p.oid, 'EXECUTE') as anon_blocked,
    not has_function_privilege('public', p.oid, 'EXECUTE') as public_blocked,
    pg_get_functiondef(p.oid) ilike '%for update%' as serialized
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('update_financial_movement','remove_financial_movement')
`);
if (universalRpcSecurity.rows.length !== 2 || universalRpcSecurity.rows.some(row =>
  Object.entries(row).some(([key, value]) => key !== 'proname' && value !== true))) {
  throw new Error('Contrato de segurança das RPCs universais está incorreto.');
}

console.table(actual);
console.log('OK: as 30 migrations reconstruíram o catálogo público esperado.');
console.log('OK: smoke CRUD, isolamento por proprietário e exigência AAL2 validados.');
console.log('OK: salário/reserva atômicos, idempotentes e com rollback completo validados.');
console.log('OK: edição universal sincronizada, idempotente e com rollback completo validada.');
await db.close();
