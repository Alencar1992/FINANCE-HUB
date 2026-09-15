import { describe, expect, it } from "vitest";

import {
  buildFinancialEntryPayload,
  createdEntryMessage,
  entryStatusOptions,
} from "../src/features/movements/financial-entry-utils";

const baseValues = {
  description: "Mercado do bairro",
  category: "",
  total: "1.234,56",
  installments: 3,
  date: "2026-09-15",
  status: "pending",
  notes: "  compra mensal  ",
};

describe("adaptador do lançamento unificado", () => {
  it.each([
    ["income", "transaction", "Outras receitas"],
    ["expense", "transaction", "Alimentação"],
    ["receivable", "obligation", "Alimentação"],
    ["payable", "obligation", "Alimentação"],
  ])("normaliza o tipo %s para a fonte %s", (entryType, sourceType, category) => {
    const payload = buildFinancialEntryPayload(entryType, {
      ...baseValues,
      description: entryType === "income" ? "Consultoria" : baseValues.description,
      status: sourceType === "transaction" ? "pending" : "open",
      counterparty: sourceType === "obligation" ? "  Maria Silva  " : undefined,
      phone: sourceType === "obligation" ? "+55 (11) 99999-9999" : undefined,
    });

    expect(payload).toMatchObject({
      description: entryType === "income" ? "Consultoria" : "Mercado do bairro",
      category,
      total_amount: 1234.56,
      installments: 3,
      date: "2026-09-15",
      status: sourceType === "transaction" ? "pending" : "open",
      notes: "compra mensal",
    });
    if (sourceType === "transaction") {
      expect(payload).toMatchObject({
        is_recurring: false,
        classification_source: "rules",
      });
      expect(payload).not.toHaveProperty("counterparty_name");
    } else {
      expect(payload).toMatchObject({
        counterparty_name: "Maria Silva",
        phone: "5511999999999",
      });
      expect(payload).not.toHaveProperty("is_recurring");
    }
  });

  it("torna recorrência e parcelamento mutuamente exclusivos", () => {
    const payload = buildFinancialEntryPayload("expense", {
      ...baseValues,
      recurring: true,
      recurrenceDay: "12",
    });

    expect(payload).toMatchObject({
      installments: 1,
      is_recurring: true,
      recurrence_day: 12,
    });
  });

  it("valida os dados obrigatórios antes de chamar o banco", () => {
    expect(() => buildFinancialEntryPayload("invalid", baseValues)).toThrow(
      "Tipo de lançamento inválido",
    );
    expect(() =>
      buildFinancialEntryPayload("expense", { ...baseValues, total: "0" }),
    ).toThrow("Informe um valor válido");
    expect(() =>
      buildFinancialEntryPayload("receivable", { ...baseValues, status: "open" }),
    ).toThrow("Informe a pessoa ou empresa");
  });

  it("expõe status e mensagens coerentes com o resultado", () => {
    expect(entryStatusOptions("income")).toEqual([
      ["pending", "Pendente"],
      ["received", "Recebida"],
    ]);
    expect(createdEntryMessage({ idempotentReplay: true })).toContain(
      "nenhuma duplicação",
    );
    expect(createdEntryMessage({ duplicateOf: "tx-1" })).toContain(
      "possível duplicidade",
    );
  });
});
