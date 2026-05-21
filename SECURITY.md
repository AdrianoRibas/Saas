# SECURITY.md — Adaptador Docs SaaS

> Documento baseado nas 4 Perguntas de Segurança do CISO (Rafael Milagre / Lovable × Supabase Masterclass).

---

## Pergunta 1: O QUE EXATAMENTE ESTAMOS CONSTRUINDO?

**Produto:** SaaS B2B multi-tenant de acessibilidade educacional.

**Problema que resolve:** Escolas e universidades precisam adaptar documentos pedagógicos para alunos com deficiências (PCD) — autismo, baixa visão, surdez, dislexia.

**Que dados guardamos:**

- Dados pessoais sensíveis de alunos PCD (`accessibilityTypes`, `accessibilityNotes`, nível de autismo)
- Documentos pedagógicos em PDF (originais + adaptações)
- Dados de pagamento (processados pelo Stripe — não armazenamos cartões)
- Credenciais de login com hash bcrypt
- Logs de auditoria e sessões ativas

**Quem usa:**

- OWNERs (gestores da instituição)
- ADMINs (coordenadores)
- MEMBERs (professores)
- O sistema de IA processa documentos em background

---

## Pergunta 2: O QUE PODE DAR ERRADO?

| Risco                                                 | Impacto        | Probabilidade |
| ----------------------------------------------------- | -------------- | ------------- |
| Cross-tenant leak (aluno de Org A visível para Org B) | Crítico        | Médio         |
| Força bruta em login                                  | Alto           | Alto          |
| Token JWT vazado com longa validade                   | Alto           | Baixo         |
| Dados de alunos PCD expostos                          | Crítico (LGPD) | Médio         |
| API key do Gemini / Stripe exposta em logs            | Alto           | Médio         |
| Upload de arquivo malicioso                           | Médio          | Baixo         |
| Admin incorretamente escalado por bug                 | Crítico        | Baixo         |

---

## Pergunta 3: O QUE ESTAMOS FAZENDO SOBRE ISSO HOJE?

### ✅ Camada 1 — HTTP não guarda segredo

- `helmet` ativo: `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, `CSP`
- Body limit: `10mb` (antes era 50mb)
- Uploads servidos via URL assinada do Supabase Storage (nunca expostos diretamente)

### ✅ Camada 2 — Edge Functions validam os acessos (Auth)

- Rate limiter: 5 tentativas login / 15min por IP (express-rate-limit)
- **Account Lockout:** Bloqueio por 15 minutos após 5 tentativas de senha incorreta
- Senha forte: mínimo 8 chars + 1 maiúscula + 1 número + 1 caractere especial (Zod)
- bcrypt com salt factor 12
- JWT de curta duração + Refresh Tokens revogáveis
- Fluxo de recuperação de senha: token SHA-256 de 32 bytes, expira em 1 hora, uso único

### ✅ Camada 3 — Banco de dados confirma permissão

- `tenantGuard` middleware: TODA rota `/api/*` (exceto auth) exige `organizationId` validado
- Todas as queries do Prisma incluem `organizationId` como filtro obrigatório
- Modelo `AuditLog` registra ações sensíveis (login, remoção, mudança de role)
- Assinatura verificada antes de liberar recursos

### ✅ Camada 4 — Knowledge Base impede a IA de remover segurança

- `.agent/rules/security-rules.md` define regras obrigatórias para o agente de IA
- NUNCA remover `organizationId` de queries
- NUNCA desativar `tenantGuard` ou rate limiters
- NUNCA logar dados sensíveis (senhas, tokens, dados de alunos PCD)

---

## Pergunta 4: ISSO É SUFICIENTE?

**Para o estágio atual: Sim, com ressalvas.**

O app guarda dados sensíveis de alunos PCD (dados de saúde — sujeitos à LGPD, Art. 11).
A proteção atual cobre os riscos de maior probabilidade × impacto.

**Próximos passos prioritários:**

- [ ] Criptografia em repouso para campos PCD sensíveis (AES-256)
- [ ] MFA opcional para roles OWNER e ADMIN
- [ ] Teste de penetração antes do lançamento público
- [ ] Política de retenção e deleção de dados (LGPD)
- [ ] Monitoramento de anomalias (ex.: acesso fora do horário comercial)
