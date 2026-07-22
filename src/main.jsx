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
  CircleDollarSign,
  Mail,
  MonitorSmartphone,
  LockKeyhole,
  Pencil,
  Trash2,
} from "lucide-react";
import "./styles.css";
import { supabase } from "./lib/supabase";
import ExpenseElimination from "./ExpenseElimination";

const APP_URL = "https://alencar1992.github.io/FINANCE-HUB/";
const authErrorPt = (error, fallback = "Não foi possível concluir. Tente novamente.") => {
  const code = error?.code || error?.error_code || "";
  const message = String(error?.message || "").toLowerCase();
  if (code === "over_email_send_rate_limit" || message.includes("rate limit") || message.includes("too many")) return "O limite temporário de envio de e-mails foi atingido. Aguarde antes de tentar novamente.";
  if (code === "email_not_confirmed" || message.includes("email not confirmed")) return "O e-mail ainda não foi confirmado. Verifique sua caixa de entrada e a pasta de spam.";
  if (code === "invalid_credentials" || message.includes("invalid login")) return "E-mail ou senha inválidos.";
  if (code === "user_already_exists" || message.includes("already registered")) return "Este e-mail já está cadastrado.";
  if (code === "weak_password" || message.includes("weak password")) return "A senha não atende aos requisitos de segurança.";
  if (message.includes("different from the old password")) return "Escolha uma senha diferente da senha anterior.";
  if (message.includes("captcha")) return "Não foi possível validar a proteção de segurança. Atualize a página e tente novamente.";
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
  return Number(raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw);
};
const monthStart=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-01`;
const dueDateFor=(day,date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(Math.min(Number(day),new Date(date.getFullYear(),date.getMonth()+1,0).getDate())).padStart(2,"0")}`;
const categoryRules=[
  ["Alimentação",/mercado|supermercado|padaria|restaurante|lanche|ifood|comida|açougue/i],
  ["Moradia",/aluguel|condom[ií]nio|energia|luz|[aá]gua|g[aá]s|iptu/i],
  ["Transporte",/combust[ií]vel|gasolina|uber|99|ônibus|onibus|oficina|moto|carro|ped[aá]gio/i],
  ["Saúde",/farm[aá]cia|m[eé]dico|dentista|hospital|consulta|exame|academia/i],
  ["Assinaturas",/netflix|spotify|disney|prime|streaming|assinatura|gamepass/i],
  ["Educação",/curso|faculdade|escola|livro|mensalidade/i],
  ["Investimentos",/investimento|aporte|poupan[cç]a|cdb|lci|lca|tesouro/i],
  ["Salário",/sal[aá]rio|adiantamento|pagamento mensal/i],
  ["Renda extra",/venda|freelancer|comiss[aã]o|renda extra|servi[cç]o/i],
];
function suggestCategory(name,type){const found=categoryRules.find(([,rule])=>rule.test(String(name)));return found?{category:found[0],confidence:.9,source:"rules"}:{category:type==="income"?"Outras receitas":"Outras despesas",confidence:.45,source:"rules"}}
const normalizeText=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
async function addSavingsContribution(ownerId,amount,label){
  if(amount<=0)return null;
  let{data:investment}=await supabase.from("investments").select("*").eq("owner_id",ownerId).ilike("name","Reserva de Poupança").eq("active",true).maybeSingle();
  if(investment){const{data,error}=await supabase.from("investments").update({initial_amount:Number(investment.initial_amount)+amount,current_amount:Number(investment.current_amount)+amount,updated_at:new Date().toISOString()}).eq("id",investment.id).eq("owner_id",ownerId).select().single();if(error)throw error;investment=data}else{const{data,error}=await supabase.from("investments").insert({owner_id:ownerId,name:"Reserva de Poupança",bank_name:"Reserva automática",investment_type:"Poupança",initial_amount:amount,current_amount:amount,rate_mode:"savings",contracted_rate:null,invested_at:new Date().toISOString().slice(0,10),notes:"Criada automaticamente pela central de salário."}).select().single();if(error)throw error;investment=data}
  const reference=monthStart(),{data:snapshot}=await supabase.from("investment_snapshots").select("*").eq("investment_id",investment.id).eq("reference_month",reference).maybeSingle(),contribution=Number(snapshot?.contribution||0);await supabase.from("investment_snapshots").upsert({owner_id:ownerId,investment_id:investment.id,reference_month:reference,amount:Number(investment.current_amount),contribution:contribution+amount},{onConflict:"investment_id,reference_month"});
  const{data:expense,error:expenseError}=await supabase.from("transactions").insert({owner_id:ownerId,name:`Aporte Reserva de Poupança · ${label}`,category:"Investimentos",amount,total_amount:amount,installment_amount:amount,transaction_type:"expense",transaction_date:new Date().toISOString().slice(0,10),status:"paid",is_installment:false,installment_count:1,installment_number:1,notes:"Aporte debitado automaticamente do salário."}).select("id").single();if(expenseError)throw expenseError;return{investmentId:investment.id,transactionId:expense.id}
}
async function processSalarySchedule(ownerId){
  const{data:settings}=await supabase.from("salary_settings").select("*").eq("owner_id",ownerId).maybeSingle();if(!settings)return 0;
  const now=new Date(),today=now.getDate(),reference=monthStart(now);let created=0;
  const processPayment=async(kind,enabled,amount,day)=>{if(!enabled||Number(amount)<=0||today<Math.min(Number(day),new Date(now.getFullYear(),now.getMonth()+1,0).getDate()))return;const{data:exists}=await supabase.from("salary_events").select("id").eq("owner_id",ownerId).eq("reference_month",reference).eq("event_type",kind).maybeSingle();if(exists)return;const{data:event,error:eventError}=await supabase.from("salary_events").insert({owner_id:ownerId,reference_month:reference,event_type:kind,amount}).select().single();if(eventError)return;const label=kind==="salary"?"Salário":"Adiantamento salarial",{data:transaction,error}=await supabase.from("transactions").insert({owner_id:ownerId,name:`${label} · ${reference.slice(0,7)}`,category:"Salário",amount:Number(amount),total_amount:Number(amount),installment_amount:Number(amount),transaction_type:"income",transaction_date:dueDateFor(day,now),status:"received",is_installment:false,installment_count:1,installment_number:1,notes:"Inserido automaticamente pela central de salário."}).select("id").single();if(error){await supabase.from("salary_events").delete().eq("id",event.id);return}await supabase.from("salary_events").update({transaction_id:transaction.id}).eq("id",event.id);created++;
    const shouldSave=settings.savings_enabled&&settings.savings_recurring&&((kind==="salary"&&settings.savings_on_salary)||(kind==="advance"&&settings.savings_on_advance));if(!shouldSave)return;const savingType=`${kind}_savings`,{data:savingExists}=await supabase.from("salary_events").select("id").eq("owner_id",ownerId).eq("reference_month",reference).eq("event_type",savingType).maybeSingle();if(savingExists)return;const savingAmount=Math.round((settings.savings_mode==="percentage"?Number(amount)*Number(settings.savings_value)/100:Number(settings.savings_value))*100)/100;if(savingAmount<=0)return;try{const result=await addSavingsContribution(ownerId,savingAmount,label);await supabase.from("salary_events").insert({owner_id:ownerId,reference_month:reference,event_type:savingType,amount:savingAmount,transaction_id:result.transactionId,investment_id:result.investmentId});created++}catch(error){console.error("Falha no aporte automático",error)}
  };
  await processPayment("salary",settings.salary_enabled,settings.salary_amount,settings.salary_day);await processPayment("advance",settings.advance_enabled,settings.advance_amount,settings.advance_day);if(created)window.dispatchEvent(new Event("finance-data-changed"));return created
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
const seedTx = [];
const debts = [];
const owed = [];

function FinanceApp({ owner }) {
  const [page, setPage] = useState("Início"),
    [menu, setMenu] = useState(false),
    [sidebarCollapsed, setSidebarCollapsed] = useState(()=>localStorage.getItem("finance-sidebar-collapsed")==="true"),
    [dark, setDark] = useState(false),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(""),
    [tx, setTx] = useState([]),
    [query, setQuery] = useState(""),
    [customModules, setCustomModules] = useState([]),
    [profile,setProfile]=useState(owner),
    [profileMenu,setProfileMenu]=useState(false),
    [appDialog,setAppDialog]=useState(null),
    [salaryNotice,setSalaryNotice]=useState(null),
    [closureNotice,setClosureNotice]=useState(null),
    [backupNotice,setBackupNotice]=useState(null),
    [avatarUrl,setAvatarUrl]=useState("");
  const dialogResolver=useRef(null);
  const notify = (m) => {
    setToast(m);
    setTimeout(() => setToast(""), 2600);
  };
  const ask = (options) => new Promise((resolve) => {
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
    events.forEach((event) => addEventListener(event, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((event) => removeEventListener(event, reset));
    };
  }, []);
  useEffect(()=>{(async()=>{if(!profile.avatar_url)return setAvatarUrl("");const{data}=await supabase.storage.from("finance-assets").createSignedUrl(profile.avatar_url,3600);setAvatarUrl(data?.signedUrl||"")})()},[profile.avatar_url]);
  useEffect(()=>{(async()=>{const count=await processSalarySchedule(owner.id);if(count)await loadTransactions();await loadSalaryNotifications()})()},[owner.id]);
  useEffect(()=>{supabase.from("monthly_closures").select("*").eq("owner_id",owner.id).in("status",["pending","ready"]).order("reference_month",{ascending:true}).limit(1).maybeSingle().then(({data})=>setClosureNotice(data||null))},[owner.id]);
  useEffect(()=>{supabase.from("finance_backups").select("backup_date,created_at,status").eq("owner_id",owner.id).order("created_at",{ascending:false}).limit(1).maybeSingle().then(({data})=>{if(data){setBackupNotice(data);setTimeout(()=>setBackupNotice(null),8000)}})},[owner.id]);
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
              elapsed = Math.max(0,(now.getFullYear()-first.getFullYear())*12+now.getMonth()-first.getMonth()),
              currentInstallment = x.is_installment?Math.min(x.installment_count,elapsed+1):1,
              effectiveDate = x.is_recurring&&x.recurrence_active?new Date(now.getFullYear(),now.getMonth(),Math.min(Number(x.recurrence_day||first.getDate()),new Date(now.getFullYear(),now.getMonth()+1,0).getDate())):new Date(first);
            if(x.is_installment)effectiveDate.setMonth(first.getMonth()+currentInstallment-1);
            return {
              id: x.id,
              name: x.is_installment?`${x.name} · ${currentInstallment}/${x.installment_count}`:x.name,
              cat: x.category,
              value: Number(x.installment_amount||x.amount),
              date: effectiveDate.toLocaleDateString("pt-BR",{day:"2-digit",month:"short"}),
              type: x.transaction_type === "income" ? "in" : "out",
              status: currentInstallment>=x.installment_count&&x.is_installment?"Última parcela":({pending:"Pendente",paid:"Pago",received:"Recebido",overdue:"Vencido",cancelled:"Cancelado"}[x.status]),
              rawStatus:x.status,
              rawDate:x.transaction_date,
              totalValue:Number(x.total_amount||x.amount),
              classificationSource:x.classification_source,
              classificationConfidence:Number(x.classification_confidence||0),
              duplicateStatus:x.duplicate_review_status,
              duplicateOf:x.duplicate_of,
              source:"transaction",
              recurring:Boolean(x.is_recurring&&x.recurrence_active),
            };
          }),
        );
  }
  async function loadSalaryNotifications(){
    const{data,error}=await supabase.from("salary_events").select("id,event_type,amount,reference_month,created_at").eq("owner_id",owner.id).in("event_type",["salary_savings","advance_savings"]).is("notified_at",null).order("created_at",{ascending:true});
    if(!error&&data?.length)setSalaryNotice({events:data,total:data.reduce((sum,event)=>sum+Number(event.amount),0)});
  }
  async function acknowledgeSalaryNotice(){
    const ids=salaryNotice?.events.map(event=>event.id)||[];
    if(ids.length){const{error}=await supabase.from("salary_events").update({notified_at:new Date().toISOString()}).eq("owner_id",owner.id).in("id",ids);if(error)return notify("Não foi possível confirmar esta notificação.")}
    setSalaryNotice(null);
  }
  function closureRows(snapshot){return Object.entries(snapshot||{}).filter(([,rows])=>Array.isArray(rows)).flatMap(([origem,rows])=>rows.map(row=>({origem,...row})))}
  function downloadBlob(blob,name){const link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(link.href),3000)}
  async function completeClosure(){const rows=closureRows(closureNotice.snapshot),month=closureNotice.reference_month.slice(0,7),headers=[...new Set(rows.flatMap(row=>Object.keys(row)))],csv=[headers.join(";"),...rows.map(row=>headers.map(key=>`"${String(typeof row[key]==="object"?JSON.stringify(row[key]):row[key]??"").replaceAll('"','""')}"`).join(";"))].join("\n");downloadBlob(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}),`fechamento-${month}.csv`);const{jsPDF}=await import("jspdf");const pdf=new jsPDF();pdf.setFontSize(18);pdf.text(`Fechamento mensal · ${month}`,14,18);pdf.setFontSize(9);let y=28;rows.forEach(row=>{const text=`${row.origem} · ${row.name||row.description||row.counterparty_name||row.participant_name||"Registro"} · ${money(Number(row.amount||row.total_amount||row.remaining_amount||0))}`;pdf.text(text.slice(0,105),14,y);y+=6;if(y>282){pdf.addPage();y=18}});pdf.save(`fechamento-${month}.pdf`);await supabase.from("monthly_closures").update({status:"completed",closed_at:new Date().toISOString(),downloaded_at:new Date().toISOString()}).eq("id",closureNotice.id).eq("owner_id",owner.id);setClosureNotice(null);notify("Fechamento concluído e arquivos baixados.")}
  useEffect(() => {loadTransactions();const refresh=()=>loadTransactions();addEventListener("finance-data-changed",refresh);return()=>removeEventListener("finance-data-changed",refresh)}, [owner.id]);
  async function loadCustomModules(){const{data}=await supabase.from("custom_modules").select("*").eq("owner_id",owner.id).eq("active",true).order("created_at");setCustomModules(data||[])}
  useEffect(()=>{loadCustomModules()},[owner.id]);
  const visibleNav=[...nav.slice(0,7),...(profile.expense_plan_enabled!==false?[["Eliminar despesas",Target]]:[]),...(profile.streaming_enabled?[["Streamings",Play]]:[]),...customModules.map(m=>[`module:${m.id}`,Sparkles,m.name]),...nav.slice(7)];
  async function addTx(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      total = parseBRNumber(f.get("total")),
      count = Number(f.get("installments") || 1),
      monthly = Math.round((total / count) * 100) / 100;
    const type=f.get("type") === "in" ? "income" : "expense",
      typedCategory=String(f.get("cat")||"").trim(),
      suggestion=suggestCategory(f.get("name"),type),
      category=typedCategory||suggestion.category,
      startDate=f.get("date")||new Date().toISOString().slice(0,10),
      dayBefore=new Date(startDate+"T12:00"),dayAfter=new Date(startDate+"T12:00");
    dayBefore.setDate(dayBefore.getDate()-2);dayAfter.setDate(dayAfter.getDate()+2);
    const{data:possibleDuplicates}=await supabase.from("transactions").select("id,name,amount,transaction_date").eq("owner_id",owner.id).eq("transaction_type",type).eq("amount",monthly).gte("transaction_date",dayBefore.toISOString().slice(0,10)).lte("transaction_date",dayAfter.toISOString().slice(0,10)).neq("status","cancelled").limit(10);
    const duplicate=(possibleDuplicates||[]).find(item=>normalizeText(item.name)===normalizeText(f.get("name")))||possibleDuplicates?.[0];
    const row = {
      owner_id: owner.id,
      name: f.get("name"),
      category,
      classification_source:typedCategory?"manual":suggestion.source,
      classification_confidence:typedCategory?1:suggestion.confidence,
      duplicate_of:duplicate?.id||null,
      duplicate_review_status:duplicate?"pending":"not_flagged",
      amount: monthly,
      total_amount: total,
      is_installment: count > 1,
      installment_count: count,
      installment_number: 1,
      installment_amount: monthly,
      transaction_type: type,
      status: "pending",
      transaction_date:startDate,
      is_recurring:f.get("recurring")==="on",
      recurrence_active:f.get("recurring")==="on",
      recurrence_day:f.get("recurring")==="on"?Number(f.get("recurrence_day")||new Date().getDate()):null,
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
    <div className={`${dark ? "app dark" : "app"}${sidebarCollapsed ? " sidebar-collapsed" : ""}`} style={{"--violet":profile.app_color||"#6445ED","--user-bg":profile.background_color||"#F6F8FC"}}>
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
        <button className="sidebar-toggle" title={sidebarCollapsed?"Mostrar menu lateral":"Ocultar menu lateral"} aria-label={sidebarCollapsed?"Mostrar menu lateral":"Ocultar menu lateral"} onClick={()=>setSidebarCollapsed(value=>{localStorage.setItem("finance-sidebar-collapsed",String(!value));return !value})}>
          {sidebarCollapsed?<PanelLeftOpen/>:<PanelLeftClose/>}<span>{sidebarCollapsed?"Mostrar menu":"Ocultar menu"}</span>
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
            </button>
          ))}
        </nav>
        <div className="profile-wrap"><button className="profile" onClick={()=>setProfileMenu(!profileMenu)}>
          <span>{avatarUrl?<img src={avatarUrl} alt="Foto do perfil"/>:initials(profile.name)}</span>
          <div>
            <strong>{profile.name}</strong>
            <small>Perfil pessoal</small>
          </div>
          <MoreHorizontal />
        </button>{profileMenu&&<div className="profile-popover"><button onClick={()=>{setPage("Configurações");setProfileMenu(false)}}><Settings/>Configurações</button><button className="logout" onClick={async()=>{const{data:{user}}=await supabase.auth.getUser();if(user?.is_anonymous){setPage("Configurações");setProfileMenu(false);return notify("Vincule e-mail e senha antes de sair, para não perder o acesso aos dados.")}await supabase.auth.signOut();location.reload()}}><ArrowDownLeft/>Sair</button></div>}</div>
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
            <button className="salary-trigger" onClick={()=>setModal("salary")}><Banknote/><span><strong>Salário</strong><small>Pagamento, adiantamento e reserva</small></span></button>
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
            <span className="avatar">{avatarUrl?<img src={avatarUrl} alt="Foto do perfil"/>:initials(owner.name)}</span>
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
            <UnifiedMovements owner={owner} baseRows={filtered} open={() => setModal("transaction")} notify={notify} refresh={loadTransactions}/>
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
          ) : page === "Eliminar despesas" ? (
            <ExpenseElimination owner={owner} notify={notify}/>
          ) : page === "Inteligência" ? (
            <FinancialIntelligence owner={owner} tx={tx} notify={notify} refresh={loadTransactions} ask={ask}/>
          ) : page === "Streamings" ? (
            <StreamingsModule owner={owner} notify={notify}/>
          ) : page === "Investimentos" ? (
            <InvestmentsModule owner={owner} notify={notify} />
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
              ask={ask}
              openBuilder={()=>setPage("Criar função")}
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
      {modal==="salary"&&<SalaryModal owner={owner} close={()=>setModal(null)} notify={notify} refresh={loadTransactions}/>} 
      {salaryNotice&&<div className="salary-notice-bg" role="dialog" aria-modal="true" aria-labelledby="salary-notice-title"><section className="salary-notice"><span className="salary-notice-icon"><PiggyBank/></span><small>AUTOMAÇÃO CONCLUÍDA</small><h2 id="salary-notice-title">Reserva de Poupança atualizada</h2><p>Enquanto você estava fora, o Finance Hub processou sua regra mensal com segurança.</p><div className="salary-notice-value"><span>Valor reservado</span><strong>{money(salaryNotice.total)}</strong></div><div className="salary-notice-events">{salaryNotice.events.map(event=><span key={event.id}><b>{event.event_type==="salary_savings"?"Aporte do salário":"Aporte do adiantamento"}</b><strong>{money(Number(event.amount))}</strong></span>)}</div><button className="primary" onClick={acknowledgeSalaryNotice}><Check/>Entendi</button></section></div>}
      {closureNotice&&<div className="salary-notice-bg" role="dialog" aria-modal="true"><section className="salary-notice closure-notice"><span className="salary-notice-icon"><FileText/></span><small>{closureNotice.mode==="automatic"?"FECHAMENTO PREPARADO":"FECHAMENTO PENDENTE"}</small><h2>O mês virou</h2><p>{closureNotice.mode==="automatic"?"Seu fechamento foi arquivado. Baixe agora as cópias CSV e PDF.":"O fechamento do mês anterior ainda não foi realizado. Os dados permanecem preservados até sua confirmação."}</p><div className="salary-notice-value"><span>Competência</span><strong>{new Date(closureNotice.reference_month+"T12:00").toLocaleDateString("pt-BR",{month:"long",year:"numeric"})}</strong></div><div className="closure-actions"><button className="primary" onClick={completeClosure}><Download/>{closureNotice.mode==="automatic"?"Baixar CSV e PDF":"Realizar fechamento agora"}</button><button className="closure-later" onClick={()=>setClosureNotice(null)}><Clock3/>Lembrar depois</button></div><em>O aviso aparecerá novamente no próximo login.</em></section></div>}
      {appDialog && <AppDialog dialog={appDialog} onAnswer={answerDialog} />}
      {toast && (
        <div className="toast">
          <Check />
          {toast}
        </div>
      )}
      {backupNotice&&<div className="backup-login-notice"><ShieldCheck/><div><strong>Backup financeiro protegido</strong><span>Última cópia: {new Date(backupNotice.created_at).toLocaleString("pt-BR")}</span><i/></div><button onClick={()=>setBackupNotice(null)}><X/></button></div>}
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
    [recurring,setRecurring]=useState(false),
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
        <label className="installment-toggle recurring-toggle"><input name="recurring" type="checkbox" checked={recurring} onChange={e=>{setRecurring(e.target.checked);if(e.target.checked)setParcelled(false)}}/>Despesa ou receita recorrente mensal</label>
        {recurring&&<div className="installment-box"><label>Dia mensal do vencimento<input name="recurrence_day" type="number" min="1" max="31" defaultValue={new Date().getDate()}/></label><div><span>Como funciona</span><strong>Fixa até quitação</strong><small>Aparecerá em cada mês enquanto estiver ativa.</small></div></div>}
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
        <label>Data inicial<input name="date" type="date" required defaultValue={new Date().toISOString().slice(0,10)}/></label>
        <label>
          Observação
          <textarea name="notes" placeholder="Opcional" />
        </label>
        <button className="primary submit">Salvar movimentação</button>
      </form>
    </Modal>
  );
}
function SalaryModal({owner,close,notify,refresh}){
  const[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[form,setForm]=useState({salary_amount:"",salary_day:5,salary_enabled:false,advance_amount:"",advance_day:20,advance_enabled:false,savings_enabled:false,savings_mode:"percentage",savings_value:"",savings_recurring:false,savings_on_salary:true,savings_on_advance:false});
  useEffect(()=>{(async()=>{const{data}=await supabase.from("salary_settings").select("*").eq("owner_id",owner.id).maybeSingle();if(data)setForm({...data,salary_amount:Number(data.salary_amount).toFixed(2).replace(".",","),advance_amount:Number(data.advance_amount).toFixed(2).replace(".",","),savings_value:Number(data.savings_value).toFixed(data.savings_mode==="percentage"?2:2).replace(".",",")});setLoading(false)})()},[owner.id]);
  const set=(key,value)=>setForm(current=>({...current,[key]:value})),salary=parseBRNumber(form.salary_amount)||0,advance=parseBRNumber(form.advance_amount)||0,savingValue=parseBRNumber(form.savings_value)||0,calc=amount=>Math.round((form.savings_mode==="percentage"?amount*savingValue/100:savingValue)*100)/100,salarySaving=form.savings_enabled&&form.savings_on_salary?calc(salary):0,advanceSaving=form.savings_enabled&&form.savings_on_advance?calc(advance):0;
  async function save(e){e.preventDefault();setSaving(true);const payload={owner_id:owner.id,salary_amount:salary,salary_day:Number(form.salary_day),salary_enabled:form.salary_enabled,advance_amount:advance,advance_day:Number(form.advance_day),advance_enabled:form.advance_enabled,savings_enabled:form.savings_enabled,savings_mode:form.savings_mode,savings_value:savingValue,savings_recurring:form.savings_recurring,savings_on_salary:form.savings_on_salary,savings_on_advance:form.savings_on_advance,updated_at:new Date().toISOString()};const{error}=await supabase.from("salary_settings").upsert(payload,{onConflict:"owner_id"});if(error){setSaving(false);return notify("Não foi possível salvar a configuração salarial.")}const count=await processSalarySchedule(owner.id);await refresh();setSaving(false);close();notify(count?`${count} lançamento(s) processado(s) e configuração salva.`:"Configuração salarial salva.")}
  return <Modal title="Central de salário" close={close}>{loading?<p>Carregando configuração…</p>:<form className="form salary-form" onSubmit={save}><section><div className="salary-section-title"><Banknote/><div><strong>Pagamento principal</strong><small>Entrada mensal do salário.</small></div></div><div className="fields"><label>Valor do salário<input value={form.salary_amount} onChange={e=>set("salary_amount",e.target.value)} inputMode="decimal" placeholder="1.234,56" required/></label><label>Dia do pagamento<input type="number" min="1" max="31" value={form.salary_day} onChange={e=>set("salary_day",e.target.value)} required/></label></div><label className="salary-check"><input type="checkbox" checked={form.salary_enabled} onChange={e=>set("salary_enabled",e.target.checked)}/><span><Check/></span>Inserir o salário automaticamente todos os meses</label></section><section><div className="salary-section-title"><CalendarDays/><div><strong>Adiantamento salarial</strong><small>Configure se você recebe adiantamento.</small></div></div><div className="fields"><label>Valor do adiantamento<input value={form.advance_amount} onChange={e=>set("advance_amount",e.target.value)} inputMode="decimal" placeholder="0,00"/></label><label>Dia do adiantamento<input type="number" min="1" max="31" value={form.advance_day} onChange={e=>set("advance_day",e.target.value)}/></label></div><label className="salary-check"><input type="checkbox" checked={form.advance_enabled} onChange={e=>set("advance_enabled",e.target.checked)}/><span><Check/></span>Inserir o adiantamento automaticamente todos os meses</label></section><section className="salary-savings"><div className="salary-section-title"><PiggyBank/><div><strong>Reserva de Poupança</strong><small>Debita do saldo e adiciona automaticamente aos investimentos.</small></div></div><label className="salary-check"><input type="checkbox" checked={form.savings_enabled} onChange={e=>set("savings_enabled",e.target.checked)}/><span><Check/></span>Habilitar Reserva de Poupança</label>{form.savings_enabled&&<><div className="fields"><label>Forma de cálculo<select value={form.savings_mode} onChange={e=>set("savings_mode",e.target.value)}><option value="percentage">Porcentagem do recebimento</option><option value="fixed">Valor fixo em reais</option></select></label><label>{form.savings_mode==="percentage"?"Porcentagem":"Valor do aporte"}<input value={form.savings_value} onChange={e=>set("savings_value",e.target.value)} inputMode="decimal" placeholder={form.savings_mode==="percentage"?"Ex.: 10,00%":"Ex.: 250,00"}/></label></div><div className="salary-apply"><label><input type="checkbox" checked={form.savings_on_salary} onChange={e=>set("savings_on_salary",e.target.checked)}/>Aplicar no salário</label><label><input type="checkbox" checked={form.savings_on_advance} onChange={e=>set("savings_on_advance",e.target.checked)}/>Aplicar no adiantamento</label></div><label className="salary-check"><input type="checkbox" checked={form.savings_recurring} onChange={e=>set("savings_recurring",e.target.checked)}/><span><Check/></span>Realizar o aporte automaticamente nas datas configuradas</label><div className="salary-preview"><span>Próximo aporte calculado</span><strong>{money(salarySaving+advanceSaving)}</strong><small>Salário: {money(salarySaving)} · Adiantamento: {money(advanceSaving)}</small></div></>}</section><p className="salary-note"><ShieldCheck/>Cada competência é registrada apenas uma vez. Se o aplicativo não estiver aberto na data, o processamento acontece no próximo acesso.</p><div className="form-actions"><button type="button" onClick={close}>Cancelar</button><button className="primary" disabled={saving}>{saving?"Salvando…":"Salvar configuração"}</button></div></form>}</Modal>
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
    [pendingEmail,setPendingEmail]=useState(""),
    [passwordRecovery,setPasswordRecovery]=useState(false),
    [recoveryDone,setRecoveryDone]=useState(false),
    [recoveryEmail,setRecoveryEmail]=useState(""),
    [authBusy,setAuthBusy]=useState(false);
  const authBusyRef=useRef(false);
  useEffect(() => {
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
      if(event==="PASSWORD_RECOVERY"){
        setUser(session?.user||null);
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
      const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
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
    return()=>subscription.unsubscribe();
  }, []);
  async function createOwner(name, id = user?.id) {
    if (!id) return;
    const row = { id, name: name.trim(), profile_color: "#6445ed" };
    const { data, error } = await supabase.from("owners").upsert(row).select().single();
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
      options: { data: { name: f.get("name").trim() }, emailRedirectTo: APP_URL },
    });
    if (error) {
      setError(authErrorPt(error,"Não foi possível criar a conta."));
      return;
    }
    if (!data.session) {
      setMessage("Cadastro criado. Confirme o e-mail e depois faça login.");
      setMode("login");
      return;
    }
    setUser(data.user);
  }
  async function migrateAnonymous(e){e.preventDefault();const f=new FormData(e.currentTarget),email=String(f.get("email")).trim();setError("");setPendingEmail(email);const{error}=await supabase.auth.updateUser({email,password:f.get("password"),data:{name:f.get("name").trim()}},{emailRedirectTo:APP_URL});if(error){if(error.message.toLowerCase().includes("different from the old password")){setMessage("A senha já foi salva na tentativa anterior. Reenvie a confirmação para concluir.");return}setError(authErrorPt(error,"Não foi possível proteger a conta."));return}localStorage.setItem("finance-hub-permanent","true");setMessage("Conta protegida. Confirme o e-mail; depois entre novamente e ative o autenticador.");}
  async function resendConfirmation(){if(!pendingEmail)return setError("Informe o e-mail usado no cadastro.");setError("");const{error}=await supabase.auth.resend({type:"email_change",email:pendingEmail,options:{emailRedirectTo:APP_URL}});if(error)return setError(authErrorPt(error,"Não foi possível reenviar a confirmação."));setMessage("Novo e-mail enviado com o endereço correto. Use somente o link mais recente.")}
  async function signIn(e){e.preventDefault();const f=new FormData(e.currentTarget);setError("");const{data,error}=await supabase.auth.signInWithPassword({email:f.get("email"),password:f.get("password")});if(error){setError("E-mail ou senha inválidos, ou e-mail ainda não confirmado.");return}setUser(data.user);location.reload()}
  async function requestPasswordReset(e){e.preventDefault();if(authBusyRef.current)return;const email=recoveryEmail.trim();setError("");setMessage("");authBusyRef.current=true;setAuthBusy(true);const{error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:APP_URL});authBusyRef.current=false;setAuthBusy(false);if(error){setError(authErrorPt(error,"Não foi possível enviar o link de recuperação."));return}setMessage("Se houver uma conta com esse e-mail, enviaremos um link seguro para redefinir a senha.")}
  async function resendSignupConfirmation(){if(authBusyRef.current||!recoveryEmail.trim())return;setError("");setMessage("");authBusyRef.current=true;setAuthBusy(true);const{error}=await supabase.auth.resend({type:"signup",email:recoveryEmail.trim(),options:{emailRedirectTo:APP_URL}});authBusyRef.current=false;setAuthBusy(false);if(error)return setError(authErrorPt(error,"Não foi possível reenviar a confirmação."));setMessage("Se o cadastro estiver aguardando confirmação, enviaremos um novo link para o e-mail informado.")}
  async function updateRecoveredPassword(e){e.preventDefault();const f=new FormData(e.currentTarget),password=String(f.get("password")),confirmation=String(f.get("confirmation"));setError("");if(password!==confirmation)return setError("As senhas informadas não são iguais.");const{error}=await supabase.auth.updateUser({password});if(error)return setError(authErrorPt(error,"Não foi possível salvar a nova senha."));setRecoveryDone(true);setMessage("Senha alterada com sucesso. Agora você já pode voltar ao login.")}
  if (loading)
    return (
      <div className="boot">
        <span>
          <WalletCards />
        </span>
        <p>Preparando seu Finance Hub…</p>
      </div>
    );
  if(passwordRecovery)return <AuthCard title="Crie uma nova senha" text="Use uma senha forte e diferente das anteriores." error={error} message={message}>{recoveryDone?<button className="primary submit" onClick={async()=>{await supabase.auth.signOut();location.href=APP_URL}}>Voltar para o login</button>:<form onSubmit={updateRecoveredPassword}><label>Nova senha<input name="password" type="password" minLength="10" required autoComplete="new-password"/></label><label>Confirmar nova senha<input name="confirmation" type="password" minLength="10" required autoComplete="new-password"/></label><button className="primary submit">Salvar nova senha</button></form>}</AuthCard>;
  if (user?.is_anonymous) return <AuthCard title="Proteja sua conta atual" text="Seus dados existentes serão preservados. Cadastre e-mail e senha para converter este acesso em uma conta recuperável." error={error} message={message}><form onSubmit={migrateAnonymous}><label>Seu nome<input name="name" required minLength="2" defaultValue={user.user_metadata?.name||"Alencar"}/></label><label>E-mail<input name="email" type="email" required onChange={e=>setPendingEmail(e.target.value)}/></label><label>Senha forte<input name="password" type="password" minLength="10" required autoComplete="new-password"/></label><button className="primary submit">Proteger meus dados</button></form>{message&&<button className="auth-switch" onClick={resendConfirmation}>Reenviar confirmação</button>}<button className="auth-switch" onClick={async()=>{await supabase.auth.signOut();location.reload()}}>Já confirmei o e-mail — ir para login</button></AuthCard>;
  if (user && !mfaReady) return <MfaGate user={user} onVerified={()=>location.reload()}/>;
  if (owner) return <FinanceApp owner={owner} />;
  if (user && mfaReady) {
    const name = user.user_metadata?.name || user.email?.split("@")[0] || "Cliente";
    createOwner(name).catch(()=>setError("Não foi possível preparar o perfil. Tente novamente."));
    return <div className="boot"><span><WalletCards/></span><p>Criando seu espaço seguro…</p></div>;
  }
  return (
    <div className="onboarding">
      <div className="onboard-brand">
        <span>
          <WalletCards />
        </span>
        Finance Hub
      </div>
      <div className="onboard-card">
        <div className="onboard-icon"><ShieldCheck /></div>
        <h1>{mode==="login"?"Acesse seu Finance Hub":mode==="forgot"?"Redefina sua senha":"Crie sua conta segura"}</h1>
        <p>{mode==="login"?"Entre com e-mail, senha e autenticação em dois fatores.":mode==="forgot"?"Informe seu e-mail para receber um link de recuperação seguro.":"Cada cliente recebe um ambiente financeiro privado e isolado."}</p>
        {error && <div className="form-error">{error}</div>}
        {message && <div className="form-success">{message}</div>}
        {mode==="login"?<form onSubmit={signIn}><label>E-mail<input name="email" type="email" required autoComplete="email"/></label><label>Senha<input name="password" type="password" minLength="10" required autoComplete="current-password"/></label><button className="primary submit">Entrar com segurança</button></form>:mode==="forgot"?<><form onSubmit={requestPasswordReset}><label>E-mail da conta<input name="email" type="email" required autoComplete="email" autoFocus value={recoveryEmail} onChange={e=>setRecoveryEmail(e.target.value)}/></label><button className="primary submit" disabled={authBusy}>{authBusy?"Enviando…":"Enviar link de recuperação"}</button></form><button className="auth-switch" disabled={authBusy||!recoveryEmail.trim()} onClick={resendSignupConfirmation}>Ainda não confirmou o cadastro? Reenviar confirmação</button></>:<form onSubmit={register}><label>Seu nome<input name="name" required minLength="2" autoFocus/></label><label>E-mail<input name="email" type="email" required autoComplete="email"/></label><label>Senha forte<input name="password" type="password" minLength="10" required autoComplete="new-password"/></label><button className="primary submit">Criar conta</button></form>}
        {mode==="login"&&<button className="auth-switch" onClick={()=>{setMode("forgot");setError("");setMessage("")}}>Esqueci minha senha</button>}
        <button className="auth-switch" onClick={()=>{setMode(mode==="login"?"register":"login");setError("");setMessage("")}}>{mode==="login"?"Primeiro acesso? Criar conta":"Voltar para o login"}</button>
        <small>Dados isolados, e-mail confirmado e verificação em duas etapas.</small>
      </div>
    </div>
  );
}

function AuthCard({title,text,error,message,children}){return <div className="onboarding"><div className="onboard-brand"><span><WalletCards/></span>Finance Hub</div><div className="onboard-card"><div className="onboard-icon"><ShieldCheck/></div><h1>{title}</h1><p>{text}</p>{error&&<div className="form-error">{error}</div>}{message&&<div className="form-success">{message}</div>}{children}</div></div>}

function MfaGate({user,onVerified}){
  const [factor,setFactor]=useState(null),[code,setCode]=useState(""),[error,setError]=useState(""),[loading,setLoading]=useState(true),[copied,setCopied]=useState(false);
  useEffect(()=>{(async()=>{const{data}=await supabase.auth.mfa.listFactors();const verified=data?.totp?.find(x=>x.status==="verified");if(verified){setFactor(verified);setLoading(false);return}const enrolled=await supabase.auth.mfa.enroll({factorType:"totp",friendlyName:`Finance Hub - ${user.email}`});if(enrolled.error)setError(authErrorPt(enrolled.error,"Não foi possível preparar a verificação em duas etapas."));else setFactor(enrolled.data);setLoading(false)})()},[]);
  async function verify(e){e.preventDefault();setError("");const challenge=await supabase.auth.mfa.challenge({factorId:factor.id});if(challenge.error)return setError(authErrorPt(challenge.error,"Não foi possível iniciar a verificação."));const result=await supabase.auth.mfa.verify({factorId:factor.id,challengeId:challenge.data.id,code:code.trim()});if(result.error)return setError("Código inválido. Confira o aplicativo autenticador.");onVerified()}
  async function copySecret(){if(!factor?.totp?.secret)return;await navigator.clipboard.writeText(factor.totp.secret);setCopied(true);setTimeout(()=>setCopied(false),2200)}
  return <AuthCard title="Verificação em duas etapas" text={factor?.status==="verified"?"Digite o código atual do seu aplicativo autenticador.":"Escolha abaixo como configurar o autenticador."} error={error}>{loading?<p>Preparando autenticação…</p>:<>{factor?.totp&&<div className="mfa-setup"><div className="mfa-method"><strong>Opção 1 — Em outro aparelho</strong><span>Escaneie o código usando Google Authenticator, Microsoft Authenticator ou aplicativo compatível.</span>{factor.totp.qr_code&&<img className="mfa-qr" src={factor.totp.qr_code} alt="Código QR para configurar a verificação em duas etapas"/>}</div><div className="mfa-method mobile-method"><strong>Opção 2 — Neste mesmo celular</strong><span>Abra diretamente no autenticador. Se o aplicativo não abrir, copie a chave e adicione uma conta manualmente.</span>{factor.totp.uri&&<a className="mfa-open-app" href={factor.totp.uri}>Abrir no aplicativo autenticador</a>}<button className="mfa-copy" type="button" onClick={copySecret}>{copied?<Check/>:<FileText/>}{copied?"Chave copiada":"Copiar chave manual"}</button><code>{factor.totp.secret}</code><ol><li>Abra seu aplicativo autenticador.</li><li>Toque em adicionar conta ou inserir chave de configuração.</li><li>Cole a chave, escolha o tipo “Baseado em tempo” e salve.</li><li>Volte ao Finance Hub e informe o código de seis dígitos.</li></ol></div></div>}<form onSubmit={verify}><label>Código de 6 dígitos<input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} inputMode="numeric" pattern="[0-9]{6}" required autoFocus/></label><button className="primary submit" disabled={code.length!==6}>Verificar e entrar</button></form></>}</AuthCard>
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

function InvestmentsModule({owner,notify}){
  const[items,setItems]=useState([]),[snapshots,setSnapshots]=useState([]),[open,setOpen]=useState(false),[position,setPosition]=useState(null),[positionValue,setPositionValue]=useState(""),[rates,setRates]=useState({selic:null,cdi:null,updated:""}),[loadingRates,setLoadingRates]=useState(false);
  const types=["CDB","LCI","LCA","Poupança","Tesouro Selic","Tesouro Prefixado","Fundo de renda fixa","Outro"];
  async function load(){const[{data,error},{data:history}]=await Promise.all([supabase.from("investments").select("*").eq("owner_id",owner.id).eq("active",true).order("created_at"),supabase.from("investment_snapshots").select("*").eq("owner_id",owner.id).order("reference_month")]);if(!error)setItems(data||[]);setSnapshots(history||[])}
  async function loadRates(){setLoadingRates(true);try{const[selicRes,cdiRes]=await Promise.all([fetch("https://api.bcb.gov.br/dados/serie/bcdata.sgs.1178/dados/ultimos/1?formato=json"),fetch("https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/1?formato=json")]);const[selicData,cdiData]=await Promise.all([selicRes.json(),cdiRes.json()]),daily=Number(cdiData?.[0]?.valor),annual=(Math.pow(1+daily/100,252)-1)*100;setRates({selic:Number(selicData?.[0]?.valor),cdi:annual,updated:cdiData?.[0]?.data||selicData?.[0]?.data||""})}catch{notify("Não foi possível consultar as taxas do Banco Central agora.")}finally{setLoadingRates(false)}}
  useEffect(()=>{load();loadRates()},[owner.id]);
  const referenceRate=item=>item.rate_mode==="cdi"?(rates.cdi||0)*Number(item.contracted_rate||100)/100:item.rate_mode==="savings"?((rates.selic||0)>8.5?6.17:(rates.selic||0)*.7):Number(item.contracted_rate||0);
  const projected=item=>{const days=Math.max(0,(Date.now()-new Date(item.invested_at+"T12:00").getTime())/86400000),rate=referenceRate(item);return Number(item.initial_amount)*Math.pow(1+rate/100,days/365)};
  const totalInvested=items.reduce((sum,item)=>sum+Number(item.initial_amount),0),totalCurrent=items.reduce((sum,item)=>sum+Number(item.current_amount),0),gain=totalCurrent-totalInvested,evolution=totalInvested?gain/totalInvested*100:0,monthlyHistory=Object.values(snapshots.reduce((months,row)=>{const key=row.reference_month.slice(0,7);months[key]||={key,label:new Date(`${key}-02T12:00`).toLocaleDateString("pt-BR",{month:"short",year:"2-digit"}),value:0};months[key].value+=Number(row.amount);return months},{})).slice(-12),historyMax=Math.max(1,...monthlyHistory.map(row=>row.value));
  async function add(e){e.preventDefault();const form=new FormData(e.currentTarget),amount=parseBRNumber(form.get("amount")),type=form.get("type"),mode=type==="Poupança"?"savings":form.get("rate_mode"),rate=mode==="savings"?null:parseBRNumber(form.get("rate"));if(!Number.isFinite(amount)||amount<=0)return notify("Informe um valor investido válido, como 1.877,19.");if(mode!=="savings"&&(!Number.isFinite(rate)||rate<=0))return notify("Informe uma taxa válida, como 82,98%.");const{data,error}=await supabase.from("investments").insert({owner_id:owner.id,name:form.get("name"),bank_name:form.get("bank"),investment_type:type,initial_amount:amount,current_amount:amount,rate_mode:mode,contracted_rate:rate,invested_at:form.get("date"),maturity_date:form.get("maturity")||null,notes:form.get("notes")||null}).select().single();if(error){console.error("Falha ao salvar investimento",error);return notify(`Não foi possível salvar: ${error.message||"verifique os dados"}.`)}const month=`${String(form.get("date")).slice(0,7)}-01`;const{error:snapshotError}=await supabase.from("investment_snapshots").insert({owner_id:owner.id,investment_id:data.id,reference_month:month,amount,contribution:amount});if(snapshotError)console.error("Falha ao salvar posição inicial",snapshotError);setOpen(false);await load();notify("Investimento adicionado à carteira.")}
  async function savePosition(e){e.preventDefault();const amount=parseBRNumber(positionValue);if(!Number.isFinite(amount)||amount<0)return notify("Informe uma posição válida.");const month=new Date().toISOString().slice(0,7)+"-01";const[{error}]=await Promise.all([supabase.from("investments").update({current_amount:amount,updated_at:new Date().toISOString()}).eq("id",position.id).eq("owner_id",owner.id),supabase.from("investment_snapshots").upsert({owner_id:owner.id,investment_id:position.id,reference_month:month,amount},{onConflict:"investment_id,reference_month"})]);if(error)return notify("Não foi possível atualizar a posição.");setPosition(null);setPositionValue("");await load();notify("Posição mensal atualizada.")}
  function openPosition(item){setPosition(item);setPositionValue(Number(item.current_amount).toFixed(2).replace(".",","))}
  return <div className="investments-page">
    <div className="page-head"><div><h2>Investimentos</h2><p>Acompanhe sua carteira, rentabilidade e evolução mensal por banco.</p></div><div className="page-actions"><button onClick={loadRates} disabled={loadingRates}><RefreshCw/>{loadingRates?"Atualizando…":"Atualizar taxas"}</button><button className="primary" onClick={()=>setOpen(true)}><Plus/>Novo investimento</button></div></div>
    <div className="investment-rates"><span><Landmark/><small>Selic atual</small><strong>{rates.selic==null?"—":`${rates.selic.toFixed(2)}% a.a.`}</strong></span><span><Percent/><small>CDI de referência</small><strong>{rates.cdi==null?"—":`${rates.cdi.toFixed(2)}% a.a.`}</strong></span><p>Fonte: Banco Central do Brasil (SGS){rates.updated?` · atualizada em ${rates.updated}`:""}. Valores são referências para projeção.</p></div>
    <div className="investment-summary"><div><small>Total aplicado</small><strong>{money(totalInvested)}</strong></div><div><small>Posição atual</small><strong>{money(totalCurrent)}</strong></div><div className={gain>=0?"positive":"negative"}><small>Resultado informado</small><strong>{money(gain)}</strong><span>{evolution.toFixed(2)}%</span></div></div>
    {!!monthlyHistory.length&&<section className="investment-history"><div><h3>Evolução mensal consolidada</h3><p>Com base nas posições mensais registradas em todos os bancos.</p></div><div className="investment-history-bars">{monthlyHistory.map(row=><span key={row.key} title={`${row.label}: ${money(row.value)}`}><i style={{height:`${Math.max(8,row.value/historyMax*100)}%`}}/><small>{row.label}</small><b>{money(row.value)}</b></span>)}</div></section>}
    {open&&<form className="inline-form investment-form" onSubmit={add}><label>Nome do investimento<input name="name" required placeholder="Ex.: Reserva de emergência"/></label><label>Banco ou corretora<input name="bank" required placeholder="Ex.: Banco Inter"/></label><label>Tipo<select name="type" required>{types.map(type=><option key={type}>{type}</option>)}</select></label><label>Forma de rentabilidade<select name="rate_mode" required><option value="cdi">Percentual do CDI</option><option value="fixed">Taxa prefixada ao ano</option><option value="manual">Rentabilidade informada</option><option value="savings">Poupança — regra Selic/TR</option></select></label><label>Taxa contratada<input name="rate" type="text" inputMode="decimal" placeholder="Ex.: 110,00 (% CDI ou % a.a.)"/></label><label>Valor investido<input name="amount" type="text" inputMode="decimal" required placeholder="Ex.: 1.250,90"/></label><label>Data da aplicação<input name="date" type="date" required defaultValue={new Date().toISOString().slice(0,10)}/></label><label>Vencimento<input name="maturity" type="date"/></label><label className="wide">Observações<textarea name="notes"/></label><div className="form-actions"><button type="button" onClick={()=>setOpen(false)}>Cancelar</button><button className="primary">Salvar investimento</button></div></form>}
    <div className="investment-grid">{items.map(item=>{const current=Number(item.current_amount),initial=Number(item.initial_amount),change=initial?(current/initial-1)*100:0,projection=projected(item),rate=referenceRate(item);return <article className="investment-card" key={item.id}><div className="investment-card-head"><span><PiggyBank/></span><div><small>{item.bank_name}</small><h3>{item.name}</h3><p>{item.investment_type}</p></div><i>{item.rate_mode==="cdi"?`${item.contracted_rate}% do CDI`:item.rate_mode==="savings"?"Regra da poupança":`${item.contracted_rate}% a.a.`}</i></div><div className="investment-values"><span><small>Aplicado</small><strong>{money(initial)}</strong></span><span><small>Posição atual</small><strong>{money(current)}</strong></span><span className={change>=0?"positive":"negative"}><small>Evolução</small><strong>{change.toFixed(2)}%</strong></span></div><div className="investment-projection"><span>Projeção pela referência atual ({rate.toFixed(2)}% a.a.)</span><strong>{money(projection)}</strong><div><i style={{width:`${Math.min(100,Math.max(3,50+change))}%`}}/></div></div><button onClick={()=>openPosition(item)}>Registrar posição mensal</button></article>})}{!items.length&&<EmptyState text="Nenhum investimento cadastrado."/>}</div>
    {position&&<Modal title="Registrar posição mensal" close={()=>setPosition(null)}><form className="form" onSubmit={savePosition}><p className="modal-context">Informe o saldo atual mostrado pelo banco para acompanhar a evolução real de {position.name}.</p><label>Valor atual<input value={positionValue} onChange={e=>setPositionValue(e.target.value)} inputMode="decimal" placeholder="0,00" required/></label><button className="primary submit">Atualizar evolução</button></form></Modal>}
  </div>
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

function Transactions({ rows, open, onEdit }) {
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
            <button aria-label={r.editable===false?"Gerenciado pelo módulo de origem":"Editar movimentação"} disabled={r.editable===false} onClick={()=>onEdit?.(r)} title={r.editable===false?"Edite no módulo de origem":"Editar movimentação"}>
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
function UnifiedMovements({owner,baseRows,open,notify,refresh}){
  const[linked,setLinked]=useState([]),[editing,setEditing]=useState(null),[editValue,setEditValue]=useState("");
  useEffect(()=>{(async()=>{const[{data:o},{data:p}]=await Promise.all([supabase.from("obligations").select("*").eq("owner_id",owner.id).neq("status","cancelled"),supabase.from("card_purchases").select("*,cards(name)").eq("owner_id",owner.id)]);setLinked([...(o||[]).map(x=>({id:`o-${x.id}`,name:`${x.counterparty_name} · ${x.description}`,cat:x.direction==='receivable'?'Me devem':'Eu devo',value:Number(x.installment_amount||x.remaining_amount),date:x.next_due_date?new Date(x.next_due_date+'T12:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}):'Sem data',type:x.direction==='receivable'?'in':'out',status:x.status==='paid'?'Quitado':`Parcela ${Math.min((x.paid_installments||0)+1,x.installments||1)}/${x.installments||1}`,editable:false})),...(p||[]).map(x=>({id:`p-${x.id}`,name:`${x.cards?.name} · ${x.description}`,cat:`Cartão · ${x.purchased_by}`,value:Number(x.installment_amount),date:new Date(x.first_due_date+'T12:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}),type:'out',status:x.status==='paid'?'Pago':`Parcela ${Math.min(x.paid_installments+1,x.installment_count)}/${x.installment_count}`,editable:false}))])})()},[owner.id]);
  async function beginEdit(row){const{data,error}=await supabase.from("transactions").select("*").eq("id",row.id).eq("owner_id",owner.id).single();if(error)return notify("Não foi possível abrir esta movimentação.");setEditing(data);setEditValue(Number(data.total_amount||data.amount).toFixed(2).replace(".",","))}
  async function saveEdit(e){e.preventDefault();const form=new FormData(e.currentTarget),value=parseBRNumber(editValue);if(!Number.isFinite(value)||value<=0)return notify("Informe um valor válido.");const recurring=form.get("recurring")==="on",status=form.get("status"),{error}=await supabase.from("transactions").update({name:form.get("name"),category:form.get("category"),total_amount:value,amount:value,installment_amount:value,transaction_date:form.get("date"),status,is_recurring:recurring,recurrence_active:recurring&&!['paid','received','cancelled'].includes(status),recurrence_day:recurring?Number(form.get("recurrence_day")):null,notes:form.get("notes")}).eq("id",editing.id).eq("owner_id",owner.id);if(error)return notify("Não foi possível atualizar a movimentação.");setEditing(null);await refresh();notify("Movimentação atualizada.")}
  async function remove(){const{error}=await supabase.from("transactions").delete().eq("id",editing.id).eq("owner_id",owner.id);if(error)return notify("Não foi possível excluir.");setEditing(null);await refresh();notify("Movimentação excluída.")}
  return <><Transactions rows={[...baseRows,...linked]} open={open} onEdit={beginEdit}/>{editing&&<Modal title="Editar movimentação" close={()=>setEditing(null)}><form className="form" onSubmit={saveEdit}><label>Descrição<input name="name" defaultValue={editing.name} required/></label><label>Categoria<input name="category" defaultValue={editing.category} required/></label><div className="fields"><label>Valor<input value={editValue} onChange={e=>setEditValue(e.target.value)} inputMode="decimal" required/></label><label>Data<input name="date" type="date" defaultValue={editing.transaction_date} required/></label></div><label>Status<select name="status" defaultValue={editing.status}><option value="pending">Pendente</option><option value={editing.transaction_type==='income'?"received":"paid"}>{editing.transaction_type==='income'?"Recebido":"Pago"}</option><option value="overdue">Vencido</option><option value="cancelled">Cancelado</option></select></label><label className="installment-toggle"><input name="recurring" type="checkbox" defaultChecked={editing.is_recurring}/>Movimentação recorrente mensal</label><label>Dia do vencimento mensal<input name="recurrence_day" type="number" min="1" max="31" defaultValue={editing.recurrence_day||new Date(editing.transaction_date+'T12:00').getDate()}/></label><label>Observações<textarea name="notes" defaultValue={editing.notes||""}/></label><div className="movement-editor-actions"><button type="button" className="danger-text" onClick={remove}>Excluir movimentação</button><button type="button" onClick={()=>setEditing(null)}>Cancelar</button><button className="primary">Salvar alterações</button></div></form></Modal>}</>}

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
    [fields, setFields] = useState([
      {id:"cliente",name:"Cliente",type:"text",required:true,enabled:true},
      {id:"valor",name:"Valor",type:"number",required:true,enabled:true},
      {id:"data",name:"Data",type:"date",required:true,enabled:true},
      {id:"status",name:"Status",type:"text",required:false,enabled:true},
      {id:"quilometragem",name:"Quilometragem",type:"number",required:false,enabled:true},
    ]),
    [customField,setCustomField]=useState(""),
    [automationDraft,setAutomationDraft]=useState(null),
    [automations,setAutomations]=useState([]),
    [financial,setFinancial]=useState({enabled:true,direction:"income",valueFieldId:"valor",dateFieldId:"data",descriptionFieldId:"cliente",alertEnabled:true,daysBefore:3});
  const inferType=(value)=>/telefone|whatsapp|celular/i.test(value)?"tel":/e-mail|email/i.test(value)?"email":/valor|preço|quantidade|km|quilometragem/i.test(value)?"number":/data|vencimento/i.test(value)?"date":"text";
  const addField=(fieldName,type=inferType(fieldName))=>{const clean=fieldName.trim();if(!clean||fields.some(f=>f.name.toLocaleLowerCase("pt-BR")===clean.toLocaleLowerCase("pt-BR")))return;setFields(v=>[...v,{id:`campo_${Date.now()}`,name:clean,type,required:false,enabled:true}])};
  function interpretRequest(){const value=customField.trim();if(!value)return;if(/whats|mensagem|cobrar/i.test(value)){let phone=fields.find(f=>f.type==="tel"||/telefone|whats|celular/i.test(f.name));if(!phone){phone={id:`campo_${Date.now()}`,name:"Telefone/WhatsApp",type:"tel",required:true,enabled:true};setFields(v=>[...v,phone])}setAutomationDraft({kind:"whatsapp",name:"Enviar WhatsApp",trigger:/ap[oó]s|salvar|cadastrar/i.test(value)?"after_save":"manual",phoneField:phone.name,message:"Olá {Cliente}, seguem as informações do seu registro: {Resumo}."});setCustomField("");return}if(/alerta|lembrete|avisar|vencimento/i.test(value)){let date=fields.find(f=>f.type==="date");if(!date){date={id:`campo_${Date.now()}`,name:"Data de vencimento",type:"date",required:true,enabled:true};setFields(v=>[...v,date])}setAutomationDraft({kind:"reminder",name:"Lembrete de vencimento",dateField:date.name,daysBefore:3,message:"Você possui um compromisso próximo do vencimento."});setCustomField("");return}addField(value);setCustomField("")}
  function saveAutomation(){if(!automationDraft)return;setAutomations(v=>[...v,{...automationDraft,id:`regra_${Date.now()}`}]);setAutomationDraft(null)}
  const updateField=(id,changes)=>setFields(v=>v.map(f=>f.id===id?{...f,...changes}:f));
  async function finish() {
    const activeFields=fields.filter(x=>x.enabled),fieldName=id=>activeFields.find(f=>f.id===id)?.name||"";
    if(financial.enabled&&!fieldName(financial.valueFieldId))return notify("Selecione um campo numérico para o valor financeiro.");
    if(financial.enabled&&financial.alertEnabled&&!fieldName(financial.dateFieldId))return notify("Selecione um campo de data para o alerta de vencimento.");
    const schemaFields=activeFields.map(({name,type,required,options})=>({name,type,required,...(options?{options}:{})}));
    if(financial.enabled&&financial.direction==="both"&&!schemaFields.some(f=>f.name==="Tipo financeiro"))schemaFields.push({name:"Tipo financeiro",type:"select",required:true,options:["Recebimento","Pagamento"]});
    const { data, error } = await supabase
      .from("custom_modules")
      .insert({
        owner_id: owner.id,
        name: name || "Nova função",
        field_schema: schemaFields,
        automation_schema: automations,
        financial_schema: financial.enabled?{enabled:true,direction:financial.direction,valueField:fieldName(financial.valueFieldId),dateField:fieldName(financial.dateFieldId),descriptionField:fieldName(financial.descriptionFieldId),directionField:financial.direction==="both"?"Tipo financeiro":null,alertEnabled:financial.alertEnabled,daysBefore:Number(financial.daysBefore||0)}:{enabled:false},
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
            <p className="builder-help">Edite o nome, o tipo e a obrigatoriedade de cada informação.</p>
            <div className="field-editor-list">{fields.map(field=><div className={`field-editor ${field.enabled?"":"disabled"}`} key={field.id}><label className="field-enabled"><input type="checkbox" checked={field.enabled} onChange={e=>updateField(field.id,{enabled:e.target.checked})}/><span><Check/></span></label><input value={field.name} onChange={e=>updateField(field.id,{name:e.target.value})} aria-label="Nome do campo"/><select value={field.type} onChange={e=>updateField(field.id,{type:e.target.value})} aria-label="Tipo do campo"><option value="text">Texto</option><option value="number">Número/valor</option><option value="date">Data</option><option value="tel">Telefone</option><option value="email">E-mail</option><option value="textarea">Texto longo</option></select><label className="required-toggle"><input type="checkbox" checked={field.required} onChange={e=>updateField(field.id,{required:e.target.checked})}/>Obrigatório</label><button className="remove-field" onClick={()=>setFields(v=>v.filter(f=>f.id!==field.id))} aria-label={`Remover ${field.name}`}><X/></button></div>)}</div>
            <div className="smart-field-add"><div><Sparkles/><span><strong>Adicionar campo ou ação</strong><small>Ex.: Telefone, data de entrega, enviar WhatsApp após salvar</small></span></div><div><input value={customField} onChange={e=>setCustomField(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();interpretRequest()}}} placeholder="Descreva o que deseja criar"/><button onClick={interpretRequest}><Plus/>Analisar e adicionar</button></div></div>
            {automationDraft?.kind==="whatsapp"&&<div className="automation-builder"><div className="automation-title"><Send/><div><strong>Configurar envio pelo WhatsApp</strong><small>Responda às perguntas para criar a ação corretamente.</small></div></div><label>Quando deseja executar?<select value={automationDraft.trigger} onChange={e=>setAutomationDraft(v=>({...v,trigger:e.target.value}))}><option value="manual">Ao clicar em um botão no registro</option><option value="after_save">Logo após salvar o registro</option></select></label><label>Qual campo contém o WhatsApp?<select value={automationDraft.phoneField} onChange={e=>setAutomationDraft(v=>({...v,phoneField:e.target.value}))}>{fields.filter(f=>f.enabled).map(f=><option key={f.id}>{f.name}</option>)}</select></label><label>Qual mensagem será enviada?<textarea value={automationDraft.message} onChange={e=>setAutomationDraft(v=>({...v,message:e.target.value}))}/><small>Use nomes entre chaves, como {'{Cliente}'} e {'{Valor}'}. Use {'{Resumo}'} para reunir todos os campos.</small></label><div className="automation-actions"><button onClick={()=>setAutomationDraft(null)}>Cancelar</button><button className="primary" onClick={saveAutomation}>Criar ação</button></div></div>}
            {automationDraft?.kind==="reminder"&&<div className="automation-builder"><div className="automation-title"><Bell/><div><strong>Configurar lembrete</strong><small>Defina quando o aplicativo deverá avisar.</small></div></div><label>Campo usado como data<select value={automationDraft.dateField} onChange={e=>setAutomationDraft(v=>({...v,dateField:e.target.value}))}>{fields.filter(f=>f.enabled&&f.type==="date").map(f=><option key={f.id}>{f.name}</option>)}</select></label><label>Quantos dias antes?<input type="number" min="0" max="365" value={automationDraft.daysBefore} onChange={e=>setAutomationDraft(v=>({...v,daysBefore:Number(e.target.value)}))}/></label><label>Texto do lembrete<textarea value={automationDraft.message} onChange={e=>setAutomationDraft(v=>({...v,message:e.target.value}))}/></label><div className="automation-actions"><button onClick={()=>setAutomationDraft(null)}>Cancelar</button><button className="primary" onClick={saveAutomation}>Criar regra</button></div></div>}
            {!!automations.length&&<div className="created-automations"><strong>Ações e regras criadas</strong>{automations.map(a=><span key={a.id}>{a.kind==="whatsapp"?<Send/>:<Bell/>}{a.name}<button onClick={()=>setAutomations(v=>v.filter(x=>x.id!==a.id))}><X/></button></span>)}</div>}
            <div className="financial-builder"><div className="automation-title"><Landmark/><div><strong>Integração financeira</strong><small>Defina como os registros deste botão entrarão no Finance Hub.</small></div></div><label className="financial-enabled"><input type="checkbox" checked={financial.enabled} onChange={e=>setFinancial(v=>({...v,enabled:e.target.checked}))}/><span><Check/></span>Este módulo registra movimentações financeiras</label>{financial.enabled&&<div className="financial-questions"><label>Qual tipo de movimentação?<select value={financial.direction} onChange={e=>setFinancial(v=>({...v,direction:e.target.value}))}><option value="income">Recebimento</option><option value="expense">Pagamento</option><option value="both">Perguntar em cada novo registro</option></select></label><label>Qual campo contém o valor?<select value={financial.valueFieldId} onChange={e=>setFinancial(v=>({...v,valueFieldId:e.target.value}))}>{fields.filter(f=>f.enabled&&f.type==="number").map(f=><option value={f.id} key={f.id}>{f.name}</option>)}</select></label><label>Qual campo contém a data ou vencimento?<select value={financial.dateFieldId} onChange={e=>setFinancial(v=>({...v,dateFieldId:e.target.value}))}>{fields.filter(f=>f.enabled&&f.type==="date").map(f=><option value={f.id} key={f.id}>{f.name}</option>)}</select></label><label>Qual campo identifica o registro?<select value={financial.descriptionFieldId} onChange={e=>setFinancial(v=>({...v,descriptionFieldId:e.target.value}))}>{fields.filter(f=>f.enabled).map(f=><option value={f.id} key={f.id}>{f.name}</option>)}</select></label><label className="financial-enabled"><input type="checkbox" checked={financial.alertEnabled} onChange={e=>setFinancial(v=>({...v,alertEnabled:e.target.checked}))}/><span><Check/></span>Criar alerta de vencimento</label>{financial.alertEnabled&&<label>Alertar quantos dias antes?<input type="number" min="0" max="365" value={financial.daysBefore} onChange={e=>setFinancial(v=>({...v,daysBefore:Number(e.target.value)}))}/></label>}</div>}</div>
          </>
        )}
        {step === 3 && (
          <div className="success">
            <Sparkles />
            <h3>Seu módulo está pronto!</h3>
            <p>“{name}” terá {fields.filter(f=>f.enabled).length} campos, {automations.length} ações/regras e {financial.enabled?"integração financeira":"nenhuma movimentação financeira"}.</p>
          </div>
        )}
        <div className="form-navigation"><button onClick={()=>step>1?setStep(step-1):onCancel()}>{step>1?'Voltar':'Cancelar'}</button><button className="primary" disabled={step === 1 && !name.trim()} onClick={() => (step < 3 ? setStep(step + 1) : finish())}>{step < 3 ? "Continuar" : "Criar função"}<ChevronRight /></button></div>
      </div>
    </div>
  );
}

function CustomModulePage({owner,module,notify}){
  const[entries,setEntries]=useState([]),[open,setOpen]=useState(false);
  async function load(){if(!module)return;const{data}=await supabase.from("custom_module_entries").select("*").eq("owner_id",owner.id).eq("module_id",module.id).order("created_at",{ascending:false});setEntries(data||[])}
  useEffect(()=>{load()},[module?.id]);
  if(!module)return <EmptyState text="Função não encontrada."/>;
  const fields=(Array.isArray(module.field_schema)?module.field_schema:[]).filter(f=>f.enabled!==false),automations=Array.isArray(module.automation_schema)?module.automation_schema:[],financial=module.financial_schema||{enabled:false};
  const entryState=entry=>{const finance=entry.data?._finance;if(finance?.status==="paid")return"paid";const due=finance?.dueDate||(financial.dateField&&entry.data?.[financial.dateField]);return due&&new Date(due+"T23:59:59")<new Date()?"overdue":"pending"},statusLabel=entry=>entryState(entry)==="paid"?(entry.data?._finance?.direction==="income"?"RECEBIDO":"PAGO"):entryState(entry)==="overdue"?"VENCIDO":"PENDENTE",statusCounts=entries.reduce((result,entry)=>{result[entryState(entry)]++;return result},{pending:0,overdue:0,paid:0});
  function whatsappUrl(data,rule){const summary=fields.map(f=>`${f.name}: ${data[f.name]||"—"}`).join("\n"),message=String(rule.message||"").replace(/\{Resumo\}/gi,summary).replace(/\{([^}]+)\}/g,(_,key)=>data[key]||`{${key}}`),phone=String(data[rule.phoneField]||"").replace(/\D/g,"");return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`}
  function runWhatsApp(data,rule){const phone=String(data[rule.phoneField]||"").replace(/\D/g,"");if(!phone)return notify(`Preencha o campo ${rule.phoneField} para enviar.`);window.open(whatsappUrl(data,rule),"_blank")}
  function reminderFor(entry){const rule=financial.enabled&&financial.alertEnabled?{dateField:financial.dateField,daysBefore:financial.daysBefore}:automations.find(a=>a.kind==="reminder");if(!rule||!entry.data?.[rule.dateField]||entry.data?._finance?.status==="paid")return null;const days=Math.ceil((new Date(entry.data[rule.dateField]+"T12:00")-new Date())/86400000);return days<=Number(rule.daysBefore)&&days>=0?`${days===0?"Vence hoje":`Vence em ${days} dia(s)`}`:days<0?`Vencido há ${Math.abs(days)} dia(s)`:null}
  async function add(e){
    e.preventDefault();
    const form=new FormData(e.currentTarget),data={};fields.forEach(field=>data[field.name]=form.get(field.name));
    let transactionId=null,obligationId=null;
    if(financial.enabled){
      const amount=parseBRNumber(data[financial.valueField]);
      if(!Number.isFinite(amount)||amount<=0)return notify("Informe um valor válido, por exemplo 55,90.");
      const direction=financial.direction==="both"?(data[financial.directionField]==="Pagamento"?"expense":"income"):financial.direction;
      const date=data[financial.dateField]||new Date().toISOString().slice(0,10),description=data[financial.descriptionField]||module.name;
      const{data:transaction,error:transactionError}=await supabase.from("transactions").insert({owner_id:owner.id,name:`${module.name}: ${description}`,category:module.name,amount,total_amount:amount,installment_amount:amount,transaction_type:direction,transaction_date:date,status:"pending",is_installment:false,installment_count:1,installment_number:1,notes:`Criado pela função ${module.name}`}).select("id").single();
      if(transactionError)return notify("Não foi possível criar a movimentação financeira.");
      transactionId=transaction.id;
      if(financial.alertEnabled){
        const{data:obligation,error:obligationError}=await supabase.from("obligations").insert({owner_id:owner.id,direction:direction==="income"?"receivable":"payable",counterparty_name:String(description),description:`${module.name}: ${description}`,category:module.name,total_amount:amount,remaining_amount:amount,installment_amount:amount,installments:1,next_due_date:date,status:"open",notes:`Criado pela função ${module.name}`}).select("id").single();
        if(obligationError){await supabase.from("transactions").delete().eq("id",transactionId).eq("owner_id",owner.id);return notify("Não foi possível criar o alerta de vencimento.")}
        obligationId=obligation.id;
      }
      data._finance={direction,amount,status:"pending",transactionId,obligationId,dueDate:date,daysBefore:Number(financial.daysBefore||0)};
    }
    const{error}=await supabase.from("custom_module_entries").insert({owner_id:owner.id,module_id:module.id,data});
    if(error){if(obligationId)await supabase.from("obligations").delete().eq("id",obligationId).eq("owner_id",owner.id);if(transactionId)await supabase.from("transactions").delete().eq("id",transactionId).eq("owner_id",owner.id);return notify("Não foi possível salvar o registro.")}
    setOpen(false);await load();window.dispatchEvent(new Event("finance-data-changed"));notify(financial.enabled?"Registro financeiro sincronizado com o saldo.":"Registro salvo na função.");const automatic=automations.find(a=>a.kind==="whatsapp"&&a.trigger==="after_save");if(automatic)runWhatsApp(data,automatic)
  }
  async function settle(entry){const finance=entry.data?._finance;if(!finance||finance.status==="paid")return;const status=finance.direction==="income"?"received":"paid";const results=await Promise.all([supabase.from("transactions").update({status}).eq("id",finance.transactionId).eq("owner_id",owner.id),finance.obligationId?supabase.from("obligations").update({status:"paid",remaining_amount:0,paid_installments:1}).eq("id",finance.obligationId).eq("owner_id",owner.id):Promise.resolve({error:null}),supabase.from("custom_module_entries").update({data:{...entry.data,_finance:{...finance,status:"paid"}}}).eq("id",entry.id).eq("owner_id",owner.id)]);if(results.some(result=>result.error))return notify("Não foi possível concluir esta baixa.");await load();window.dispatchEvent(new Event("finance-data-changed"));notify(finance.direction==="income"?"Recebimento confirmado.":"Pagamento confirmado.")}
  const inputFor=field=>field.type==="textarea"?<textarea name={field.name} required={field.required}/>:field.type==="select"?<select name={field.name} required={field.required}><option value="">Selecione</option>{(field.options||[]).map(option=><option key={option}>{option}</option>)}</select>:field.type==="number"?<input name={field.name} type="text" inputMode="decimal" placeholder="0,00" pattern="[0-9.]+([,][0-9]{1,2})?|[0-9]+([.][0-9]{1,2})?" required={field.required}/>:<input name={field.name} type={field.type||"text"} required={field.required}/>;
  return <div className="custom-module-page"><div className="page-head"><div><h2>{module.name}</h2><p>Tela criada automaticamente com campos, ações e regras personalizadas.</p></div><button className="primary" onClick={()=>setOpen(true)}><Plus/>Novo registro</button></div>{financial.enabled&&<div className="module-status-report"><div><small>Pendentes</small><strong>{statusCounts.pending}</strong></div><div className="overdue"><small>Vencidos</small><strong>{statusCounts.overdue}</strong><span>Continuam visíveis até a quitação</span></div><div className="paid"><small>Quitados</small><strong>{statusCounts.paid}</strong></div></div>}{open&&<form className="inline-form" onSubmit={add}>{fields.map(field=><label key={field.name}>{field.name}{inputFor(field)}</label>)}<div className="form-actions"><button type="button" onClick={()=>setOpen(false)}>Cancelar</button><button className="primary">Salvar registro</button></div></form>}<div className="page-panel custom-records-panel"><div className="panel-title"><div><h2>Registros</h2><p>{entries.length} cadastro(s) nesta função</p></div></div><div className="dynamic-table custom-record-grid">{entries.map(entry=><article className={`dynamic-row custom-entry state-${entryState(entry)}`} key={entry.id}><div className="custom-entry-head"><span className="custom-entry-avatar">{String(entry.data?.[financial.descriptionField]||entry.data?.[fields[0]?.name]||module.name).charAt(0).toUpperCase()}</span><div><small>{financial.descriptionField||fields[0]?.name||"Registro"}</small><h3>{entry.data?.[financial.descriptionField]||entry.data?.[fields[0]?.name]||"Registro"}</h3></div><i className={`entry-status ${entryState(entry)}`}>{statusLabel(entry)}</i></div><div className="custom-entry-fields">{fields.filter(field=>field.name!==financial.descriptionField&&!/^status$/i.test(field.name)).map(field=><span className={field.name===financial.valueField?"value-field":""} key={field.name}><small>{field.name}</small><strong>{field.name===financial.valueField&&Number.isFinite(parseBRNumber(entry.data?.[field.name]))?money(parseBRNumber(entry.data?.[field.name])):entry.data?.[field.name]||"—"}</strong></span>)}</div>{reminderFor(entry)&&<i className="entry-reminder"><Bell/>{reminderFor(entry)}</i>}<div className="entry-actions">{entry.data?._finance&&<button className="finance-action" disabled={entry.data._finance.status==="paid"} onClick={()=>settle(entry)}><Check/>{entry.data._finance.status==="paid"?(entry.data._finance.direction==="income"?"Recebido":"Pago"):(entry.data._finance.direction==="income"?"Receber":"Pagar")}</button>}{automations.filter(a=>a.kind==="whatsapp"&&a.trigger==="manual").map(rule=><button key={rule.id} onClick={()=>runWhatsApp(entry.data,rule)}><Send/>{rule.name}</button>)}</div></article>)}{!entries.length&&<EmptyState text="Nenhum registro nesta função."/>}</div></div></div>
}

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
    [sharing,setSharing]=useState(false),
    cardRef = useRef(null),
    captureRef=useRef(null);
  const month = new Date().toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    }),
    openItems = group.items.filter((x) => x.status !== "paid");
  const chargeText = () => `Olá, ${group.name}! Segue o resumo das despesas de ${month}:\n${openItems.map((x) => `• ${x.description} — parcela ${(x.paid_installments || 0) + 1}/${x.installments || 1}: ${money(Number(x.installment_amount || x.remaining_amount))}`).join("\n")}\n\nTotal deste mês: ${money(group.monthly)}\nSaldo total pendente: ${money(group.total)}`;
  function openWhatsApp(){
    if(!group.phone)return notify("Cadastre o WhatsApp do devedor para enviar a cobrança.");
    if(!openItems.length)return notify("Não existem valores pendentes para cobrar.");
    window.open(`https://wa.me/${String(group.phone).replace(/\D/g,"")}?text=${encodeURIComponent(chargeText())}`,"_blank");
  }
  async function downloadCharge() {
    if(sharing)return;
    setSharing(true);
    if(!expanded){setExpanded(true);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))}
    const safeName=group.key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(captureRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });
      const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
      if(!blob)throw new Error("Não foi possível gerar a imagem.");
      const link = document.createElement("a");
      link.download = `cobranca-${safeName}.png`;
      link.href = URL.createObjectURL(blob);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 5000);
      notify("Print da cobrança salvo no dispositivo.");
    } catch(error) {
      console.error("Falha ao gerar cobrança",error);
      notify("Não foi possível gerar o print. Tente novamente.");
    }finally{
      setSharing(false);
    }
  }
  return (
    <div className="debt-card debtor-group" ref={cardRef} data-charge-card={group.key}>
      <div className="charge-export-stage" aria-hidden="true"><div className="charge-export-card" ref={captureRef}><div className="charge-export-title"><FileText/><strong>Resumo de Débitos</strong></div><div className="charge-export-client"><b>Cliente:</b><span>{group.name}</span></div><div className="charge-export-items">{openItems.map(item=><div className="charge-export-line" key={item.id}><div><strong>{item.description}</strong><small>({item.next_due_date?new Date(item.next_due_date+"T12:00").toLocaleDateString("pt-BR"):"Sem vencimento"})</small></div><b>{money(Number(item.remaining_amount||item.installment_amount||0))}</b></div>)}</div><div className="charge-export-total"><span>VALOR TOTAL EM ABERTO</span><strong>{money(group.total)}</strong></div><small className="charge-export-date">Resumo gerado em {new Date().toLocaleDateString("pt-BR")}</small></div></div>
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
          <><button className="charge-print" disabled={!openItems.length||sharing} onClick={downloadCharge}><Download/>{sharing?"Gerando print…":"Baixar print"}</button><button className="whatsapp" disabled={!group.phone||!openItems.length} onClick={openWhatsApp}><Send/>Enviar WhatsApp</button></>
        )}
      </div>
    </div>
  );
}

function nextCardDue(card){if(!card)return"";const now=new Date(),target=new Date(now.getFullYear(),now.getMonth()+(now.getDate()>card.due_day?1:0),1),last=new Date(target.getFullYear(),target.getMonth()+1,0).getDate();target.setDate(Math.min(card.due_day,last));return `${target.getFullYear()}-${String(target.getMonth()+1).padStart(2,"0")}-${String(target.getDate()).padStart(2,"0")}`}
function bankLogo(bank){const key=normalizeText(bank),domains=[["inter","inter.co"],["neon","neon.com.br"],["santander","santander.com.br"],["nubank","nubank.com.br"],["itau","itau.com.br"],["bradesco","bradesco.com.br"],["caixa","caixa.gov.br"],["bancodobrasil","bb.com.br"],["c6","c6bank.com.br"],["picpay","picpay.com"],["mercadopago","mercadopago.com.br"]],found=domains.find(([name])=>key.includes(name));return found?`https://www.google.com/s2/favicons?domain=${found[1]}&sz=128`:null}
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
        logo_url: bankLogo(f.get("bank")),
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
            {c.logo_url?<img className="card-bank-logo" src={c.logo_url} alt={`Logo ${c.bank}`} onError={e=>e.currentTarget.style.display="none"}/>:<CreditCard />}
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
    [viewDate,setViewDate]=useState(()=>{const d=new Date();return new Date(d.getFullYear(),d.getMonth(),1)}),
    year = viewDate.getFullYear(),
    month = viewDate.getMonth(),
    leading = new Date(year,month,1).getDay(),
    days = Array.from(
      { length: new Date(year, month + 1, 0).getDate() },
      (_, i) => i + 1,
    );
  const changeMonth=(amount)=>setViewDate(d=>new Date(d.getFullYear(),d.getMonth()+amount,1));
  useEffect(() => {
    (async () => {
      const start = new Date(year, month, 1).toISOString().slice(0, 10),
        end = new Date(year, month + 1, 0).toISOString().slice(0, 10);
      const [{ data: obligations }, { data: purchases }, {data:transactions}, {data:subscriptions}] = await Promise.all([
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
        supabase.from("transactions").select("*").eq("owner_id",owner.id).lte("transaction_date",end).neq("status","cancelled"),
        supabase.from("subscriptions").select("*").eq("owner_id",owner.id).eq("active",true),
      ]);
      setEvents([
        ...(obligations || []).map((x) => ({
          id: x.id,
          day: Number(x.next_due_date.slice(8, 10)),
          type: x.direction === "receivable" ? "in" : "out",
          label: `${x.counterparty_name}: ${money(Number(x.installment_amount))}`,
        })),
        ...(purchases || []).flatMap((x) => {const first=new Date(x.first_due_date+"T12:00"),elapsed=(year-first.getFullYear())*12+month-first.getMonth(),installment=elapsed+1;if(elapsed<0||installment>x.installment_count||installment<=Number(x.paid_installments||0))return[];const last=new Date(year,month+1,0).getDate();return [{
          id: `cartao-${x.id}-${year}-${month}`,
          day: Math.min(first.getDate(),last),
          type: "out",
          label: `${x.cards?.name || "Cartão"} · ${installment}/${x.installment_count}: ${money(Number(x.installment_amount))}`,
        }]}),
        ...(transactions||[]).flatMap(x=>{const first=new Date(x.transaction_date+"T12:00"),elapsed=(year-first.getFullYear())*12+month-first.getMonth();if(x.is_recurring&&x.recurrence_active){if(elapsed<0||(x.recurrence_end_date&&x.recurrence_end_date<start))return[];return[{id:`mov-rec-${x.id}-${year}-${month}`,day:Math.min(Number(x.recurrence_day||first.getDate()),new Date(year,month+1,0).getDate()),type:x.transaction_type==="income"?"in":"out",label:`${x.name} · recorrente`}]}if(x.is_installment){if(elapsed<0||elapsed>=Number(x.installment_count||1))return[];return[{id:`mov-${x.id}-${elapsed}`,day:first.getDate(),type:x.transaction_type==="income"?"in":"out",label:`${x.name} · ${elapsed+1}/${x.installment_count}`}]}if(x.transaction_date<start||x.transaction_date>end)return[];return[{id:`mov-${x.id}`,day:first.getDate(),type:x.transaction_type==="income"?"in":"out",label:x.name}]}),
        ...(subscriptions||[]).map(x=>({id:`assinatura-${x.id}-${year}-${month}`,day:Math.min(Number(x.due_day||1),new Date(year,month+1,0).getDate()),type:"out",label:`${x.name}: ${money(Number(x.amount))}`})),
      ]);
    })();
  }, [owner.id, year, month]);
  return (
    <div className="page-panel">
      <div className="page-head">
        <div>
          <h2>Calendário financeiro</h2>
          <p className="calendar-month">{viewDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p>
        </div>
        <div className="calendar-navigation"><button onClick={()=>changeMonth(-1)} aria-label="Mês anterior"><ChevronRight/></button><button onClick={()=>{const d=new Date();setViewDate(new Date(d.getFullYear(),d.getMonth(),1))}}>Mês atual</button><button onClick={()=>changeMonth(1)} aria-label="Próximo mês"><ChevronRight/></button></div>
      </div>
      <div className="calendar-weekdays">{["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map(x=><span key={x}>{x}</span>)}</div>
      <div className="calendar-grid">
        {Array.from({length:leading},(_,i)=><div className="calendar-day empty" key={`vazio-${i}`}/>) }
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
function FinancialIntelligence({owner,tx,notify,refresh,ask}){
  const[tab,setTab]=useState("visao"),[goals,setGoals]=useState([]),[goalOpen,setGoalOpen]=useState(false),[editingGoal,setEditingGoal]=useState(null),[simulation,setSimulation]=useState(null);
  async function load(){const{data}=await supabase.from("financial_goals").select("*").eq("owner_id",owner.id).neq("status","cancelled").order("target_date");setGoals(data||[])}
  useEffect(()=>{load()},[owner.id]);
  const flagged=tx.filter(item=>item.duplicateStatus==="pending"),classified=tx.filter(item=>item.classificationSource==="rules"||item.classificationSource==="gemini"),now=new Date(),thisKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`,previous=new Date(now.getFullYear(),now.getMonth()-1,1),previousKey=`${previous.getFullYear()}-${String(previous.getMonth()+1).padStart(2,"0")}`;
  const monthTotals=key=>tx.filter(item=>String(item.rawDate||"").startsWith(key)).reduce((acc,item)=>{acc[item.type]+=Number(item.value);return acc},{in:0,out:0}),current=monthTotals(thisKey),prior=monthTotals(previousKey),difference=current.in-current.out-(prior.in-prior.out);
  async function reviewDuplicate(item,status){const{error}=await supabase.from("transactions").update({duplicate_review_status:status}).eq("id",item.id).eq("owner_id",owner.id);if(error)return notify("Não foi possível registrar a revisão.");await refresh();notify(status==="dismissed"?"Alerta descartado.":"Duplicidade confirmada; o lançamento foi mantido para sua decisão.")}
  async function saveGoal(e){e.preventDefault();const f=new FormData(e.currentTarget),target=parseBRNumber(f.get("target")),currentAmount=parseBRNumber(f.get("current"))||0;if(!Number.isFinite(target)||target<=0)return notify("Informe um valor de meta válido.");if(currentAmount<0)return notify("O valor reservado não pode ser negativo.");const payload={name:String(f.get("name")||"").trim(),target_amount:target,current_amount:Math.min(currentAmount,target),target_date:f.get("date"),priority:f.get("priority"),notes:f.get("notes")||null,status:currentAmount>=target?"completed":"active",updated_at:new Date().toISOString()},query=editingGoal?supabase.from("financial_goals").update(payload).eq("id",editingGoal.id).eq("owner_id",owner.id):supabase.from("financial_goals").insert({...payload,owner_id:owner.id}),{error}=await query;if(error)return notify(editingGoal?"Não foi possível atualizar a meta.":"Não foi possível salvar a meta.");const wasEditing=Boolean(editingGoal);setGoalOpen(false);setEditingGoal(null);await load();notify(wasEditing?"Meta atualizada com sucesso.":"Meta financeira criada.")}function openNewGoal(){setEditingGoal(null);setGoalOpen(true)}function openEditGoal(goal){setEditingGoal(goal);setGoalOpen(true)}function closeGoalForm(){setGoalOpen(false);setEditingGoal(null)}async function deleteGoal(){if(!editingGoal)return;const accepted=await ask({kind:"confirm",tone:"danger",title:"Excluir meta?",message:`A meta “${editingGoal.name}” será excluída permanentemente. Esta ação não poderá ser desfeita.`,confirmLabel:"Excluir meta"});if(!accepted)return;const{error}=await supabase.from("financial_goals").delete().eq("id",editingGoal.id).eq("owner_id",owner.id);if(error)return notify("Não foi possível excluir a meta.");closeGoalForm();await load();notify("Meta excluída com sucesso.")}
  async function contribute(goal){const value=await ask({kind:"input",title:"Adicionar progresso à meta",message:`Informe quanto foi reservado para “${goal.name}”.`,value:"",confirmLabel:"Adicionar à meta"});if(value==null)return;const amount=parseBRNumber(value);if(!Number.isFinite(amount)||amount<=0)return notify("Informe um valor válido.");const next=Math.min(Number(goal.target_amount),Number(goal.current_amount)+amount),{error}=await supabase.from("financial_goals").update({current_amount:next,status:next>=Number(goal.target_amount)?"completed":"active",updated_at:new Date().toISOString()}).eq("id",goal.id).eq("owner_id",owner.id);if(error)return notify("Não foi possível atualizar a meta.");await load();notify(next>=Number(goal.target_amount)?"Parabéns! Meta concluída.":"Progresso da meta atualizado.")}
  function simulate(e){e.preventDefault();const f=new FormData(e.currentTarget),principal=parseBRNumber(f.get("balance")),rate=(parseBRNumber(f.get("rate"))||0)/100,payment=parseBRNumber(f.get("payment")),extra=parseBRNumber(f.get("extra"))||0;if(!principal||!payment||payment+extra<=principal*rate)return notify("A parcela precisa ser maior que os juros do mês.");const run=extraValue=>{let balance=principal,months=0,interest=0;while(balance>.01&&months<1200){const fee=balance*rate;interest+=fee;balance=Math.max(0,balance+fee-payment-extraValue);months++}return{months,interest,total:principal+interest}};const base=run(0),accelerated=run(extra);setSimulation({base,accelerated,saved:base.interest-accelerated.interest})}
  const tabs=[["visao","Visão inteligente",BrainCircuit],["duplicidades","Duplicidades",CopyCheck],["quitacao","Quitação",Calculator],["metas","Metas",Target]];
  return <div className="intelligence-page"><div className="page-head"><div><h2>Inteligência financeira</h2><p>Análises seguras para decidir melhor, sem alterar seus dados automaticamente.</p></div><span className="intelligence-badge"><ShieldCheck/>Dados protegidos por RLS</span></div><div className="intelligence-tabs">{tabs.map(([key,label,Icon])=><button key={key} className={tab===key?"active":""} onClick={()=>setTab(key)}><Icon/>{label}{key==="duplicidades"&&flagged.length>0?<b>{flagged.length}</b>:null}</button>)}</div>
  {tab==="visao"&&<><div className="intelligence-summary"><article><Tags/><span><small>Classificação automática</small><strong>{classified.length} lançamento(s)</strong><p>Regras locais; Gemini poderá interpretar descrições ambíguas.</p></span></article><article><CopyCheck/><span><small>Possíveis duplicidades</small><strong>{flagged.length}</strong><p>Mesmo valor, tipo e data próxima exigem sua revisão.</p></span></article><article><CircleDollarSign/><span><small>Resultado comparado</small><strong className={difference>=0?"positive":"negative"}>{difference>=0?"+ ":""}{money(difference)}</strong><p>Diferença do resultado atual contra o mês anterior.</p></span></article><article><Target/><span><small>Metas ativas</small><strong>{goals.filter(g=>g.status==="active").length}</strong><p>Acompanhamento e valor mensal necessário calculados localmente.</p></span></article></div></>}
  {tab==="duplicidades"&&<section className="intelligence-panel"><div className="panel-title"><div><h3>Revisão de duplicidades</h3><p>Nenhum lançamento é apagado automaticamente.</p></div></div>{flagged.map(item=><article className="duplicate-row" key={item.id}><CopyCheck/><div><strong>{item.name}</strong><span>{item.cat} · {item.date}</span></div><b>{money(item.value)}</b><div><button onClick={()=>reviewDuplicate(item,"dismissed")}>Não é duplicado</button><button className="danger-text" onClick={()=>reviewDuplicate(item,"confirmed")}>Confirmar alerta</button></div></article>)}{!flagged.length&&<EmptyState text="Nenhuma possível duplicidade aguardando revisão."/>}</section>}
  {tab==="quitacao"&&<section className="intelligence-panel debt-simulator"><div><h3>Simulação de quitação antecipada</h3><p>Compare prazo e juros usando as condições informadas pelo seu credor.</p></div><form className="inline-form" onSubmit={simulate}><label>Dívida atual<input name="balance" inputMode="decimal" required placeholder="Ex.: 5.000,00"/></label><label>Juros ao mês (%)<input name="rate" inputMode="decimal" required placeholder="Ex.: 2,50"/></label><label>Parcela atual<input name="payment" inputMode="decimal" required placeholder="Ex.: 350,00"/></label><label>Valor extra mensal<input name="extra" inputMode="decimal" placeholder="Ex.: 100,00"/></label><button className="primary"><Calculator/>Simular</button></form>{simulation&&<div className="simulation-result"><span><small>Plano atual</small><strong>{simulation.base.months} meses</strong><b>{money(simulation.base.interest)} em juros</b></span><span><small>Com antecipação</small><strong>{simulation.accelerated.months} meses</strong><b>{money(simulation.accelerated.interest)} em juros</b></span><span className="saving"><small>Economia estimada</small><strong>{money(simulation.saved)}</strong><b>{simulation.base.months-simulation.accelerated.months} meses a menos</b></span></div>}<p className="legal-note">Simulação orientativa. Confirme saldo, juros, encargos e desconto de quitação com o credor.</p></section>}
  {tab==="metas"&&<section className="intelligence-panel"><div className="panel-title"><div><h3>Metas financeiras inteligentes</h3><p>O valor mensal necessário é recalculado conforme prazo e progresso.</p></div><button className="primary" onClick={openNewGoal}><Plus/>Nova meta</button></div>{goalOpen&&<form key={editingGoal?.id||"new-goal"} className="inline-form goal-form" onSubmit={saveGoal}><div className="goal-form-heading wide"><strong>{editingGoal?"Editar meta":"Criar nova meta"}</strong><small>{editingGoal?"Revise os dados e salve as alterações.":"Defina o objetivo e acompanhe sua evolução."}</small></div><label>Nome da meta<input name="name" required defaultValue={editingGoal?.name||""} placeholder="Ex.: Reserva de emergência"/></label><label>Valor desejado<input name="target" inputMode="decimal" required defaultValue={editingGoal?Number(editingGoal.target_amount).toLocaleString("pt-BR",{minimumFractionDigits:2}):""} placeholder="10.000,00"/></label><label>Valor já reservado<input name="current" inputMode="decimal" defaultValue={editingGoal?Number(editingGoal.current_amount).toLocaleString("pt-BR",{minimumFractionDigits:2}):""} placeholder="0,00"/></label><label>Data desejada<input name="date" type="date" required defaultValue={editingGoal?.target_date||""} min={editingGoal?.target_date<new Date().toISOString().slice(0,10)?editingGoal.target_date:new Date().toISOString().slice(0,10)}/></label><label>Prioridade<select name="priority" defaultValue={editingGoal?.priority||"high"}><option value="high">Alta</option><option value="medium">Média</option><option value="low">Baixa</option></select></label><label className="wide">Observações<textarea name="notes" defaultValue={editingGoal?.notes||""}/></label><div className="form-actions">{editingGoal&&<button type="button" className="danger-text goal-delete-button" onClick={deleteGoal}>Excluir meta</button>}<button type="button" onClick={closeGoalForm}>Cancelar</button><button className="primary">{editingGoal?"Salvar alterações":"Salvar meta"}</button></div></form>}<div className="goal-grid">{goals.map(goal=>{const target=Number(goal.target_amount),saved=Number(goal.current_amount),remaining=Math.max(0,target-saved),months=Math.max(1,(new Date(goal.target_date+"T12:00").getFullYear()-now.getFullYear())*12+new Date(goal.target_date+"T12:00").getMonth()-now.getMonth()),monthly=remaining/months,progress=Math.min(100,saved/target*100);return <article key={goal.id}><div><span className={`priority ${goal.priority}`}>{goal.priority==="high"?"Alta prioridade":goal.priority==="medium"?"Média prioridade":"Baixa prioridade"}</span><h3>{goal.name}</h3><small>Até {new Date(goal.target_date+"T12:00").toLocaleDateString("pt-BR")}</small></div><strong>{money(saved)} <small>de {money(target)}</small></strong><div className="goal-progress"><i style={{width:`${progress}%`}}/></div><p>Reserve aproximadamente <b>{money(monthly)} por mês</b>.</p><div className="goal-actions"><button onClick={()=>openEditGoal(goal)}>Editar</button><button className="primary" onClick={()=>contribute(goal)} disabled={goal.status==="completed"}>{goal.status==="completed"?"Meta concluída":"Adicionar progresso"}</button></div></article>})}{!goals.length&&<EmptyState text="Crie sua primeira meta financeira."/>}</div></section>}
  
  </div>
}
function StreamingsModule({owner,notify}){
  const[subscriptions,setSubscriptions]=useState([]),[charges,setCharges]=useState([]),[editing,setEditing]=useState(null),[open,setOpen]=useState(false),[retroOpen,setRetroOpen]=useState(false),[retroSubscriptionId,setRetroSubscriptionId]=useState(""),[shared,setShared]=useState(false),[participants,setParticipants]=useState([{name:"",phone:"",amount:""}]);
  const reference=monthStart(),months=Array.from({length:4},(_,i)=>{const d=new Date();d.setMonth(d.getMonth()-(3-i));return monthStart(d)}),retroSubscription=subscriptions.find(item=>item.id===retroSubscriptionId),retroParticipants=retroSubscription?.participants||[];
  async function load(){const[{data:s},{data:c}]=await Promise.all([supabase.from("subscriptions").select("*").eq("owner_id",owner.id).order("created_at",{ascending:false}),supabase.from("subscription_charges").select("*,subscriptions(name)").eq("owner_id",owner.id).order("reference_month",{ascending:false})]);setSubscriptions(s||[]);setCharges(c||[])}
  useEffect(()=>{load()},[owner.id]);
  function addParticipant(){setParticipants(v=>[...v,{name:"",phone:"",amount:""}])}function updateParticipant(index,key,value){setParticipants(v=>v.map((p,i)=>i===index?{...p,[key]:value}:p))}function removeParticipant(index){setParticipants(v=>v.filter((_,i)=>i!==index))}
  function startEdit(subscription){setEditing(subscription);setShared(subscription.is_shared);setParticipants(subscription.participants?.length?subscription.participants.map(p=>({...p,amount:String(p.amount).replace(".",",")})):[{name:"",phone:"",amount:""}]);setOpen(true)}
  function close(){setOpen(false);setEditing(null);setShared(false);setParticipants([{name:"",phone:"",amount:""}])}
  async function save(e){e.preventDefault();const f=new FormData(e.currentTarget),clean=shared?participants.filter(p=>p.name.trim()).map(p=>({name:p.name.trim(),phone:p.phone.replace(/\D/g,""),amount:parseBRNumber(p.amount)})):[],payload={owner_id:owner.id,name:f.get("name"),amount:parseBRNumber(f.get("amount")),due_day:Number(f.get("due_day")),is_shared:shared,participants:clean,active:true,updated_at:new Date().toISOString()};let subscription;if(editing){const{data,error}=await supabase.from("subscriptions").update(payload).eq("id",editing.id).eq("owner_id",owner.id).select().single();if(error)return notify("Não foi possível atualizar o streaming.");subscription=data}else{const{data,error}=await supabase.from("subscriptions").insert(payload).select().single();if(error)return notify("Não foi possível salvar o streaming.");subscription=data}if(shared){const now=new Date(),last=new Date(now.getFullYear(),now.getMonth()+1,0).getDate(),due=`${reference.slice(0,8)}${String(Math.min(payload.due_day,last)).padStart(2,"0")}`;for(const person of clean)await supabase.from("subscription_charges").upsert({owner_id:owner.id,subscription_id:subscription.id,participant_name:person.name,phone:person.phone,amount:person.amount,reference_month:reference,due_date:due,status:new Date(due+"T23:59:59")<new Date()?"overdue":"pending",updated_at:new Date().toISOString()},{onConflict:"subscription_id,participant_name,reference_month"})}close();await load();notify(editing?"Streaming atualizado.":"Streaming cadastrado.")}
  function openRetroactive(){const available=subscriptions.find(item=>item.is_shared&&item.participants?.length);if(!available)return notify("Cadastre primeiro uma assinatura compartilhada e seus participantes.");setRetroSubscriptionId(available.id);setRetroOpen(true)}
  async function saveRetroactive(e){e.preventDefault();const f=new FormData(e.currentTarget),subscription=subscriptions.find(item=>item.id===f.get("subscription_id")),participant=subscription?.participants?.find(item=>item.name===f.get("participant_name")),startValue=String(f.get("start_month")||""),through=f.get("through_current")==="on",override=parseBRNumber(f.get("amount"));if(!subscription||!participant||!/^\d{4}-\d{2}$/.test(startValue))return notify("Preencha a assinatura, a pessoa e o mês inicial.");const amount=Number.isFinite(override)&&override>0?override:Number(participant.amount);if(!Number.isFinite(amount)||amount<=0)return notify("Informe um valor válido para a cobrança.");const start=new Date(startValue+"-01T12:00:00"),current=new Date(reference+"T12:00:00");if(start>current)return notify("O mês inicial não pode ser posterior ao mês atual.");const end=through?current:start,refs=[];for(let cursor=new Date(start);cursor<=end&&refs.length<60;cursor.setMonth(cursor.getMonth()+1))refs.push(monthStart(cursor));const{data:existing,error:readError}=await supabase.from("subscription_charges").select("reference_month").eq("owner_id",owner.id).eq("subscription_id",subscription.id).eq("participant_name",participant.name).in("reference_month",refs);if(readError)return notify("Não foi possível verificar as cobranças existentes.");const existingSet=new Set((existing||[]).map(item=>item.reference_month)),today=new Date(),rows=refs.filter(month=>!existingSet.has(month)).map(month=>{const base=new Date(month+"T12:00:00"),lastDay=new Date(base.getFullYear(),base.getMonth()+1,0).getDate(),dueDate=`${month.slice(0,8)}${String(Math.min(Number(subscription.due_day||1),lastDay)).padStart(2,"0")}`;return{owner_id:owner.id,subscription_id:subscription.id,participant_name:participant.name,phone:participant.phone||null,amount,reference_month:month,due_date:dueDate,status:new Date(dueDate+"T23:59:59")<today?"overdue":"pending",updated_at:new Date().toISOString()}});if(rows.length){const{error}=await supabase.from("subscription_charges").insert(rows);if(error)return notify("Não foi possível salvar as cobranças retroativas.")}setRetroOpen(false);await load();notify(rows.length?`${rows.length} cobrança(s) retroativa(s) adicionada(s).`:"As cobranças desse período já estavam cadastradas.")}
  async function pay(charge){const{error}=await supabase.from("subscription_charges").update({status:"paid",paid_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",charge.id).eq("owner_id",owner.id);if(error)return notify("Não foi possível registrar o pagamento.");await load();notify("Pagamento registrado.")}
  function chargeWhatsApp(personCharges){const current=personCharges.filter(c=>c.status!=="paid"&&c.status!=="cancelled"),phone=(current[0]?.phone||"").replace(/\D/g,""),total=current.reduce((sum,c)=>sum+Number(c.amount),0),items=current.map(c=>`${c.subscriptions?.name||"Streaming"} · ${new Date(c.reference_month+"T12:00").toLocaleDateString("pt-BR",{month:"long",year:"numeric"})}: ${money(Number(c.amount))}`).join("\n");if(!phone)return notify("Cadastre o WhatsApp desta pessoa.");window.open(`https://wa.me/${phone}?text=${encodeURIComponent(`Olá, ${current[0]?.participant_name}! Segue o resumo das assinaturas compartilhadas em aberto:\n\n${items}\n\nTotal: ${money(total)}`)}`,"_blank","noopener,noreferrer")}
  const people=Object.values(charges.reduce((acc,c)=>{const key=c.participant_name.toLocaleUpperCase("pt-BR");(acc[key]??={name:c.participant_name,rows:[]}).rows.push(c);return acc},{}));
  return <div className="streaming-page"><div className="page-head"><div><h2>Streamings</h2><p>Gerencie assinaturas e cobranças compartilhadas.</p></div><div className="page-actions"><button onClick={openRetroactive}><CalendarDays/>Cobrança retroativa</button><button className="primary" onClick={()=>setOpen(true)}><Plus/>Nova assinatura</button></div></div>{open&&<form className="inline-form streaming-form" onSubmit={save}><div className="modal-head wide"><div><h2>{editing?"Editar streaming":"Novo streaming"}</h2><p>Cadastre a assinatura e quem divide o pagamento.</p></div><button type="button" onClick={close}><X/></button></div><label>Nome<input name="name" defaultValue={editing?.name||""} placeholder="Netflix, Spotify..." required/></label><label>Valor total<input name="amount" defaultValue={editing?String(editing.amount).replace(".",","):""} inputMode="decimal" placeholder="55,90" required/></label><label>Dia do vencimento<input name="due_day" type="number" min="1" max="31" defaultValue={editing?.due_day||10} required/></label><label className="setting-row share-toggle"><span><strong>Divide com alguém?</strong><small>Crie cobranças mensais individuais</small></span><input type="checkbox" checked={shared} onChange={e=>setShared(e.target.checked)}/></label>{shared&&<div className="streaming-participants wide"><div className="participant-title"><strong>Participantes</strong><button type="button" onClick={addParticipant}><Plus/>Adicionar pessoa</button></div>{participants.map((p,i)=><div className="participant-row" key={i}><label>Nome<input value={p.name} onChange={e=>updateParticipant(i,"name",e.target.value)} required/></label><label>WhatsApp<input value={p.phone} onChange={e=>updateParticipant(i,"phone",e.target.value)} placeholder="5511999999999" required/></label><label>Valor<input value={p.amount} onChange={e=>updateParticipant(i,"amount",e.target.value)} inputMode="decimal" placeholder="19,90" required/></label>{participants.length>1&&<button type="button" onClick={()=>removeParticipant(i)}><X/></button>}</div>)}</div>}<div className="form-actions wide"><button type="button" onClick={close}>Cancelar</button><button className="primary">{editing?"Salvar alterações":"Salvar streaming"}</button></div></form>}{retroOpen&&<form className="inline-form retroactive-charge-form" onSubmit={saveRetroactive}><div className="modal-head wide"><div><h2>Adicionar cobrança retroativa</h2><p>Registre meses anteriores que ainda estão em aberto.</p></div><button type="button" onClick={()=>setRetroOpen(false)}><X/></button></div><label>Streaming<select name="subscription_id" value={retroSubscriptionId} onChange={e=>setRetroSubscriptionId(e.target.value)} required>{subscriptions.filter(item=>item.is_shared&&item.participants?.length).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Pessoa<select name="participant_name" required><option value="">Selecione</option>{retroParticipants.map(person=><option key={person.name} value={person.name}>{person.name}</option>)}</select></label><label>Mês inicial<input name="start_month" type="month" max={reference.slice(0,7)} defaultValue={reference.slice(0,7)} required/></label><label>Valor mensal opcional<input name="amount" inputMode="decimal" placeholder="Usar valor cadastrado"/></label><label className="setting-row wide"><span><strong>Gerar até o mês atual</strong><small>Inclui automaticamente todos os meses em aberto desde o mês inicial</small></span><input name="through_current" type="checkbox" defaultChecked/></label><div className="form-actions wide"><button type="button" onClick={()=>setRetroOpen(false)}>Cancelar</button><button className="primary">Adicionar cobranças</button></div></form>}<div className="streaming-subscriptions">{subscriptions.map(s=><article key={s.id}><span><Play/></span><div><small>ASSINATURA</small><h3>{s.name}</h3><p>Vence dia {s.due_day} · {s.participants?.length||0} participante(s)</p></div><strong>{money(Number(s.amount))}</strong><button onClick={()=>startEdit(s)} aria-label={`Editar ${s.name}`}><Settings/>Editar</button></article>)}{!subscriptions.length&&<EmptyState text="Nenhum streaming cadastrado."/>}</div><div className="streaming-people"><h2>Cobranças por pessoa</h2>{people.map(person=><article key={person.name}><div className="stream-person-head"><span>{person.name[0]}</span><div><h3>{person.name}</h3><small>{person.rows.filter(c=>c.status!=="paid").length} cobrança(s) em aberto</small></div><strong>{money(person.rows.filter(c=>c.status!=="paid"&&c.status!=="cancelled").reduce((a,c)=>a+Number(c.amount),0))}</strong></div><div className="stream-charge-list">{person.rows.map(c=><div key={c.id}><span><b>{c.subscriptions?.name}</b><small>{new Date(c.reference_month+"T12:00").toLocaleDateString("pt-BR",{month:"long",year:"numeric"})}</small></span><strong>{money(Number(c.amount))}</strong><i className={c.status}>{({pending:"Pendente",paid:"Pago",overdue:"Atrasado",cancelled:"Cancelado"})[c.status]}</i><button disabled={c.status==="paid"} onClick={()=>pay(c)}><Check/>{c.status==="paid"?"Pago":"Pagar"}</button></div>)}</div><button className="whatsapp" onClick={()=>chargeWhatsApp(person.rows)}><Send/>Cobrar pelo WhatsApp</button></article>)}</div><StreamingAccessBeta owner={owner} subscriptions={subscriptions} notify={notify}/><div className="streaming-history"><div><h2>Histórico geral</h2><p>Comparativo dos três meses anteriores e do mês atual.</p></div><section>{months.map(month=>{const rows=charges.filter(c=>c.reference_month===month),paid=rows.filter(c=>c.status==="paid").reduce((a,c)=>a+Number(c.amount),0),open=rows.filter(c=>c.status!=="paid"&&c.status!=="cancelled").reduce((a,c)=>a+Number(c.amount),0);return <article key={month}><small>{new Date(month+"T12:00").toLocaleDateString("pt-BR",{month:"long",year:"numeric"})}</small><strong>{money(paid+open)}</strong><span>Pago {money(paid)}</span><span>Em aberto {money(open)}</span></article>})}</section></div></div>
}

function StreamingAccessBeta({owner,subscriptions,notify}){
  const[profiles,setProfiles]=useState([]),[devices,setDevices]=useState([]),[events,setEvents]=useState([]),[editing,setEditing]=useState(null),[formOpen,setFormOpen]=useState(false),[deviceOpen,setDeviceOpen]=useState(null),[eventOpen,setEventOpen]=useState(null),[blocking,setBlocking]=useState(null);
  const netflixSubscriptions=subscriptions.filter(item=>/netflix/i.test(item.name));
  const existingParticipants=netflixSubscriptions.flatMap(subscription=>(subscription.participants||[]).map(person=>({subscription,person})));
  const profileKey=(subscriptionId,name)=>`${subscriptionId}:${String(name).trim().toLocaleUpperCase("pt-BR")}`;
  const configuredKeys=new Set(profiles.map(item=>profileKey(item.subscription_id,item.participant_name)));
  const pendingParticipants=existingParticipants.filter(({subscription,person})=>!configuredKeys.has(profileKey(subscription.id,person.name)));
  async function load(){const[{data:p,error:profileError},{data:d},{data:e}]=await Promise.all([supabase.from("streaming_access_profiles").select("*,subscriptions(name)").eq("owner_id",owner.id).order("created_at"),supabase.from("streaming_access_devices").select("*").eq("owner_id",owner.id).order("created_at"),supabase.from("streaming_access_events").select("*").eq("owner_id",owner.id).order("received_at",{ascending:false})]);if(profileError)return;setProfiles(p||[]);setDevices(d||[]);setEvents(e||[])}
  useEffect(()=>{load()},[owner.id]);
  function openProfile(profile=null,source=null){setEditing(profile||{subscription_id:source?.subscription.id||netflixSubscriptions[0]?.id||"",participant_name:source?.person.name||"",profile_name:source?.person.name||"",profile_email:"",notes:"",pin_enabled:false,status:"active"});setFormOpen(true)}
  function closeProfile(){setEditing(null);setFormOpen(false)}
  async function saveProfile(e){e.preventDefault();const f=new FormData(e.currentTarget),payload={owner_id:owner.id,subscription_id:f.get("subscription_id"),participant_name:String(f.get("participant_name")).trim(),profile_name:String(f.get("profile_name")).trim(),profile_email:String(f.get("profile_email")||"").trim()||null,pin_enabled:f.get("pin_enabled")==="on",status:f.get("status"),notes:String(f.get("notes")||"").trim()||null,updated_at:new Date().toISOString()};const query=editing?.id?supabase.from("streaming_access_profiles").update(payload).eq("id",editing.id).eq("owner_id",owner.id):supabase.from("streaming_access_profiles").insert(payload);const{error}=await query;if(error)return notify(error.code==="23505"?"Essa pessoa já possui um perfil de acesso nessa assinatura.":"Não foi possível salvar o perfil de acesso.");closeProfile();await load();notify("Perfil de acesso salvo.")}
  async function saveDevice(e){e.preventDefault();const f=new FormData(e.currentTarget),payload={owner_id:owner.id,profile_id:deviceOpen.profileId,nickname:String(f.get("nickname")).trim(),device_type:f.get("device_type"),device_identifier:String(f.get("device_identifier")||"").trim()||null,last_seen_at:f.get("last_seen_at")?new Date(f.get("last_seen_at")).toISOString():null,notes:String(f.get("notes")||"").trim()||null,updated_at:new Date().toISOString()};const query=deviceOpen.device?.id?supabase.from("streaming_access_devices").update(payload).eq("id",deviceOpen.device.id).eq("owner_id",owner.id):supabase.from("streaming_access_devices").insert(payload);const{error}=await query;if(error)return notify("Não foi possível salvar o aparelho.");setDeviceOpen(null);await load();notify("Aparelho salvo.")}
  async function deleteDevice(device){if(!confirm(`Excluir o aparelho ${device.nickname}?`))return;const{error}=await supabase.from("streaming_access_devices").delete().eq("id",device.id).eq("owner_id",owner.id);if(error)return notify("Não foi possível excluir o aparelho.");await load();notify("Aparelho excluído.")}
  async function saveEvent(e){e.preventDefault();const f=new FormData(e.currentTarget),profile=profiles.find(item=>item.id===eventOpen),payload={owner_id:owner.id,profile_id:eventOpen,event_type:f.get("event_type"),email_subject:String(f.get("email_subject")||"").trim()||null,sender_email:String(f.get("sender_email")||"").trim()||null,received_at:f.get("received_at")?new Date(f.get("received_at")).toISOString():new Date().toISOString(),status:"detected",notes:String(f.get("notes")||"").trim()||null};const{error}=await supabase.from("streaming_access_events").insert(payload);if(error)return notify("Não foi possível registrar o alerta.");await supabase.from("streaming_access_profiles").update({status:"review",last_request_at:payload.received_at,updated_at:new Date().toISOString()}).eq("id",profile.id).eq("owner_id",owner.id);setEventOpen(null);await load();notify("Solicitação registrada e perfil marcado para análise.")}
  async function blockProfile(profile){const linked=devices.filter(item=>item.profile_id===profile.id&&item.status!=="blocked");if(!confirm(`Bloquear o perfil ${profile.profile_name} e os ${linked.length} aparelho(s) vinculados?\n\nEsta ação registra o bloqueio no Finance Hub. Depois confirme a saída dos aparelhos na Netflix.`))return;setBlocking(profile.id);const now=new Date().toISOString();const{error}=await supabase.rpc("block_streaming_access_profile",{target_profile_id:profile.id});if(error){setBlocking(null);return notify("Não foi possível bloquear o perfil e os aparelhos.")}await supabase.from("streaming_access_events").insert({owner_id:owner.id,profile_id:profile.id,event_type:"profile_blocked",received_at:now,status:"reviewed",notes:`Bloqueio em lote solicitado para ${linked.length} aparelho(s).`});setBlocking(null);await load();window.open("https://www.netflix.com/manageaccountaccess","_blank","noopener,noreferrer");notify(`${linked.length} aparelho(s) marcados como bloqueados. Confirme a saída na Netflix.`)}
  async function restoreProfile(profile){const{error}=await supabase.rpc("restore_streaming_access_profile",{target_profile_id:profile.id});if(error)return notify("Não foi possível reativar o perfil.");await load();notify("Perfil e aparelhos reativados no controle beta.")}
  const statusLabel={active:"Ativo",review:"Em análise",blocked:"Bloqueado"};
  if(!netflixSubscriptions.length&&!profiles.length)return <section className="access-beta"><div className="access-beta-head"><span><LockKeyhole/></span><div><small>BETA</small><h2>Controle de acesso Netflix</h2><p>Cadastre uma assinatura Netflix para testar perfis e aparelhos.</p></div></div></section>;
  return <section className="access-beta"><div className="access-beta-head"><span><LockKeyhole/></span><div><small>BETA · CONTROLE ASSISTIDO</small><h2>Perfis e aparelhos Netflix</h2><p>Um perfil pode ter vários aparelhos. O bloqueio em lote marca todos e abre a confirmação oficial da Netflix.</p></div><button className="primary" onClick={()=>openProfile()}><Plus/>Novo perfil</button></div>{pendingParticipants.length>0&&<div className="access-import"><div><strong>Dados existentes encontrados</strong><small>Configure os participantes já cadastrados na Netflix.</small></div>{pendingParticipants.map(source=><button key={profileKey(source.subscription.id,source.person.name)} onClick={()=>openProfile(null,source)}><Plus/>{source.person.name}</button>)}</div>}{formOpen&&<form className="inline-form access-form" onSubmit={saveProfile}><div className="modal-head wide"><div><h3>{editing?.id?"Editar perfil":"Configurar perfil"}</h3><p>Todos os campos poderão ser alterados depois.</p></div><button type="button" onClick={closeProfile}><X/></button></div><label>Assinatura<select name="subscription_id" defaultValue={editing?.subscription_id} required>{netflixSubscriptions.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Pessoa responsável<input name="participant_name" defaultValue={editing?.participant_name||""} required/></label><label>Nome do perfil Netflix<input name="profile_name" defaultValue={editing?.profile_name||""} required/></label><label>E-mail do perfil<input name="profile_email" type="email" defaultValue={editing?.profile_email||""} placeholder="Opcional"/></label><label>Status<select name="status" defaultValue={editing?.status||"active"}><option value="active">Ativo</option><option value="review">Em análise</option><option value="blocked">Bloqueado</option></select></label><label className="setting-row"><span><strong>PIN ativado?</strong><small>Controle informativo</small></span><input name="pin_enabled" type="checkbox" defaultChecked={editing?.pin_enabled}/></label><label className="wide">Observações<textarea name="notes" defaultValue={editing?.notes||""}/></label><div className="form-actions wide"><button type="button" onClick={closeProfile}>Cancelar</button><button className="primary">Salvar perfil</button></div></form>}<div className="access-profile-grid">{profiles.map(profile=>{const linked=devices.filter(item=>item.profile_id===profile.id),profileEvents=events.filter(item=>item.profile_id===profile.id),activeDevices=linked.filter(item=>item.status!=="blocked");return <article key={profile.id} className={`access-profile ${profile.status}`}><header><span>{profile.profile_name?.[0]||"N"}</span><div><small>{profile.subscriptions?.name||"Netflix"}</small><h3>{profile.profile_name}</h3><p>{profile.participant_name}{profile.profile_email?` · ${profile.profile_email}`:""}</p></div><i>{statusLabel[profile.status]}</i></header><div className="access-stats"><span><MonitorSmartphone/><b>{linked.length}</b><small>Aparelhos</small></span><span><ShieldCheck/><b>{activeDevices.length}</b><small>Ativos</small></span><span><Mail/><b>{profileEvents.filter(item=>item.event_type==="residence_update_request").length}</b><small>Alertas</small></span></div><div className="access-device-list">{linked.map(device=><div key={device.id}><MonitorSmartphone/><span><b>{device.nickname}</b><small>{({tv:"Smart TV",mobile:"Celular",computer:"Computador",tablet:"Tablet",other:"Outro"})[device.device_type]}{device.device_identifier?` · ${device.device_identifier}`:""}</small></span><i className={device.status}>{device.status==="blocked"?"Bloqueado":"Ativo"}</i><button onClick={()=>setDeviceOpen({profileId:profile.id,device})} aria-label="Editar aparelho"><Pencil/></button><button onClick={()=>deleteDevice(device)} aria-label="Excluir aparelho"><Trash2/></button></div>)}{!linked.length&&<p>Nenhum aparelho cadastrado.</p>}</div><footer><button onClick={()=>setDeviceOpen({profileId:profile.id,device:null})}><Plus/>Aparelho</button><button onClick={()=>setEventOpen(profile.id)}><Mail/>Registrar alerta</button><button onClick={()=>openProfile(profile)}><Pencil/>Editar</button>{profile.status==="blocked"?<button className="restore" onClick={()=>restoreProfile(profile)}><RefreshCw/>Reativar</button>:<button className="block" disabled={blocking===profile.id} onClick={()=>blockProfile(profile)}><LockKeyhole/>{blocking===profile.id?"Bloqueando...":"Bloquear perfil"}</button>}</footer>{profile.last_request_at&&<div className="access-last-alert"><AlertTriangle/>Última solicitação: {new Date(profile.last_request_at).toLocaleString("pt-BR")}</div>}</article>})}</div>{deviceOpen&&<div className="plan-modal-bg"><form className="plan-modal" onSubmit={saveDevice}><div><h3>{deviceOpen.device?"Editar aparelho":"Novo aparelho"}</h3><button type="button" onClick={()=>setDeviceOpen(null)}><X/></button></div><label>Nome do aparelho<input name="nickname" defaultValue={deviceOpen.device?.nickname||""} placeholder="TV da sala" required/></label><label>Tipo<select name="device_type" defaultValue={deviceOpen.device?.device_type||"tv"}><option value="tv">Smart TV</option><option value="mobile">Celular</option><option value="computer">Computador</option><option value="tablet">Tablet</option><option value="other">Outro</option></select></label><label>Identificação<input name="device_identifier" defaultValue={deviceOpen.device?.device_identifier||""} placeholder="Ex.: Samsung sala"/></label><label>Último acesso<input name="last_seen_at" type="datetime-local" defaultValue={deviceOpen.device?.last_seen_at?.slice(0,16)||""}/></label><label>Observações<textarea name="notes" defaultValue={deviceOpen.device?.notes||""}/></label><button className="primary">Salvar aparelho</button></form></div>}{eventOpen&&<div className="plan-modal-bg"><form className="plan-modal" onSubmit={saveEvent}><div><h3>Registrar alerta recebido</h3><button type="button" onClick={()=>setEventOpen(null)}><X/></button></div><label>Tipo<select name="event_type"><option value="residence_update_request">Atualização de residência</option><option value="temporary_access_code">Código de acesso temporário</option><option value="unknown_access">Acesso desconhecido</option></select></label><label>Assunto do e-mail<input name="email_subject" placeholder="Cole o assunto recebido"/></label><label>Remetente<input name="sender_email" type="email" placeholder="info@account.netflix.com"/></label><label>Data e hora<input name="received_at" type="datetime-local" defaultValue={new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16)}/></label><label>Observações<textarea name="notes"/></label><button className="primary">Registrar e marcar para análise</button></form></div>}</section>
}

function SettingsModule({ owner, modules, reloadModules, onUpdate, dark, setDark, notify, ask, openBuilder }) {
  const [section,setSection]=useState("profile"),[name, setName] = useState(owner.name),[appName,setAppName]=useState(owner.app_name||"Finance Hub"),[appColor,setAppColor]=useState(owner.app_color||"#6445ED"),[backgroundColor,setBackgroundColor]=useState(owner.background_color||"#F6F8FC"),[streamingEnabled,setStreamingEnabled]=useState(Boolean(owner.streaming_enabled)),[expensePlanEnabled,setExpensePlanEnabled]=useState(owner.expense_plan_enabled!==false),[closureMode,setClosureMode]=useState(owner.monthly_closure_mode||"manual"),[closureDestination,setClosureDestination]=useState(owner.closure_destination||"local"),[destinationOpen,setDestinationOpen]=useState(false),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[showPassword,setShowPassword]=useState(false),[savingPassword,setSavingPassword]=useState(false),[assetBusy,setAssetBusy]=useState("");
  useEffect(()=>{supabase.auth.getUser().then(({data})=>setEmail(data.user?.email||""))},[]);
  useEffect(()=>{const layout=document.querySelector(".settings-layout");if(layout){layout.dataset.section=section;layout.firstElementChild?.classList.add("profile-appearance-panel")}},[section]);
  async function save(e) {
    e.preventDefault();
    const { error } = await supabase
      .from("owners")
      .update({ name,app_name:appName,app_color:appColor,background_color:backgroundColor,streaming_enabled:streamingEnabled,expense_plan_enabled:expensePlanEnabled,monthly_closure_mode:closureMode,closure_destination:closureDestination, updated_at: new Date().toISOString() })
      .eq("id", owner.id);
    if(error)return notify("Erro ao salvar personalização.");onUpdate({...owner,name,app_name:appName,app_color:appColor,background_color:backgroundColor,streaming_enabled:streamingEnabled,expense_plan_enabled:expensePlanEnabled,monthly_closure_mode:closureMode,closure_destination:closureDestination});notify("Personalização salva.");
  }
  async function uploadAsset(file,kind){if(!file)return;if(!["image/jpeg","image/png","image/webp","image/gif"].includes(file.type))return notify("Escolha uma imagem JPG, PNG, WEBP ou GIF.");if(file.size>5*1024*1024)return notify("A imagem deve ter no máximo 5 MB.");setAssetBusy(kind);const extension=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,""),path=`${owner.id}/${kind}-${Date.now()}.${extension}`,column=kind==="avatar"?"avatar_url":"background_image_url",oldPath=owner[column];const{error:uploadError}=await supabase.storage.from("finance-assets").upload(path,file,{contentType:file.type});if(uploadError){setAssetBusy("");return notify("Não foi possível enviar a imagem.")}const{error}=await supabase.from("owners").update({[column]:path,updated_at:new Date().toISOString()}).eq("id",owner.id);setAssetBusy("");if(error){await supabase.storage.from("finance-assets").remove([path]);return notify("A imagem foi enviada, mas não foi possível vinculá-la ao perfil.")}if(oldPath)await supabase.storage.from("finance-assets").remove([oldPath]);onUpdate({...owner,[column]:path});notify(kind==="avatar"?"Foto de perfil atualizada.":"Imagem de fundo atualizada.")}
  async function linkEmail(){if(!email)return notify("Informe um e-mail válido.");const{error}=await supabase.auth.updateUser({email},{emailRedirectTo:APP_URL});notify(error?authErrorPt(error,"Não foi possível atualizar o e-mail."):"Enviamos a confirmação para o novo e-mail.")}
  async function setAccountPassword(){if(password.length<10)return notify("A nova senha precisa ter pelo menos 10 caracteres.");setSavingPassword(true);const{data:{user}}=await supabase.auth.getUser();if(!user?.email){setSavingPassword(false);return notify("Confirme primeiro o endereço de e-mail.")}const{error}=await supabase.auth.updateUser({password});setSavingPassword(false);if(error)return notify(authErrorPt(error,"Não foi possível alterar a senha."));setPassword("");setShowPassword(false);notify("Senha alterada com sucesso.")}
  async function editModule(m){const result=await ask({kind:"input",title:"Editar função",message:"Altere o nome que será exibido no menu do Finance Hub.",value:m.name,confirmLabel:"Salvar alteração"}),next=result?.trim();if(!next||next===m.name)return;const{error}=await supabase.from("custom_modules").update({name:next}).eq("id",m.id).eq("owner_id",owner.id);if(error)return notify("Não foi possível editar.");await reloadModules();notify("Função atualizada.")}
  async function deleteModule(m){const accepted=await ask({kind:"confirm",tone:"danger",title:"Excluir função e dados?",message:`A função “${m.name}”, seus registros, movimentações e cobranças vinculadas serão excluídos permanentemente.`,confirmLabel:"Excluir tudo"});if(!accepted)return;const{error}=await supabase.from("custom_modules").delete().eq("id",m.id).eq("owner_id",owner.id);if(error)return notify("Não foi possível excluir a função e seus dados.");await reloadModules();window.dispatchEvent(new Event("finance-data-changed"));notify("Função e todos os dados vinculados foram excluídos.")}
  return (
    <><div className="settings-category-menu">{[["profile","Perfil",UserRound],["appearance","Aparência",Settings],["security","Segurança",ShieldCheck],["functions","Funções criadas",Sparkles],["closure","Fechamento mensal",FileText],["streaming","Streamings",Play]].map(([key,label,Icon])=><button className={section===key?"active":""} onClick={()=>setSection(key)} key={key}><Icon/><span><strong>{label}</strong><small>Abrir configurações</small></span><ChevronRight/></button>)}</div><div className="settings-layout"><div className="settings-panel">
      <h2>Perfil e aparência</h2>
      <form onSubmit={save}>
        <label>
          Nome do proprietário
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>Nome do aplicativo<input value={appName} onChange={e=>setAppName(e.target.value)} maxLength="40"/></label>
        <label>Cor principal<input type="color" value={appColor} onChange={e=>setAppColor(e.target.value)}/></label>
        <div className="asset-upload-grid"><label className="asset-upload"><span>Foto do perfil</span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e=>uploadAsset(e.target.files?.[0],"avatar")} disabled={!!assetBusy}/><strong>{assetBusy==="avatar"?"Enviando…":"Escolher foto"}</strong><small>A foto será recortada automaticamente dentro do círculo · até 5 MB</small></label></div>
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
        <label className="setting-row"><span><strong>Ativar Streamings</strong><small>Adiciona a gestão de assinaturas compartilhadas ao menu lateral</small></span><input type="checkbox" checked={streamingEnabled} onChange={e=>setStreamingEnabled(e.target.checked)}/></label>
        <label className="setting-row"><span><strong>Ativar Eliminação de despesas</strong><small>Mostra ou remove o módulo do menu sem apagar os dados</small></span><input type="checkbox" checked={expensePlanEnabled} onChange={e=>setExpensePlanEnabled(e.target.checked)}/></label>
        <label className="setting-row"><span><strong>Fechamento mensal automático</strong><small>Prepara o arquivo do mês anterior e solicita o download no próximo acesso</small></span><input type="checkbox" checked={closureMode==="automatic"} onChange={e=>{setClosureMode(e.target.checked?"automatic":"manual");if(e.target.checked)setDestinationOpen(true)}}/></label>
        {destinationOpen&&<div className="destination-picker"><div><strong>Onde deseja salvar os fechamentos?</strong><small>Serviços em nuvem precisam ser conectados antes do primeiro envio.</small></div>{[["local","Neste dispositivo"],["google_drive","Google Drive"],["onedrive","OneDrive"]].map(([value,label])=><button type="button" className={closureDestination===value?"selected":""} onClick={()=>setClosureDestination(value)} key={value}><Download/>{label}{closureDestination===value&&<Check/>}</button>)}<button type="button" className="primary" onClick={()=>setDestinationOpen(false)}>Confirmar local</button></div>}
        <button className="primary">Salvar configurações</button>
      </form>
    </div><div className="settings-panel security-panel"><h2>Segurança da conta</h2><p className="settings-help">Sua senha atual nunca pode ser visualizada. Por segurança, ela é protegida de forma irreversível. Aqui você pode atualizar o e-mail ou criar uma nova senha.</p><label>E-mail da conta<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com"/></label><button onClick={linkEmail}>Atualizar e-mail</button><label>Nova senha<div className="password-field"><input type={showPassword?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} minLength="10" autoComplete="new-password" placeholder="Mínimo de 10 caracteres"/><button type="button" onClick={()=>setShowPassword(!showPassword)} aria-label={showPassword?"Ocultar senha digitada":"Mostrar senha digitada"}><Eye/>{showPassword?"Ocultar":"Mostrar"}</button></div></label><small className="password-note">Este campo mostra apenas a nova senha que você está digitando, nunca a senha atual.</small><button className="primary account-password-button" onClick={setAccountPassword} disabled={password.length<10||savingPassword}>{savingPassword?"Alterando…":"Alterar senha"}</button></div><div className="settings-panel settings-modules"><h2>Funções criadas</h2><p className="settings-help">Edite, exclua ou crie funções personalizadas.</p><button className="primary" onClick={openBuilder}><Plus/>Criar nova função</button>{modules.map(m=><div className="module-setting" key={m.id}><span><Sparkles/><strong>{m.name}</strong><small>{m.field_schema?.length||0} campos</small></span><div><button onClick={()=>editModule(m)}>Editar</button><button className="danger-text" onClick={()=>deleteModule(m)}>Excluir</button></div></div>)}{!modules.length&&<EmptyState text="Nenhuma função personalizada."/>}</div></div>
    </>
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

function AppDialog({ dialog, onAnswer }) {
  const [value,setValue]=useState(dialog.value||"");
  const inputRef=useRef(null);
  useEffect(()=>{
    inputRef.current?.focus();
    const key=(e)=>{if(e.key==="Escape")onAnswer(dialog.kind==="input"?null:false)};
    addEventListener("keydown",key);
    return()=>removeEventListener("keydown",key);
  },[]);
  const cancel=()=>onAnswer(dialog.kind==="input"?null:false);
  const confirm=()=>onAnswer(dialog.kind==="input"?value:true);
  return <div className="app-dialog-bg" role="presentation" onMouseDown={cancel}>
    <div className={`app-dialog ${dialog.tone||"default"}`} role="dialog" aria-modal="true" aria-labelledby="app-dialog-title" onMouseDown={e=>e.stopPropagation()}>
      <div className="app-dialog-icon">{dialog.tone==="danger"?<AlertTriangle/>:<ShieldCheck/>}</div>
      <h2 id="app-dialog-title">{dialog.title}</h2>
      <p>{dialog.message}</p>
      {dialog.kind==="input"&&<label>Nome da função<input ref={inputRef} value={value} onChange={e=>setValue(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&value.trim())confirm()}} maxLength="50"/></label>}
      <div className="app-dialog-actions"><button onClick={cancel}>Cancelar</button><button className="primary" onClick={confirm} disabled={dialog.kind==="input"&&!value.trim()}>{dialog.confirmLabel||"Confirmar"}</button></div>
    </div>
  </div>;
}

createRoot(document.getElementById("root")).render(<AuthGate />);
