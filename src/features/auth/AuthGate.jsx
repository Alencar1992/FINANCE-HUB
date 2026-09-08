import { useEffect, useRef, useState } from "react";
import { Check, FileText, ShieldCheck, WalletCards } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { APP_URL, authErrorPt } from "./auth-utils";

function AuthCard({ title, text, error, message, children }) {
  return (
    <div className="onboarding">
      <div className="onboard-brand">
        <span><WalletCards /></span>
        Finance Hub
      </div>
      <div className="onboard-card">
        <div className="onboard-icon"><ShieldCheck /></div>
        <h1>{title}</h1>
        <p>{text}</p>
        {error && <div className="form-error">{error}</div>}
        {message && <div className="form-success">{message}</div>}
        {children}
      </div>
    </div>
  );
}

function MfaGate({ user, onVerified }) {
  const [factor, setFactor] = useState(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.mfa.listFactors();
      const verified = data?.totp?.find((item) => item.status === "verified");
      if (verified) {
        setFactor(verified);
        setLoading(false);
        return;
      }
      const enrolled = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Finance Hub - ${user.email}`,
      });
      if (enrolled.error) {
        setError(
          authErrorPt(
            enrolled.error,
            "Não foi possível preparar a verificação em duas etapas.",
          ),
        );
      } else {
        setFactor(enrolled.data);
      }
      setLoading(false);
    })();
  }, [user.email]);

  async function verify(event) {
    event.preventDefault();
    setError("");
    const challenge = await supabase.auth.mfa.challenge({ factorId: factor.id });
    if (challenge.error) {
      setError(authErrorPt(challenge.error, "Não foi possível iniciar a verificação."));
      return;
    }
    const result = await supabase.auth.mfa.verify({
      factorId: factor.id,
      challengeId: challenge.data.id,
      code: code.trim(),
    });
    if (result.error) {
      setError("Código inválido. Confira o aplicativo autenticador.");
      return;
    }
    onVerified();
  }

  async function copySecret() {
    if (!factor?.totp?.secret) return;
    await navigator.clipboard.writeText(factor.totp.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  return (
    <AuthCard
      title="Verificação em duas etapas"
      text={
        factor?.status === "verified"
          ? "Digite o código atual do seu aplicativo autenticador."
          : "Escolha abaixo como configurar o autenticador."
      }
      error={error}
    >
      {loading ? (
        <p>Preparando autenticação…</p>
      ) : (
        <>
          {factor?.totp && (
            <div className="mfa-setup">
              <div className="mfa-method">
                <strong>Opção 1 — Em outro aparelho</strong>
                <span>Escaneie o código usando Google Authenticator, Microsoft Authenticator ou aplicativo compatível.</span>
                {factor.totp.qr_code && (
                  <img
                    className="mfa-qr"
                    src={factor.totp.qr_code}
                    alt="Código QR para configurar a verificação em duas etapas"
                  />
                )}
              </div>
              <div className="mfa-method mobile-method">
                <strong>Opção 2 — Neste mesmo celular</strong>
                <span>Abra diretamente no autenticador. Se o aplicativo não abrir, copie a chave e adicione uma conta manualmente.</span>
                {factor.totp.uri && (
                  <a className="mfa-open-app" href={factor.totp.uri}>Abrir no aplicativo autenticador</a>
                )}
                <button className="mfa-copy" type="button" onClick={copySecret}>
                  {copied ? <Check /> : <FileText />}
                  {copied ? "Chave copiada" : "Copiar chave manual"}
                </button>
                <code>{factor.totp.secret}</code>
                <ol>
                  <li>Abra seu aplicativo autenticador.</li>
                  <li>Toque em adicionar conta ou inserir chave de configuração.</li>
                  <li>Cole a chave, escolha o tipo “Baseado em tempo” e salve.</li>
                  <li>Volte ao Finance Hub e informe o código de seis dígitos.</li>
                </ol>
              </div>
            </div>
          )}
          <form onSubmit={verify}>
            <label>
              Código de 6 dígitos
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                pattern="[0-9]{6}"
                required
                autoFocus
              />
            </label>
            <button className="primary submit" disabled={code.length !== 6}>Verificar e entrar</button>
          </form>
        </>
      )}
    </AuthCard>
  );
}

export function AuthGate({ renderApp }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [owner, setOwner] = useState(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("login");
  const [message, setMessage] = useState("");
  const [mfaReady, setMfaReady] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [recoveryDone, setRecoveryDone] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const authBusyRef = useRef(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setUser(session?.user || null);
        setPasswordRecovery(true);
        setLoading(false);
      }
    });
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
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
      const { data: profile } = await supabase
        .from("owners")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();
      setOwner(profile);
      setLoading(false);
    })();
    return () => subscription.unsubscribe();
  }, []);

  async function createOwner(name, id = user?.id) {
    if (!id) return;
    const row = { id, name: name.trim(), profile_color: "#6445ed" };
    const { data, error: ownerError } = await supabase.from("owners").upsert(row).select().single();
    if (ownerError) throw ownerError;
    setOwner(data);
  }

  async function register(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.get("email"),
      password: form.get("password"),
      options: { data: { name: form.get("name").trim() }, emailRedirectTo: APP_URL },
    });
    if (signUpError) {
      setError(authErrorPt(signUpError, "Não foi possível criar a conta."));
      return;
    }
    if (!data.session) {
      setMessage("Cadastro criado. Confirme o e-mail e depois faça login.");
      setMode("login");
      return;
    }
    setUser(data.user);
  }

  async function migrateAnonymous(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email")).trim();
    setError("");
    setPendingEmail(email);
    const { error: updateError } = await supabase.auth.updateUser(
      { email, password: form.get("password"), data: { name: form.get("name").trim() } },
      { emailRedirectTo: APP_URL },
    );
    if (updateError) {
      if (updateError.message.toLowerCase().includes("different from the old password")) {
        setMessage("A senha já foi salva na tentativa anterior. Reenvie a confirmação para concluir.");
        return;
      }
      setError(authErrorPt(updateError, "Não foi possível proteger a conta."));
      return;
    }
    localStorage.setItem("finance-hub-permanent", "true");
    setMessage("Conta protegida. Confirme o e-mail; depois entre novamente e ative o autenticador.");
  }

  async function resendConfirmation() {
    if (!pendingEmail) {
      setError("Informe o e-mail usado no cadastro.");
      return;
    }
    setError("");
    const { error: resendError } = await supabase.auth.resend({
      type: "email_change",
      email: pendingEmail,
      options: { emailRedirectTo: APP_URL },
    });
    if (resendError) {
      setError(authErrorPt(resendError, "Não foi possível reenviar a confirmação."));
      return;
    }
    setMessage("Novo e-mail enviado com o endereço correto. Use somente o link mais recente.");
  }

  async function signIn(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: form.get("email"),
      password: form.get("password"),
    });
    if (signInError) {
      setError("E-mail ou senha inválidos, ou e-mail ainda não confirmado.");
      return;
    }
    setUser(data.user);
    location.reload();
  }

  async function requestPasswordReset(event) {
    event.preventDefault();
    if (authBusyRef.current) return;
    const email = recoveryEmail.trim();
    setError("");
    setMessage("");
    authBusyRef.current = true;
    setAuthBusy(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: APP_URL });
    authBusyRef.current = false;
    setAuthBusy(false);
    if (resetError) {
      setError(authErrorPt(resetError, "Não foi possível enviar o link de recuperação."));
      return;
    }
    setMessage("Se houver uma conta com esse e-mail, enviaremos um link seguro para redefinir a senha.");
  }

  async function resendSignupConfirmation() {
    if (authBusyRef.current || !recoveryEmail.trim()) return;
    setError("");
    setMessage("");
    authBusyRef.current = true;
    setAuthBusy(true);
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: recoveryEmail.trim(),
      options: { emailRedirectTo: APP_URL },
    });
    authBusyRef.current = false;
    setAuthBusy(false);
    if (resendError) {
      setError(authErrorPt(resendError, "Não foi possível reenviar a confirmação."));
      return;
    }
    setMessage("Se o cadastro estiver aguardando confirmação, enviaremos um novo link para o e-mail informado.");
  }

  async function updateRecoveredPassword(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    const confirmation = String(form.get("confirmation"));
    setError("");
    if (password !== confirmation) {
      setError("As senhas informadas não são iguais.");
      return;
    }
    const { error: passwordError } = await supabase.auth.updateUser({ password });
    if (passwordError) {
      setError(authErrorPt(passwordError, "Não foi possível salvar a nova senha."));
      return;
    }
    setRecoveryDone(true);
    setMessage("Senha alterada com sucesso. Agora você já pode voltar ao login.");
  }

  if (loading) {
    return (
      <div className="boot">
        <span><WalletCards /></span>
        <p>Preparando seu Finance Hub…</p>
      </div>
    );
  }
  if (passwordRecovery) {
    return (
      <AuthCard title="Crie uma nova senha" text="Use uma senha forte e diferente das anteriores." error={error} message={message}>
        {recoveryDone ? (
          <button className="primary submit" onClick={async () => { await supabase.auth.signOut(); location.href = APP_URL; }}>
            Voltar para o login
          </button>
        ) : (
          <form onSubmit={updateRecoveredPassword}>
            <label>Nova senha<input name="password" type="password" minLength="10" required autoComplete="new-password" /></label>
            <label>Confirmar nova senha<input name="confirmation" type="password" minLength="10" required autoComplete="new-password" /></label>
            <button className="primary submit">Salvar nova senha</button>
          </form>
        )}
      </AuthCard>
    );
  }
  if (user?.is_anonymous) {
    return (
      <AuthCard title="Proteja sua conta atual" text="Seus dados existentes serão preservados. Cadastre e-mail e senha para converter este acesso em uma conta recuperável." error={error} message={message}>
        <form onSubmit={migrateAnonymous}>
          <label>Seu nome<input name="name" required minLength="2" defaultValue={user.user_metadata?.name || "Alencar"} /></label>
          <label>E-mail<input name="email" type="email" required onChange={(event) => setPendingEmail(event.target.value)} /></label>
          <label>Senha forte<input name="password" type="password" minLength="10" required autoComplete="new-password" /></label>
          <button className="primary submit">Proteger meus dados</button>
        </form>
        {message && <button className="auth-switch" onClick={resendConfirmation}>Reenviar confirmação</button>}
        <button className="auth-switch" onClick={async () => { await supabase.auth.signOut(); location.reload(); }}>
          Já confirmei o e-mail — ir para login
        </button>
      </AuthCard>
    );
  }
  if (user && !mfaReady) return <MfaGate user={user} onVerified={() => location.reload()} />;
  if (owner) return renderApp(owner);
  if (user && mfaReady) {
    const name = user.user_metadata?.name || user.email?.split("@")[0] || "Cliente";
    createOwner(name).catch(() => setError("Não foi possível preparar o perfil. Tente novamente."));
    return <div className="boot"><span><WalletCards /></span><p>Criando seu espaço seguro…</p></div>;
  }

  return (
    <div className="onboarding">
      <div className="onboard-brand"><span><WalletCards /></span>Finance Hub</div>
      <div className="onboard-card">
        <div className="onboard-icon"><ShieldCheck /></div>
        <h1>{mode === "login" ? "Acesse seu Finance Hub" : mode === "forgot" ? "Redefina sua senha" : "Crie sua conta segura"}</h1>
        <p>{mode === "login" ? "Entre com e-mail, senha e autenticação em dois fatores." : mode === "forgot" ? "Informe seu e-mail para receber um link de recuperação seguro." : "Cada cliente recebe um ambiente financeiro privado e isolado."}</p>
        {error && <div className="form-error">{error}</div>}
        {message && <div className="form-success">{message}</div>}
        {mode === "login" ? (
          <form onSubmit={signIn}>
            <label>E-mail<input name="email" type="email" required autoComplete="email" /></label>
            <label>Senha<input name="password" type="password" minLength="10" required autoComplete="current-password" /></label>
            <button className="primary submit">Entrar com segurança</button>
          </form>
        ) : mode === "forgot" ? (
          <>
            <form onSubmit={requestPasswordReset}>
              <label>E-mail da conta<input name="email" type="email" required autoComplete="email" autoFocus value={recoveryEmail} onChange={(event) => setRecoveryEmail(event.target.value)} /></label>
              <button className="primary submit" disabled={authBusy}>{authBusy ? "Enviando…" : "Enviar link de recuperação"}</button>
            </form>
            <button className="auth-switch" disabled={authBusy || !recoveryEmail.trim()} onClick={resendSignupConfirmation}>
              Ainda não confirmou o cadastro? Reenviar confirmação
            </button>
          </>
        ) : (
          <form onSubmit={register}>
            <label>Seu nome<input name="name" required minLength="2" autoFocus /></label>
            <label>E-mail<input name="email" type="email" required autoComplete="email" /></label>
            <label>Senha forte<input name="password" type="password" minLength="10" required autoComplete="new-password" /></label>
            <button className="primary submit">Criar conta</button>
          </form>
        )}
        {mode === "login" && (
          <button className="auth-switch" onClick={() => { setMode("forgot"); setError(""); setMessage(""); }}>
            Esqueci minha senha
          </button>
        )}
        <button className="auth-switch" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setMessage(""); }}>
          {mode === "login" ? "Primeiro acesso? Criar conta" : "Voltar para o login"}
        </button>
        <small>Dados isolados, e-mail confirmado e verificação em duas etapas.</small>
      </div>
    </div>
  );
}
