import { describe, expect, it } from "vitest";
import {
  calculateCardPayment, calculateSavings, dueDateFor, installmentAmount,
  isPotentialDuplicate, money, monthStart, normalizeText, parseBRNumber,
  simulateDebt, simulateExpensePlan, summarizeCashflow,
} from "../src/lib/finance";

describe("moeda brasileira e parcelamento", () => {
  it("interpreta valores brasileiros e internacionais", () => {
    expect(parseBRNumber("R$ 1.234,56")).toBe(1234.56);
    expect(parseBRNumber("55.90")).toBe(55.9);
    expect(Number.isNaN(parseBRNumber(""))).toBe(true);
    expect(money(1234.56)).toContain("1.234,56");
  });

  it("arredonda a parcela em centavos", () => {
    expect(installmentAmount(100, 3)).toBe(33.33);
    expect(installmentAmount(55.9, 1)).toBe(55.9);
  });
});

describe("datas, recorrência e virada de mês", () => {
  it("limita o vencimento ao último dia de fevereiro bissexto", () => {
    expect(dueDateFor(31, new Date(2028, 1, 10))).toBe("2028-02-29");
    expect(dueDateFor(31, new Date(2027, 1, 10))).toBe("2027-02-28");
  });

  it("gera a competência sem deslocamento UTC", () => {
    expect(monthStart(new Date(2027, 0, 31, 23, 59))).toBe("2027-01-01");
  });
});

describe("duplicidade", () => {
  const base = { name: "Café São João", amount: 19.9, transaction_type: "expense", transaction_date: "2026-09-03" };
  it("tolera acentos, caixa e dois dias", () => {
    expect(normalizeText("Café São João")).toBe("cafesaojoao");
    expect(isPotentialDuplicate(base, { ...base, name: "CAFE SAO JOAO", transaction_date: "2026-09-05" })).toBe(true);
  });
  it("não confunde valores ou tipos diferentes", () => {
    expect(isPotentialDuplicate(base, { ...base, amount: 20 })).toBe(false);
    expect(isPotentialDuplicate(base, { ...base, transaction_type: "income" })).toBe(false);
  });
});

describe("saldo, pagamentos e reserva", () => {
  it("ignora cancelados no saldo consolidado", () => {
    expect(summarizeCashflow([
      { type: "in", value: 1000, status: "received" },
      { type: "out", value: 250, status: "paid" },
      { type: "out", value: 800, status: "cancelled" },
    ])).toEqual({ income: 1000, expense: 250, balance: 750 });
  });

  it("calcula pagamento total e parcial do cartão", () => {
    const purchases = [
      { id: "a", status: "open", total_amount: 300, installment_amount: 100, paid_installments: 1 },
      { id: "b", status: "open", total_amount: 80, installment_amount: 80, paid_installments: 0 },
      { id: "c", status: "paid", total_amount: 50, installment_amount: 50, paid_installments: 1 },
    ];
    expect(calculateCardPayment(purchases)).toEqual({ count: 2, current: 180, remaining: 280 });
    expect(calculateCardPayment(purchases, ["a"])).toEqual({ count: 1, current: 100, remaining: 200 });
  });

  it("calcula reserva salarial fixa e percentual", () => {
    expect(calculateSavings(5000, "percentage", 10)).toBe(500);
    expect(calculateSavings(5000, "fixed", 250.1)).toBe(250.1);
  });
});

describe("projeções financeiras", () => {
  it("antecipa a quitação e reduz juros", () => {
    const base = simulateDebt({ principal: 5000, monthlyRate: 0.02, payment: 350 });
    const accelerated = simulateDebt({ principal: 5000, monthlyRate: 0.02, payment: 350, extra: 100 });
    expect(accelerated.months).toBeLessThan(base.months);
    expect(accelerated.interest).toBeLessThan(base.interest);
  });

  it("rejeita parcela que não cobre os juros", () => {
    expect(simulateDebt({ principal: 5000, monthlyRate: 0.1, payment: 500 })).toBeNull();
  });

  it("guarda a sobra mensal sem inventar renda", () => {
    const [july] = simulateExpensePlan(
      [{ total_installments: 3, current_installment: 1, installment_amount: 300 }],
      { tapioca_income: 1800, monthly_fuel: 240, initial_reserve: 0 },
      "save", ["Jul"],
    );
    expect(july.regular).toBe(300);
    expect(july.saved).toBe(1260);
    expect(july.remaining).toBe(600);
  });
});
