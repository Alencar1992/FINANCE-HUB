// Utilitários financeiros puros: usados pela interface e cobertos por testes automatizados.
export const money = (value) =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

export const parseBRNumber = (value) => {
  const raw = String(value ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/R\$/gi, "")
    .replace(/%/g, "")
    .replace(/[^0-9,.-]/g, "");
  if (!raw) return Number.NaN;
  return Number(raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw);
};

export const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export const installmentAmount = (total, count = 1) => {
  const installments = Math.max(1, Number(count) || 1);
  return roundMoney(Number(total) / installments);
};

export const monthStart = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;

export const dueDateFor = (day, date = new Date()) => {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const safeDay = Math.max(1, Math.min(Number(day) || 1, lastDay));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
};

export const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export const isPotentialDuplicate = (candidate, reference, toleranceDays = 2) => {
  if (!candidate || !reference) return false;
  const sameName = normalizeText(candidate.name) === normalizeText(reference.name);
  const sameType = candidate.transaction_type === reference.transaction_type;
  const sameAmount = roundMoney(candidate.amount) === roundMoney(reference.amount);
  const distance = Math.abs(new Date(`${candidate.transaction_date}T12:00:00`) - new Date(`${reference.transaction_date}T12:00:00`));
  return sameName && sameType && sameAmount && distance <= toleranceDays * 86_400_000;
};

export const calculateSavings = (income, mode, value) => {
  const result = mode === "percentage"
    ? Number(income) * Number(value) / 100
    : Number(value);
  return Math.max(0, roundMoney(result));
};

export const summarizeCashflow = (rows) => {
  const totals = rows.reduce((result, row) => {
    if (["cancelled", "deleted"].includes(row.status)) return result;
    const amount = Number(row.value ?? row.amount ?? 0);
    if (["in", "income"].includes(row.type ?? row.transaction_type)) result.income += amount;
    else result.expense += amount;
    return result;
  }, { income: 0, expense: 0 });
  return { ...totals, balance: roundMoney(totals.income - totals.expense) };
};

export const calculateCardPayment = (purchases, selectedIds = null) => {
  const selected = selectedIds ? new Set(selectedIds) : null;
  return purchases.reduce((result, purchase) => {
    if (purchase.status !== "open" || (selected && !selected.has(purchase.id))) return result;
    result.count += 1;
    result.current += Number(purchase.installment_amount || 0);
    result.remaining += Math.max(0, Number(purchase.total_amount || 0) - Number(purchase.paid_installments || 0) * Number(purchase.installment_amount || 0));
    return result;
  }, { count: 0, current: 0, remaining: 0 });
};

export const simulateDebt = ({ principal, monthlyRate, payment, extra = 0 }) => {
  let balance = Number(principal), months = 0, interest = 0;
  const installment = Number(payment) + Number(extra);
  if (!(balance > 0) || !(installment > balance * Number(monthlyRate))) return null;
  while (balance > 0.01 && months < 1200) {
    const fee = balance * Number(monthlyRate);
    interest += fee;
    balance = Math.max(0, balance + fee - installment);
    months += 1;
  }
  return { months, interest: roundMoney(interest), total: roundMoney(Number(principal) + interest) };
};

export const simulateExpensePlan = (items, settings, mode, labels = ["Jul", "Ago", "Set", "Out", "Nov", "Dez"]) => {
  const debts = items.map((item) => ({ ...item, left: Math.max(0, item.total_installments - item.current_installment + 1) }));
  let reserve = Number(settings.initial_reserve || 0);
  return labels.map((month) => {
    const income = Number(settings.tapioca_income || 0), fuel = Number(settings.monthly_fuel || 0);
    const regular = debts.reduce((sum, item) => sum + (item.left ? Number(item.installment_amount) : 0), 0);
    let cash = Math.max(0, income - fuel - regular), extra = 0, saved = 0;
    debts.forEach((item) => { if (item.left) item.left -= 1; });
    if (mode === "save") {
      saved = cash; reserve += saved; cash = 0;
    } else {
      const missingReserve = Math.max(0, Number(settings.minimum_reserve || 0) - reserve);
      saved = Math.min(cash, missingReserve); reserve += saved; cash -= saved;
      const ordered = debts.filter((item) => item.left).sort((a, b) => mode === "payoff"
        ? a.left * a.installment_amount - b.left * b.installment_amount
        : b.installment_amount - a.installment_amount);
      for (const item of ordered) {
        if (cash <= 0) break;
        const units = Math.min(item.left, mode === "payoff" ? item.left : 1, Math.floor((cash + 0.001) / item.installment_amount));
        item.left -= units; cash -= units * item.installment_amount; extra += units * item.installment_amount;
      }
    }
    return { month, income, fuel, regular, extra, saved, reserve, free: cash, remaining: debts.reduce((sum, item) => sum + item.left * item.installment_amount, 0) };
  });
};
