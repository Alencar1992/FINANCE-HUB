import { parseBRNumber } from "../../lib/finance";

export const FINANCIAL_ENTRY_TYPES = [
  {
    id: "income",
    label: "Receita minha",
    description: "Entrada recebida ou pendente",
  },
  {
    id: "expense",
    label: "Despesa minha",
    description: "Saída paga ou pendente",
  },
  {
    id: "receivable",
    label: "Alguém me deve",
    description: "Valor que você tem a receber",
  },
  {
    id: "payable",
    label: "Eu devo alguém",
    description: "Valor que você tem a pagar",
  },
];

const CATEGORY_RULES = [
  ["Alimentação", /mercado|supermercado|padaria|restaurante|lanche|ifood|comida|açougue/i],
  ["Moradia", /aluguel|condom[ií]nio|energia|luz|[aá]gua|g[aá]s|iptu/i],
  ["Transporte", /combust[ií]vel|gasolina|uber|99|ônibus|onibus|oficina|moto|carro|ped[aá]gio/i],
  ["Saúde", /farm[aá]cia|m[eé]dico|dentista|hospital|consulta|exame|academia/i],
  ["Assinaturas", /netflix|spotify|disney|prime|streaming|assinatura|gamepass/i],
  ["Educação", /curso|faculdade|escola|livro|mensalidade/i],
  ["Investimentos", /investimento|aporte|poupan[cç]a|cdb|lci|lca|tesouro/i],
  ["Salário", /sal[aá]rio|adiantamento|pagamento mensal/i],
  ["Renda extra", /venda|freelancer|comiss[aã]o|renda extra|servi[cç]o/i],
];

export function entryStatusOptions(entryType) {
  if (entryType === "income") {
    return [
      ["pending", "Pendente"],
      ["received", "Recebida"],
    ];
  }
  if (entryType === "expense") {
    return [
      ["pending", "Pendente"],
      ["paid", "Paga"],
    ];
  }
  return [
    ["open", "Em aberto"],
    ["paid", entryType === "receivable" ? "Recebida" : "Paga"],
    ["overdue", "Vencida"],
  ];
}

export function suggestEntryCategory(description, entryType) {
  const found = CATEGORY_RULES.find(([, rule]) => rule.test(String(description)));
  if (found) return { category: found[0], confidence: 0.9, source: "rules" };
  return {
    category: entryType === "income" ? "Outras receitas" : "Outras despesas",
    confidence: 0.45,
    source: "rules",
  };
}

export function buildFinancialEntryPayload(entryType, values) {
  if (!FINANCIAL_ENTRY_TYPES.some((option) => option.id === entryType)) {
    throw new Error("Tipo de lançamento inválido.");
  }

  const description = String(values.description || "").trim();
  const total = parseBRNumber(values.total);
  const recurring = ["income", "expense"].includes(entryType) && Boolean(values.recurring);
  const installments = recurring ? 1 : Number(values.installments || 1);
  if (!description) throw new Error("Informe a descrição.");
  if (!Number.isFinite(total) || total <= 0) throw new Error("Informe um valor válido.");
  if (!Number.isInteger(installments) || installments < 1 || installments > 120) {
    throw new Error("Informe entre 1 e 120 parcelas.");
  }

  const suggestion = suggestEntryCategory(description, entryType);
  const payload = {
    description,
    category: String(values.category || "").trim() || suggestion.category,
    total_amount: total,
    installments,
    date: values.date,
    status: values.status,
    notes: String(values.notes || "").trim() || null,
  };

  if (["income", "expense"].includes(entryType)) {
    payload.is_recurring = recurring;
    payload.recurrence_day = recurring ? Number(values.recurrenceDay) : null;
    payload.classification_source = values.category ? "manual" : suggestion.source;
    payload.classification_confidence = values.category ? 1 : suggestion.confidence;
  } else {
    const counterparty = String(values.counterparty || "").trim();
    if (!counterparty) throw new Error("Informe a pessoa ou empresa.");
    payload.counterparty_name = counterparty;
    payload.phone = String(values.phone || "").replace(/\D/g, "") || null;
  }

  return payload;
}

export function createdEntryMessage(result) {
  if (result?.idempotentReplay) return "Lançamento já registrado; nenhuma duplicação foi criada.";
  if (result?.duplicateOf) return "Lançamento salvo e sinalizado como possível duplicidade.";
  return "Lançamento salvo com segurança.";
}
