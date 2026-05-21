---
description: Regras de Segurança Obrigatórias para o Agente de IA (Camada 4 — Knowledge Base)
---

# 🔐 Security Rules — Adaptador Docs SaaS

## REGRA FUNDAMENTAL

**Segurança NÃO é uma trava. É um acelerador.**
Antes de "resolver" qualquer bug removendo validação, pergunte: isso cria uma vulnerabilidade?

---

## 🚫 NUNCA FAÇA ISSO

### 1. NUNCA remova organizationId de queries do Prisma

```typescript
// ❌ ERRADO — expõe dados de outros tenants
const docs = await prisma.document.findMany();

// ✅ CORRETO — isolamento por tenant garantido
const docs = await prisma.document.findMany({
  where: { organizationId: req.organizationId },
});
```

### 2. NUNCA desative o tenantGuard nas rotas protegidas

```typescript
// ❌ ERRADO
app.use("/api/documents", documentsRoutes); // sem tenantGuard

// ✅ CORRETO — tenantGuard já aplicado globalmente em app.use('/api', tenantGuard)
```

### 3. NUNCA logue dados sensíveis

```typescript
// ❌ ERRADO
console.log("User password:", password);
console.log("Token:", jwtToken);
console.log("Student data:", student.accessibilityNotes);

// ✅ CORRETO
console.log("Login attempt for userId:", userId);
```

### 4. NUNCA retorne o passwordHash em respostas de API

```typescript
// ❌ ERRADO
return prisma.user.findUnique({ where: { id } });

// ✅ CORRETO — sempre use select explícito
return prisma.user.findUnique({
  where: { id },
  select: { id: true, email: true, name: true, role: true },
});
```

### 5. NUNCA reduza validações Zod para "liberar" uma rota

```typescript
// ❌ ERRADO — "funciona" mas abre injection
const input = req.body;

// ✅ CORRETO
const input = mySchema.parse(req.body);
```

### 6. NUNCA aceite organizationId do body/query sem validar no JWT primeiro

```typescript
// ❌ ERRADO — user pode forjar o organizationId
const orgId = req.body.organizationId;

// ✅ CORRETO — organizationId sempre vem do tenantGuard (extraído do JWT)
const orgId = req.organizationId; // populado pelo middleware
```

---

## ✅ SEMPRE FAÇA ISSO

- Use `req.organizationId` (setado pelo `tenantGuard`) como filtro em TODA query
- Use `asyncHandler` em todas as rotas para capturar erros sem vazar stack traces
- Use `AppError` para erros esperados (não `throw new Error()` cru)
- Valide `req.user?.role` antes de operações de admin
- Implemente rate limiting em rotas que aceitam input do usuário
- Use `select` explícito no Prisma — nunca retorne campos desnecessários
- Mantenha o `helmet()` como primeiro middleware
- Tokens de reset de senha: sempre SHA-256, sempre 1 hora de expiração, sempre uso único

---

## 📋 CHECKLIST ANTES DE QUALQUER NOVA ROTA

- [ ] Rota está protegida por `requireAuth`?
- [ ] Rota filtra por `organizationId`?
- [ ] Input validado com Zod?
- [ ] Resposta não vaza dados sensíveis?
- [ ] Rate limiter adequado aplicado?
- [ ] Erros tratados com `AppError`?

---

## 🔐 MODELO DE DADOS SENSÍVEIS (LGPD)

Os seguintes campos são dados sensíveis (Art. 11 LGPD) e requerem cuidado especial:

- `Student.accessibilityTypes` — tipo de deficiência
- `Student.accessibilityNotes` — observações clínicas
- `Student.autismLevel` — nível do espectro autista
- `Student.isPcd` — condição PCD

**Regra:** Estes campos só devem aparecer em respostas quando o usuário tem `organizationId` correspondente E role OWNER/ADMIN.
