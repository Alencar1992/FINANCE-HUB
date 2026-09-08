import { describe, expect, it } from "vitest";
import { APP_URL, authErrorPt } from "../src/features/auth/auth-utils";

describe("mensagens de autenticação", () => {
  it("mantém o endereço oficial nos retornos de autenticação", () => {
    expect(APP_URL).toBe("https://alencar1992.github.io/FINANCE-HUB/");
  });

  it.each([
    [{ code: "over_email_send_rate_limit" }, "limite temporário"],
    [{ code: "email_not_confirmed" }, "ainda não foi confirmado"],
    [{ code: "invalid_credentials" }, "E-mail ou senha inválidos"],
    [{ code: "user_already_exists" }, "já está cadastrado"],
    [{ code: "weak_password" }, "requisitos de segurança"],
    [{ message: "Password should be different from the old password" }, "senha diferente"],
    [{ message: "Captcha verification failed" }, "proteção de segurança"],
  ])("traduz erros conhecidos sem expor detalhes técnicos", (error, expected) => {
    expect(authErrorPt(error)).toContain(expected);
  });

  it("usa a mensagem segura informada para erros desconhecidos", () => {
    expect(authErrorPt({ message: "internal detail" }, "Falha segura."))
      .toBe("Falha segura.");
  });
});
