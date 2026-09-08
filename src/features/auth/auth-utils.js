export const APP_URL = "https://alencar1992.github.io/FINANCE-HUB/";

export const authErrorPt = (
  error,
  fallback = "Não foi possível concluir. Tente novamente.",
) => {
  const code = error?.code || error?.error_code || "";
  const message = String(error?.message || "").toLowerCase();

  if (
    code === "over_email_send_rate_limit" ||
    message.includes("rate limit") ||
    message.includes("too many")
  ) {
    return "O limite temporário de envio de e-mails foi atingido. Aguarde antes de tentar novamente.";
  }
  if (code === "email_not_confirmed" || message.includes("email not confirmed")) {
    return "O e-mail ainda não foi confirmado. Verifique sua caixa de entrada e a pasta de spam.";
  }
  if (code === "invalid_credentials" || message.includes("invalid login")) {
    return "E-mail ou senha inválidos.";
  }
  if (code === "user_already_exists" || message.includes("already registered")) {
    return "Este e-mail já está cadastrado.";
  }
  if (code === "weak_password" || message.includes("weak password")) {
    return "A senha não atende aos requisitos de segurança.";
  }
  if (message.includes("different from the old password")) {
    return "Escolha uma senha diferente da senha anterior.";
  }
  if (message.includes("captcha")) {
    return "Não foi possível validar a proteção de segurança. Atualize a página e tente novamente.";
  }
  return fallback;
};
