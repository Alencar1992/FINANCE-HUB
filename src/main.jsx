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
} from "lucide-react";
import "./styles.css";
import { supabase } from "./lib/supabase";

const money = (n) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const nav = [
  ["Início", Home],
  ["Movimentações", ArrowLeftRight],
  ["Cartões", CreditCard],
  ["Me devem", UserRound],
  ["Eu devo", ArrowDownLeft],
  ["Calendário", CalendarDays],
  ["Relatórios", ChartNoAxesCombined],
  ["Criar função", Sparkles],
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
    [dark, setDark] = useState(false),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(""),
    [tx, setTx] = useState([]),
    [query, setQuery] = useState(""),
    [customModules, setCustomModules] = useState([]),
    [profile,setProfile]=useState(owner),
    [profileMenu,setProfileMenu]=useState(false);
  const notify = (m) => {
    setToast(m);
    setTimeout(() => setToast(""), 2600);
  };
  const filtered = useMemo(
    () =>
      tx.filter((x) =>
        (x.name + x.cat).toLowerCase().includes(query.toLowerCase()),
      ),
    [tx, query],
  );
  useEffect(() => {
    (async () => {
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
              elapsed = Math.max(0,(now.getFullYear()-first.getFullYear())*12+now.getMonth()-first.getMonth()),
              currentInstallment = x.is_installment?Math.min(x.installment_count,elapsed+1):1,
              effectiveDate = new Date(first);
            if(x.is_installment)effectiveDate.setMonth(first.getMonth()+currentInstallment-1);
            return {
              id: x.id,
              name: x.is_installment?`${x.name} · ${currentInstallment}/${x.installment_count}`:x.name,
              cat: x.category,
              value: Number(x.installment_amount||x.amount),
              date: effectiveDate.toLocaleDateString("pt-BR",{day:"2-digit",month:"short"}),
              type: x.transaction_type === "income" ? "in" : "out",
              status: currentInstallment>=x.installment_count&&x.is_installment?"Última parcela":({pending:"Pendente",paid:"Pago",received:"Recebido",overdue:"Vencido",cancelled:"Cancelado"}[x.status]),
            };
          }),
        );
    })();
  }, [owner.id]);
  async function loadCustomModules(){const{data}=await supabase.from("custom_modules").select("*").eq("owner_id",owner.id).eq("active",true).order("created_at");setCustomModules(data||[])}
  useEffect(()=>{loadCustomModules()},[owner.id]);
  const visibleNav=[...nav.slice(0,7),...customModules.map(m=>[`module:${m.id}`,Sparkles,m.name]),...nav.slice(7)];
  async function addTx(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      total = Number(f.get("total")),
      count = Number(f.get("installments") || 1),
      monthly = Math.round((total / count) * 100) / 100;
    const row = {
      owner_id: owner.id,
      name: f.get("name"),
      category: f.get("cat"),
      amount: monthly,
      total_amount: total,
      is_installment: count > 1,
      installment_count: count,
      installment_number: 1,
      installment_amount: monthly,
      transaction_type: f.get("type") === "in" ? "income" : "expense",
      status: "pending",
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
      count > 1
        ? `Parcela 1/${count} salva: ${money(monthly)}`
        : "Movimentação salva no Supabase",
    );
  }
  return (
    <div className={dark ? "app dark" : "app"} style={{"--violet":profile.app_color||"#6445ED"}}>
      <aside className={menu ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <span>
            <WalletCards />
          </span>
          {profile.app_name||"Finance Hub"}
        </div>
        <button className="close" onClick={() => setMenu(false)}>
          <X />
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
              <span>{label||n}</span>
              {n === "Me devem" && <b>3</b>}
            </button>
          ))}
        </nav>
        <div className="profile-wrap"><button className="profile" onClick={()=>setProfileMenu(!profileMenu)}>
          <span>{initials(profile.name)}</span>
          <div>
            <strong>{profile.name}</strong>
            <small>Perfil pessoal</small>
          </div>
          <MoreHorizontal />
        </button>{profileMenu&&<div className="profile-popover"><button onClick={()=>setPage("Configurações")}><Settings/>Configurações</button><button className="logout" onClick={async()=>{await supabase.auth.signOut();location.reload()}}><ArrowDownLeft/>Sair</button></div>}</div>
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
                    ? customModules.find(m=>`module:${m.id}`===page)?.name||"Função"
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
            <label className="search">
              <Search />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar em todo o Finance Hub"
              />
            </label>
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
            <span className="avatar">{initials(owner.name)}</span>
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
            <UnifiedMovements owner={owner} baseRows={filtered} open={() => setModal("transaction")}/>
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
          ) : page === "Criar função" ? (
            <FunctionBuilder owner={owner} notify={notify} onCancel={()=>setPage("Início")} onCreated={async m=>{await loadCustomModules();setPage(`module:${m.id}`)}} />
          ) : page === "Configurações" ? (
            <SettingsModule
              owner={profile}
              modules={customModules}
              reloadModules={loadCustomModules}
              onUpdate={setProfile}
              dark={dark}
              setDark={setDark}
              notify={notify}
            />
          ) : page.startsWith("module:") ? (
            <CustomModulePage owner={owner} module={customModules.find(m=>`module:${m.id}`===page)} notify={notify}/>
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
      {toast && (
        <div className="toast">
          <Check />
          {toast}
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
    [total, setTotal] = useState(""),
    [count, setCount] = useState(2);
  const monthly = Number(total || 0) / Number(count || 1);
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
            <input name="cat" required placeholder="Selecione ou digite" />
          </label>
          <label>
            Valor total
            <input
              name="total"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              required
              type="number"
              min="0.01"
              step=".01"
              placeholder="R$ 0,00"
            />
          </label>
        </div>
        <label className="installment-toggle">
          <input
            type="checkbox"
            checked={parcelled}
            onChange={(e) => setParcelled(e.target.checked)}
          />
          Parcelar este valor
        </label>
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
          Observação
          <textarea name="notes" placeholder="Opcional" />
        </label>
        <button className="primary submit">Salvar movimentação</button>
      </form>
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
    [loginRequired,setLoginRequired]=useState(localStorage.getItem("finance-hub-permanent")==="true");
  useEffect(() => {
    (async () => {
      if (!supabase) {
        setError("Configuração do banco não encontrada.");
        setLoading(false);
        return;
      }
      let {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        if(loginRequired){setLoading(false);return}
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) {
          setError("Ative Anonymous Sign-Ins no Supabase Authentication.");
          setLoading(false);
          return;
        }
        session = data.session;
      }
      setUser(session.user);
      const { data: o } = await supabase
        .from("owners")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();
      setOwner(o);
      setLoading(false);
    })();
  }, []);
  async function createOwner(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const row = {
      id: user.id,
      name: f.get("name").trim(),
      profile_color: f.get("color"),
    };
    const { data, error } = await supabase
      .from("owners")
      .insert(row)
      .select()
      .single();
    if (error) {
      setError(error.message);
      return;
    }
    setOwner(data);
  }
  async function signIn(e){e.preventDefault();const f=new FormData(e.currentTarget);setError("");const{error}=await supabase.auth.signInWithPassword({email:f.get("email"),password:f.get("password")});if(error){setError("E-mail ou senha inválidos.");return}location.reload()}
  if (loading)
    return (
      <div className="boot">
        <span>
          <WalletCards />
        </span>
        <p>Preparando seu Finance Hub…</p>
      </div>
    );
  if (owner) return <FinanceApp owner={owner} />;
  if(loginRequired&&!user)return <div className="onboarding"><div className="onboard-brand"><span><WalletCards/></span>Finance Hub</div><div className="onboard-card"><div className="onboard-icon"><ShieldCheck/></div><h1>Acesso protegido</h1><p>Entre com o e-mail e a senha vinculados ao seu Finance Hub.</p>{error&&<div className="form-error">{error}</div>}<form onSubmit={signIn}><label>E-mail<input name="email" type="email" required/></label><label>Senha<input name="password" type="password" minLength="8" required/></label><button className="primary submit">Entrar com segurança</button></form></div></div>;
  return (
    <div className="onboarding">
      <div className="onboard-brand">
        <span>
          <WalletCards />
        </span>
        Finance Hub
      </div>
      <div className="onboard-card">
        <div className="onboard-icon">
          <Sparkles />
        </div>
        <h1>Vamos criar seu espaço financeiro</h1>
        <p>
          Esta identificação vincula todos os dados ao seu perfil. Não precisa
          de senha.
        </p>
        {error && <div className="form-error">{error}</div>}
        <form onSubmit={createOwner}>
          <label>
            Seu nome
            <input
              name="name"
              required
              minLength="2"
              placeholder="Ex.: Lucas Alencar"
              autoFocus
            />
          </label>
          <label>
            Cor do perfil
            <input name="color" type="color" defaultValue="#6445ed" />
          </label>
          <button className="primary submit">
            Entrar no Finance Hub
            <ChevronRight />
          </button>
        </form>
        <small>Seus dados ficam protegidos e isolados no Supabase.</small>
      </div>
    </div>
  );
}

function Dashboard({ owner, setPage, notify, tx }) {
  const [obligations, setObligations] = useState([]),
    [cards, setCards] = useState([]),
    [cardPurchases, setCardPurchases] = useState([]),
    [subscriptions, setSubscriptions] = useState([]);
  useEffect(() => {
    (async () => {
      const [{ data: o }, { data: c }, { data: p }, { data: s }] = await Promise.all([
        supabase
          .from("obligations")
          .select("*")
          .eq("owner_id", owner.id)
          .in("status", ["open", "overdue"])
          .order("next_due_date"),
        supabase
          .from("cards")
          .select("*")
          .eq("owner_id", owner.id)
          .eq("active", true),
        supabase
          .from("card_purchases")
          .select("*")
          .eq("owner_id", owner.id)
          .eq("status", "open"),
        supabase
          .from("subscriptions")
          .select("*")
          .eq("owner_id", owner.id)
          .eq("active", true),
      ]);
      setObligations(o || []);
      setCards(c || []);
      setCardPurchases(p || []);
      setSubscriptions(s || []);
    })();
  }, [owner.id]);
  const income = tx
      .filter((x) => x.type === "in")
      .reduce((a, x) => a + x.value, 0),
    expense = tx
      .filter((x) => x.type === "out")
      .reduce((a, x) => a + x.value, 0),
    receivable = obligations
      .filter((x) => x.direction === "receivable")
      .reduce((a, x) => a + Number(x.remaining_amount), 0),
    payableObligations = obligations
      .filter((x) => x.direction === "payable")
      .reduce((a, x) => a + Number(x.remaining_amount), 0),
    currentCardInstallments = cardPurchases.reduce(
      (a, x) => a + Number(x.installment_amount || x.total_amount || 0),
      0,
    ),
    subscriptionsDue = subscriptions.reduce((a, x) => a + Number(x.amount || 0), 0),
    payable = payableObligations + currentCardInstallments + subscriptionsDue,
    balance = income - expense;
  return (
    <>
      <section className="balance-row">
        <div className="balance">
          <div>
            <span>
              Saldo atual <Eye />
            </span>
            <strong>{money(balance)}</strong>
            <small>
              <TrendingUp /> Dados reais <em>das movimentações cadastradas</em>
            </small>
          </div>
          <WalletCards />
        </div>
        <div className="stats">
            {[
            [
              TrendingUp,
              "Entradas",
              income,
              `${tx.filter((x) => x.type === "in").length} lançamentos`,
              "green",
            ],
            [
              TrendingDown,
              "Saídas",
              expense,
              `${tx.filter((x) => x.type === "out").length} lançamentos`,
              "red",
            ],
            [
              UserRound,
              "A receber",
              receivable,
              `${obligations.filter((x) => x.direction === "receivable").length} itens`,
              "blue",
            ],
            [
              CreditCard,
              "A pagar",
              payable,
              `${obligations.filter((x) => x.direction === "payable").length + cardPurchases.length + subscriptions.length} itens · ${cards.length} cartões`,
              "amber",
            ],
          ].map(([I, l, v, d, c]) => (
            <div className="stat" key={l}>
              <i className={c}>
                <I />
              </i>
              <span>{l}</span>
              <strong>{money(v)}</strong>
              <small>{d}</small>
            </div>
          ))}
        </div>
      </section>
      <section className="main-grid">
        <div className="panel chart">
          <div className="panel-title">
            <div>
              <h2>Entradas x Saídas</h2>
              <p>
                <i className="dot violet" /> Entradas <i className="dot teal" />{" "}
                Saídas
              </p>
            </div>
          </div>
          <BarChart tx={tx} />
        </div>
        <div className="panel pending">
          <div className="panel-title">
            <h2>Pendências importantes</h2>
            <button onClick={() => setPage("Eu devo")}>Ver todas</button>
          </div>
          {obligations.slice(0, 4).map((x) => (
            <div
              className={
                "alert " +
                (new Date(x.next_due_date) < new Date() ? "danger" : "warning")
              }
              key={x.id}
            >
              <AlertTriangle />
              <div>
                <small>
                  {x.direction === "receivable" ? "A receber" : "A pagar"}
                </small>
                <strong>{x.counterparty_name}</strong>
                <span>
                  {x.description} · parcela {(x.paid_installments || 0) + 1}/
                  {x.installments || 1}
                </span>
              </div>
              <div>
                <b>
                  {money(Number(x.installment_amount || x.remaining_amount))}
                </b>
                <button
                  onClick={() =>
                    setPage(
                      x.direction === "receivable" ? "Me devem" : "Eu devo",
                    )
                  }
                >
                  Abrir
                </button>
              </div>
            </div>
          ))}
          {!obligations.length && (
            <div className="real-empty">
              <AlertTriangle />
              <strong>Nenhuma pendência</strong>
              <span>Contas e cobranças próximas aparecerão aqui.</span>
            </div>
          )}
        </div>
      </section>
      <section className="lower-grid">
        <div className="panel payments">
          <div className="panel-title">
            <h2>Últimas movimentações</h2>
            <button onClick={() => setPage("Movimentações")}>Ver todas</button>
          </div>
          {tx.slice(0, 4).map((x) => (
            <div className="pay" key={x.id}>
              <i>{x.type === "in" ? <TrendingUp /> : <TrendingDown />}</i>
              <div>
                <strong>{x.name}</strong>
                <span>
                  {x.cat} · {x.date}
                </span>
              </div>
              <b className={x.type === "in" ? "pos" : "neg"}>
                {money(x.value)}
              </b>
            </div>
          ))}
          {!tx.length && (
            <div className="real-empty">
              <FileText />
              <strong>Nenhuma movimentação</strong>
              <span>Use “Nova movimentação” para começar.</span>
            </div>
          )}
        </div>
        <div className="panel categories">
          <div className="panel-title">
            <h2>Resumo financeiro</h2>
            <button onClick={() => setPage("Relatórios")}>Relatório</button>
          </div>
          <div className="cat-body">
            <div
              className="donut"
              style={!tx.length ? { background: "var(--border)" } : {}}
            >
              <span>
                <small>Saídas</small>
                {money(expense)}
              </span>
            </div>
            <ul>
              <li>
                <i style={{ background: "#19b9a4" }} />
                Receitas<b>{money(income)}</b>
              </li>
              <li>
                <i style={{ background: "#ff5e6c" }} />
                Despesas<b>{money(expense)}</b>
              </li>
              <li>
                <i style={{ background: "#6c4cff" }} />
                Saldo<b>{money(balance)}</b>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}

function BarChart({ tx }) {
  if (!tx.length)
    return (
      <div className="real-empty">
        <ChartNoAxesCombined />
        <strong>Gráfico aguardando dados</strong>
        <span>Cadastre receitas e despesas para visualizar o comparativo.</span>
      </div>
    );
  const max = Math.max(...tx.map((x) => x.value), 1);
  return (
    <div className="bars">
      <span className="gridline g1">Maior</span>
      <span className="gridline g2">Médio</span>
      <span className="gridline g3">R$ 0</span>
      {tx
        .slice(0, 18)
        .reverse()
        .map((x) => (
          <div className="barpair" key={x.id}>
            {x.type === "in" ? (
              <i style={{ height: Math.max(8, (x.value / max) * 90) + "%" }} />
            ) : (
              <b style={{ height: Math.max(8, (x.value / max) * 70) + "%" }} />
            )}
          </div>
        ))}
      <div className="axis">
        <span>Mais antigas</span>
        <span>Movimentações cadastradas</span>
        <span>Mais recentes</span>
      </div>
    </div>
  );
}

function Transactions({ rows, open }) {
  const [filter, setFilter] = useState("all");
  const shown = rows.filter((x) => filter === "all" || x.type === filter);
  return (
    <div className="page-panel">
      <div className="page-head">
        <div>
          <h2>Movimentações</h2>
          <p>Acompanhe todas as entradas e saídas.</p>
        </div>
        {open && (
          <button className="primary" onClick={open}>
            <Plus />
            Adicionar
          </button>
        )}
      </div>
      <div className="filters">
        <button
          className={filter === "all" ? "selected" : ""}
          onClick={() => setFilter("all")}
        >
          Todas
        </button>
        <button
          className={filter === "in" ? "selected" : ""}
          onClick={() => setFilter("in")}
        >
          Receitas
        </button>
        <button
          className={filter === "out" ? "selected" : ""}
          onClick={() => setFilter("out")}
        >
          Despesas
        </button>
      </div>
      <div className="table">
        {shown.map((r) => (
          <div className="tr" key={r.id}>
            <i className={r.type === "in" ? "txicon in" : "txicon out"}>
              {r.type === "in" ? <TrendingUp /> : <TrendingDown />}
            </i>
            <div>
              <strong>{r.name}</strong>
              <span>{r.cat}</span>
            </div>
            <span>{r.date}</span>
            <span>{r.status}</span>
            <b className={r.type === "in" ? "pos" : "neg"}>
              {r.type === "in" ? "+ " : "- "}
              {money(r.value)}
            </b>
            <button aria-label="Mais opções">
              <MoreHorizontal />
            </button>
          </div>
        ))}
        {!shown.length && (
          <EmptyState text="Nenhuma movimentação neste filtro." />
        )}
      </div>
    </div>
  );
}
function UnifiedMovements({owner,baseRows,open}){const[linked,setLinked]=useState([]);useEffect(()=>{(async()=>{const[{data:o},{data:p}]=await Promise.all([supabase.from("obligations").select("*").eq("owner_id",owner.id).neq("status","cancelled"),supabase.from("card_purchases").select("*,cards(name)").eq("owner_id",owner.id)]);setLinked([...(o||[]).map(x=>({id:`o-${x.id}`,name:`${x.counterparty_name} · ${x.description}`,cat:x.direction==='receivable'?'Me devem':'Eu devo',value:Number(x.installment_amount||x.remaining_amount),date:x.next_due_date?new Date(x.next_due_date+'T12:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}):'Sem data',type:x.direction==='receivable'?'in':'out',status:x.status==='paid'?'Quitado':`Parcela ${Math.min((x.paid_installments||0)+1,x.installments||1)}/${x.installments||1}`})),...(p||[]).map(x=>({id:`p-${x.id}`,name:`${x.cards?.name} · ${x.description}`,cat:`Cartão · ${x.purchased_by}`,value:Number(x.installment_amount),date:new Date(x.first_due_date+'T12:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}),type:'out',status:x.status==='paid'?'Pago':`Parcela ${Math.min(x.paid_installments+1,x.installment_count)}/${x.installment_count}`}))])})()},[owner.id]);return <Transactions rows={[...baseRows,...linked]} open={open}/>}

function DebtPage({ notify }) {
  return (
    <CardsPage
      intro="Valores que outras pessoas precisam pagar para você."
      total="Total a receber"
      value={3280}
    >
      <div className="debt-grid">
        {debts.map((d) => (
          <div className="debt-card" key={d.name}>
            <div className="debt-avatar">{d.name[0]}</div>
            <div className="debt-top">
              <div>
                <h3>{d.name}</h3>
                <p>{d.desc}</p>
              </div>
              <span className={d.tone}>{d.due}</span>
            </div>
            <div className="debt-value">
              <small>Valor pendente</small>
              <strong>{money(d.value)}</strong>
            </div>
            <div className="card-actions">
              <button onClick={() => notify("Recebimento registrado")}>
                <Check />
                Receber
              </button>
              <button
                className="whatsapp"
                onClick={() =>
                  window.open(
                    `https://wa.me/${d.phone}?text=${encodeURIComponent(`Olá, ${d.name}! Passando para lembrar do valor de ${money(d.value)} referente a ${d.desc}.`)}`,
                  )
                }
              >
                <Send />
                Cobrar
              </button>
            </div>
          </div>
        ))}
      </div>
    </CardsPage>
  );
}
function OwedPage({ notify }) {
  return (
    <CardsPage
      intro="Suas compras, empréstimos e compromissos a pagar."
      total="Total que eu devo"
      value={2440}
    >
      <div className="debt-grid">
        {owed.map((d) => (
          <div className="debt-card" key={d.name}>
            <div className="debt-top">
              <div>
                <h3>{d.name}</h3>
                <p>{d.desc}</p>
              </div>
              <span className={d.tone}>{d.next}</span>
            </div>
            <div className="progress">
              <i style={{ width: (d.left / d.total) * 100 + "%" }} />
            </div>
            <div className="debt-value row">
              <span>
                <small>Valor total</small>
                <b>{money(d.total)}</b>
              </span>
              <span>
                <small>Restante</small>
                <strong>{money(d.left)}</strong>
              </span>
            </div>
            <div className="card-actions">
              <button onClick={() => notify("Parcela marcada como paga")}>
                <Check />
                Pagar parcela
              </button>
              <button>Detalhes</button>
            </div>
          </div>
        ))}
      </div>
    </CardsPage>
  );
}
function CardsPage({ intro, total, value, children }) {
  return (
    <>
      <div className="summary-hero">
        <div>
          <h2>{total}</h2>
          <strong>{money(value)}</strong>
          <p>{intro}</p>
        </div>
        <button className="primary">
          <Plus>Novo</Plus>Novo cadastro
        </button>
      </div>
      {children}
    </>
  );
}
function FunctionBuilder({ owner, notify, onCreated, onCancel }) {
  const [step, setStep] = useState(1),
    [name, setName] = useState(""),
    [fields, setFields] = useState(["Cliente", "Valor", "Data", "Status"]),
    [customField,setCustomField]=useState("");
  async function finish() {
    const { data, error } = await supabase
      .from("custom_modules")
      .insert({
        owner_id: owner.id,
        name: name || "Nova função",
        field_schema: fields.map((x) => ({
          name: x,
          type: /valor|preço|quantidade|km|quilometragem/i.test(x)?"number":/data|vencimento/i.test(x)?"date":"text",
        })),
      }).select().single();
    if (error)
      return notify(
        error.code === "23505"
          ? "Essa função já existe."
          : "Não foi possível criar a função.",
      );
    notify(`Função ${name} criada e salva!`);
    onCreated?.(data);
  }
  return (
    <div className="builder">
      <div className="builder-copy">
        <span>
          <Sparkles /> Principal diferencial
        </span>
        <h2>Crie uma função do seu jeito</h2>
        <p>
          Monte um módulo profissional para qualquer atividade: entregas,
          vendas, serviços ou consultoria.
        </p>
        <ul>
          <li>
            <Check />
            Formulário e cadastro automáticos
          </li>
          <li>
            <Check />
            Indicadores e gráficos integrados
          </li>
          <li>
            <Check />
            Alertas, pesquisa e exportação
          </li>
        </ul>
      </div>
      <div className="builder-form">
        <div className="steps">
          <b className={step >= 1 ? "on" : ""}>1</b>
          <i />
          <b className={step >= 2 ? "on" : ""}>2</b>
          <i />
          <b className={step >= 3 ? "on" : ""}>3</b>
        </div>
        {step === 1 && (
          <>
            <h3>Qual atividade você quer controlar?</h3>
            <label>
              Nome da função
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Motoboy"
              />
            </label>
            <div className="suggestions">
              {["Motoboy", "Venda de bolos", "Freelancer", "Consultoria"].map(
                (x) => (
                  <button key={x} onClick={() => setName(x)}>
                    {x}
                  </button>
                ),
              )}
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <h3>Quais informações deseja registrar?</h3>
            {["Cliente", "Valor", "Data", "Status", "Quilometragem"].map(
              (x) => (
                <label className="check" key={x}>
                  <input
                    type="checkbox"
                    checked={fields.includes(x)}
                    onChange={() =>
                      setFields((v) =>
                        v.includes(x) ? v.filter((f) => f !== x) : [...v, x],
                      )
                    }
                  />
                  <span>
                    <Check />
                  </span>
                  {x}
                </label>
              ),
            )}
            <div className="custom-field-add"><input value={customField} onChange={e=>setCustomField(e.target.value)} placeholder="Outro campo, ex.: Endereço"/><button onClick={()=>{const value=customField.trim();if(value&&!fields.includes(value))setFields(v=>[...v,value]);setCustomField("")}}><Plus/>Adicionar campo</button></div>
            <div className="selected-fields">{fields.filter(x=>!["Cliente","Valor","Data","Status","Quilometragem"].includes(x)).map(x=><span key={x}>{x}<button onClick={()=>setFields(v=>v.filter(f=>f!==x))}><X/></button></span>)}</div>
          </>
        )}
        {step === 3 && (
          <div className="success">
            <Sparkles />
            <h3>Seu módulo está pronto!</h3>
            <p>“{name}” será salvo no Supabase.</p>
          </div>
        )}
        <div className="form-navigation"><button onClick={()=>step>1?setStep(step-1):onCancel()}>{step>1?'Voltar':'Cancelar'}</button><button className="primary" disabled={step === 1 && !name.trim()} onClick={() => (step < 3 ? setStep(step + 1) : finish())}>{step < 3 ? "Continuar" : "Criar função"}<ChevronRight /></button></div>
      </div>
    </div>
  );
}

function CustomModulePage({owner,module,notify}){const[entries,setEntries]=useState([]),[open,setOpen]=useState(false);async function load(){if(!module)return;const{data}=await supabase.from("custom_module_entries").select("*").eq("owner_id",owner.id).eq("module_id",module.id).order("created_at",{ascending:false});setEntries(data||[])}useEffect(()=>{load()},[module?.id]);if(!module)return <EmptyState text="Função não encontrada."/>;const fields=Array.isArray(module.field_schema)?module.field_schema:[];async function add(e){e.preventDefault();const f=new FormData(e.currentTarget),data={};fields.forEach(field=>data[field.name]=f.get(field.name));const{error}=await supabase.from("custom_module_entries").insert({owner_id:owner.id,module_id:module.id,data});if(error)return notify("Não foi possível salvar o registro.");setOpen(false);load();notify("Registro salvo na função.")}return <div className="custom-module-page"><div className="page-head"><div><h2>{module.name}</h2><p>Tela criada automaticamente com os campos escolhidos.</p></div><button className="primary" onClick={()=>setOpen(true)}><Plus/>Novo registro</button></div>{open&&<form className="inline-form" onSubmit={add}>{fields.map(field=><label key={field.name}>{field.name}<input name={field.name} type={field.type||"text"} required/></label>)}<div className="form-actions"><button type="button" onClick={()=>setOpen(false)}>Cancelar</button><button className="primary">Salvar registro</button></div></form>}<div className="page-panel"><div className="panel-title"><h2>Registros</h2></div><div className="dynamic-table">{entries.map(entry=><div className="dynamic-row" key={entry.id}>{fields.map(field=><span key={field.name}><small>{field.name}</small><strong>{entry.data?.[field.name]||"—"}</strong></span>)}</div>)}{!entries.length&&<EmptyState text="Nenhum registro nesta função."/>}</div></div></div>}

const normalizeName = (n) =>
  n.trim().replace(/\s+/g, " ").toLocaleUpperCase("pt-BR");
function ObligationsPage({ owner, direction, notify }) {
  const [items, setItems] = useState([]),
    [contacts, setContacts] = useState([]),
    [open, setOpen] = useState(false),
    [selectedName, setSelectedName] = useState(""),
    [phone, setPhone] = useState(""),
    [parcelled, setParcelled] = useState(false),
    [formTotal, setFormTotal] = useState(""),
    [parcelCount, setParcelCount] = useState(2);
  const isRecv = direction === "receivable";
  async function load() {
    const [{ data: i }, { data: c }] = await Promise.all([
      supabase
        .from("obligations")
        .select("*")
        .eq("owner_id", owner.id)
        .eq("direction", direction)
        .order("created_at", { ascending: true }),
      isRecv
        ? supabase
            .from("debtor_contacts")
            .select("*")
            .eq("owner_id", owner.id)
            .order("display_name")
        : Promise.resolve({ data: [] }),
    ]);
    setItems(i || []);
    setContacts(c || []);
  }
  useEffect(() => {
    load();
  }, [direction]);
  function selectPerson(name) {
    setSelectedName(name);
    const found = contacts.find(
      (c) => c.normalized_name === normalizeName(name),
    );
    setPhone(found?.phone || "");
  }
  async function add(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      name = f.get("name").trim(),
      normalized = normalizeName(name),
      amount = Number(formTotal),
      count = parcelled ? Number(parcelCount) : 1,
      monthly = Math.round((amount / count) * 100) / 100,
      typedPhone = (f.get("phone") || "").replace(/\D/g, ""),
      known = contacts.find((c) => c.normalized_name === normalized),
      finalPhone = typedPhone || known?.phone || null;
    if (isRecv) {
      const { error: contactError } = await supabase
        .from("debtor_contacts")
        .upsert(
          {
            owner_id: owner.id,
            display_name: name,
            normalized_name: normalized,
            phone: finalPhone,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "owner_id,normalized_name" },
        );
      if (contactError) return notify("Não foi possível salvar o contato.");
    }
    const { error } = await supabase
      .from("obligations")
      .insert({
        owner_id: owner.id,
        direction,
        counterparty_name: known?.display_name || name,
        phone: finalPhone,
        description: f.get("description"),
        total_amount: amount,
        remaining_amount: amount,
        is_installment: count > 1,
        installments: count,
        installment_amount: monthly,
        paid_installments: 0,
        next_due_date: f.get("due") || null,
      });
    if (error) return notify("Não foi possível salvar.");
    setOpen(false);
    setSelectedName("");
    setPhone("");
    setFormTotal("");
    setParcelled(false);
    load();
    notify(
      count > 1
        ? `Plano de ${count} parcelas criado. Parcela atual: ${money(monthly)}`
        : isRecv
          ? "Despesa vinculada ao devedor."
          : "Obrigação salva no Supabase",
    );
  }
  async function settle(x) {
    const { error } = await supabase.rpc("advance_obligation_installment", {
      p_obligation_id: x.id,
    });
    if (error) return notify("Não foi possível avançar a parcela.");
    load();
    notify(
      x.paid_installments + 1 >= x.installments
        ? "Dívida quitada."
        : `Parcela paga. Próxima: ${(x.paid_installments || 0) + 2}/${x.installments}`,
    );
  }
  const total = items.reduce((a, x) => a + Number(x.remaining_amount), 0),
    groups = Object.values(
      items.reduce((a, x) => {
        const key = normalizeName(x.counterparty_name);
        if (!a[key])
          a[key] = {
            key,
            name: x.counterparty_name,
            phone:
              x.phone || contacts.find((c) => c.normalized_name === key)?.phone,
            items: [],
            total: 0,
            monthly: 0,
          };
        a[key].items.push(x);
        a[key].total += Number(x.remaining_amount);
        a[key].monthly += Number(x.installment_amount || x.remaining_amount);
        if (!a[key].phone && x.phone) a[key].phone = x.phone;
        return a;
      }, {}),
    );
  return (
    <>
      <div className="summary-hero">
        <div>
          <h2>{isRecv ? "Total a receber" : "Total que eu devo"}</h2>
          <strong>{money(total)}</strong>
          <p>
            {groups.length} pessoa(s) · {items.length} item(ns).
          </p>
        </div>
        <button className="primary" onClick={() => setOpen(!open)}>
          <Plus />
          Novo cadastro
        </button>
      </div>
      {open && (
        <form className="inline-form" onSubmit={add}>
          <label>
            {isRecv ? "Nome do devedor" : "Nome do credor"}
            <input
              name="name"
              list={isRecv ? "people-history" : undefined}
              value={selectedName}
              onChange={(e) => selectPerson(e.target.value)}
              required
              autoComplete="off"
            />
            <datalist id="people-history">
              {contacts.map((c) => (
                <option value={c.display_name} key={c.id}>
                  {c.phone || "Sem WhatsApp"}
                </option>
              ))}
            </datalist>
          </label>
          <label>
            Item ou descrição
            <input name="description" required />
          </label>
          <label>
            Valor total
            <input
              value={formTotal}
              onChange={(e) => setFormTotal(e.target.value)}
              type="number"
              step=".01"
              min="0.01"
              required
            />
          </label>
          <label>
            Primeiro vencimento
            <input name="due" type="date" required />
          </label>
          {isRecv && (
            <label>
              WhatsApp
              <input
                name="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="5511999999999"
              />
              <small>
                {phone
                  ? "Número vinculado a este devedor"
                  : "Será salvo para os próximos itens"}
              </small>
            </label>
          )}
          <label className="installment-toggle">
            <input
              type="checkbox"
              checked={parcelled}
              onChange={(e) => setParcelled(e.target.checked)}
            />
            Parcelado?
          </label>
          {parcelled && (
            <label>
              Quantidade de parcelas
              <input
                type="number"
                min="2"
                max="120"
                value={parcelCount}
                onChange={(e) => setParcelCount(e.target.value)}
              />
              <small>
                Valor mensal:{" "}
                {money(Number(formTotal || 0) / Number(parcelCount || 1))}
              </small>
            </label>
          )}
          <div className="form-actions"><button type="button" onClick={()=>setOpen(false)}>Cancelar</button><button className="primary">Salvar e vincular</button></div>
        </form>
      )}
      <div className="debt-grid grouped">
        {groups.map((g) => (
          <DebtorGroup
            key={g.key}
            group={g}
            isRecv={isRecv}
            settle={settle}
            notify={notify}
          />
        ))}
        {!groups.length && (
          <EmptyState text="Nenhum registro cadastrado ainda." />
        )}
      </div>
    </>
  );
}

function DebtorGroup({ group, isRecv, settle, notify }) {
  const [expanded, setExpanded] = useState(true),
    cardRef = useRef(null);
  const month = new Date().toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    }),
    openItems = group.items.filter((x) => x.status !== "paid");
  async function share() {
    const text = `Olá, ${group.name}! Segue o resumo das despesas de ${month}:\n${openItems.map((x) => `• ${x.description} — parcela ${(x.paid_installments || 0) + 1}/${x.installments || 1}: ${money(Number(x.installment_amount || x.remaining_amount))}`).join("\n")}\n\nTotal deste mês: ${money(group.monthly)}\nSaldo total pendente: ${money(group.total)}`;
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });
      const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
      const file = new File(
        [blob],
        `despesas-${group.key.toLowerCase().replace(/\s/g, "-")}.png`,
        { type: "image/png" },
      );
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          text,
          title: `Despesas de ${group.name}`,
        });
        return;
      }
      const link = document.createElement("a");
      link.download = file.name;
      link.href = URL.createObjectURL(blob);
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      if (group.phone)
        window.open(
          `https://wa.me/${group.phone}?text=${encodeURIComponent(text)}`,
          "_blank",
        );
      notify("Print baixado. Anexe a imagem na conversa aberta.");
    } catch {
      if (group.phone)
        window.open(
          `https://wa.me/${group.phone}?text=${encodeURIComponent(text)}`,
          "_blank",
        );
      notify("Texto preparado para cobrança.");
    }
  }
  return (
    <div className="debt-card debtor-group" ref={cardRef}>
      <button className="group-head" onClick={() => setExpanded(!expanded)}>
        <div className="debt-avatar">{group.name[0]}</div>
        <div>
          <h3>{group.name}</h3>
          <span>
            {group.items.length} item(ns)
            {group.phone ? " · WhatsApp salvo" : ""}
          </span>
        </div>
        <strong>{money(group.monthly)}</strong>
        <ChevronRight className={expanded ? "rotated" : ""} />
      </button>
      {expanded && (
        <div className="debt-items">
          {group.items.map((x) => (
            <div
              className={x.status === "paid" ? "debt-line paid" : "debt-line"}
              key={x.id}
            >
              <div>
                <strong>{x.description}</strong>
                <small>
                  Parcela {(x.paid_installments || 0) + 1}/{x.installments || 1}
                  {" · "}
                  {x.next_due_date
                    ? new Date(x.next_due_date + "T12:00").toLocaleDateString(
                        "pt-BR",
                      )
                    : "Sem vencimento"}
                </small>
              </div>
              <b>{money(Number(x.installment_amount || x.remaining_amount))}</b>
              <button disabled={x.status === "paid"} onClick={() => settle(x)}>
                <Check />
                {x.status === "paid"
                  ? "Recebido"
                  : isRecv
                    ? "Receber"
                    : "Pagar"}
              </button>
            </div>
          ))}
          <div className="group-total">
            <span>Total deste mês · saldo {money(group.total)}</span>
            <strong>{money(group.monthly)}</strong>
          </div>
        </div>
      )}
      <div className="card-actions group-actions">
        {isRecv && (
          <button
            className="whatsapp"
            disabled={!group.phone || !openItems.length}
            onClick={share}
          >
            <Send />
            Compartilhar cobrança
          </button>
        )}
      </div>
    </div>
  );
}

function nextCardDue(card){if(!card)return"";const now=new Date(),target=new Date(now.getFullYear(),now.getMonth()+(now.getDate()>card.due_day?1:0),1),last=new Date(target.getFullYear(),target.getMonth()+1,0).getDate();target.setDate(Math.min(card.due_day,last));return `${target.getFullYear()}-${String(target.getMonth()+1).padStart(2,"0")}-${String(target.getDate()).padStart(2,"0")}`}
function CardsModule({ owner, notify }) {
  const [cards, setCards] = useState([]),
    [purchases, setPurchases] = useState([]),
    [open, setOpen] = useState(false),
    [purchaseOpen, setPurchaseOpen] = useState(false),
    [purchaseTotal, setPurchaseTotal] = useState(""),
    [purchaseCount, setPurchaseCount] = useState(1),
    [purchaseCardId,setPurchaseCardId]=useState(""),
    [selectedCard, setSelectedCard] = useState(null);
  async function load() {
    const [{ data }, { data: p }] = await Promise.all([
      supabase.from("cards").select("*").eq("owner_id", owner.id).order("created_at", { ascending: false }),
      supabase.from("card_purchases").select("*,cards(name)").eq("owner_id", owner.id).order("created_at",{ascending:false}),
    ]);
    setCards(data || []);
    setPurchases(p || []);
    if(!purchaseCardId&&data?.length)setPurchaseCardId(data[0].id);
  }
  useEffect(() => {
    load();
  }, []);
  async function add(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const { error } = await supabase
      .from("cards")
      .insert({
        owner_id: owner.id,
        bank: f.get("bank"),
        name: f.get("name"),
        credit_limit: Number(f.get("limit")),
        closing_day: Number(f.get("closing")),
        due_day: Number(f.get("due")),
        color: f.get("color"),
      });
    if (error) return notify("Erro ao cadastrar cartão.");
    setOpen(false);
    load();
    notify("Cartão cadastrado");
  }
  async function addPurchase(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget), count = Number(purchaseCount || 1), total = Number(purchaseTotal), monthly = Math.round(total / count * 100) / 100;
    const chosen=cards.find(c=>c.id===purchaseCardId),due=nextCardDue(chosen);
    const { error } = await supabase.from("card_purchases").insert({owner_id:owner.id,card_id:purchaseCardId,description:f.get("description"),purchased_by:f.get("purchased_by")||"Próprio",total_amount:total,installment_count:count,installment_amount:monthly,first_due_date:due});
    if(error)return notify("Erro ao cadastrar compra.");
    setPurchaseOpen(false);setPurchaseTotal("");setPurchaseCount(1);load();notify(`Compra cadastrada: ${count}x de ${money(monthly)}`);
  }
  if(selectedCard)return <CardDetail card={selectedCard} purchases={purchases.filter(p=>p.card_id===selectedCard.id)} back={()=>setSelectedCard(null)} reload={load} notify={notify}/>;
  return (
    <>
      <div className="page-head">
        <div>
          <h2>Meus cartões</h2>
          <p>Controle limites e datas de fechamento.</p>
        </div>
        <div className="page-actions"><button onClick={() => setPurchaseOpen(!purchaseOpen)} disabled={!cards.length}><Plus/>Nova compra</button><button className="primary" onClick={() => setOpen(!open)}><Plus/>Novo cartão</button></div>
      </div>
      {open && (
        <form className="inline-form" onSubmit={add}>
          <label>
            Banco
            <input name="bank" required />
          </label>
          <label>
            Nome do cartão
            <input name="name" required />
          </label>
          <label>
            Limite
            <input name="limit" type="number" min="0" step=".01" required />
          </label>
          <label>
            Fechamento
            <input name="closing" type="number" min="1" max="31" required />
          </label>
          <label>
            Vencimento
            <input name="due" type="number" min="1" max="31" required />
          </label>
          <label>
            Cor
            <input name="color" type="color" defaultValue="#6445ed" />
          </label>
          <div className="form-actions"><button type="button" onClick={()=>setOpen(false)}>Cancelar</button><button className="primary">Salvar cartão</button></div>
        </form>
      )}
      {purchaseOpen&&<form className="inline-form" onSubmit={addPurchase}><label>Cartão<select value={purchaseCardId} onChange={e=>setPurchaseCardId(e.target.value)} required>{cards.map(c=><option value={c.id} key={c.id}>{c.name} · {c.bank}</option>)}</select></label><label>Compra<input name="description" required/></label><label>Quem deve?<input name="purchased_by" placeholder="Próprio, Marcelo..." required/></label><label>Valor total<input type="number" min=".01" step=".01" value={purchaseTotal} onChange={e=>setPurchaseTotal(e.target.value)} required/></label><label>Parcelas<input type="number" min="1" max="120" value={purchaseCount} onChange={e=>setPurchaseCount(e.target.value)} required/><small>Parcela mensal: {money(Number(purchaseTotal||0)/Number(purchaseCount||1))}</small></label><label>Vencimento automático<input value={nextCardDue(cards.find(c=>c.id===purchaseCardId))} readOnly/><small>Definido pelo vencimento do cartão selecionado</small></label><div className="form-actions"><button type="button" onClick={()=>setPurchaseOpen(false)}>Cancelar</button><button className="primary">Salvar compra</button></div></form>}
      <div className="cards-grid">
        {cards.map((c) => (
          <button
            className="credit-card"
            style={{ background: `linear-gradient(135deg,${c.color},#071c3a)` }}
            key={c.id}
            onClick={()=>setSelectedCard(c)}
          >
            <CreditCard />
            <small>{c.bank}</small>
            <h3>{c.name}</h3>
            <strong>Limite {money(Number(c.credit_limit))}</strong>
            <span>
              Fecha dia {c.closing_day} · vence dia {c.due_day}
            </span>
            <em>Ver histórico <ChevronRight/></em>
          </button>
        ))}
        {!cards.length && <EmptyState text="Nenhum cartão cadastrado." />}
      </div>
    </>
  );
}

function CardDetail({card,purchases,back,reload,notify}){
  const[dialog,setDialog]=useState(null),[selected,setSelected]=useState([]),open=purchases.filter(p=>p.status==='open'),currentTotal=open.reduce((a,p)=>a+Number(p.installment_amount),0),remainingTotal=open.reduce((a,p)=>a+Math.max(0,Number(p.total_amount)-Number(p.paid_installments)*Number(p.installment_amount)),0);
  function toggle(id){setSelected(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id])}
  async function pay(all){const{data,error}=await supabase.rpc('pay_card_purchases',{p_card_id:card.id,p_purchase_ids:all?null:selected,p_pay_all:all});if(error)return notify('Não foi possível registrar o pagamento.');setDialog(null);setSelected([]);await reload();notify(all?`Cartão quitado: ${data} compra(s).`:`Pagamento parcial registrado em ${data} compra(s).`)}
  return <div className="card-detail"><button className="back-button" onClick={back}><ArrowDownLeft/>Voltar aos cartões</button><div className="card-detail-head"><div><span>{card.bank}</span><h2>{card.name}</h2><p>Fecha dia {card.closing_day} · vence dia {card.due_day}</p></div><div><small>Parcela do mês</small><strong>{money(currentTotal)}</strong><span>Saldo total {money(remainingTotal)}</span></div><button className="primary" disabled={!open.length} onClick={()=>setDialog('choose')}><Check/>Pagar</button></div><div className="page-panel"><div className="panel-title"><div><h2>Histórico de compras</h2><p>{purchases.length} compra(s) registradas</p></div></div><div className="purchase-history"><div className="purchase-row header"><span>Compra</span><span>Responsável</span><span>Valor total</span><span>Parcelas</span><span>Parcela atual</span><span>Status</span></div>{purchases.map(p=><div className="purchase-row" key={p.id}><div><strong>{p.description}</strong><small>{new Date(p.first_due_date+'T12:00').toLocaleDateString('pt-BR')}</small></div><span>{p.purchased_by}</span><b>{money(Number(p.total_amount))}</b><span>{Math.min(p.paid_installments+1,p.installment_count)}/{p.installment_count}</span><b>{money(Number(p.installment_amount))}</b><i className={p.status}>{p.status==='paid'?'Pago':'Em aberto'}</i></div>)}{!purchases.length&&<EmptyState text="Nenhuma compra neste cartão."/>}</div></div>{dialog&&<div className="payment-dialog-bg"><div className="payment-dialog"><div className="modal-head"><div><h2>Como deseja pagar?</h2><p>{dialog==='choose'?'Escolha entre quitar o cartão ou selecionar parcelas.':'Selecione as compras que serão pagas neste mês.'}</p></div><button onClick={()=>{setDialog(null);setSelected([])}}><X/></button></div>{dialog==='choose'?<div className="payment-options"><button onClick={()=>setDialog('total')}><ShieldCheck/><strong>Pagar total</strong><span>Quitar todas as compras em débito · {money(remainingTotal)}</span></button><button onClick={()=>setDialog('partial')}><FileText/><strong>Pagamento parcial</strong><span>Escolher as parcelas atuais que serão pagas</span></button></div>:dialog==='total'?<div className="confirm-total"><AlertTriangle/><h3>Confirmar quitação total?</h3><p>Todas as {open.length} compras em aberto serão marcadas como pagas. Valor pendente: <strong>{money(remainingTotal)}</strong>.</p><button className="primary" onClick={()=>pay(true)}>Confirmar pagamento total</button></div>:<><div className="partial-list">{open.map(p=><label key={p.id}><input type="checkbox" checked={selected.includes(p.id)} onChange={()=>toggle(p.id)}/><span><strong>{p.description}</strong><small>{p.purchased_by} · parcela {p.paid_installments+1}/{p.installment_count}</small></span><b>{money(Number(p.installment_amount))}</b></label>)}</div><div className="partial-footer"><span>Selecionado: <strong>{money(open.filter(p=>selected.includes(p.id)).reduce((a,p)=>a+Number(p.installment_amount),0))}</strong></span><button className="primary" disabled={!selected.length} onClick={()=>pay(false)}>Pagar selecionados</button></div></>}</div></div>}</div>
}

function CalendarModule({ owner, tx }) {
  const [events, setEvents] = useState([]),
    now = new Date(),
    year = now.getFullYear(),
    month = now.getMonth(),
    days = Array.from(
      { length: new Date(year, month + 1, 0).getDate() },
      (_, i) => i + 1,
    );
  useEffect(() => {
    (async () => {
      const start = new Date(year, month, 1).toISOString().slice(0, 10),
        end = new Date(year, month + 1, 0).toISOString().slice(0, 10);
      const [{ data: obligations }, { data: purchases }] = await Promise.all([
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
          .gte("first_due_date", start)
          .lte("first_due_date", end)
          .eq("status", "open"),
      ]);
      setEvents([
        ...(obligations || []).map((x) => ({
          id: x.id,
          day: Number(x.next_due_date.slice(8, 10)),
          type: x.direction === "receivable" ? "in" : "out",
          label: `${x.counterparty_name}: ${money(Number(x.installment_amount))}`,
        })),
        ...(purchases || []).map((x) => ({
          id: x.id,
          day: Number(x.first_due_date.slice(8, 10)),
          type: "out",
          label: `${x.cards?.name || "Cartão"}: ${money(Number(x.installment_amount))}`,
        })),
      ]);
    })();
  }, [owner.id, year, month]);
  return (
    <div className="page-panel">
      <div className="page-head">
        <div>
          <h2>Calendário financeiro</h2>
          <p>{now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p>
        </div>
      </div>
      <div className="calendar-grid">
        {days.map((d) => (
          <div className="calendar-day" key={d}>
            <b>{d}</b>
            {tx
              .filter((x) => parseInt(x.date) === d)
              .map((x) => (
                <span className={x.type} key={x.id}>
                  {x.name}
                </span>
              ))}
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
function SettingsModule({ owner, modules, reloadModules, onUpdate, dark, setDark, notify }) {
  const [name, setName] = useState(owner.name),[appName,setAppName]=useState(owner.app_name||"Finance Hub"),[appColor,setAppColor]=useState(owner.app_color||"#6445ED"),[email,setEmail]=useState(""),[password,setPassword]=useState("");
  async function save(e) {
    e.preventDefault();
    const { error } = await supabase
      .from("owners")
      .update({ name,app_name:appName,app_color:appColor, updated_at: new Date().toISOString() })
      .eq("id", owner.id);
    if(error)return notify("Erro ao salvar personalização.");onUpdate({...owner,name,app_name:appName,app_color:appColor});notify("Personalização salva.");
  }
  async function linkEmail(){if(!email)return notify("Informe um e-mail válido.");const{error}=await supabase.auth.updateUser({email});notify(error?error.message:"Enviamos a confirmação. Abra seu e-mail antes de definir a senha.")}
  async function setAccountPassword(){if(password.length<8)return notify("A senha precisa ter pelo menos 8 caracteres.");const{data:{user}}=await supabase.auth.getUser();if(!user?.email)return notify("Confirme primeiro o endereço de e-mail.");const{error}=await supabase.auth.updateUser({password});if(error)return notify(error.message);localStorage.setItem("finance-hub-permanent","true");setPassword("");notify("Senha ativada. Agora sua conta pode ser acessada em outros aparelhos.")}
  async function editModule(m){const next=prompt("Novo nome da função:",m.name)?.trim();if(!next||next===m.name)return;const{error}=await supabase.from("custom_modules").update({name:next}).eq("id",m.id).eq("owner_id",owner.id);if(error)return notify("Não foi possível editar.");await reloadModules();notify("Função atualizada.")}
  async function deleteModule(m){if(!confirm(`Excluir a função ${m.name} e todos os seus registros?`))return;const{error}=await supabase.from("custom_modules").delete().eq("id",m.id).eq("owner_id",owner.id);if(error)return notify("Não foi possível excluir.");await reloadModules();notify("Função excluída.")}
  return (
    <div className="settings-layout"><div className="settings-panel">
      <h2>Perfil e aparência</h2>
      <form onSubmit={save}>
        <label>
          Nome do proprietário
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>Nome do aplicativo<input value={appName} onChange={e=>setAppName(e.target.value)} maxLength="40"/></label>
        <label>Cor principal<input type="color" value={appColor} onChange={e=>setAppColor(e.target.value)}/></label>
        <label className="setting-row">
          <span>
            <strong>Tema escuro</strong>
            <small>Alternar aparência do aplicativo</small>
          </span>
          <input
            type="checkbox"
            checked={dark}
            onChange={(e) => setDark(e.target.checked)}
          />
        </label>
        <button className="primary">Salvar configurações</button>
      </form>
    </div><div className="settings-panel"><h2>Segurança da conta</h2><p className="settings-help">Vincule um e-mail verificado e depois crie uma senha. Isso evita perder os dados ao trocar de aparelho ou limpar o navegador.</p><label>E-mail de recuperação<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com"/></label><button onClick={linkEmail}>Vincular e-mail</button><label>Nova senha<input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength="8"/></label><button className="primary" onClick={setAccountPassword}>Ativar senha</button></div><div className="settings-panel settings-modules"><h2>Funções criadas</h2><p className="settings-help">Edite o nome ou exclua botões criados por você.</p>{modules.map(m=><div className="module-setting" key={m.id}><span><Sparkles/><strong>{m.name}</strong><small>{m.field_schema?.length||0} campos</small></span><div><button onClick={()=>editModule(m)}>Editar</button><button className="danger-text" onClick={()=>deleteModule(m)}>Excluir</button></div></div>)}{!modules.length&&<EmptyState text="Nenhuma função personalizada."/>}</div></div>
  );
}
function EmptyState({ text }) {
  return (
    <div className="module-empty">
      <PackageOpen />
      <strong>{text}</strong>
      <span>Use o botão de cadastro para começar.</span>
    </div>
  );
}
function ModulePage({ title, notify }) {
  return (
    <div className="empty-module">
      <div>
        <PackageOpen />
      </div>
      <h2>{title}</h2>
      <p>
        Este módulo já está preparado para receber e organizar seus dados
        financeiros.
      </p>
      <div>
        <button
          className="primary"
          onClick={() => notify("Novo cadastro iniciado")}
        >
          <Plus />
          Novo cadastro
        </button>
        <button onClick={() => notify("Exportação preparada")}>
          <Download />
          Exportar
        </button>
      </div>
    </div>
  );
}
function Modal({ title, close, children }) {
  return (
    <div className="modal-bg" onMouseDown={close}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            <p>Preencha os dados abaixo.</p>
          </div>
          <button onClick={close}>
            <X />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<AuthGate />);
