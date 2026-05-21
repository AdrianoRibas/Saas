---
name: security-compliance
description: Diretrizes para conformidade LGPD/GDPR e proteção de dados sensíveis.
---

# 🛡️ Security & Compliance (GDPR/LGPD)

> **Princípio do Lead Engineer:** "Dados são tóxicos. Colete apenas o necessário, proteja como se fosse ouro e delete quando solicitado."

## 1. Core Principles

- **Privacy by Design:** A privacidade é o padrão, não uma opção.
- **Right to Erasure:** O usuário deve poder deletar seus dados (e isso deve propagar para backups/logs se possível).
- **Data Minimization:** Não colete o que não usa.

## 2. Implementation Patterns (Do This)

### A. PII Redaction in Logs

Nunca logue dados pessoais (email, CPF, telefone).

```typescript
// utils/logger.ts
const redactSensitive = (obj: any) => {
  const sensitiveKeys = ["email", "cpf", "password", "token"];
  // Lógica recursiva para mascarar chaves...
  return JSON.stringify(obj, (key, value) => {
    if (sensitiveKeys.includes(key)) return "***";
    return value;
  });
};

console.log("User action:", redactSensitive(payload));
```

### B. Soft Delete vs Hard Delete

Implemente "Lixeira" (30 dias) antes de Hard Delete para cumprir requisitos legais de auditoria vs esquecimento.

- **Soft Delete:** `deletedAt = new Date()` (usuário "deletou").
- **Hard Delete:** Cron job limpa registros com `deletedAt > 30 days`.

### C. Consent Management

Registre o aceite de termos e políticas com timestamp e versão.

```prisma
model UserConsent {
  id        String   @id @default(cuid())
  userId    String
  termVersion String // ex: "v1.2"
  acceptedAt DateTime @default(now())
  ipAddress  String? // para auditoria legal
}
```

## 3. Anti-Patterns (Don't Do This)

- ❌ **Logs Verborrágicos:** Logar o body inteiro do request (pode conter senhas).
- ❌ **Banco de Dados Público:** Deixar a porta do Postgres aberta para a internet (0.0.0.0) sem restrição de IP.
- ❌ **Dependências Vulneráveis:** Ignorar alertas do `npm audit`.

## 4. Checklist Legal

- [ ] Política de Privacidade acessível.
- [ ] Banner de Cookies funcional.
- [ ] Auditoria de acesso (quem acessou o quê).
