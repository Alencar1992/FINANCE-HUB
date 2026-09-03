import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "../src/components/ErrorBoundary";

function BrokenScreen() { throw new Error("falha controlada para teste"); }

describe("proteção contra tela branca", () => {
  it("mostra recuperação quando uma tela falha", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ErrorBoundary><BrokenScreen /></ErrorBoundary>);
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível abrir esta tela");
    expect(screen.getByRole("button", { name: "Atualizar aplicativo" })).toBeVisible();
    consoleSpy.mockRestore();
  });

  it("renderiza normalmente quando não há erro", () => {
    render(<ErrorBoundary><button type="button">Abrir resumo</button></ErrorBoundary>);
    fireEvent.click(screen.getByRole("button", { name: "Abrir resumo" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
