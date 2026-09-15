import { supabase } from "../../lib/supabase";

export function createFinancialEntry(ownerId, requestId, entryType, payload) {
  if (!ownerId) throw new Error("owner_id é obrigatório");
  if (!requestId) throw new Error("request_id é obrigatório");
  return supabase.rpc("create_financial_entry", {
    p_owner_id: ownerId,
    p_request_id: requestId,
    p_entry_type: entryType,
    p_payload: payload,
  });
}
