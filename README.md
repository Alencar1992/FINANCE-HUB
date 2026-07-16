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

O banco usa Row Level Security. Cada perfil é vinculado a uma sessão anônima do Supabase e só consegue acessar seus próprios registros.
