# Finance Hub

Aplicativo responsivo de controle financeiro pessoal, integrado ao Supabase e instalável como PWA no Android, iPhone, tablet e computador.

## Executar localmente

```bash
npm install
npm run dev
```

Copie `.env.example` para `.env.local` e informe a URL e a chave pública do projeto Supabase.

## Publicação

Cada push em `main` executa o workflow de GitHub Pages. Em **Settings → Pages**, selecione **GitHub Actions** como fonte.

## Instalação no celular

- Android/Chrome: menu → **Adicionar à tela inicial**.
- iPhone/Safari: compartilhar → **Adicionar à Tela de Início**.

## Segurança

O banco usa Row Level Security por proprietário. O acesso aos dados exige conta identificada, sessão autenticada e MFA (`aal2`). Identidades anônimas antigas são mantidas apenas para conversão segura da conta, sem alteração do proprietário dos registros.

O plano de validação e rollback das políticas está em [`docs/security/issue-4-validation.md`](docs/security/issue-4-validation.md).
