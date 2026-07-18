Warning: truncated output (original token count: 57266)
Total output lines: 7000

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Home,
  ArrowLeftRight,
  CreditCard,
  UserRound,
  ArrowDownLeft,
  CalendarDays,
  ChartNoAxesCombined,
  Sparkles,
  Settings,
  Search,
  Bell,
  Plus,
  Eye,
  TrendingUp,
  TrendingDown,
  WalletCards,
  Clock3,
  AlertTriangle,
  Wifi,
  Zap,
  Building2,
  ShieldCheck,
  Check,
  ChevronRight,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  MoreHorizontal,
  Sun,
  Moon,
  FileText,
  Download,
  Send,
  Landmark,
  Play,
  Target,
  PackageOpen,
  PiggyBank,
  Percent,
  RefreshCw,
  Banknote,
  BrainCircuit,
  Tags,
  CopyCheck,
  Calculator,
  Lightbulb,
  MessageCircle,
  CircleDollarSign,
} from "lucide-react";
import "./styles.css";
import { supabase } from "./lib/supabase";

const APP_URL = "https://alencar1992.github.io/FINANCE-HUB/";
const authErrorPt = (
  error,
  fallback = "Não foi possível concluir. Tente novamente.",
) => {
  const code = error?.code || error?.error_code || "";
  const message = String(error?.message || "").toLowerCase();
  if (
    code === "over_email_send_rate_limit" ||
    message.includes("rate limit") ||
    message.includes("too many")
  )
    return "O limite temporário de envio de e-mails foi atingido. Aguarde antes de tentar novamente.";
  if (code === "email_not_confirmed" || message.includes("email not confirmed"))
    return "O e-mail ainda não foi confirmado. Verifique sua caixa de entrada e a pasta de spam.";
  if (code === "invalid_credentials" || message.includes("invalid login"))
    return "E-mail ou senha inválidos.";
  if (code === "user_already_exists" || message.includes("already registered"))
    return "Este e-mail já está cadastrado.";
  if (code === "weak_password" || message.includes("weak password"))
    return "A senha não atende aos requisitos de segurança.";
  if (message.includes("different from the old password"))
    return "Escolha uma senha diferente da senha anterior.";
  if (message.includes("captcha"))
    return "Não foi possível validar a proteção de segurança. Atualize a página e tente novamente.";
  return fallback;
};

const money = (n) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const parseBRNumber = (value) => {
  const raw = String(value ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/R\$/gi, "")
    .replace(/%/g, "")
    .replace(/[^0-9,.-]/g, "");
  if (!raw) return Number.NaN;
  return Number(
    raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw,
  );
};
const monthStart = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
const dueDateFor = (day, date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(Math.min(Number(day), new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate())).padStart(2, "0")}`;
const categoryRules = [
  [
    "Alimentação",
    /mercado|supermercado|padaria|restaurante|lanche|ifood|comida|açougue/i,
  ],
  ["Moradia", /aluguel|condom[ií]nio|energia|luz|[aá]gua|g[aá]s|iptu/i],
  [
    "Transporte",
    /combust[ií]vel|gasolina|uber|99|ônibus|onibus|oficina|moto|carro|ped[aá]gio/i,
  ],
  ["Saúde", /farm[aá]cia|m[eé]dico|dentista|hospital|consulta|exame|academia/i],
  [
    "Assinaturas",
    /netflix|spotify|disney|prime|streaming|assinatura|gamepass/i,
  ],
  ["Educação", /curso|faculdade|escola|livro|mensalidade/i],
  ["Investimentos", /investimento|aporte|poupan[cç]a|cdb|lci|lca|tesouro/i],
  ["Salário", /sal[aá]rio|adiantamento|pagamento mensal/i],
  ["Renda extra", /venda|freelancer|comiss[aã]o|renda extra|servi[cç]o/i],
];
function suggestCategory(name, type) {
  const found = categoryRules.find(([, rule]) => rule.test(String(name)));
  return found
    ? { category: found[0], confidence: 0.9, source: "rules" }
    : {
        category: type === "income" ? "Outras receitas" : "Outras despesas",
        confidence: 0.45,
        source: "rules",
      };
}
const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
async function addSavingsContribution(ownerId, amount, label) {
  if (amount <= 0) return null;
  let { data: investment } = await supabase
    .from("investments")
    .select("*")
    .eq("owner_id", ownerId)
    .ilike("name", "Reserva de Poupança")
    .eq("active", true)
    .maybeSingle();
  if (investment) {
    const { data, error } = await supabase
      .from("investments")
      .update({
        initial_amount: Number(investment.initial_amount) + amount,
        current_amount: Number(investment.current_amount) + amount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", investment.id)
      .eq("owner_id", ownerId)
      .select()
      .single();
    if (error) throw error;
    investment = data;
  } else {
    const { data, error } = await supabase
      .from("investments")
      .insert({
        owner_id: ownerId,
        name: "Reserva de Poupança",
        bank_name: "Reserva automática",
        investment_type: "Poupança",
        initial_amount: amount,
        current_amount: amount,
        rate_mode: "savings",
        contracted_rate: null,
        invested_at: new Date().toISOString().slice(0, 10),
        notes: "Criada automaticamente pela central de salário.",
      })
      .select()
      .single();
    if (error) throw error;
    investment = data;
  }
  const reference = monthStart(),
    { data: snapshot } = await supabase
      .from("investment_snapshots")
      .select("*")
      .eq("investment_id", investment.id)
      .eq("reference_month", reference)
      .maybeSingle(),
    contribution = Number(snapshot?.contribution || 0);
  await supabase
    .from("investment_snapshots")
    .upsert(
      {
        owner_id: ownerId,
        investment_id: investment.id,
        reference_month: reference,
        amount: Number(investment.current_amount),
        contribution: contribution + amount,
      },
      { onConflict: "investment_id,reference_month" },
    );
  const { data: expense, error: expenseError } = await supabase
    .from("transactions")
    .insert({
      owner_id: ownerId,
      name: `Aporte Reserva de Poupança · ${label}`,
      category: "Investimentos",
      amount,
      total_amount: amount,
      installment_amount: amount,
      transaction_type: "expense",
      transaction_date: new Date().toISOString().slice(0, 10),
      status: "paid",
      is_installment: false,
      installment_count: 1,
      installment_number: 1,
      notes: "Aporte debitado automaticamente do salário.",
    })
    .select("id")
    .single();
  if (expenseError) throw expenseError;
  return { investmentId: investment.id, transactionId: expense.id };
}
async function processSalarySchedule(ownerId) {
  const { data: settings } = await supabase
    .from("salary_settings")
    .select("*")
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (!settings) return 0;
  const now = new Date(),
    today = now.getDate(),
    reference = monthStart(now);
  let created = 0;
  const processPayment = async (kind, enabled, amount, day) => {
    if (
      !enabled ||
      Number(amount) <= 0 ||
      today <
        Math.min(
          Number(day),
          new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
        )
    )
      return;
    const { data: exists } = await supabase
      .from("salary_events")
      .select("id")
      .eq("owner_id", ownerId)
      .eq("reference_month", reference)
      .eq("event_type", kind)
      .maybeSingle();
    if (exists) return;
    const { data: event, error: eventError } = await supabase
      .from("salary_events")
      .insert({
        owner_id: ownerId,
        reference_month: reference,
        event_type: kind,
        amount,
      })
      .select()
      .single();
    if (eventError) return;
    const label = kind === "salary" ? "Salário" : "Adiantamento salarial",
      { data: transaction, error } = await supabase
        .from("transactions")
        .insert({
          owner_id: ownerId,
          name: `${label} · ${reference.slice(0, 7)}`,
          category: "Salário",
          amount: Number(amount),
          total_amount: Number(amount),
          installment_amount: Number(amount),
          transaction_type: "income",
          transaction_date: dueDateFor(day, now),
          status: "received",
          is_installment: false,
          installment_count: 1,
          installment_number: 1,
          notes: "Inserido automaticamente pela central de salário.",
        })
        .select("id")
        .single();
    if (error) {
      await supabase.from("salary_events").delete().eq("id", event.id);
      return;
    }
    await supabase
      .from("salary_events")
      .update({ transaction_id: transaction.id })
      .eq("id", event.id);
    created++;
    const shouldSave =
      settings.savings_enabled &&
      settings.savings_recurring &&
      ((kind === "salary" && settings.savings_on_salary) ||
        (kind === "advance" && settings.savings_on_advance));
    if (!shouldSave) return;
    const savingType = `${kind}_savings`,
      { data: savingExists } = await supabase
        .from("salary_events")
        .select("id")
        .eq("owner_id", ownerId)
        .eq("reference_month", reference)
        .eq("event_type", savingType)
        .maybeSingle();
    if (savingExists) return;
    const savingAmount =
      Math.round(
        (settings.savings_mode === "percentage"
          ? (Number(amount) * Number(settings.savings_value)) / 100
          : Number(settings.savings_value)) * 100,
      ) / 100;
    if (savingAmount <= 0) return;
    try {
      const result = await addSavingsContribution(ownerId, savingAmount, label);
      await supabase
        .from("salary_events")
        .insert({
          owner_id: ownerId,
          reference_month: reference,
          event_type: savingType,
          amount: savingAmount,
          transaction_id: result.transactionId,
          investment_id: result.investmentId,
        });
      created++;
    } catch (error) {
      console.error("Falha no aporte automático", error);
    }
  };
  await processPayment(
    "salary",
    settings.salary_enabled,
    settings.salary_amount,
    settings.salary_day,
  );
  await processPayment(
    "advance",
    settings.advance_enabled,
    settings.advance_amount,
    settings.advance_day,
  );
  if (created) window.dispatchEvent(new Event("finance-data-changed"));
  return created;
}
const nav = [
  ["Início", Home],
  ["Movimentações", ArrowLeftRight],
  ["Cartões", CreditCard],
  ["Me devem", UserRound],
  ["Eu devo", ArrowDownLeft],
  ["Calendário", CalendarDays],
  ["Relatórios", ChartNoAxesCombined],
  ["Inteligência", BrainCircuit],
  ["Investimentos", PiggyBank],
  ["Configurações", Settings],
];
const seedTx = [
  {
    id: 1,
    name: "Salário Linx",
    cat: "Salário",
    date: "05 jul",
    value: 5000,
    type: "in",
    status: "Recebido",
  },
  {
    id: 2,
    name: "Expresso Tapiocaria",
    cat: "Renda extra",
    date: "08 jul",
    value: 1180,
    type: "in",
    status: "Recebido",
  },
  {
    id: 3,
    name: "Condomínio",
    cat: "Moradia",
    date: "10 jul",
    value: 742.8,
    type: "out",
    status: "Pago",
  },
  {
    id: 4,
    name: "Mercado do mês",
    cat: "Alimentação",
    date: "12 jul",
    value: 628.4,
    type: "out",
    status: "Pago",
  },
  {
    id: 5,
    name: "Revisão Lander",
    cat: "Transporte",
    date: "15 jul",
    value: 399.75,
    type: "out",
    status: "Pendente",
  },
];
const debts = [
  {
    name: "Marcelo Silva",
    desc: "Compra no cartão Inter",
    value: 680,
    due: "Hoje",
    tone: "warning",
    phone: "5511999999999",
  },
  {
    name: "Fernanda Costa",
    desc: "Netflix + Spotify",
    value: 74.9,
    due: "Amanhã",
    tone: "orange",
    phone: "5511988888888",
  },
  {
    name: "Ezequiel",
    desc: "Equipamento da tapiocaria",
    value: 450,
    due: "Vencido há 2 dias",
    tone: "danger",
    phone: "5511977777777",
  },
];
const owed = [
  {
    name: "Loja do Amigo",
    desc: "Capacete Lander",
    total: 900,
    left: 600,
    next: "20 jul · 2/4",
    tone: "warning",
  },
  {
    name: "Banco Inter",
    desc: "Empréstimo pessoal",
    total: 2400,
    left: 1320,
    next: "28 jul · 12/24",
    tone: "orange",
  },
  {
    name: "Oficina do Zé",
    desc: "Manutenção da moto",
    total: 520,
    left: 520,
    next: "Vencido há 2 dias",
    tone: "danger",
  },
];

function FinanceApp({ owner }) {
  const [page, setPage] = useState("Início"),
    [menu, setMenu] = useState(false),
    [sidebarCollapsed, setSidebarCollapsed] = useState(
      () => localStorage.getItem("finance-sidebar-collapsed") === "true",
    ),
    [dark, setDark] = useState(false),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(""),
    [tx, setTx] = useState([]),
    [query, setQuery] = useState(""),
    [customModules, setCustomModules] = useState([]),
    [profile, setProfile] = useState(owner),
    [profileMenu, setProfileMenu] = useState(false),
    [appDialog, setAppDialog] = useState(null),
    [salaryNotice, setSalaryNotice] = useState(null),
    [closureNotice, setClosureNotice] = useState(null),
    [backupNotice, setBackupNotice] = useState(null),
    [avatarUrl, setAvatarUrl] = useState("");
  const dialogResolver = useRef(null);
  const notify = (m) => {
    setToast(m);
    setTimeout(() => setToast(""), 2600);
  };
  const ask = (options) =>
    new Promise((resolve) => {
      dialogResolver.current = resolve;
      setAppDialog(options);
    });
  const answerDialog = (value) => {
    dialogResolver.current?.(value);
    dialogResolver.current = null;
    setAppDialog(null);
  };
  useEffect(() => {
    const IDLE_LIMIT = 15 * 60 * 1000;
    let timer;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        await supabase.auth.signOut();
        location.reload();
      }, IDLE_LIMIT);
    };
    const events = ["pointerdown", "keydown", "scroll", "touchstart"];
    events.forEach((event) =>
      addEventListener(event, reset, { passive: true }),
    );
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((event) => removeEventListener(event, reset));
    };
  }, []);
  useEffect(() => {
    (async () => {
      if (!profile.avatar_url) return setAvatarUrl("");
      const { data } = await supabase.storage
        .from("finance-assets")
        .createSignedUrl(profile.avatar_url, 3600);
      setAvatarUrl(data?.signedUrl || "");
    })();
  }, [profile.avatar_url]);
  useEffect(() => {
    (async () => {
      const count = await processSalarySchedule(owner.id);
      if (count) await loadTransactions();
      await loadSalaryNotifications();
    })();
  }, [owner.id]);
  useEffect(() => {
    supabase
      .from("monthly_closures")
      .select("*")
      .eq("owner_id", owner.id)
      .in("status", ["pending", "ready"])
      .order("reference_month", { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setClosureNotice(data || null));
  }, [owner.id]);
  useEffect(() => {
    supabase
      .from("finance_backups")
      .select("backup_date,created_at,status")
      .eq("owner_id", owner.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setBackupNotice(data);
          setTimeout(() => setBackupNotice(null), 8000);
        }
      });
  }, [owner.id]);
  const filtered = useMemo(
    () =>
      tx.filter((x) =>
        (x.name + x.cat).toLowerCase().includes(query.toLowerCase()),
      ),
    [tx, query],
  );
  async function loadTransactions() {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("owner_id", owner.id)
      .order("transaction_date", { ascending: false });
    if (!error)
      setTx(
        (data || []).map((x) => {
          const first = new Date(x.transaction_date + "T12:00:00"),
            now = new Date(),
            elapsed = Math.max(
              0,
              (now.getFullYear() - first.getFullYear()) * 12 +
                now.getMonth() -
                first.getMonth(),
            ),
            currentInstallment = x.is_installment
              ? Math.min(x.installment_count, elapsed + 1)
              : 1,
            effectiveDate =
              x.is_recurring && x.recurrence_active
                ? new Date(
                    now.getFullYear(),
                    now.getMonth(),
                    Math.min(
                      Number(x.recurrence_day || first.getDate()),
                      new Date(
                        now.getFullYear(),
                        now.getMonth() + 1,
                        0,
                      ).getDate(),
                    ),
                  )
                : new Date(first);
          if (x.is_installment)
            effectiveDate.setMonth(first.getMonth() + currentInstallment - 1);
          return {
            id: x.id,
            name: x.is_installment
              ? `${x.name} · ${currentInstallment}/${x.installment_count}`
              : x.name,
            cat: x.category,
            value: Number(x.installment_amount || x.amount),
            date: effectiveDate.toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
            }),
            type: x.transaction_type === "income" ? "in" : "out",
            status:
              currentInstallment >= x.installment_count && x.is_installment
                ? "Última parcela"
                : {
                    pending: "Pendente",
                    paid: "Pago",
                    received: "Recebido",
                    overdue: "Vencido",
                    cancelled: "Cancelado",
                  }[x.status],
            rawStatus: x.status,
            rawDate: x.transaction_date,
            totalValue: Number(x.total_amount || x.amount),
            classificationSource: x.classification_source,
            classificationConfidence: Number(x.classification_confidence || 0),
            duplicateStatus: x.duplicate_review_status,
            duplicateOf: x.duplicate_of,
            source: "transaction",
            recurring: Boolean(x.is_recurring && x.recurrence_active),
          };
        }),
      );
  }
  async function loadSalaryNotifications() {
    const { data, error } = await supabase
      .from("salary_events")
      .select("id,event_type,amount,reference_month,created_at")
      .eq("owner_id", owner.id)
      .in("event_type", ["salary_savings", "advance_savings"])
      .is("notified_at", null)
      .order("created_at", { ascending: true });
    if (!error && data?.length)
      setSalaryNotice({
        events: data,
        total: data.reduce((sum, event) => sum + Number(event.amount), 0),
      });
  }
  async function acknowledgeSalaryNotice() {
    const ids = salaryNotice?.events.map((event) => event.id) || [];
    if (ids.length) {
      const { error } = await supabase
        .from("salary_events")
        .update({ notified_at: new Date().toISOString() })
        .eq("owner_id", owner.id)
        .in("id", ids);
      if (error) return notify("Não foi possível confirmar esta notificação.");
    }
    setSalaryNotice(null);
  }
  function closureRows(snapshot) {
    return Object.entries(snapshot || {})
      .filter(([, rows]) => Array.isArray(rows))
      .flatMap(([origem, rows]) => rows.map((row) => ({ origem, ...row })));
  }
  function downloadBlob(blob, name) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 3000);
  }
  async function completeClosure() {
    const rows = closureRows(closureNotice.snapshot),
      month = closureNotice.reference_month.slice(0, 7),
      headers = [...new Set(rows.flatMap((row) => Object.keys(row)))],
      csv = [
        headers.join(";"),
        ...rows.map((row) =>
          headers
            .map(
              (key) =>
                `"${String(typeof row[key] === "object" ? JSON.stringify(row[key]) : (row[key] ?? "")).replaceAll('"', '""')}"`,
            )
            .join(";"),
        ),
      ].join("\n");
    downloadBlob(
      new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }),
      `fechamento-${month}.csv`,
    );
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF();
    pdf.setFontSize(18);
    pdf.text(`Fechamento mensal · ${month}`, 14, 18);
    pdf.setFontSize(9);
    let y = 28;
    rows.forEach((row) => {
      const text = `${row.origem} · ${row.name || row.description || row.counterparty_name || row.participant_name || "Registro"} · ${money(Number(row.amount || row.total_amount || row.remaining_amount || 0))}`;
      pdf.text(text.slice(0, 105), 14, y);
      y += 6;
      if (y > 282) {
        pdf.addPage();
        y = 18;
      }
    });
    pdf.save(`fechamento-${month}.pdf`);
    await supabase
      .from("monthly_closures")
      .update({
        status: "completed",
        closed_at: new Date().toISOString(),
        downloaded_at: new Date().toISOString(),
      })
      .eq("id", closureNotice.id)
      .eq("owner_id", owner.id);
    setClosureNotice(null);
    notify("Fechamento concluído e arquivos baixados.");
  }
  useEffect(() => {
    loadTransactions();
    const refresh = () => loadTransactions();
    addEventListener("finance-data-changed", refresh);
    return () => removeEventListener("finance-data-changed", refresh);
  }, [owner.id]);
  async function loadCustomModules() {
    const { data } = await supabase
      .from("custom_modules")
      .select("*")
      .eq("owner_id", owner.id)
      .eq("active", true)
      .order("created_at");
    setCustomModules(data || []);
  }
  useEffect(() => {
    loadCustomModules();
  }, [owner.id]);
  const visibleNav = [
    ...nav.slice(0, 7),
    ...(profile.streaming_enabled ? [["Streamings", Play]] : []),
    ...customModules.map((m) => [`module:${m.id}`, Sparkles, m.name]),
    ...nav.slice(7),
  ];
  async function addTx(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      total = parseBRNumber(f.get("total")),
      count = Number(f.get("installments") || 1),
      monthly = Math.round((total / count) * 100) / 100;
    const type = f.get("type") === "in" ? "income" : "expense",
      typedCategory = String(f.get("cat") || "").trim(),
      suggestion = suggestCategory(f.get("name"), type),
      category = typedCategory || suggestion.category,
      startDate = f.get("date") || new Date().toISOString().slice(0, 10),
      dayBefore = new Date(startDate + "T12:00"),
      dayAfter = new Date(startDate + "T12:00");
    dayBefore.setDate(dayBefore.getDate() - 2);
    dayAfter.setDate(dayAfter.getDate() + 2);
    const { data: possibleDuplicates } = await supabase
      .from("transactions")
      .select("id,name,amount,transaction_date")
      .eq("owner_id", owner.id)
      .eq("transaction_type", type)
      .eq("amount", monthly)
      .gte("transaction_date", dayBefore.toISOString().slice(0, 10))
      .lte("transaction_date", dayAfter.toISOString().slice(0, 10))
      .neq("status", "cancelled")
      .limit(10);
    const duplicate =
      (possibleDuplicates || []).find(
        (item) => normalizeText(item.name) === normalizeText(f.get("name")),
      ) || possibleDuplicates?.[0];
    const row = {
      owner_id: owner.id,
      name: f.get("name"),
      category,
      classification_source: typedCategory ? "manual" : suggestion.source,
      classification_confidence: typedCategory ? 1 : suggestion.confidence,
      duplicate_of: duplicate?.id || null,
      duplicate_review_status: duplicate ? "pending" : "not_flagged",
      amount: monthly,
      total_amount: total,
      is_installment: count > 1,
      installment_count: count,
      installment_number: 1,
      installment_amount: monthly,
      transaction_type: type,
      status: "pending",
      transaction_date: startDate,
      is_recurring: f.get("recurring") === "on",
      recurrence_active: f.get("recurring") === "on",
      recurrence_day:
        f.get("recurring") === "on"
          ? Number(f.get("recurrence_day") || new Date().getDate())
          : null,
    };
    const { data, error } = await supabase
      .from("transactions")
      .insert(row)
      .select()
      .single();
    if (error) {
      notify("Não foi possível salvar. Tente novamente.");
      return;
    }
    setTx((v) => [
      {
        id: data.id,
        name: data.name,
        cat: data.category,
        value: Number(data.amount),
        date: "Hoje",
        type: f.get("type"),
        status: "Pendente",
      },
      ...v,
    ]);
    setModal(null);
    notify(
      duplicate
        ? `Movimentação salva, mas encontramos um possível lançamento duplicado de ${money(monthly)}.`
        : count > 1
          ? `Parcela 1/${count} salva: ${money(monthly)}`
          : "Movimentação salva no Supabase",
    );
  }
  return (
    <div
      className={`${dark ? "app dark" : "app"}${sidebarCollapsed ? " sidebar-collapsed" : ""}`}
      style={{
        "--violet": profile.app_color || "#6445ED",
        "--user-bg": profile.background_color || "#F6F8FC",
      }}
    >
      <aside className={menu ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <span>
            <WalletCards />
          </span>
          {profile.app_name || "Finance Hub"}
        </div>
        <button className="close" onClick={() => setMenu(false)}>
          <X />
        </button>
        <button
          className="sidebar-toggle"
          title={
            sidebarCollapsed ? "Mostrar menu lateral" : "Ocultar menu lateral"
          }
          aria-label={
            sidebarCollapsed ? "Mostrar menu lateral" : "Ocultar menu lateral"
          }
          onClick={() =>
            setSidebarCollapsed((value) => {
              localStorage.setItem("finance-sidebar-collapsed", String(!value));
              return !value;
            })
          }
        >
          {sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          <span>{sidebarCollapsed ? "Mostrar menu" : "Ocultar menu"}</span>
        </button>
        <nav>
          {visibleNav.map(([n, I, label]) => (
            <button
              key={n}
              className={page === n ? "active" : ""}
              onClick={() => {
                setPage(n);
                setMenu(false);
              }}
            >
              <I />
              <span>{label || n}</span>
            </button>
          ))}
        </nav>
        <div className="profile-wrap">
          <button
            className="profile"
            onClick={() => setProfileMenu(!profileMenu)}
          >
            <span>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Foto do perfil" />
              ) : (
                initials(profile.name)
              )}
            </span>
            <div>
              <strong>{profile.name}</strong>
              <small>Perfil pessoal</small>
            </div>
            <MoreHorizontal />
          </button>
          {profileMenu && (
            <div className="profile-popover">
              <button
                onClick={() => {
                  setPage("Configurações");
                  setProfileMenu(false);
                }}
              >
                <Settings />
                Configurações
              </button>
              <button
                className="logout"
                onClick={async () => {
                  const {
                    data: { user },
                  } = await supabase.auth.getUser();
                  if (user?.is_anonymous) {
                    setPage("Configurações");
                    setProfileMenu(false);
                    return notify(
                      "Vincule e-mail e senha antes de sair, para não perder o acesso aos dados.",
                    );
                  }
                  await supabase.auth.signOut();
                  location.reload();
                }}
              >
                <ArrowDownLeft />
                Sair
              </button>
            </div>
          )}
        </div>
      </aside>
      {menu && <div className="scrim" onClick={() => setMenu(false)} />}
      <main>
        <header>
          <div className="hello">
            <button className="mobile-menu" onClick={() => setMenu(true)}>
              <Menu />
            </button>
            <div>
              <h1>
                {page === "Início"
                  ? `Olá, ${owner.name.split(" ")[0]} 👋`
                  : page.startsWith("module:")
                    ? customModules.find((m) => `module:${m.id}` === page)
                        ?.name || "Função"
                    : page}
              </h1>
              <p>
                {page === "Início"
                  ? "Sua vida financeira em um só lugar."
                  : "Gerencie tudo de forma simples e rápida."}
              </p>
            </div>
          </div>
          <div className="head-actions">
            <button
              className="salary-trigger"
              onClick={() => setModal("salary")}
            >
              <Banknote />
              <span>
                <strong>Salário</strong>
                <small>Pagamento, adiantamento e reserva</small>
              </span>
            </button>
            <button className="icon" onClick={() => setDark(!dark)}>
              {dark ? <Sun /> : <Moon />}
            </button>
            <button
              className="icon bell"
              onClick={() => setModal("notifications")}
              aria-label="Abrir notificações"
            >
              <Bell />
              <NotificationCount owner={owner} />
            </button>
            <button className="primary" onClick={() => setModal("transaction")}>
              <Plus />
              Nova movimentação
            </button>
            <span className="avatar">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Foto do perfil" />
              ) : (
                initials(owner.name)
              )}
            </span>
          </div>
        </header>
        <div className="content">
          {page === "Início" ? (
            <Dashboard
              owner={owner}
              setPage={setPage}
              notify={notify}
              tx={tx}
            />
          ) : page === "Movimentações" ? (
            <UnifiedMovements
              owner={owner}
              baseRows={filtered}
              open={() => setModal("transaction")}
              notify={notify}
              refresh={loadTransactions}
            />
          ) : page === "Me devem" ? (
            <ObligationsPage
              owner={owner}
              direction="receivable"
              notify={notify}
            />
          ) : page === "Eu devo" ? (
            <ObligationsPage
              owner={owner}
              direction="payable"
              notify={notify}
            />
          ) : page === "Cartões" ? (
            <CardsModule owner={owner} notify={notify} />
          ) : page === "Calendário" ? (
            <CalendarModule owner={owner} tx={tx} />
          ) : page === "Relatórios" ? (
            <ReportsModule tx={tx} />
          ) : page === "Inteligência" ? (
            <FinancialIntelligence
              owner={owner}
              tx={tx}
              notify={notify}
              refresh={loadTransactions}
              ask={ask}
            />
          ) : page === "Streamings" ? (
            <StreamingsModule owner={owner} notify={notify} />
          ) : page === "Investimentos" ? (
            <InvestmentsModule owner={owner} notify={notify} />
          ) : page === "Criar função" ? (
            <FunctionBuilder
              owner={owner}
              notify={notify}
              onCancel={() => setPage("Início")}
              onCreated={async (m) => {
                await loadCustomModules();
                setPage(`module:${m.id}`);
              }}
            />
          ) : page === "Configurações" ? (
            <SettingsModule
              owner={profile}
              modules={customModules}
              reloadModules={loadCustomModules}
              onUpdate={setProfile}
              dark={dark}
              setDark={setDark}
              notify={notify}
              ask={ask}
              openBuilder={() => setPage("Criar função")}
            />
          ) : page.startsWith("module:") ? (
            <CustomModulePage
              owner={owner}
              module={customModules.find((m) => `module:${m.id}` === page)}
              notify={notify}
            />
          ) : null}
        </div>
      </main>
      {modal === "transaction" && (
        <TransactionModal addTx={addTx} close={() => setModal(null)} />
      )}
      {modal === "notifications" && (
        <Modal title="Central de notificações" close={() => setModal(null)}>
          <Notifications
            owner={owner}
            setPage={(p) => {
              setPage(p);
              setModal(null);
            }}
          />
        </Modal>
      )}
      {modal === "salary" && (
        <SalaryModal
          owner={owner}
          close={() => setModal(null)}
          notify={notify}
          refresh={loadTransactions}
        />
      )}
      {salaryNotice && (
        <div
          className="salary-notice-bg"
          role="dialog"
          aria-modal="true"
          aria-labelledby="salary-notice-title"
        >
          <section className="salary-notice">
            <span className="salary-notice-icon">
              <PiggyBank />
            </span>
            <small>AUTOMAÇÃO CONCLUÍDA</small>
            <h2 id="salary-notice-title">Reserva de Poupança atualizada</h2>
            <p>
              Enquanto você estava fora, o Finance Hub processou sua regra
              mensal com segurança.
            </p>
            <div className="salary-notice-value">
              <span>Valor reservado</span>
              <strong>{money(salaryNotice.total)}</strong>
            </div>
            <div className="salary-notice-events">
              {salaryNotice.events.map((event) => (
                <span key={event.id}>
                  <b>
                    {event.event_type === "salary_savings"
                      ? "Aporte do salário"
                      : "Aporte do adiantamento"}
                  </b>
                  <strong>{money(Number(event.amount))}</strong>
                </span>
              ))}
            </div>
            <button className="primary" onClick={acknowledgeSalaryNotice}>
              <Check />
              Entendi
            </button>
          </section>
        </div>
      )}
      {closureNotice && (
        <div className="salary-notice-bg" role="dialog" aria-modal="true">
          <section className="salary-notice closure-notice">
            <span className="salary-notice-icon">
              <FileText />
            </span>
            <small>
              {closureNotice.mode === "automatic"
                ? "FECHAMENTO PREPARADO"
                : "FECHAMENTO PENDENTE"}
            </small>
            <h2>O mês virou</h2>
            <p>
              {closureNotice.mode === "automatic"
                ? "Seu fechamento foi arquivado. Baixe agora as cópias CSV e PDF."
                : "O fechamento do mês anterior ainda não foi realizado. Os dados permanecem preservados até sua confirmação."}
            </p>
            <div className="salary-notice-value">
              <span>Competência</span>
              <strong>
                {new Date(
                  closureNotice.reference_month + "T12:00",
                ).toLocaleDateString("pt-BR", {
                  month: "long",
                  year: "numeric",
                })}
              </strong>
            </div>
            <div className="closure-actions">
              <button className="primary" onClick={completeClosure}>
                <Download />
                {closureNotice.mode === "automatic"
                  ? "Baixar CSV e PDF"
                  : "Realizar fechamento agora"}
              </button>
              <button
                className="closure-later"
                onClick={() => setClosureNotice(null)}
              >
                <Clock3 />
                Lembrar depois
              </button>
            </div>
            <em>O aviso aparecerá novamente no próximo login.</em>
          </section>
        </div>
      )}
      {appDialog && <AppDialog dialog={appDialog} onAnswer={answerDialog} />}
      {toast && (
        <div className="toast">
          <Check />
          {toast}
        </div>
      )}
      {backupNotice && (
        <div className="backup-login-notice">
          <ShieldCheck />
          <div>
            <strong>Backup financeiro protegido</strong>
            <span>
              Última cópia:{" "}
              {new Date(backupNotice.created_at).toLocaleString("pt-BR")}
            </span>
            <i />
          </div>
          <button onClick={() => setBackupNotice(null)}>
            <X />
          </button>
        </div>
      )}
    </div>
  );
}

const initials = (n) =>
  n
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();
function TransactionModal({ addTx, close }) {
  const [parcelled, setParcelled] = useState(false),
    [recurring, setRecurring] = useState(false),
    [total, setTotal] = useState(""),
    [count, setCount] = useState(2);
  const monthly = (parseBRNumber(total) || 0) / Number(count || 1);
  return (
    <Modal title="Nova movimentação" close={close}>
      <form onSubmit={addTx} className="form">
        <div className="seg">
          <label>
            <input type="radio" name="type" value="in" defaultChecked />
            Receita
          </label>
          <label>
            <input type="radio" name="type" value="out" />
            Despesa
          </label>
        </div>
        <label>
          Descrição
          <input
            name="name"
            required
            placeholder="Ex.: Venda, mercado, salário"
          />
        </label>
        <div className="fields">
          <label>
            Categoria
            <input name="cat" placeholder="Automática ou digite" />
          </label>
          <label>
            Valor total
            <input
              name="total"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              required
              type="text"
              inputMode="decimal"
              pattern="[0-9.]+([,][0-9]{1,2})?|[0-9]+([.][0-9]{1,2})?"
              placeholder="R$ 0,00"
            />
          </label>
        </div>
        <label className="installment-toggle">
          <input
            type="checkbox"
            checked={parcelled}
            disabled={recurring}
            onChange={(e) => setParcelled(e.target.checked)}
          />
          Parcelar este valor
        </label>
        <label className="installment-toggle recurring-toggle">
          <input
            name="recurring"
            type="checkbox"
            checked={recurring}
            onChange={(e) => {
              setRecurring(e.target.checked);
              if (e.target.checked) setParcelled(false);
            }}
          />
          Despesa ou receita recorrente mensal
        </label>
        {recurring && (
          <div className="installment-box">
            <label>
              Dia mensal do vencimento
              <input
                name="recurrence_day"
                type="number"
                min="1"
                max="31"
                defaultValue={new Date().getDate()}
              />
            </label>
            <div>
              <span>Como funciona</span>
              <strong>Fixa até quitação</strong>
              <small>Aparecerá em cada mês enquanto estiver ativa.</small>
            </div>
          </div>
        )}
        {parcelled && (
          <div className="installment-box">
            <label>
              Quantidade de parcelas
              <input
                name="installments"
                type="number"
                min="2"
                max="120"
                value={count}
                onChange={(e) => setCount(e.target.value)}
              />
            </label>
            <div>
              <span>Valor mensal</span>
              <strong>{money(monthly || 0)}</strong>
              <small>Será inserida agora apenas a parcela 1/{count}.</small>
            </div>
          </div>
        )}{" "}
        {!parcelled && <input type="hidden" name="installments" value="1" />}
        <label>
          Data inicial
          <input
            name="date"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </label>
        <label>
          Observação
          <textarea name="notes" placeholder="Opcional" />
        </label>
        <button className="primary submit">Salvar movimentação</button>
      </form>
    </Modal>
  );
}
function SalaryModal({ owner, close, notify, refresh }) {
  const [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [form, setForm] = useState({
      salary_amount: "",
      salary_day: 5,
      salary_enabled: false,
      advance_amount: "",
      advance_day: 20,
      advance_enabled: false,
      savings_enabled: false,
      savings_mode: "percentage",
      savings_value: "",
      savings_recurring: false,
      savings_on_salary: true,
      savings_on_advance: false,
    });
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("salary_settings")
        .select("*")
        .eq("owner_id", owner.id)
        .maybeSingle();
      if (data)
        setForm({
          ...data,
          salary_amount: Number(data.salary_amount)
            .toFixed(2)
            .replace(".", ","),
          advance_amount: Number(data.advance_amount)
            .toFixed(2)
            .replace(".", ","),
          savings_value: Number(data.savings_value)
            .toFixed(data.savings_mode === "percentage" ? 2 : 2)
            .replace(".", ","),
        });
      setLoading(false);
    })();
  }, [owner.id]);
  const set = (key, value) =>
      setForm((current) => ({ ...current, [key]: value })),
    salary = parseBRNumber(form.salary_amount) || 0,
    advance = parseBRNumber(form.advance_amount) || 0,
    savingValue = parseBRNumber(form.savings_value) || 0,
    calc = (amount) =>
      Math.round(
        (form.savings_mode === "percentage"
          ? (amount * savingValue) / 100
          : savingValue) * 100,
      ) / 100,
    salarySaving =
      form.savings_enabled && form.savings_on_salary ? calc(salary) : 0,
    advanceSaving =
      form.savings_enabled && form.savings_on_advance ? calc(advance) : 0;
  async function save(e) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      owner_id: owner.id,
      salary_amount: salary,
      salary_day: Number(form.salary_day),
      salary_enabled: form.salary_enabled,
      advance_amount: advance,
      advance_day: Number(form.advance_day),
      advance_enabled: form.advance_enabled,
      savings_enabled: form.savings_enabled,
      savings_mode: form.savings_mode,
      savings_value: savingValue,
      savings_recurring: form.savings_recurring,
      savings_on_salary: form.savings_on_salary,
      savings_on_advance: form.savings_on_advance,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("salary_settings")
      .upsert(payload, { onConflict: "owner_id" });
    if (error) {
      setSaving(false);
      return notify("Não foi possível salvar a configuração salarial.");
    }
    const count = await processSalarySchedule(owner.id);
    await refresh();
    setSaving(false);
    close();
    notify(
      count
        ? `${count} lançamento(s) processado(s) e configuração salva.`
        : "Configuração salarial salva.",
    );
  }
  return (
    <Modal title="Central de salário" close={close}>
      {loading ? (
        <p>Carregando configuração…</p>
      ) : (
        <form className="form salary-form" onSubmit={save}>
          <section>
            <div className="salary-section-title">
              <Banknote />
              <div>
                <strong>Pagamento principal</strong>
                <small>Entrada mensal do salário.</small>
              </div>
            </div>
            <div className="fields">
              <label>
                Valor do salário
                <input
                  value={form.salary_amount}
                  onChange={(e) => set("salary_amount", e.target.value)}
                  inputMode="decimal"
                  placeholder="1.234,56"
                  required
                />
              </label>
              <label>
                Dia do pagamento
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={form.salary_day}
                  onChange={(e) => set("salary_day", e.target.value)}
                  required
                />
              </label>
            </div>
            <label className="salary-check">
              <input
                type="checkbox"
                checked={form.salary_enabled}
                onChange={(e) => set("salary_enabled", e.target.checked)}
              />
              <span>
                <Check />
              </span>
              Inserir o salário automaticamente todos os meses
            </label>
          </section>
          <section>
            <div className="salary-section-title">
              <CalendarDays />
              <div>
                <strong>Adiantamento salarial</strong>
                <small>Configure se você recebe adiantamento.</small>
              </div>
            </div>
            <div className="fields">
              <label>
                Valor do adiantamento
                <input
                  value={form.advance_amount}
                  onChange={(e) => set("advance_amount", e.target.value)}
                  inputMode="decimal"
                  placeholder="0,00"
                />
              </label>
              <label>
                Dia do adiantamento
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={form.advance_day}
                  onChange={(e) => set("advance_day", e.target.value)}
                />
              </label>
            </div>
            <label className="salary-check">
              <input
                type="checkbox"
                checked={form.advance_enabled}
                onChange={(e) => set("advance_enabled", e.target.checked)}
              />
              <span>
                <Check />
              </span>
              Inserir o adiantamento automaticamente todos os meses
            </label>
          </section>
          <section className="salary-savings">
            <div className="salary-section-title">
              <PiggyBank />
              <div>
                <strong>Reserva de Poupança</strong>
                <small>
                  Debita do saldo e adiciona automaticamente aos investimentos.
                </small>
              </div>
            </div>
            <label className="salary-check">
              <input
                type="checkbox"
                checked={form.savings_enabled}
                onChange={(e) => set("savings_enabled", e.target.checked)}
              />
              <span>
                <Check />
              </span>
              Habilitar Reserva de Poupança
            </label>
            {form.savings_enabled && (
              <>
                <div className="fields">
                  <label>
                    Forma de cálculo
                    <select
                      value={form.savings_mode}
                      onChange={(e) => set("savings_mode", e.target.value)}
                    >
                      <option value="percentage">
                        Porcentagem do recebimento
                      </option>
                      <option value="fixed">Valor fixo em reais</option>
                    </select>
                  </label>
                  <label>
                    {form.savings_mode === "percentage"
                      ? "Porcentagem"
                      : "Valor do aporte"}
                    <input
                      value={form.savings_value}
                      onChange={(e) => set("savings_value", e.target.value)}
                      inputMode="decimal"
                      placeholder={
                        form.savings_mode === "percentage"
                          ? "Ex.: 10,00%"
                          : "Ex.: 250,00"
                      }
                    />
                  </label>
                </div>
                <div className="salary-apply">
                  <label>
                    <input
                      type="checkbox"
                      checked={form.savings_on_salary}
                      onChange={(e) =>
                        set("savings_on_salary", e.target.checked)
                      }
                    />
                    Aplicar no salário
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={form.savings_on_advance}
                      onChange={(e) =>
                        set("savings_on_advance", e.target.checked)
                      }
                    />
                    Aplicar no adiantamento
                  </label>
                </div>
                <label className="salary-check">
                  <input
                    type="checkbox"
                    checked={form.savings_recurring}
                    onChange={(e) => set("savings_recurring", e.target.checked)}
                  />
                  <span>
                    <Check />
                  </span>
                  Realizar o aporte automaticamente nas datas configuradas
                </label>
                <div className="salary-preview">
                  <span>Próximo aporte calculado</span>
                  <strong>{money(salarySaving + advanceSaving)}</strong>
                  <small>
                    Salário: {money(salarySaving)} · Adiantamento:{" "}
                    {money(advanceSaving)}
                  </small>
                </div>
              </>
            )}
          </section>
          <p className="salary-note">
            <ShieldCheck />
            Cada competência é registrada apenas uma vez. Se o aplicativo não
            estiver aberto na data, o processamento acontece no próximo acesso.
          </p>
          <div className="form-actions">
            <button type="button" onClick={close}>
              Cancelar
            </button>
            <button className="primary" disabled={saving}>
              {saving ? "Salvando…" : "Salvar configuração"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
function NotificationCount({ owner }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10),
        limit = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);
      const { count: c } = await supabase
        .from("obligations")
        .select("*", { count: "exact", head: true })
        .eq("owner_id", owner.id)
        .in("status", ["open", "overdue"])
        .lte("next_due_date", limit);
      setCount(c || 0);
    })();
  }, [owner.id]);
  return count ? <i>{count > 9 ? "9+" : count}</i> : null;
}
function Notifications({ owner, setPage }) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    (async () => {
      const limit = new Date(Date.now() + 15 * 86400000)
        .toISOString()
        .slice(0, 10);
      const { data } = await supabase
        .from("obligations")
        .select("*")
        .eq("owner_id", owner.id)
        .in("status", ["open", "overdue"])
        .lte("next_due_date", limit)
        .order("next_due_date");
      setRows(data || []);
    })();
  }, [owner.id]);
  return (
    <div className="notification-list">
      {rows.map((x) => {
        const days = Math.ceil(
          (new Date(x.next_due_date + "T12:00") - new Date()) / 86400000,
        );
        return (
          <button
            key={x.id}
            onClick={() =>
              setPage(x.direction === "receivable" ? "Me devem" : "Eu devo")
            }
          >
            <AlertTriangle />
            <div>
              <strong>
                {x.counterparty_name} · {x.description}
              </strong>
              <span>
                {days < 0
                  ? `${Math.abs(days)} dia(s) em atraso`
                  : days === 0
                    ? "Vence hoje"
                    : `Vence em ${days} dia(s)`}
              </span>
            </div>
            <b>{money(Number(x.installment_amount || x.remaining_amount))}</b>
          </button>
        );
      })}
      {!rows.length && <EmptyState text="Nenhuma notificação financeira." />}
    </div>
  );
}
function AuthGate() {
  const [loading, setLoading] = useState(true),
    [user, setUser] = useState(null),
    [owner, setOwner] = useState(null),
    [error, setError] = useState(""),
    [mode, setMode] = useState("login"),
    [message, setMessage] = useState(""),
    [mfaReady, setMfaReady] = useState(false),
    [pendingEmail, setPendingEmail] = useState(""),
    [passwordRecovery, setPasswordRecovery] = useState(false),
    [recoveryDone, setRecoveryDone] = useState(false),
    [recoveryEmail, setRecoveryEmail] = useState(""),
    [authBusy, setAuthBusy] = useState(false);
  const authBusyRef = useRef(false);
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setUser(session?.user || null);
        setPasswordRecovery(true);
        setLoading(false);
      }
    });
    (async () => {
      if (!supabase) {
        setError("Configuração do banco não encontrada.");
        setLoading(false);
        return;
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }
      setUser(session.user);
      if (session.user.is_anonymous) {
        setLoading(false);
        return;
      }
      const { data: assurance } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance?.currentLevel !== "aal2") {
        setLoading(false);
        return;
      }
      setMfaReady(true);
      const { data: o } = await supabase
        .from("owners")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();
      setOwner(o);
      setLoading(false);
    })();
    return () => subscription.unsubscribe();
  }, []);
  async function createOwner(name, id = user?.id) {
    if (!id) return;
    const row = { id, name: name.trim(), profile_color: "#6445ed" };
    const { data, error } = await supabase
      .from("owners")
      .upsert(row)
      .select()
      .single();
    if (error) throw error;
    setOwner(data);
  }
  async function register(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError("");
    const { data, error } = await supabase.auth.signUp({
      email: f.get("email"),
      password: f.get("password"),
      options: {
        data: { name: f.get("name").trim() },
        emailRedirectTo: APP_URL,
      },
    });
    if (error) {
      setError(authErrorPt(error, "Não foi possível criar a conta."));
      return;
    }
    if (!data.session) {
      setMessage("Cadastro criado. Confirme o e-mail e depois faça login.");
      setMode("login");
      return;
    }
    setUser(data.user);
  }
  async function migrateAnonymous(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      email = String(f.get("email")).trim();
    setError("");
    setPendingEmail(email);
    const { error } = await supabase.auth.updateUser(
      {
        email,
        password: f.get("password"),
        data: { name: f.get("name").trim() },
      },
      { emailRedirectTo: APP_URL },
    );
    if (error) {
      if (
        error.message.toLowerCase().includes("different from the old password")
      ) {
        setMessage(
          "A senha já foi salva na tentativa anterior. Reenvie a confirmação para concluir.",
        );
        return;
      }
      setError(authErrorPt(error, "Não foi possível proteger a conta."));
      return;
    }
    localStorage.setItem("finance-hub-permanent", "true");
    setMessage(
      "Conta protegida. Confirme o e-mail; depois entre novamente e ative o autenticador.",
    );
  }
  async function resendConfirmation() {
    if (!pendingEmail) return setError("Informe o e-mail usado no cadastro.");
    setError("");
    const { error } = await supabase.auth.resend({
      type: "email_change",
      email: pendingEmail,
      options: { emailRedirectTo: APP_URL },
    });
    if (error)
      return setError(
        authErrorPt(error, "Não foi possível reenviar a confirmação."),
      );
    setMessage(
      "Novo e-mail enviado com o endereço correto. Use somente o link mais recente.",
    );
  }
  async function signIn(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError("");
    const { data, error } = await supabase.auth.signInWithPassword({
      email: f.get("email"),
      password: f.get("password"),
    });
    if (error) {
      setError("E-mail ou senha inválidos, ou e-mail ainda não confirmado.");
      return;
    }
    setUser(data.user);
    location.reload();
  }
  async function requestPasswordReset(e) {
    e.preventDefault();
    if (authBusyRef.current) return;
    const email = recoveryEmail.trim();
    setError("");
    setMessage("");
    authBusyRef.current = true;
    setAuthBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: APP_URL,
    });
    authBusyRef.current = false;
    setAuthBusy(false);
    if (error) {
      setError(
        authErrorPt(error, "Não foi possível enviar o link de recuperação."),
      );
      return;
    }
    setMessage(
      "Se houver uma conta com esse e-mail, enviaremos um link seguro para redefinir a senha.",
    );
  }
  async function resendSignupConfirmation() {
    if (authBusyRef.current || !recoveryEmail.trim()) return;
    setError("");
    setMessage("");
    authBusyRef.current = true;
    setAuthBusy(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: recoveryEmail.…27266 tokens truncated…   </span>
            <em>
              Ver histórico <ChevronRight />
            </em>
          </button>
        ))}
        {!cards.length && <EmptyState text="Nenhum cartão cadastrado." />}
      </div>
    </>
  );
}

function CardDetail({ card, purchases, back, reload, notify }) {
  const [dialog, setDialog] = useState(null),
    [selected, setSelected] = useState([]),
    open = purchases.filter((p) => p.status === "open"),
    currentTotal = open.reduce((a, p) => a + Number(p.installment_amount), 0),
    remainingTotal = open.reduce(
      (a, p) =>
        a +
        Math.max(
          0,
          Number(p.total_amount) -
            Number(p.paid_installments) * Number(p.installment_amount),
        ),
      0,
    );
  function toggle(id) {
    setSelected((v) =>
      v.includes(id) ? v.filter((x) => x !== id) : [...v, id],
    );
  }
  async function pay(all) {
    const { data, error } = await supabase.rpc("pay_card_purchases", {
      p_card_id: card.id,
      p_purchase_ids: all ? null : selected,
      p_pay_all: all,
    });
    if (error) return notify("Não foi possível registrar o pagamento.");
    setDialog(null);
    setSelected([]);
    await reload();
    notify(
      all
        ? `Cartão quitado: ${data} compra(s).`
        : `Pagamento parcial registrado em ${data} compra(s).`,
    );
  }
  return (
    <div className="card-detail">
      <button className="back-button" onClick={back}>
        <ArrowDownLeft />
        Voltar aos cartões
      </button>
      <div className="card-detail-head">
        <div>
          <span>{card.bank}</span>
          <h2>{card.name}</h2>
          <p>
            Fecha dia {card.closing_day} · vence dia {card.due_day}
          </p>
        </div>
        <div>
          <small>Parcela do mês</small>
          <strong>{money(currentTotal)}</strong>
          <span>Saldo total {money(remainingTotal)}</span>
        </div>
        <button
          className="primary"
          disabled={!open.length}
          onClick={() => setDialog("choose")}
        >
          <Check />
          Pagar
        </button>
      </div>
      <div className="page-panel">
        <div className="panel-title">
          <div>
            <h2>Histórico de compras</h2>
            <p>{purchases.length} compra(s) registradas</p>
          </div>
        </div>
        <div className="purchase-history">
          <div className="purchase-row header">
            <span>Compra</span>
            <span>Responsável</span>
            <span>Valor total</span>
            <span>Parcelas</span>
            <span>Parcela atual</span>
            <span>Status</span>
          </div>
          {purchases.map((p) => (
            <div className="purchase-row" key={p.id}>
              <div>
                <strong>{p.description}</strong>
                <small>
                  {new Date(p.first_due_date + "T12:00").toLocaleDateString(
                    "pt-BR",
                  )}
                </small>
              </div>
              <span>{p.purchased_by}</span>
              <b>{money(Number(p.total_amount))}</b>
              <span>
                {Math.min(p.paid_installments + 1, p.installment_count)}/
                {p.installment_count}
              </span>
              <b>{money(Number(p.installment_amount))}</b>
              <i className={p.status}>
                {p.status === "paid" ? "Pago" : "Em aberto"}
              </i>
            </div>
          ))}
          {!purchases.length && (
            <EmptyState text="Nenhuma compra neste cartão." />
          )}
        </div>
      </div>
      {dialog && (
        <div className="payment-dialog-bg">
          <div className="payment-dialog">
            <div className="modal-head">
              <div>
                <h2>Como deseja pagar?</h2>
                <p>
                  {dialog === "choose"
                    ? "Escolha entre quitar o cartão ou selecionar parcelas."
                    : "Selecione as compras que serão pagas neste mês."}
                </p>
              </div>
              <button
                onClick={() => {
                  setDialog(null);
                  setSelected([]);
                }}
              >
                <X />
              </button>
            </div>
            {dialog === "choose" ? (
              <div className="payment-options">
                <button onClick={() => setDialog("total")}>
                  <ShieldCheck />
                  <strong>Pagar total</strong>
                  <span>
                    Quitar todas as compras em débito · {money(remainingTotal)}
                  </span>
                </button>
                <button onClick={() => setDialog("partial")}>
                  <FileText />
                  <strong>Pagamento parcial</strong>
                  <span>Escolher as parcelas atuais que serão pagas</span>
                </button>
              </div>
            ) : dialog === "total" ? (
              <div className="confirm-total">
                <AlertTriangle />
                <h3>Confirmar quitação total?</h3>
                <p>
                  Todas as {open.length} compras em aberto serão marcadas como
                  pagas. Valor pendente:{" "}
                  <strong>{money(remainingTotal)}</strong>.
                </p>
                <button className="primary" onClick={() => pay(true)}>
                  Confirmar pagamento total
                </button>
              </div>
            ) : (
              <>
                <div className="partial-list">
                  {open.map((p) => (
                    <label key={p.id}>
                      <input
                        type="checkbox"
                        checked={selected.includes(p.id)}
                        onChange={() => toggle(p.id)}
                      />
                      <span>
                        <strong>{p.description}</strong>
                        <small>
                          {p.purchased_by} · parcela {p.paid_installments + 1}/
                          {p.installment_count}
                        </small>
                      </span>
                      <b>{money(Number(p.installment_amount))}</b>
                    </label>
                  ))}
                </div>
                <div className="partial-footer">
                  <span>
                    Selecionado:{" "}
                    <strong>
                      {money(
                        open
                          .filter((p) => selected.includes(p.id))
                          .reduce(
                            (a, p) => a + Number(p.installment_amount),
                            0,
                          ),
                      )}
                    </strong>
                  </span>
                  <button
                    className="primary"
                    disabled={!selected.length}
                    onClick={() => pay(false)}
                  >
                    Pagar selecionados
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarModule({ owner, tx }) {
  const [events, setEvents] = useState([]),
    [viewDate, setViewDate] = useState(() => {
      const d = new Date();
      return new Date(d.getFullYear(), d.getMonth(), 1);
    }),
    year = viewDate.getFullYear(),
    month = viewDate.getMonth(),
    leading = new Date(year, month, 1).getDay(),
    days = Array.from(
      { length: new Date(year, month + 1, 0).getDate() },
      (_, i) => i + 1,
    );
  const changeMonth = (amount) =>
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + amount, 1));
  useEffect(() => {
    (async () => {
      const start = new Date(year, month, 1).toISOString().slice(0, 10),
        end = new Date(year, month + 1, 0).toISOString().slice(0, 10);
      const [
        { data: obligations },
        { data: purchases },
        { data: transactions },
        { data: subscriptions },
      ] = await Promise.all([
        supabase
          .from("obligations")
          .select("*")
          .eq("owner_id", owner.id)
          .gte("next_due_date", start)
          .lte("next_due_date", end)
          .neq("status", "paid"),
        supabase
          .from("card_purchases")
          .select("*,cards(name)")
          .eq("owner_id", owner.id)
          .lte("first_due_date", end)
          .eq("status", "open"),
        supabase
          .from("transactions")
          .select("*")
          .eq("owner_id", owner.id)
          .lte("transaction_date", end)
          .neq("status", "cancelled"),
        supabase
          .from("subscriptions")
          .select("*")
          .eq("owner_id", owner.id)
          .eq("active", true),
      ]);
      setEvents([
        ...(obligations || []).map((x) => ({
          id: x.id,
          day: Number(x.next_due_date.slice(8, 10)),
          type: x.direction === "receivable" ? "in" : "out",
          label: `${x.counterparty_name}: ${money(Number(x.installment_amount))}`,
        })),
        ...(purchases || []).flatMap((x) => {
          const first = new Date(x.first_due_date + "T12:00"),
            elapsed =
              (year - first.getFullYear()) * 12 + month - first.getMonth(),
            installment = elapsed + 1;
          if (
            elapsed < 0 ||
            installment > x.installment_count ||
            installment <= Number(x.paid_installments || 0)
          )
            return [];
          const last = new Date(year, month + 1, 0).getDate();
          return [
            {
              id: `cartao-${x.id}-${year}-${month}`,
              day: Math.min(first.getDate(), last),
              type: "out",
              label: `${x.cards?.name || "Cartão"} · ${installment}/${x.installment_count}: ${money(Number(x.installment_amount))}`,
            },
          ];
        }),
        ...(transactions || []).flatMap((x) => {
          const first = new Date(x.transaction_date + "T12:00"),
            elapsed =
              (year - first.getFullYear()) * 12 + month - first.getMonth();
          if (x.is_recurring && x.recurrence_active) {
            if (
              elapsed < 0 ||
              (x.recurrence_end_date && x.recurrence_end_date < start)
            )
              return [];
            return [
              {
                id: `mov-rec-${x.id}-${year}-${month}`,
                day: Math.min(
                  Number(x.recurrence_day || first.getDate()),
                  new Date(year, month + 1, 0).getDate(),
                ),
                type: x.transaction_type === "income" ? "in" : "out",
                label: `${x.name} · recorrente`,
              },
            ];
          }
          if (x.is_installment) {
            if (elapsed < 0 || elapsed >= Number(x.installment_count || 1))
              return [];
            return [
              {
                id: `mov-${x.id}-${elapsed}`,
                day: first.getDate(),
                type: x.transaction_type === "income" ? "in" : "out",
                label: `${x.name} · ${elapsed + 1}/${x.installment_count}`,
              },
            ];
          }
          if (x.transaction_date < start || x.transaction_date > end) return [];
          return [
            {
              id: `mov-${x.id}`,
              day: first.getDate(),
              type: x.transaction_type === "income" ? "in" : "out",
              label: x.name,
            },
          ];
        }),
        ...(subscriptions || []).map((x) => ({
          id: `assinatura-${x.id}-${year}-${month}`,
          day: Math.min(
            Number(x.due_day || 1),
            new Date(year, month + 1, 0).getDate(),
          ),
          type: "out",
          label: `${x.name}: ${money(Number(x.amount))}`,
        })),
      ]);
    })();
  }, [owner.id, year, month]);
  return (
    <div className="page-panel">
      <div className="page-head">
        <div>
          <h2>Calendário financeiro</h2>
          <p className="calendar-month">
            {viewDate.toLocaleDateString("pt-BR", {
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="calendar-navigation">
          <button onClick={() => changeMonth(-1)} aria-label="Mês anterior">
            <ChevronRight />
          </button>
          <button
            onClick={() => {
              const d = new Date();
              setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
            }}
          >
            Mês atual
          </button>
          <button onClick={() => changeMonth(1)} aria-label="Próximo mês">
            <ChevronRight />
          </button>
        </div>
      </div>
      <div className="calendar-weekdays">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((x) => (
          <span key={x}>{x}</span>
        ))}
      </div>
      <div className="calendar-grid">
        {Array.from({ length: leading }, (_, i) => (
          <div className="calendar-day empty" key={`vazio-${i}`} />
        ))}
        {days.map((d) => (
          <div className="calendar-day" key={d}>
            <b>{d}</b>
            {events
              .filter((x) => x.day === d)
              .map((x) => (
                <span className={x.type} key={x.id} title={x.label}>
                  {x.label}
                </span>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
function ReportsModule({ tx }) {
  const inc = tx
      .filter((x) => x.type === "in")
      .reduce((a, x) => a + x.value, 0),
    out = tx.filter((x) => x.type === "out").reduce((a, x) => a + x.value, 0);
  function csv() {
    const body = [
      "Nome,Categoria,Data,Tipo,Valor",
      ...tx.map(
        (x) => `"${x.name}","${x.cat}","${x.date}",${x.type},${x.value}`,
      ),
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([body], { type: "text/csv" }));
    a.download = "finance-hub.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return (
    <div className="page-panel">
      <div className="page-head">
        <div>
          <h2>Relatórios</h2>
          <p>Resumo baseado nas movimentações reais.</p>
        </div>
        <button className="primary" onClick={csv} disabled={!tx.length}>
          <Download />
          Exportar CSV
        </button>
      </div>
      <div className="report-grid">
        <div>
          <span>Receitas</span>
          <strong className="pos">{money(inc)}</strong>
        </div>
        <div>
          <span>Despesas</span>
          <strong className="neg">{money(out)}</strong>
        </div>
        <div>
          <span>Resultado</span>
          <strong>{money(inc - out)}</strong>
        </div>
        <div>
          <span>Lançamentos</span>
          <strong>{tx.length}</strong>
        </div>
      </div>
      <Transactions rows={tx} open={null} />
    </div>
  );
}
function FinancialIntelligence({ owner, tx, notify, refresh, ask }) {
  const [tab, setTab] = useState("visao"),
    [goals, setGoals] = useState([]),
    [goalOpen, setGoalOpen] = useState(false),
    [editingGoal, setEditingGoal] = useState(null),
    [simulation, setSimulation] = useState(null),
    [aiLoading, setAiLoading] = useState(false),
    [aiResult, setAiResult] = useState(null),
    [aiQuestion, setAiQuestion] = useState("");
  async function load() {
    const { data } = await supabase
      .from("financial_goals")
      .select("*")
      .eq("owner_id", owner.id)
      .neq("status", "cancelled")
      .order("target_date");
    setGoals(data || []);
  }
  useEffect(() => {
    load();
  }, [owner.id]);
  const flagged = tx.filter((item) => item.duplicateStatus === "pending"),
    classified = tx.filter(
      (item) =>
        item.classificationSource === "rules" ||
        item.classificationSource === "gemini",
    ),
    now = new Date(),
    thisKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    previous = new Date(now.getFullYear(), now.getMonth() - 1, 1),
    previousKey = `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, "0")}`;
  const monthTotals = (key) =>
      tx
        .filter((item) => String(item.rawDate || "").startsWith(key))
        .reduce(
          (acc, item) => {
            acc[item.type] += Number(item.value);
            return acc;
          },
          { in: 0, out: 0 },
        ),
    current = monthTotals(thisKey),
    prior = monthTotals(previousKey),
    difference = current.in - current.out - (prior.in - prior.out);
  async function reviewDuplicate(item, status) {
    const { error } = await supabase
      .from("transactions")
      .update({ duplicate_review_status: status })
      .eq("id", item.id)
      .eq("owner_id", owner.id);
    if (error) return notify("Não foi possível registrar a revisão.");
    await refresh();
    notify(
      status === "dismissed"
        ? "Alerta descartado."
        : "Duplicidade confirmada; o lançamento foi mantido para sua decisão.",
    );
  }
  async function saveGoal(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      target = parseBRNumber(f.get("target")),
      currentAmount = parseBRNumber(f.get("current")) || 0;
    if (!Number.isFinite(target) || target <= 0)
      return notify("Informe um valor de meta válido.");
    if (currentAmount < 0)
      return notify("O valor reservado não pode ser negativo.");
    const payload = {
      name: String(f.get("name") || "").trim(),
      target_amount: target,
      current_amount: Math.min(currentAmount, target),
      target_date: f.get("date"),
      priority: f.get("priority"),
      notes: f.get("notes") || null,
      status: currentAmount >= target ? "completed" : "active",
      updated_at: new Date().toISOString(),
    };
    const query = editingGoal
      ? supabase
          .from("financial_goals")
          .update(payload)
          .eq("id", editingGoal.id)
          .eq("owner_id", owner.id)
      : supabase
          .from("financial_goals")
          .insert({ ...payload, owner_id: owner.id });
    const { error } = await query;
    if (error)
      return notify(
        editingGoal
          ? "Não foi possível atualizar a meta."
          : "Não foi possível salvar a meta.",
      );
    const wasEditing = Boolean(editingGoal);
    setGoalOpen(false);
    setEditingGoal(null);
    await load();
    notify(
      wasEditing ? "Meta atualizada com sucesso." : "Meta financeira criada.",
    );
  }
  function openNewGoal() {
    setEditingGoal(null);
    setGoalOpen(true);
  }
  function openEditGoal(goal) {
    setEditingGoal(goal);
    setGoalOpen(true);
  }
  function closeGoalForm() {
    setGoalOpen(false);
    setEditingGoal(null);
  }
  async function contribute(goal) {
    const value = await ask({
      kind: "input",
      title: "Adicionar progresso à meta",
      message: `Informe quanto foi reservado para “${goal.name}”.`,
      value: "",
      confirmLabel: "Adicionar à meta",
    });
    if (value == null) return;
    const amount = parseBRNumber(value);
    if (!Number.isFinite(amount) || amount <= 0)
      return notify("Informe um valor válido.");
    const next = Math.min(
        Number(goal.target_amount),
        Number(goal.current_amount) + amount,
      ),
      { error } = await supabase
        .from("financial_goals")
        .update({
          current_amount: next,
          status: next >= Number(goal.target_amount) ? "completed" : "active",
          updated_at: new Date().toISOString(),
        })
        .eq("id", goal.id)
        .eq("owner_id", owner.id);
    if (error) return notify("Não foi possível atualizar a meta.");
    await load();
    notify(
      next >= Number(goal.target_amount)
        ? "Parabéns! Meta concluída."
        : "Progresso da meta atualizado.",
    );
  }
  function simulate(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      principal = parseBRNumber(f.get("balance")),
      rate = (parseBRNumber(f.get("rate")) || 0) / 100,
      payment = parseBRNumber(f.get("payment")),
      extra = parseBRNumber(f.get("extra")) || 0;
    if (!principal || !payment || payment + extra <= principal * rate)
      return notify("A parcela precisa ser maior que os juros do mês.");
    const run = (extraValue) => {
      let balance = principal,
        months = 0,
        interest = 0;
      while (balance > 0.01 && months < 1200) {
        const fee = balance * rate;
        interest += fee;
        balance = Math.max(0, balance + fee - payment - extraValue);
        months++;
      }
      return { months, interest, total: principal + interest };
    };
    const base = run(0),
      accelerated = run(extra);
    setSimulation({
      base,
      accelerated,
      saved: base.interest - accelerated.interest,
    });
  }
  async function runAI(mode, question = "") {
    setAiLoading(true);
    setAiResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("financial-ai", {
        body: { mode, question },
      });
      if (error) {
        let detail = null;
        try {
          detail = await error.context?.json();
        } catch {
          detail = null;
        }
        return notify(
          detail?.erro ||
            error.message ||
            "Não foi possível consultar a Inteligência Financeira.",
        );
      }
      if (data?.erro) return notify(data.erro);
      setAiResult({ mode, ...data.resultado });
      if (mode !== "assistant") setTab("assistente");
    } finally {
      setAiLoading(false);
    }
  }
  const tabs = [
    ["visao", "Visão inteligente", BrainCircuit],
    ["duplicidades", "Duplicidades", CopyCheck],
    ["quitacao", "Quitação", Calculator],
    ["metas", "Metas", Target],
    ["assistente", "Assistente", MessageCircle],
  ];
  return (
    <div className="intelligence-page">
      <div className="page-head">
        <div>
          <h2>Inteligência financeira</h2>
          <p>
            Análises seguras para decidir melhor, sem alterar seus dados
            automaticamente.
          </p>
        </div>
        <span className="intelligence-badge">
          <ShieldCheck />
          Dados protegidos por RLS
        </span>
      </div>
      <div className="intelligence-tabs">
        {tabs.map(([key, label, Icon]) => (
          <button
            key={key}
            className={tab === key ? "active" : ""}
            onClick={() => setTab(key)}
          >
            <Icon />
            {label}
            {key === "duplicidades" && flagged.length > 0 ? (
              <b>{flagged.length}</b>
            ) : null}
          </button>
        ))}
      </div>
      {tab === "visao" && (
        <>
          <div className="intelligence-summary">
            <article>
              <Tags />
              <span>
                <small>Classificação automática</small>
                <strong>{classified.length} lançamento(s)</strong>
                <p>
                  Regras locais; Gemini poderá interpretar descrições ambíguas.
                </p>
              </span>
            </article>
            <article>
              <CopyCheck />
              <span>
                <small>Possíveis duplicidades</small>
                <strong>{flagged.length}</strong>
                <p>Mesmo valor, tipo e data próxima exigem sua revisão.</p>
              </span>
            </article>
            <article>
              <CircleDollarSign />
              <span>
                <small>Resultado comparado</small>
                <strong className={difference >= 0 ? "positive" : "negative"}>
                  {difference >= 0 ? "+ " : ""}
                  {money(difference)}
                </strong>
                <p>Diferença do resultado atual contra o mês anterior.</p>
              </span>
            </article>
            <article>
              <Target />
              <span>
                <small>Metas ativas</small>
                <strong>
                  {goals.filter((g) => g.status === "active").length}
                </strong>
                <p>
                  Acompanhamento e valor mensal necessário calculados
                  localmente.
                </p>
              </span>
            </article>
          </div>
          <section className="ai-preview">
            <Lightbulb />
            <div>
              <small>GEMINI CONECTADO COM SEGURANÇA</small>
              <h3>Economia personalizada e comparação mensal explicada</h3>
              <p>
                A IA recebe somente totais e categorias agregados, nunca sua
                senha, e-mail ou telefone.
              </p>
              <div className="ai-quick-actions">
                <button onClick={() => runAI("savings")} disabled={aiLoading}>
                  <PiggyBank />
                  Sugerir economias
                </button>
                <button
                  onClick={() => runAI("monthly_comparison")}
                  disabled={aiLoading}
                >
                  <ChartNoAxesCombined />
                  Explicar comparação mensal
                </button>
              </div>
            </div>
          </section>
        </>
      )}
      {tab === "duplicidades" && (
        <section className="intelligence-panel">
          <div className="panel-title">
            <div>
              <h3>Revisão de duplicidades</h3>
              <p>Nenhum lançamento é apagado automaticamente.</p>
            </div>
          </div>
          {flagged.map((item) => (
            <article className="duplicate-row" key={item.id}>
              <CopyCheck />
              <div>
                <strong>{item.name}</strong>
                <span>
                  {item.cat} · {item.date}
                </span>
              </div>
              <b>{money(item.value)}</b>
              <div>
                <button onClick={() => reviewDuplicate(item, "dismissed")}>
                  Não é duplicado
                </button>
                <button
                  className="danger-text"
                  onClick={() => reviewDuplicate(item, "confirmed")}
                >
                  Confirmar alerta
                </button>
              </div>
            </article>
          ))}
          {!flagged.length && (
            <EmptyState text="Nenhuma possível duplicidade aguardando revisão." />
          )}
        </section>
      )}
      {tab === "quitacao" && (
        <section className="intelligence-panel debt-simulator">
          <div>
            <h3>Simulação de quitação antecipada</h3>
            <p>
              Compare prazo e juros usando as condições informadas pelo seu
              credor.
            </p>
          </div>
          <form className="inline-form" onSubmit={simulate}>
            <label>
              Dívida atual
              <input
                name="balance"
                inputMode="decimal"
                required
                placeholder="Ex.: 5.000,00"
              />
            </label>
            <label>
              Juros ao mês (%)
              <input
                name="rate"
                inputMode="decimal"
                required
                placeholder="Ex.: 2,50"
              />
            </label>
            <label>
              Parcela atual
              <input
                name="payment"
                inputMode="decimal"
                required
                placeholder="Ex.: 350,00"
              />
            </label>
            <label>
              Valor extra mensal
              <input
                name="extra"
                inputMode="decimal"
                placeholder="Ex.: 100,00"
              />
            </label>
            <button className="primary">
              <Calculator />
              Simular
            </button>
          </form>
          {simulation && (
            <div className="simulation-result">
              <span>
                <small>Plano atual</small>
                <strong>{simulation.base.months} meses</strong>
                <b>{money(simulation.base.interest)} em juros</b>
              </span>
              <span>
                <small>Com antecipação</small>
                <strong>{simulation.accelerated.months} meses</strong>
                <b>{money(simulation.accelerated.interest)} em juros</b>
              </span>
              <span className="saving">
                <small>Economia estimada</small>
                <strong>{money(simulation.saved)}</strong>
                <b>
                  {simulation.base.months - simulation.accelerated.months} meses
                  a menos
                </b>
              </span>
            </div>
          )}
          <p className="legal-note">
            Simulação orientativa. Confirme saldo, juros, encargos e desconto de
            quitação com o credor.
          </p>
        </section>
      )}
      {tab === "metas" && (
        <section className="intelligence-panel">
          <div className="panel-title">
            <div>
              <h3>Metas financeiras inteligentes</h3>
              <p>
                O valor mensal necessário é recalculado conforme prazo e
                progresso.
              </p>
            </div>
            <button className="primary" onClick={openNewGoal}>
              <Plus />
              Nova meta
            </button>
          </div>
          {goalOpen && (
            <form
              key={editingGoal?.id || "new-goal"}
              className="inline-form goal-form"
              onSubmit={saveGoal}
            >
              <div className="goal-form-heading wide">
                <strong>{editingGoal ? "Editar meta" : "Criar nova meta"}</strong>
                <small>
                  {editingGoal
                    ? "Revise os dados e salve as alterações."
                    : "Defina o objetivo e acompanhe sua evolução."}
                </small>
              </div>
              <label>
                Nome da meta
                <input
                  name="name"
                  required
                  defaultValue={editingGoal?.name || ""}
                  placeholder="Ex.: Reserva de emergência"
                />
              </label>
              <label>
                Valor desejado
                <input
                  name="target"
                  inputMode="decimal"
                  required
                  defaultValue={
                    editingGoal
                      ? Number(editingGoal.target_amount).toLocaleString(
                          "pt-BR",
                          { minimumFractionDigits: 2 },
                        )
                      : ""
                  }
                  placeholder="10.000,00"
                />
              </label>
              <label>
                Valor já reservado
                <input
                  name="current"
                  inputMode="decimal"
                  defaultValue={
                    editingGoal
                      ? Number(editingGoal.current_amount).toLocaleString(
                          "pt-BR",
                          { minimumFractionDigits: 2 },
                        )
                      : ""
                  }
                  placeholder="0,00"
                />
              </label>
              <label>
                Data desejada
                <input
                  name="date"
                  type="date"
                  required
                  defaultValue={editingGoal?.target_date || ""}
                  min={
                    editingGoal?.target_date <
                    new Date().toISOString().slice(0, 10)
                      ? editingGoal.target_date
                      : new Date().toISOString().slice(0, 10)
                  }
                />
              </label>
              <label>
                Prioridade
                <select
                  name="priority"
                  defaultValue={editingGoal?.priority || "high"}
                >
                  <option value="high">Alta</option>
                  <option value="medium">Média</option>
                  <option value="low">Baixa</option>
                </select>
              </label>
              <label className="wide">
                Observações
                <textarea
                  name="notes"
                  defaultValue={editingGoal?.notes || ""}
                />
              </label>
              <div className="form-actions">
                <button type="button" onClick={closeGoalForm}>
                  Cancelar
                </button>
                <button className="primary">
                  {editingGoal ? "Salvar alterações" : "Salvar meta"}
                </button>
              </div>
            </form>
          )}
          <div className="goal-grid">
            {goals.map((goal) => {
              const target = Number(goal.target_amount),
                saved = Number(goal.current_amount),
                remaining = Math.max(0, target - saved),
                months = Math.max(
                  1,
                  (new Date(goal.target_date + "T12:00").getFullYear() -
                    now.getFullYear()) *
                    12 +
                    new Date(goal.target_date + "T12:00").getMonth() -
                    now.getMonth(),
                ),
                monthly = remaining / months,
                progress = Math.min(100, (saved / target) * 100);
              return (
                <article key={goal.id}>
                  <div>
                    <span className={`priority ${goal.priority}`}>
                      {goal.priority === "high"
                        ? "Alta prioridade"
                        : goal.priority === "medium"
                          ? "Média prioridade"
                          : "Baixa prioridade"}
                    </span>
                    <h3>{goal.name}</h3>
                    <small>
                      Até{" "}
                      {new Date(goal.target_date + "T12:00").toLocaleDateString(
                        "pt-BR",
                      )}
                    </small>
                  </div>
                  <strong>
                    {money(saved)} <small>de {money(target)}</small>
                  </strong>
                  <div className="goal-progress">
                    <i style={{ width: `${progress}%` }} />
                  </div>
                  <p>
                    Reserve aproximadamente <b>{money(monthly)} por mês</b>.
                  </p>
                  <div className="goal-actions">
                    <button onClick={() => openEditGoal(goal)}>Editar</button>
                    <button
                      className="primary"
                      onClick={() => contribute(goal)}
                      disabled={goal.status === "completed"}
                    >
                      {goal.status === "completed"
                        ? "Meta concluída"
                        : "Adicionar progresso"}
                    </button>
                  </div>
                </article>
              );
            })}
            {!goals.length && (
              <EmptyState text="Crie sua primeira meta financeira." />
            )}
          </div>
        </section>
      )}
      {tab === "assistente" && (
        <section className="assistant-live">
          <div className="assistant-title">
            <BrainCircuit />
            <div>
              <small>ASSISTENTE PROTEGIDO</small>
              <h3>Converse com suas finanças</h3>
              <p>
                As respostas usam somente resumos autorizados e são educativas.
              </p>
            </div>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runAI("assistant", aiQuestion);
            }}
          >
            <textarea
              value={aiQuestion}
              onChange={(e) => setAiQuestion(e.target.value)}
              maxLength="600"
              required
              placeholder="Ex.: Em quais categorias gastei mais neste mês?"
            />
            <div>
              <small>{aiQuestion.length}/600</small>
              <button
                className="primary"
                disabled={aiLoading || !aiQuestion.trim()}
              >
                {aiLoading ? <RefreshCw className="spin" /> : <Send />}
                {aiLoading ? "Analisando..." : "Perguntar ao Gemini"}
              </button>
            </div>
          </form>
          {aiResult && (
            <article className="ai-answer">
              <span>
                <Sparkles />
                <small>
                  {aiResult.mode === "savings"
                    ? "SUGESTÕES DE ECONOMIA"
                    : aiResult.mode === "monthly_comparison"
                      ? "COMPARAÇÃO MENSAL"
                      : "RESPOSTA DO ASSISTENTE"}
                </small>
              </span>
              <h3>{aiResult.titulo}</h3>
              <p>{aiResult.resumo}</p>
              {aiResult.recomendacoes?.length > 0 && (
                <div>
                  <strong>Recomendações</strong>
                  <ul>
                    {aiResult.recomendacoes.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {aiResult.alertas?.length > 0 && (
                <div className="ai-alerts">
                  <strong>Pontos de atenção</strong>
                  <ul>
                    {aiResult.alertas.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              <small className="ai-disclaimer">{aiResult.aviso}</small>
            </article>
          )}
        </section>
      )}
    </div>
  );
}
function StreamingsModule({ owner, notify }) {
  const [subscriptions, setSubscriptions] = useState([]),
    [charges, setCharges] = useState([]),
    [editing, setEditing] = useState(null),
    [open, setOpen] = useState(false),
    [shared, setShared] = useState(false),
    [participants, setParticipants] = useState([
      { name: "", phone: "", amount: "" },
    ]);
  const reference = monthStart(),
    months = Array.from({ length: 4 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (3 - i));
      return monthStart(d);
    });
  async function load() {
    const [{ data: s }, { data: c }] = await Promise.all([
      supabase
        .from("subscriptions")
        .select("*")
        .eq("owner_id", owner.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("subscription_charges")
        .select("*,subscriptions(name)")
        .eq("owner_id", owner.id)
        .order("reference_month", { ascending: false }),
    ]);
    setSubscriptions(s || []);
    setCharges(c || []);
  }
  useEffect(() => {
    load();
  }, [owner.id]);
  function addParticipant() {
    setParticipants((v) => [...v, { name: "", phone: "", amount: "" }]);
  }
  function updateParticipant(index, key, value) {
    setParticipants((v) =>
      v.map((p, i) => (i === index ? { ...p, [key]: value } : p)),
    );
  }
  function removeParticipant(index) {
    setParticipants((v) => v.filter((_, i) => i !== index));
  }
  function startEdit(subscription) {
    setEditing(subscription);
    setShared(subscription.is_shared);
    setParticipants(
      subscription.participants?.length
        ? subscription.participants.map((p) => ({
            ...p,
            amount: String(p.amount).replace(".", ","),
          }))
        : [{ name: "", phone: "", amount: "" }],
    );
    setOpen(true);
  }
  function close() {
    setOpen(false);
    setEditing(null);
    setShared(false);
    setParticipants([{ name: "", phone: "", amount: "" }]);
  }
  async function save(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      clean = shared
        ? participants
            .filter((p) => p.name.trim())
            .map((p) => ({
              name: p.name.trim(),
              phone: p.phone.replace(/\D/g, ""),
              amount: parseBRNumber(p.amount),
            }))
        : [],
      payload = {
        owner_id: owner.id,
        name: f.get("name"),
        amount: parseBRNumber(f.get("amount")),
        due_day: Number(f.get("due_day")),
        is_shared: shared,
        participants: clean,
        active: true,
        updated_at: new Date().toISOString(),
      };
    let subscription;
    if (editing) {
      const { data, error } = await supabase
        .from("subscriptions")
        .update(payload)
        .eq("id", editing.id)
        .eq("owner_id", owner.id)
        .select()
        .single();
      if (error) return notify("Não foi possível atualizar o streaming.");
      subscription = data;
    } else {
      const { data, error } = await supabase
        .from("subscriptions")
        .insert(payload)
        .select()
        .single();
      if (error) return notify("Não foi possível salvar o streaming.");
      subscription = data;
    }
    if (shared) {
      const now = new Date(),
        last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
        due = `${reference.slice(0, 8)}${String(Math.min(payload.due_day, last)).padStart(2, "0")}`;
      for (const person of clean)
        await supabase
          .from("subscription_charges")
          .upsert(
            {
              owner_id: owner.id,
              subscription_id: subscription.id,
              participant_name: person.name,
              phone: person.phone,
              amount: person.amount,
              reference_month: reference,
              due_date: due,
              status:
                new Date(due + "T23:59:59") < new Date()
                  ? "overdue"
                  : "pending",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "subscription_id,participant_name,reference_month" },
          );
    }
    close();
    await load();
    notify(editing ? "Streaming atualizado." : "Streaming cadastrado.");
  }
  async function pay(charge) {
    const { error } = await supabase
      .from("subscription_charges")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", charge.id)
      .eq("owner_id", owner.id);
    if (error) return notify("Não foi possível registrar o pagamento.");
    await load();
    notify("Pagamento registrado.");
  }
  function chargeWhatsApp(personCharges) {
    const current = personCharges.filter(
        (c) => c.status !== "paid" && c.status !== "cancelled",
      ),
      phone = (current[0]?.phone || "").replace(/\D/g, ""),
      total = current.reduce((sum, c) => sum + Number(c.amount), 0),
      items = current
        .map(
          (c) =>
            `${c.subscriptions?.name || "Streaming"} · ${new Date(c.reference_month + "T12:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}: ${money(Number(c.amount))}`,
        )
        .join("\n");
    if (!phone) return notify("Cadastre o WhatsApp desta pessoa.");
    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(`Olá, ${current[0]?.participant_name}! Segue o resumo das assinaturas compartilhadas em aberto:\n\n${items}\n\nTotal: ${money(total)}`)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }
  const people = Object.values(
    charges.reduce((acc, c) => {
      const key = c.participant_name.toLocaleUpperCase("pt-BR");
      (acc[key] ??= { name: c.participant_name, rows: [] }).rows.push(c);
      return acc;
    }, {}),
  );
  return (
    <div className="streaming-page">
      <div className="page-head">
        <div>
          <h2>Streamings</h2>
          <p>Gerencie assinaturas e cobranças compartilhadas.</p>
        </div>
        <button className="primary" onClick={() => setOpen(true)}>
          <Plus />
          Nova assinatura
        </button>
      </div>
      {open && (
        <form className="inline-form streaming-form" onSubmit={save}>
          <div className="modal-head wide">
            <div>
              <h2>{editing ? "Editar streaming" : "Novo streaming"}</h2>
              <p>Cadastre a assinatura e quem divide o pagamento.</p>
            </div>
            <button type="button" onClick={close}>
              <X />
            </button>
          </div>
          <label>
            Nome
            <input
              name="name"
              defaultValue={editing?.name || ""}
              placeholder="Netflix, Spotify..."
              required
            />
          </label>
          <label>
            Valor total
            <input
              name="amount"
              defaultValue={
                editing ? String(editing.amount).replace(".", ",") : ""
              }
              inputMode="decimal"
              placeholder="55,90"
              required
            />
          </label>
          <label>
            Dia do vencimento
            <input
              name="due_day"
              type="number"
              min="1"
              max="31"
              defaultValue={editing?.due_day || 10}
              required
            />
          </label>
          <label className="setting-row share-toggle">
            <span>
              <strong>Divide com alguém?</strong>
              <small>Crie cobranças mensais individuais</small>
            </span>
            <input
              type="checkbox"
              checked={shared}
              onChange={(e) => setShared(e.target.checked)}
            />
          </label>
          {shared && (
            <div className="streaming-participants wide">
              <div className="participant-title">
                <strong>Participantes</strong>
                <button type="button" onClick={addParticipant}>
                  <Plus />
                  Adicionar pessoa
                </button>
              </div>
              {participants.map((p, i) => (
                <div className="participant-row" key={i}>
                  <label>
                    Nome
                    <input
                      value={p.name}
                      onChange={(e) =>
                        updateParticipant(i, "name", e.target.value)
                      }
                      required
                    />
                  </label>
                  <label>
                    WhatsApp
                    <input
                      value={p.phone}
                      onChange={(e) =>
                        updateParticipant(i, "phone", e.target.value)
                      }
                      placeholder="5511999999999"
                      required
                    />
                  </label>
                  <label>
                    Valor
                    <input
                      value={p.amount}
                      onChange={(e) =>
                        updateParticipant(i, "amount", e.target.value)
                      }
                      inputMode="decimal"
                      placeholder="19,90"
                      required
                    />
                  </label>
                  {participants.length > 1 && (
                    <button type="button" onClick={() => removeParticipant(i)}>
                      <X />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="form-actions wide">
            <button type="button" onClick={close}>
              Cancelar
            </button>
            <button className="primary">
              {editing ? "Salvar alterações" : "Salvar streaming"}
            </button>
          </div>
        </form>
      )}
      <div className="streaming-subscriptions">
        {subscriptions.map((s) => (
          <article key={s.id}>
            <span>
              <Play />
            </span>
            <div>
              <small>ASSINATURA</small>
              <h3>{s.name}</h3>
              <p>
                Vence dia {s.due_day} · {s.participants?.length || 0}{" "}
                participante(s)
              </p>
            </div>
            <strong>{money(Number(s.amount))}</strong>
            <button
              onClick={() => startEdit(s)}
              aria-label={`Editar ${s.name}`}
            >
              <Settings />
              Editar
            </button>
          </article>
        ))}
        {!subscriptions.length && (
          <EmptyState text="Nenhum streaming cadastrado." />
        )}
      </div>
      <div className="streaming-people">
        <h2>Cobranças por pessoa</h2>
        {people.map((person) => (
          <article key={person.name}>
            <div className="stream-person-head">
              <span>{person.name[0]}</span>
              <div>
                <h3>{person.name}</h3>
                <small>
                  {person.rows.filter((c) => c.status !== "paid").length}{" "}
                  cobrança(s) em aberto
                </small>
              </div>
              <strong>
                {money(
                  person.rows
                    .filter(
                      (c) => c.status !== "paid" && c.status !== "cancelled",
                    )
                    .reduce((a, c) => a + Number(c.amount), 0),
                )}
              </strong>
            </div>
            <div className="stream-charge-list">
              {person.rows.map((c) => (
                <div key={c.id}>
                  <span>
                    <b>{c.subscriptions?.name}</b>
                    <small>
                      {new Date(
                        c.reference_month + "T12:00",
                      ).toLocaleDateString("pt-BR", {
                        month: "long",
                        year: "numeric",
                      })}
                    </small>
                  </span>
                  <strong>{money(Number(c.amount))}</strong>
                  <i className={c.status}>
                    {
                      {
                        pending: "Pendente",
                        paid: "Pago",
                        overdue: "Atrasado",
                        cancelled: "Cancelado",
                      }[c.status]
                    }
                  </i>
                  <button disabled={c.status === "paid"} onClick={() => pay(c)}>
                    <Check />
                    {c.status === "paid" ? "Pago" : "Pagar"}
                  </button>
                </div>
              ))}
            </div>
            <button
              className="whatsapp"
              onClick={() => chargeWhatsApp(person.rows)}
            >
              <Send />
              Cobrar pelo WhatsApp
            </button>
          </article>
        ))}
      </div>
      <div className="streaming-history">
        <div>
          <h2>Histórico geral</h2>
          <p>Comparativo dos três meses anteriores e do mês atual.</p>
        </div>
        <section>
          {months.map((month) => {
            const rows = charges.filter((c) => c.reference_month === month),
              paid = rows
                .filter((c) => c.status === "paid")
                .reduce((a, c) => a + Number(c.amount), 0),
              open = rows
                .filter((c) => c.status !== "paid" && c.status !== "cancelled")
                .reduce((a, c) => a + Number(c.amount), 0);
            return (
              <article key={month}>
                <small>
                  {new Date(month + "T12:00").toLocaleDateString("pt-BR", {
                    month: "long",
                    year: "numeric",
                  })}
                </small>
                <strong>{money(paid + open)}</strong>
                <span>Pago {money(paid)}</span>
                <span>Em aberto {money(open)}</span>
              </article>
            );
          })}
        </section>
      </div>
    </div>
  );
}

function SettingsModule({
  owner,
  modules,
  reloadModules,
  onUpdate,
  dark,
  setDark,
  notify,
  ask,
  openBuilder,
}) {
  const [section, setSection] = useState("profile"),
    [name, setName] = useState(owner.name),
    [appName, setAppName] = useState(owner.app_name || "Finance Hub"),
    [appColor, setAppColor] = useState(owner.app_color || "#6445ED"),
    [backgroundColor, setBackgroundColor] = useState(
      owner.background_color || "#F6F8FC",
    ),
    [streamingEnabled, setStreamingEnabled] = useState(
      Boolean(owner.streaming_enabled),
    ),
    [closureMode, setClosureMode] = useState(
      owner.monthly_closure_mode || "manual",
    ),
    [closureDestination, setClosureDestination] = useState(
      owner.closure_destination || "local",
    ),
    [destinationOpen, setDestinationOpen] = useState(false),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [showPassword, setShowPassword] = useState(false),
    [savingPassword, setSavingPassword] = useState(false),
    [assetBusy, setAssetBusy] = useState("");
  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data }) => setEmail(data.user?.email || ""));
  }, []);
  useEffect(() => {
    const layout = document.querySelector(".settings-layout");
    if (layout) {
      layout.dataset.section = section;
      layout.firstElementChild?.classList.add("profile-appearance-panel");
    }
  }, [section]);
  async function save(e) {
    e.preventDefault();
    const { error } = await supabase
      .from("owners")
      .update({
        name,
        app_name: appName,
        app_color: appColor,
        background_color: backgroundColor,
        streaming_enabled: streamingEnabled,
        monthly_closure_mode: closureMode,
        closure_destination: closureDestination,
        updated_at: new Date().toISOString(),
      })
      .eq("id", owner.id);
    if (error) return notify("Erro ao salvar personalização.");
    onUpdate({
      ...owner,
      name,
      app_name: appName,
      app_color: appColor,
      background_color: backgroundColor,
      streaming_enabled: streamingEnabled,
      monthly_closure_mode: closureMode,
      closure_destination: closureDestination,
    });
    notify("Personalização salva.");
  }
  async function uploadAsset(file, kind) {
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
        file.type,
      )
    )
      return notify("Escolha uma imagem JPG, PNG, WEBP ou GIF.");
    if (file.size > 5 * 1024 * 1024)
      return notify("A imagem deve ter no máximo 5 MB.");
    setAssetBusy(kind);
    const extension = (file.name.split(".").pop() || "jpg")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, ""),
      path = `${owner.id}/${kind}-${Date.now()}.${extension}`,
      column = kind === "avatar" ? "avatar_url" : "background_image_url",
      oldPath = owner[column];
    const { error: uploadError } = await supabase.storage
      .from("finance-assets")
      .upload(path, file, { contentType: file.type });
    if (uploadError) {
      setAssetBusy("");
      return notify("Não foi possível enviar a imagem.");
    }
    const { error } = await supabase
      .from("owners")
      .update({ [column]: path, updated_at: new Date().toISOString() })
      .eq("id", owner.id);
    setAssetBusy("");
    if (error) {
      await supabase.storage.from("finance-assets").remove([path]);
      return notify(
        "A imagem foi enviada, mas não foi possível vinculá-la ao perfil.",
      );
    }
    if (oldPath)
      await supabase.storage.from("finance-assets").remove([oldPath]);
    onUpdate({ ...owner, [column]: path });
    notify(
      kind === "avatar"
        ? "Foto de perfil atualizada."
        : "Imagem de fundo atualizada.",
    );
  }
  async function linkEmail() {
    if (!email) return notify("Informe um e-mail válido.");
    const { error } = await supabase.auth.updateUser(
      { email },
      { emailRedirectTo: APP_URL },
    );
    notify(
      error
        ? authErrorPt(error, "Não foi possível atualizar o e-mail.")
        : "Enviamos a confirmação para o novo e-mail.",
    );
  }
  async function setAccountPassword() {
    if (password.length < 10)
      return notify("A nova senha precisa ter pelo menos 10 caracteres.");
    setSavingPassword(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) {
      setSavingPassword(false);
      return notify("Confirme primeiro o endereço de e-mail.");
    }
    const { error } = await supabase.auth.updateUser({ password });
    setSavingPassword(false);
    if (error)
      return notify(authErrorPt(error, "Não foi possível alterar a senha."));
    setPassword("");
    setShowPassword(false);
    notify("Senha alterada com sucesso.");
  }
  async function editModule(m) {
    const result = await ask({
        kind: "input",
        title: "Editar função",
        message: "Altere o nome que será exibido no menu do Finance Hub.",
        value: m.name,
        confirmLabel: "Salvar alteração",
      }),
      next = result?.trim();
    if (!next || next === m.name) return;
    const { error } = await supabase
      .from("custom_modules")
      .update({ name: next })
      .eq("id", m.id)
      .eq("owner_id", owner.id);
    if (error) return notify("Não foi possível editar.");
    await reloadModules();
    notify("Função atualizada.");
  }
  async function deleteModule(m) {
    const accepted = await ask({
      kind: "confirm",
      tone: "danger",
      title: "Excluir função?",
      message: `A função “${m.name}” e todos os registros vinculados serão excluídos permanentemente.`,
      confirmLabel: "Excluir função",
    });
    if (!accepted) return;
    const { error } = await supabase
      .from("custom_modules")
      .delete()
      .eq("id", m.id)
      .eq("owner_id", owner.id);
    if (error) return notify("Não foi possível excluir.");
    await reloadModules();
    notify("Função excluída.");
  }
  return (
    <>
      <div className="settings-category-menu">
        {[
          ["profile", "Perfil", UserRound],
          ["appearance", "Aparência", Settings],
          ["security", "Segurança", ShieldCheck],
          ["functions", "Funções criadas", Sparkles],
          ["closure", "Fechamento mensal", FileText],
          ["streaming", "Streamings", Play],
        ].map(([key, label, Icon]) => (
          <button
            className={section === key ? "active" : ""}
            onClick={() => setSection(key)}
            key={key}
          >
            <Icon />
            <span>
              <strong>{label}</strong>
              <small>Abrir configurações</small>
            </span>
            <ChevronRight />
          </button>
        ))}
      </div>
      <div className="settings-layout">
        <div className="settings-panel">
          <h2>Perfil e aparência</h2>
          <form onSubmit={save}>
            <label>
              Nome do proprietário
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
