import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({
  createFinancialEntry: vi.fn(),
}));

vi.mock("../src/features/movements/financial-entry-service", () => service);

import { UnifiedEntryForm } from "../src/features/movements/UnifiedEntryForm";

function renderForm(props = {}) {
  const callbacks = {
    close: vi.fn(),
    notify: vi.fn(),
    onCreated: vi.fn(),
    ...props,
  };
  render(
    <UnifiedEntryForm
      owner={{ id: "owner-1" }}
      close={callbacks.close}
      notify={callbacks.notify}
      onCreated={callbacks.onCreated}
    />,
  );
  return callbacks;
}

async function submitType(entryType, label) {
  const callbacks = renderForm();
  service.createFinancialEntry.mockResolvedValue({
    data: { status: "created", entryType, id: `${entryType}-1` },
    error: null,
  });

  if (entryType !== "expense") {
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(label) }));
  }
  if (["receivable", "payable"].includes(entryType)) {
    fireEvent.change(screen.getByLabelText("Pessoa ou empresa"), {
      target: { value: "Maria Silva" },
    });
    fireEvent.change(screen.getByLabelText("WhatsApp"), {
      target: { value: "+55 (11) 99999-9999" },
    });
  }
  fireEvent.change(screen.getByLabelText("Descrição"), {
    target: { value: "Mercado" },
  });
  fireEvent.change(screen.getByLabelText("Valor total"), {
    target: { value: "250,00" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Salvar lançamento" }));

  await waitFor(() => expect(service.createFinancialEntry).toHaveBeenCalled());
  const [ownerId, requestId, calledType, payload] =
    service.createFinancialEntry.mock.calls[0];
  expect(ownerId).toBe("owner-1");
  expect(requestId).toEqual(expect.any(String));
  expect(calledType).toBe(entryType);
  expect(payload).toMatchObject({ description: "Mercado", total_amount: 250 });
  if (["receivable", "payable"].includes(entryType)) {
    expect(payload).toMatchObject({
      counterparty_name: "Maria Silva",
      phone: "5511999999999",
      status: "open",
    });
  }
  await waitFor(() =>
    expect(callbacks.onCreated).toHaveBeenCalledWith({
      status: "created",
      entryType,
      id: `${entryType}-1`,
    }),
  );
}

describe("formulário unificado de lançamentos", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["income", "Receita minha"],
    ["expense", "Despesa minha"],
    ["receivable", "Alguém me deve"],
    ["payable", "Eu devo alguém"],
  ])("abre e envia o fluxo %s", async (entryType, label) => {
    await submitType(entryType, label);
  });

  it("reutiliza a mesma chave idempotente ao reenviar após falha", async () => {
    const callbacks = renderForm();
    service.createFinancialEntry
      .mockResolvedValueOnce({ data: null, error: { message: "network" } })
      .mockResolvedValueOnce({
        data: { status: "created", entryType: "expense", id: "expense-1" },
        error: null,
      });
    fireEvent.change(screen.getByLabelText("Descrição"), {
      target: { value: "Conta de luz" },
    });
    fireEvent.change(screen.getByLabelText("Valor total"), {
      target: { value: "100,00" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Salvar lançamento" }));
    await waitFor(() => expect(callbacks.notify).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Salvar lançamento" }));
    await waitFor(() => expect(service.createFinancialEntry).toHaveBeenCalledTimes(2));

    expect(service.createFinancialEntry.mock.calls[0][1]).toBe(
      service.createFinancialEntry.mock.calls[1][1],
    );
    expect(callbacks.onCreated).toHaveBeenCalledTimes(1);
  });
});
