import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "../src/components/ErrorBoundary";
import {
  buildMovementsCsv,
  ReportsModule,
} from "../src/features/reports/ReportsModule";

const rows = [
  {
    id: "income-1",
    name: "Salário",
    cat: "Receita",
    date: "05 set.",
    type: "in",
    value: 5000,
    status: "Recebido",
  },
  {
    id: "expense-1",
    name: "Mercado, mês",
    cat: "Alimentação",
    date: "06 set.",
    type: "out",
    value: 200,
    status: "Pago",
  },
];

describe("módulo de relatórios", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("abre o resumo e o detalhamento sem derrubar a tela", () => {
    render(
      <ErrorBoundary>
        <ReportsModule tx={rows} />
      </ErrorBoundary>,
    );

    expect(
      screen.getByRole("heading", { name: "Relatórios" }),
    ).toBeInTheDocument();
    expect(screen.getByText("R$ 5.000,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 200,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 4.800,00")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Detalhamento" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Salário")).toBeInTheDocument();
    expect(screen.getByText("Mercado, mês")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("gera CSV válido e inicia o download", () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => "blob:report-test");
    const revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });

    render(<ReportsModule tx={rows} />);
    fireEvent.click(screen.getByRole("button", { name: "Exportar CSV" }));

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(createObjectURL.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect(click).toHaveBeenCalledOnce();
    expect(document.querySelector('a[href="blob:report-test"]')).toBeNull();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(3000);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:report-test");
  });

  it("protege campos com vírgulas e aspas no CSV", () => {
    expect(
      buildMovementsCsv([
        {
          name: 'Mercado "Central", mês',
          cat: "Alimentação",
          date: "06 set.",
          type: "out",
          value: 200,
        },
      ]),
    ).toContain('"Mercado ""Central"", mês"');
  });

  it("mantém a exportação desabilitada quando não há dados", () => {
    render(<ReportsModule tx={[]} />);

    expect(screen.getByRole("button", { name: "Exportar CSV" })).toBeDisabled();
    expect(
      screen.getByText("Nenhuma movimentação neste filtro."),
    ).toBeInTheDocument();
  });
});
