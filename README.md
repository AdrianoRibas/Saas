# SaaS - Adaptador de Documentos Acessíveis

Este projeto é uma plataforma para adaptação automática de documentos acadêmicos para formatos acessíveis, utilizando Inteligência Artificial.

## 🏗️ Arquitetura do Projeto

O sistema opera no modelo **Monorepo** e é dividido em três componentes principais:

### 1. Backend (`/backend`)
API RESTful que gerencia toda a lógica de negócios, banco de dados, autenticação e integrações.
- **Tecnologias**: Node.js, Express, TypeScript, Prisma ORM.
- **Banco de Dados**: PostgreSQL.
- **Integrações**: Stripe (pagamentos), Cloudflare R2/Supabase (armazenamento), Gemini AI (inteligência para adaptação).

### 2. Frontend (`/frontend`)
Interface do usuário simplificada e performática, construída com tecnologias web nativas.
- **Tecnologias**: HTML5, Vanilla JavaScript (ES6+), CSS3.
- **Comunicação**: Consome a API do backend via `fetch`.
- **Configuração**: Conecta automaticamente ao backend em `http://localhost:3001` quando rodando localmente.

### 3. Video Service (`/video-service`)
Microserviço especializado para geração programática de vídeos (ex: adaptações em LIBRAS ou legendagem).
- **Tecnologias**: Remotion (React), TypeScript.

---

## 🚀 Como Rodar o Projeto

Siga os passos abaixo para preparar o ambiente e iniciar os serviços.

### Pré-requisitos
- **Node.js**: Versão 20 ou superior.
- **PostgreSQL**: Banco de dados instalado e rodando.

---

### Passo 1: Configurar o Backend

1. Navegue até a pasta do backend:
   ```bash
   cd backend
   ```

2. Crie o arquivo de configuração `.env` copiando o exemplo:
   ```bash
   cp .env.example .env
   # No Windows (PowerShell): copy .env.example .env
   ```

3. **IMPORTANTE**: Abra o arquivo `.env` e configure sua conexão com o banco de dados em `DATABASE_URL`.
   - Exemplo: `postgresql://usuario:senha@localhost:5432/nome_do_banco`

4. Instale as dependências:
   ```bash
   npm install
   ```

5. Configure o banco de dados (tabelas e migrations):
   ```bash
   npm run db:generate
   npm run db:migrate
   ```

6. Inicie o servidor backend:
   ```bash
   npm run dev
   ```
   > O servidor iniciará em `http://localhost:3001`

---

### Passo 2: Rodar o Frontend

O frontend não requer instalação complexa, apenas um servidor web estático.

1. Abra um novo terminal na raiz do projeto ou na pasta `frontend`.

2. Se estiver na raiz, você pode usar o comando:
   ```bash
   npm run start:frontend
   ```

3. Ou, se preferir rodar manualmente de dentro da pasta `frontend` (requer `npx`):
   ```bash
   cd frontend
   npx serve .
   ```
   > O frontend deve identificar automaticamente o backend rodando na porta 3001.

---

### Passo 3: Rodar o Serviço de Vídeo (Opcional)

Apenas necessário se for trabalhar na geração de vídeos.

1. Navegue até a pasta:
   ```bash
   cd video-service
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Inicie o modo de preview:
   ```bash
   npm start
   ```

---

## 📝 Resumo dos Comandos Principais

| Serviço | Comando de Instalação | Comando de Start | Porta Padrão |
|---------|---------------------|------------------|--------------|
| **Backend** | `cd backend && npm install` | `npm run dev` | 3001 |
| **Frontend** | - | `npx serve frontend` | 3000 (ou outra disponível) |
| **Video** | `cd video-service && npm install` | `npm start` | 3000 (Remotion Studio) |

## 🔑 Variáveis de Ambiente Importantes (Backend)

No arquivo `backend/.env`, as principais variáveis são:
- `DATABASE_URL`: Conexão com o Banco de Dados.
- `JWT_SECRET`: Chave para assinar tokens de login.
- `STRIPE_*`: Chaves do Stripe para pagamentos.
- `GEMINI_API_KEY`: Chave da API do Google Gemini para IA.

