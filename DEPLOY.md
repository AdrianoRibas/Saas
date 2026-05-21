# Guia de Deploy (Produção)

Este guia cobre o deploy do **Adaptador SaaS** para **Railway** (Backend) e **Vercel** (Frontend).

## 1. Backend (Railway)

O backend é uma aplicação Node.js + Prisma.

### Pré-requisitos
- Conta no Railway (railway.app)
- Projeto criado no Railway
- PostgreSQL adicionado ao projeto

### Variáveis de Ambiente (Railway)
Configure as seguintes variáveis no dashboard do Railway:

```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://postgres:senha@containers-us-west-1.railway.app:5432/railway
JWT_SECRET=sua_chave_secreta_super_segura_32bits
JWT_EXPIRES_IN=7d
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=eyJ...
FRONTEND_URL=https://seu-frontend.vercel.app
```

### Comandos de Deploy
Com o repositório conectado ao Railway, o deploy é automático ao fazer push.
O arquivo `railway.json` já está configurado para usar `npm run start`.

## 2. Frontend (Vercel)

O frontend é um site estático (HTML/JS/CSS).

### Pré-requisitos
- Conta na Vercel (vercel.com)
- CLI da Vercel instalada (`npm i -g vercel`) OU repositório conectado ao GitHub/GitLab.

### Configuração
O arquivo `vercel.json` já define a pasta de saída como `frontend` e configura as rotas.

### Atenção: URL da API
Como o frontend é estático, a URL da API está definida em `frontend/src/services/apiService.js`.
O valor atual é: `https://saas-teste-production-913f.up.railway.app/api`

Se o seu backend tiver outra URL, edite este arquivo antes de fazer o deploy.

### Variáveis de Ambiente (Opcional)
Se decidir migrar para Vite/React no futuro, use variáveis iniciadas com `VITE_`.

## 3. Passo a Passo Final

1. **Commit das alterações:**
   ```bash
   git add .
   git commit -m "chore: prepare for production deployment"
   ```

2. **Push para o repositório:**
   ```bash
   git push origin main
   ```

3. **Verificar Dashboards:**
   - Acompanhe o build no Railway.
   - Acompanhe o deploy na Vercel.

4. **Rodar Migrations (se necessário):**
   No Railway, você pode precisar rodar a migration inicial manualmente via CLI ou Console se o comando de build não incluir:
   ```bash
   npx prisma migrate deploy
   ```
