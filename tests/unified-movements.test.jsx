import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({
  fetchLinkedMovements: vi.fn(),
  fetchMovementSource: vi.fn(),
  removeFinancialMovement: vi.fn(),
  updateFinancialMovement: vi.fn(),
}));

vi.mock("../src/features/movements/movements-service", () => service);

import { UnifiedMovements } from "../src/features/movements/UnifiedMovements";

const emptySource = { data: [], error: null };

describe("tela unificada de movimentações", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service.fetchLinkedMovements.mockResolvedValue([
      emptySource,
      emptySource,
      emptySource,
    ]);
  });

  it("renderiza a lista e filtra receitas e despesas", async () => {
    render(
      <UnifiedMovements
        owner={{ id: "owner-1" }}
        baseRows={[
          {
            id: "income-1",
            name: "Salário",
            cat: "Receita",
            value: 5000,
            date: "05 set.",
            type: "in",
            status: "Recebido",
          },
          {
            id: "expense-1",
            name: "Mercado",
            cat: "Alimentação",
            value: 200,
            date: "06 set.",
            type: "out",
            status: "Pago",
          },
        ]}
        open={vi.fn()}
        notify={vi.fn()}
        refresh={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(service.fetchLinkedMovements).toHaveBeenCalledWith("owner-1"),
    );
    expect(screen.getByText("Salário")).toBeInTheDocument();
    expect(screen.getByText("Mercado")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Receitas" }));
    expect(screen.getByText("Salário")).toBeInTheDocument();
    expect(screen.queryByText("Mercado")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Despesas" }));
    expect(screen.queryByText("Salário")).not.toBeInTheDocument();
    expect(screen.getByText("Mercado")).toBeInTheDocument();
  });

  it("abre o editor correto para uma compra de cartão", async () => {
    service.fetchLinkedMovements.mockResolvedValue([
      emptySource,
      {
        data: [
          {
            id: "purchase-1",
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
        error: null,
      },
      emptySource,
    ]);
    service.fetchMovementSource.mockResolvedValue({
      data: {
        id: "purchase-1",
        description: "Mercado",
        purchased_by: "Próprio",
        total_amount: "200",
        installment_count: 2,
        first_due_date: "2026-09-15",
        status: "open",
      },
      error: null,
    });

    render(
      <UnifiedMovements
        owner={{ id: "owner-2" }}
        baseRows={[]}
        open={vi.fn()}
        notify={vi.fn()}
        refresh={vi.fn()}
      />,
    );

    const edit = await screen.findByRole("button", {
      name: "Editar movimentação",
    });
    fireEvent.click(edit);

    expect(
      await screen.findByRole("heading", { name: "Editar movimentação" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Cartão de crédito")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Mercado")).toBeInTheDocument();
    expect(screen.getByDisplayValue("200,00")).toBeInTheDocument();
    expect(service.fetchMovementSource).toHaveBeenCalledWith(
      "owner-2",
      "card_purchase",
      "purchase-1",
    );
  });
});
