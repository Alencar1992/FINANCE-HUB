import { supabase } from "../../lib/supabase";

// Impede consultas financeiras sem o identificador do proprietário.
function requireOwnerId(ownerId) {
  if (!ownerId) throw new Error("owner_id é obrigatório para acessar dados financeiros.");
}

// Operações de leitura usadas na inicialização e no cabeçalho do aplicativo.
export async function getProfileAssetSignedUrl(assetPath, expiresIn = 3600) {
  if (!assetPath) return "";
  const { data, error } = await supabase.storage
    .from("finance-assets")
    .createSignedUrl(assetPath, expiresIn);
  if (error) return "";
  return data?.signedUrl || "";
}

export function fetchTransactions(ownerId) {
  requireOwnerId(ownerId);
  return supabase
    .from("transactions")
    .select("*")
    .eq("owner_id", ownerId)
    .order("transaction_date", { ascending: false });
}

export function fetchNextMonthlyClosure(ownerId) {
  requireOwnerId(ownerId);
  return supabase
    .from("monthly_closures")
    .select("*")
    .eq("owner_id", ownerId)
    .in("status", ["pending", "ready"])
    .order("reference_month", { ascending: true })
    .limit(1)
    .maybeSingle();
}

export function fetchLatestBackup(ownerId) {
  requireOwnerId(ownerId);
  return supabase
    .from("finance_backups")
    .select("backup_date,created_at,status")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
}

export function fetchActiveCustomModules(ownerId) {
  requireOwnerId(ownerId);
  return supabase
    .from("custom_modules")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("active", true)
    .order("created_at");
}

// Operações salariais e de fechamento mantêm as rotinas transacionais existentes.
export async function runSalarySchedule(ownerId) {
  requireOwnerId(ownerId);
  const { data, error } = await supabase.rpc("process_salary_for_owner", {
    p_owner_id: ownerId,
  });
  if (error) throw error;
  return Number(data || 0);
}

export function fetchPendingSalaryNotifications(ownerId) {
  requireOwnerId(ownerId);
  return supabase
    .from("salary_events")
    .select("id,event_type,amount,reference_month,created_at")
    .eq("owner_id", ownerId)
    .in("event_type", ["salary_savings", "advance_savings"])
    .is("notified_at", null)
    .order("created_at", { ascending: true });
}

export function acknowledgeSalaryNotifications(ownerId, ids, notifiedAt) {
  requireOwnerId(ownerId);
  if (!ids?.length) return Promise.resolve({ error: null });
  return supabase
    .from("salary_events")
    .update({ notified_at: notifiedAt })
    .eq("owner_id", ownerId)
    .in("id", ids);
}

export function finishMonthlyClosure(ownerId, closureId, completedAt) {
  requireOwnerId(ownerId);
  if (!closureId) throw new Error("O fechamento mensal é obrigatório.");
  return supabase
    .from("monthly_closures")
    .update({
      status: "completed",
      closed_at: completedAt,
      downloaded_at: completedAt,
    })
    .eq("id", closureId)
    .eq("owner_id", ownerId);
}
