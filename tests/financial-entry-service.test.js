import { beforeEach, describe, expect, it, vi } from "vitest";

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: { rpc: vi.fn() },
}));

vi.mock("../src/lib/supabase", () => ({ supabase: supabaseMock }));

import { createFinancialEntry } from "../src/features/movements/financial-entry-service";

describe("serviço do lançamento unificado", () => {
  beforeEach(() => vi.clearAllMocks());

  it("preserva owner, chave idempotente, tipo e payload no contrato RPC", async () => {
    const payload = { description: "Salário", total_amount: 5000 };
    supabaseMock.rpc.mockResolvedValue({
      data: { status: "created", id: "tx-1" },
      error: null,
    });

    await createFinancialEntry("owner-1", "request-1", "income", payload);

    expect(supabaseMock.rpc).toHaveBeenCalledWith("create_financial_entry", {
      p_owner_id: "owner-1",
      p_request_id: "request-1",
      p_entry_type: "income",
      p_payload: payload,
    });
  });

  it("recusa owner ou chave idempotente ausentes sem consultar o banco", () => {
    expect(() => createFinancialEntry(null, "request-1", "expense", {})).toThrow(
      "owner_id é obrigatório",
    );
    expect(() => createFinancialEntry("owner-1", null, "expense", {})).toThrow(
      "request_id é obrigatório",
    );
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });
});
