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
];
const expected = {
  migrations: 28,
  tables: 24,
  columns: 273,
  constraints: 127,
  indexes: 56,
  policies: 51,
  triggers: 22,
  functions: 11,
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

console.table(actual);
console.log('OK: as 28 migrations reconstruíram o catálogo público equivalente à produção.');
console.log('OK: smoke CRUD, isolamento por proprietário e exigência AAL2 validados.');
await db.close();
