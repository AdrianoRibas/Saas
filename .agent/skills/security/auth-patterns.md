---
name: auth-implementation-patterns
description: Padrões de autenticação segura e gestão de sessões em ambiente Multi-tenant.
---

# 🔒 Auth Implementation Patterns

> **Princípio do Lead Engineer:** "Não confie no cliente. A identidade é apenas o começo; a autorização (RBAC + Tenant) é o que importa."

## 1. Core Principles

- **Tenant Isolation:** Todo request autenticado DEVE ter um `organizationId` validado.
- **Least Privilege:** O token de acesso deve ter o escopo mínimo necessário.
- **Session Management:** Prefira HTTP-only Cookies para tokens de longa duração.

## 2. Implementation Patterns (Do This)

### A. Middleware de Tenant Guard

Intercepte todas as rotas protegidas para injetar e validar o tenant.

```typescript
// middleware.ts
export default authMiddleware({
  afterAuth(auth, req) {
    if (!auth.userId && !auth.isPublicRoute) {
      return redirectToSignIn({ returnBackUrl: req.url });
    }

    // Multi-tenant check
    if (auth.userId && !auth.orgId) {
      // Se usuário está logado mas sem organização ativa, redireciona para seleção
      const orgSelection = new URL("/org-selection", req.url);
      return NextResponse.redirect(orgSelection);
    }
  },
});
```

### B. Context Injection (React Server Component)

Em Server Components, extraia a auth de forma segura.

```typescript
// app/dashboard/page.tsx
const { userId, orgId } = auth();

if (!orgId) redirect("/select-org");

// Passa orgId explicitamente para queries do DB, nunca confie no frontend
const data = await getDashboardData(orgId);
```

## 3. Anti-Patterns (Don't Do This)

- ❌ **Client-Side Auth Only:** Confiar apenas em `useAuth` no front para proteger botões sensíveis sem validar no backend.
- ❌ **Passing UserID via Body:** Nunca aceite `userId` ou `orgId` no corpo do POST sem verificar se bate com o token de sessão.
- ❌ **Hardcoded Secrets:** Chaves de API no código. Use variáveis de ambiente (`.env`).

## 4. Checklist de Segurança

- [ ] Cookies são `Secure` e `SameSite=Lax/Strict`.
- [ ] Rota de logout invalida a sessão no servidor.
- [ ] Rate limiting ativo nas rotas de login/signup.
