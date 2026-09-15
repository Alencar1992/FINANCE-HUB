import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "../src/components/ErrorBoundary";

const rootRender = vi.hoisted(() => vi.fn());

vi.mock("react-dom/client", () => ({
  createRoot: () => ({ render: rootRender }),
}));

import { ReportsModule } from "../src/main";

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
    name: "Mercado",
    cat: "Alimentação",
    date: "06 set.",
    type: "out",
    value: 200,
    status: "Pago",
  },
];

describe("Relatórios", () => {
  beforeEach(() => {
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:finance-hub-report"),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  it("abre a tela, mostra os lançamentos e não aciona o Error Boundary", () => {
    render(
      <ErrorBoundary>
        <ReportsModule tx={rows} />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("heading", { name: "Relatórios" })).toBeVisible();
    expect(screen.getByText("Salário")).toBeInTheDocument();
    expect(screen.getByText("Mercado")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("exporta o CSV pelo botão da tela", async () => {
    render(<ReportsModule tx={rows} />);

    fireEvent.click(screen.getByRole("button", { name: "Exportar CSV" }));

    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:finance-hub-report");

    const csvBlob = URL.createObjectURL.mock.calls[0][0];
    const csv = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(csvBlob);
    });
    expect(csv).toContain("Nome,Categoria,Data,Tipo,Valor");
    expect(csv).toContain('"Salário","Receita","05 set.",in,5000');
  });
});
