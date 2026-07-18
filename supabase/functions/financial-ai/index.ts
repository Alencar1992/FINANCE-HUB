import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server";

const ALLOWED_ORIGINS = new Set([
  "https://alencar1992.github.io",
  "http://localhost:3000",
  "http://localhost:5173",
]);

const MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-3.1-flash-lite";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

type Mode = "assistant" | "savings" | "monthly_comparison" | "classify";

function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "https://alencar1992.github.io";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function monthStart(offset = 0) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1)).toISOString().slice(0, 10);
}

function summarizeTransactions(rows: Array<Record<string, unknown>>) {
  const categories: Record<string, { entradas: number; saidas: number }> = {};
  let entradas = 0;
  let saidas = 0;
  for (const row of rows) {
    const amount = Number(row.amount || 0);
    const isIncome = String(row.transaction_type || "").toLowerCase().includes("receita");
    const category = String(row.category || "Sem categoria").slice(0, 60);
    categories[category] ||= { entradas: 0, saidas: 0 };
    if (isIncome) {
      entradas += amount;
      categories[category].entradas += amount;
    } else {
      saidas += amount;
      categories[category].saidas += amount;
    }
  }
  return {
    entradas: Number(entradas.toFixed(2)),
    saidas: Number(saidas.toFixed(2)),
    saldo: Number((entradas - saidas).toFixed(2)),
    categorias: Object.entries(categories)
      .map(([categoria, valor]) => ({ categoria, ...valor }))
      .sort((a, b) => b.saidas - a.saidas)
      .slice(0, 15),
  };
}

function schemaFor(mode: Mode) {
  if (mode === "classify") return {
    type: "OBJECT", properties: {
      categoria: { type: "STRING" }, confianca: { type: "NUMBER" }, justificativa: { type: "STRING" },
    }, required: ["categoria", "confianca", "justificativa"],
  };
  return {
    type: "OBJECT", properties: {
      titulo: { type: "STRING" }, resumo: { type: "STRING" },
      recomendacoes: { type: "ARRAY", items: { type: "STRING" } },
      alertas: { type: "ARRAY", items: { type: "STRING" } },
      aviso: { type: "STRING" },
    }, required: ["titulo", "resumo", "recomendacoes", "alertas", "aviso"],
  };
}

function instruction(mode: Mode, question: string) {
  const rules = `Responda somente em português do Brasil. Use linguagem simples e objetiva. Não invente valores, não prometa rentabilidade e não dê recomendação definitiva de investimento. Baseie-se apenas no resumo agregado fornecido. Valores são em reais. Inclua o aviso: \"Análise educativa; confirme decisões financeiras importantes com um profissional.\"`;
  if (mode === "savings") return `${rules}\nSugira até 5 economias realistas, priorizando categorias com maiores saídas e sem cortar necessidades essenciais.`;
  if (mode === "monthly_comparison") return `${rules}\nExplique a diferença entre o mês atual e o anterior, destacando variações relevantes e ações práticas.`;
  if (mode === "classify") return `${rules}\nClassifique a descrição em uma categoria financeira curta. Confiança deve estar entre 0 e 1. Descrição: ${question.slice(0, 180)}`;
  return `${rules}\nAtue como assistente financeiro educacional. Responda à pergunta: ${question.slice(0, 600)}`;
}

async function callGemini(mode: Mode, question: string, context: unknown) {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY não configurada");
  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: `${instruction(mode, question)}\n\nResumo financeiro anonimizado:\n${JSON.stringify(context)}` }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1200,
        responseMimeType: "application/json",
        responseSchema: schemaFor(mode),
      },
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error("Gemini API error", response.status, detail.slice(0, 500));
    throw new Error(response.status === 429 ? "Limite temporário da IA atingido. Tente novamente em alguns minutos." : "A IA não respondeu neste momento.");
  }
  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Resposta vazia da IA");
  return JSON.parse(text);
}

Deno.serve(withSupabase({ auth: "user" }, async (req, ctx) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { erro: "Método não permitido." }, 405);

  try {
    const claims = ctx.userClaims as Record<string, unknown> | undefined;
    const ownerId = String(claims?.sub || claims?.id || "");
    if (!ownerId) return json(req, { erro: "Sessão inválida." }, 401);
    const { data: assurance, error: assuranceError } =
      await ctx.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError || assurance?.currentLevel !== "aal2") {
      return json(
        req,
        {
          erro: "Confirme a autenticação em dois fatores para usar a Inteligência Financeira.",
          codigo: "MFA_REQUIRED",
        },
        403,
      );
    }

    const body = await req.json().catch(() => ({}));
    const mode = String(body?.mode || "assistant") as Mode;
    const question = String(body?.question || "").trim();
    if (!["assistant", "savings", "monthly_comparison", "classify"].includes(mode)) return json(req, { erro: "Tipo de análise inválido." }, 400);
    if ((mode === "assistant" || mode === "classify") && (!question || question.length > 600)) return json(req, { erro: "Informe uma pergunta válida de até 600 caracteres." }, 400);

    const from = monthStart(-1);
    const to = monthStart(1);
    const [{ data: transactions, error: txError }, { data: goals, error: goalsError }, { data: investments, error: invError }] = await Promise.all([
      ctx.supabase.from("transactions").select("amount,transaction_type,category,transaction_date,status").gte("transaction_date", from).lt("transaction_date", to).limit(1000),
      ctx.supabase.from("financial_goals").select("name,target_amount,current_amount,target_date,priority,status").eq("status", "active").limit(30),
      ctx.supabase.from("investments").select("investment_type,current_amount,active").eq("active", true).limit(30),
    ]);
    if (txError || goalsError || invError) throw new Error("Não foi possível montar o resumo financeiro protegido.");

    const currentStart = monthStart(0);
    const rows = (transactions || []) as Array<Record<string, unknown>>;
    const context = {
      competencia_atual: currentStart.slice(0, 7),
      mes_atual: summarizeTransactions(rows.filter((r) => String(r.transaction_date) >= currentStart)),
      mes_anterior: summarizeTransactions(rows.filter((r) => String(r.transaction_date) < currentStart)),
      metas: (goals || []).map((g) => ({ nome: String(g.name).slice(0, 60), alvo: Number(g.target_amount), atual: Number(g.current_amount), prazo: g.target_date, prioridade: g.priority })),
      investimentos: (investments || []).map((i) => ({ tipo: i.investment_type, valor_atual: Number(i.current_amount) })),
    };

    const result = await callGemini(mode, question, mode === "classify" ? {} : context);
    if (mode !== "classify") {
      await ctx.supabase.from("ai_insights").insert({
        owner_id: ownerId,
        insight_type: mode,
        reference_month: currentStart,
        title: result.titulo || "Análise financeira",
        content: result,
        model: MODEL,
        status: "active",
      });
    }
    return json(req, { resultado: result, modelo: MODEL });
  } catch (error) {
    console.error("financial-ai", error instanceof Error ? error.message : error);
    return json(req, { erro: error instanceof Error ? error.message : "Não foi possível concluir a análise." }, 400);
  }
}));
