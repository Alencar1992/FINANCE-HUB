import { beforeEach, describe, expect, it, vi } from "vitest";

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {
    from: vi.fn(),
    rpc: vi.fn(),
    storage: { from: vi.fn() },
  },
}));

vi.mock("../src/lib/supabase", () => ({ supabase: supabaseMock }));

import {
  acknowledgeSalaryNotifications,
  fetchActiveCustomModules,
  fetchTransactions,
  finishMonthlyClosure,
  getProfileAssetSignedUrl,
  runSalarySchedule,
} from "../src/features/app-shell/app-shell-service";

function queryResult(result = { data: [], error: null }) {
  const query = {};
  for (const method of ["select", "eq", "in", "is", "order", "limit", "maybeSingle", "update"]) {
    query[method] = vi.fn(() => query);
  }
  query.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return query;
}

describe("serviço do núcleo do aplicativo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("recusa consultas financeiras sem owner_id", () => {
    expect(() => fetchTransactions()).toThrow("owner_id é obrigatório");
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it("lista movimentações sempre limitadas ao proprietário", async () => {
    const query = queryResult({ data: [{ id: "tx-1" }], error: null });
    supabaseMock.from.mockReturnValue(query);

    await expect(fetchTransactions("owner-1")).resolves.toEqual({
      data: [{ id: "tx-1" }],
      error: null,
    });
    expect(supabaseMock.from).toHaveBeenCalledWith("transactions");
    expect(query.eq).toHaveBeenCalledWith("owner_id", "owner-1");
    expect(query.order).toHaveBeenCalledWith("transaction_date", { ascending: false });
  });

  it("mantém apenas módulos ativos do proprietário", async () => {
    const query = queryResult();
    supabaseMock.from.mockReturnValue(query);

    await fetchActiveCustomModules("owner-2");
    expect(supabaseMock.from).toHaveBeenCalledWith("custom_modules");
    expect(query.eq).toHaveBeenCalledWith("owner_id", "owner-2");
    expect(query.eq).toHaveBeenCalledWith("active", true);
  });

  it("preserva o RPC salarial transacional e converte o resultado", async () => {
    supabaseMock.rpc.mockResolvedValue({ data: "2", error: null });

    await expect(runSalarySchedule("owner-3")).resolves.toBe(2);
    expect(supabaseMock.rpc).toHaveBeenCalledWith("process_salary_for_owner", {
      p_owner_id: "owner-3",
    });
  });

  it("propaga falhas do processamento salarial", async () => {
    const error = new Error("rpc indisponível");
    supabaseMock.rpc.mockResolvedValue({ data: null, error });

    await expect(runSalarySchedule("owner-3")).rejects.toBe(error);
  });

  it("gera URL temporária sem expor o caminho do arquivo", async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://storage.test/avatar" },
      error: null,
    });
    supabaseMock.storage.from.mockReturnValue({ createSignedUrl });

    await expect(getProfileAssetSignedUrl("owner/avatar.webp")).resolves.toBe(
      "https://storage.test/avatar",
    );
    expect(supabaseMock.storage.from).toHaveBeenCalledWith("finance-assets");
    expect(createSignedUrl).toHaveBeenCalledWith("owner/avatar.webp", 3600);
  });

  it("marca avisos e fechamento somente dentro do proprietário", async () => {
    const noticesQuery = queryResult();
    const closureQuery = queryResult();
    supabaseMock.from
      .mockReturnValueOnce(noticesQuery)
      .mockReturnValueOnce(closureQuery);

    await acknowledgeSalaryNotifications("owner-4", ["event-1"], "2026-09-08T20:00:00.000Z");
    await finishMonthlyClosure("owner-4", "closure-1", "2026-09-08T20:00:00.000Z");

    expect(noticesQuery.eq).toHaveBeenCalledWith("owner_id", "owner-4");
    expect(noticesQuery.in).toHaveBeenCalledWith("id", ["event-1"]);
    expect(closureQuery.eq).toHaveBeenCalledWith("id", "closure-1");
    expect(closureQuery.eq).toHaveBeenCalledWith("owner_id", "owner-4");
    expect(closureQuery.update).toHaveBeenCalledWith({
      status: "completed",
      closed_at: "2026-09-08T20:00:00.000Z",
      downloaded_at: "2026-09-08T20:00:00.000Z",
    });
  });
});
