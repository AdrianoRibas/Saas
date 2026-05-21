---
name: api-security-best-practices
description: Proteção de APIs contra ataques comuns (OWASP Top 10) e abuso de recursos.
---

# 👮 API Security Best Practices

> **Princípio do Lead Engineer:** "Sua API é a porta de entrada. Se não tiver porteiro (Rate Limit) e detector de metais (Validation), alguém vai entrar armado."

## 1. Core Principles

- **Validate Everything:** Valide inputs (body, query, params) estritamente.
- **Rate Limit:** Proteja recursos caros (LLM, Database) contra DDOS/abuso.
- **CORS Estrito:** Limite quais domínios podem chamar sua API.

## 2. Implementation Patterns (Do This)

### A. Input Validation (Zod Guard)

Se não passar no schema, nem toca no controller.

```typescript
// middleware/validate.ts
export const validate = (schema: ZodSchema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res
      .status(400)
      .json({ error: "Invalid Input", details: result.error });
  }
  next();
};
```

### B. Rate Limiting (Upstash/Redis)

Use Redis para contar requests por IP/User.

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"), // 10 requests por 10s
});

// No Server Action ou Route
const { success } = await ratelimit.limit(userId);
if (!success) throw new Error("Too Many Requests");
```

## 3. Anti-Patterns (Don't Do This)

- ❌ **Erro Verboso:** Retornar stack trace de erro 500 para o cliente. (Mostra estrutura interna).
- ❌ **ID Sequencial:** Usar ID numérico (`/users/1`, `/users/2`) permite enumeração. Use UUID/CUID.
- ❌ **HTTP Methods Incorretos:** Usar GET para ações que mudam estado (CSRF vulnerability).

## 4. OWASP Top 10 Check

- [ ] Injection (SQL/NoSQL) -> Prevenido pelo Prisma/ORM.
- [ ] Broken Auth -> Prevenido pelo Clerk/Auth Service.
- [ ] Data Exposure -> Prevenido pelos DTOs/Selects.
