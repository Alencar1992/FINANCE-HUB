import { describe, expect, it } from "vitest";
import {
  buildMovementPayload,
  mapLinkedMovements,
  movementValue,
} from "../src/features/movements/movement-utils";

function form(values) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("regras de apresentação e edição de movimentações", () => {
  it("mapeia obrigações, cartões e streamings sem perder a origem", () => {
    const rows = mapLinkedMovements(
      [
        {
          id: "o-1",
          direction: "receivable",
          counterparty_name: "Vitória",
          description: "Netflix",
          installment_amount: "25.90",
          next_due_date: "2026-09-10",
          paid_installments: 1,
          installments: 3,
          status: "open",
        },
      ],
      [
        {
          id: "p-1",
          cards: { name: "Nubank" },
          description: "Mercado",
          purchased_by: "Próprio",
          installment_amount: "100",
          first_due_date: "2026-09-15",
          paid_installments: 0,
          installment_count: 2,
          status: "open",
        },
      ],
      [
        {
          id: "s-1",
          subscriptions: { name: "Netflix" },
          participant_name: "Vitória",
          amount: "25.90",
          due_date: "2026-09-20",
          status: "overdue",
        },
      ],
    );

    expect(rows).toHaveLength(3);
    expect(rows.map(({ sourceType, sourceId }) => [sourceType, sourceId])).toEqual([
      ["obligation", "o-1"],
      ["card_purchase", "p-1"],
      ["subscription_charge", "s-1"],
    ]);
    expect(rows[0]).toMatchObject({ type: "in", status: "Parcela 2/3" });
    expect(rows[1]).toMatchObject({ type: "out", status: "Parcela 1/2" });
    expect(rows[2]).toMatchObject({ type: "in", status: "Vencido" });
  });

  it("mantém o payload completo de uma movimentação manual recorrente", () => {
    const payload = buildMovementPayload(
      "transaction",
      form({
        name: "  Salário  ",
        category: "Receita",
        installments: "1",
        direction: "income",
        date: "2026-09-05",
        status: "received",
        recurring: "on",
        recurrence_day: "5",
        notes: "Mensal",
      }),
      5000,
      {},
    );

    expect(payload).toEqual({
      name: "Salário",
      category: "Receita",
      total_amount: 5000,
      installment_count: 1,
      transaction_type: "income",
      transaction_date: "2026-09-05",
      status: "received",
      is_recurring: true,
      recurrence_day: 5,
      notes: "Mensal",
    });
  });

  it("normaliza telefone e preserva os campos de obrigação", () => {
    const payload = buildMovementPayload(
      "obligation",
      form({
        direction: "receivable",
        counterparty: "Vitória",
        phone: "+55 (11) 99999-9999",
        description: "Netflix",
        category: "Streaming",
        installments: "4",
        date: "2026-09-10",
        status: "open",
        notes: "Retroativo",
      }),
      103.6,
      {},
    );

    expect(payload).toMatchObject({
      phone: "5511999999999",
      total_amount: 103.6,
      installments: 4,
      next_due_date: "2026-09-10",
    });
  });

  it("preserva os contratos de cartão e streaming", () => {
    expect(
      buildMovementPayload(
        "card_purchase",
        form({
          description: "Mercado",
          counterparty: "Próprio",
          installments: "2",
          date: "2026-09-15",
          status: "open",
        }),
        200,
        {},
      ),
    ).toEqual({
      description: "Mercado",
      purchased_by: "Próprio",
      total_amount: 200,
      installment_count: 2,
      first_due_date: "2026-09-15",
      status: "open",
    });

    expect(
      buildMovementPayload(
        "subscription_charge",
        form({
          counterparty: "Vitória",
          phone: "11 99999-9999",
          date: "2026-09-20",
          status: "pending",
        }),
        25.9,
        {},
      ),
    ).toEqual({
      participant_name: "Vitória",
      phone: "11999999999",
      amount: 25.9,
      due_date: "2026-09-20",
      status: "pending",
    });
  });

  it("seleciona o valor correto para cada origem", () => {
    expect(movementValue("transaction", { total_amount: "10" })).toBe(10);
    expect(movementValue("obligation", { total_amount: "20" })).toBe(20);
    expect(movementValue("card_purchase", { total_amount: "30" })).toBe(30);
    expect(movementValue("subscription_charge", { amount: "40" })).toBe(40);
  });
});
