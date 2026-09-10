import { beforeEach, describe, expect, it, vi } from "vitest";

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock("../src/lib/supabase", () => ({ supabase: supabaseMock }));

import {
  fetchLinkedMovements,
  fetchMovementSource,
  removeFinancialMovement,
  updateFinancialMovement,
} from "../src/features/movements/movements-service";

function queryResult(result = { data: [], error: null }) {
  const query = {};
  for (const method of ["select", "eq", "neq"]) {
    query[method] = vi.fn(() => query);
  }
  query.single = vi.fn(() => Promise.resolve(result));
  query.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return query;
}

describe("serviço de movimentações", () => {
  beforeEach(() => vi.clearAllMocks());

  it("recusa operações sem proprietário autenticado", () => {
    expect(() => fetchLinkedMovements()).toThrow("owner_id é obrigatório");
    expect(() =>
      updateFinancialMovement(null, "transaction", "tx-1", {}),
    ).toThrow("owner_id é obrigatório");
    expect(supabaseMock.from).not.toHaveBeenCalled();
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it("carrega todas as origens vinculadas limitadas ao proprietário", async () => {
    const obligations = queryResult({ data: [{ id: "o-1" }], error: null });
    const purchases = queryResult({ data: [{ id: "p-1" }], error: null });
    const charges = queryResult({ data: [{ id: "s-1" }], error: null });
    supabaseMock.from
      .mockReturnValueOnce(obligations)
      .mockReturnValueOnce(purchases)
      .mockReturnValueOnce(charges);

    await expect(fetchLinkedMovements("owner-1")).resolves.toEqual([
      { data: [{ id: "o-1" }], error: null },
      { data: [{ id: "p-1" }], error: null },
      { data: [{ id: "s-1" }], error: null },
    ]);

    expect(supabaseMock.from.mock.calls.map(([table]) => table)).toEqual([
      "obligations",
      "card_purchases",
      "subscription_charges",
    ]);
    for (const query of [obligations, purchases, charges]) {
      expect(query.eq).toHaveBeenCalledWith("owner_id", "owner-1");
    }
    expect(obligations.neq).toHaveBeenCalledWith("status", "cancelled");
  });

  it.each([
    ["transaction", "transactions", "*"],
    ["obligation", "obligations", "*"],
    ["card_purchase", "card_purchases", "*,cards(name,bank)"],
    [
      "subscription_charge",
      "subscription_charges",
      "*,subscriptions(name)",
    ],
  ])(
    "abre %s na tabela correta e mantém o filtro de proprietário",
    async (sourceType, table, select) => {
      const query = queryResult({ data: { id: "source-1" }, error: null });
      supabaseMock.from.mockReturnValue(query);

      await fetchMovementSource("owner-2", sourceType, "source-1");

      expect(supabaseMock.from).toHaveBeenCalledWith(table);
      expect(query.select).toHaveBeenCalledWith(select);
      expect(query.eq).toHaveBeenCalledWith("id", "source-1");
      expect(query.eq).toHaveBeenCalledWith("owner_id", "owner-2");
      expect(query.single).toHaveBeenCalled();
    },
  );

  it("preserva o contrato transacional do RPC de atualização", async () => {
    supabaseMock.rpc.mockResolvedValue({ data: { status: "updated" }, error: null });
    const payload = { total_amount: 125.9, status: "paid" };

    await updateFinancialMovement(
      "owner-3",
      "card_purchase",
      "purchase-1",
      payload,
    );

    expect(supabaseMock.rpc).toHaveBeenCalledWith("update_financial_movement", {
      p_owner_id: "owner-3",
      p_source_type: "card_purchase",
      p_source_id: "purchase-1",
      p_payload: payload,
    });
  });

  it("preserva o contrato idempotente do RPC de exclusão", async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: { status: "already_removed" },
      error: null,
    });

    await removeFinancialMovement(
      "owner-4",
      "subscription_charge",
      "charge-1",
    );

    expect(supabaseMock.rpc).toHaveBeenCalledWith("remove_financial_movement", {
      p_owner_id: "owner-4",
      p_source_type: "subscription_charge",
      p_source_id: "charge-1",
    });
  });

  it("recusa uma origem desconhecida antes de consultar o banco", () => {
    expect(() => fetchMovementSource("owner-5", "unknown", "item-1")).toThrow(
      "origem financeira inválida",
    );
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });
});
