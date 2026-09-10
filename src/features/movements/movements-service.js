import { supabase } from "../../lib/supabase";

const sourceConfig = {
  transaction: { table: "transactions", select: "*" },
  obligation: { table: "obligations", select: "*" },
  card_purchase: { table: "card_purchases", select: "*,cards(name,bank)" },
  subscription_charge: {
    table: "subscription_charges",
    select: "*,subscriptions(name)",
  },
};

function requireOwnerId(ownerId) {
  if (!ownerId) throw new Error("owner_id é obrigatório");
  return ownerId;
}

function requireSource(sourceType) {
  const source = sourceConfig[sourceType];
  if (!source) throw new Error("origem financeira inválida");
  return source;
}

export function fetchLinkedMovements(ownerId) {
  requireOwnerId(ownerId);
  return Promise.all([
    supabase
      .from("obligations")
      .select("*")
      .eq("owner_id", ownerId)
      .neq("status", "cancelled"),
    supabase
      .from("card_purchases")
      .select("*,cards(name,bank)")
      .eq("owner_id", ownerId),
    supabase
      .from("subscription_charges")
      .select("*,subscriptions(name)")
      .eq("owner_id", ownerId),
  ]);
}

export function fetchMovementSource(ownerId, sourceType, sourceId) {
  requireOwnerId(ownerId);
  const source = requireSource(sourceType);
  return supabase
    .from(source.table)
    .select(source.select)
    .eq("id", sourceId)
    .eq("owner_id", ownerId)
    .single();
}

export function updateFinancialMovement(ownerId, sourceType, sourceId, payload) {
  requireOwnerId(ownerId);
  requireSource(sourceType);
  return supabase.rpc("update_financial_movement", {
    p_owner_id: ownerId,
    p_source_type: sourceType,
    p_source_id: sourceId,
    p_payload: payload,
  });
}

export function removeFinancialMovement(ownerId, sourceType, sourceId) {
  requireOwnerId(ownerId);
  requireSource(sourceType);
  return supabase.rpc("remove_financial_movement", {
    p_owner_id: ownerId,
    p_source_type: sourceType,
    p_source_id: sourceId,
  });
}
