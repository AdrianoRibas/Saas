# Backend - Adaptador de Documentos Acessíveis

API backend para o SaaS de adaptação de documentos acessíveis.

## Tecnologias
- **Node.js + Express + TypeScript**
- **PostgreSQL + Prisma ORM**
- **JWT para autenticação**
- **Stripe para pagamentos**
- **Cloudflare R2 para armazenamento**

## Configuração

1. Copie o arquivo de exemplo de variáveis de ambiente:
```bash
cp .env.example .env
```

2. Configure as variáveis no arquivo `.env`

3. Instale as dependências:
```bash
npm install
```

4. Gere o cliente Prisma:
```bash
npm run db:generate
```

5. Execute as migrations do banco:
```bash
npm run db:migrate
```

6. Inicie o servidor:
```bash
npm run dev
```

## Endpoints da API

### Autenticação
- `POST /api/auth/register` - Cadastro
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Usuário atual

### Organizações
- `GET /api/organizations/current` - Dados da organização
- `PUT /api/organizations/settings` - Atualizar configurações
- `GET /api/organizations/header` - Configuração do cabeçalho

### Documentos
- `GET /api/documents` - Listar documentos
- `POST /api/documents/upload` - Upload de PDF
- `GET /api/documents/:id` - Buscar documento
- `DELETE /api/documents/:id` - Deletar documento

### Billing
- `GET /api/billing/status` - Status da assinatura
- `POST /api/billing/checkout` - Criar checkout
- `POST /api/billing/portal` - Portal do cliente
