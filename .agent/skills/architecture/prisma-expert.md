---
name: prisma-expert
description: Melhores práticas para modelagem de dados, performance e segurança com Prisma ORM.
---

# 🐘 Prisma Expert (Database/ORM)

> **Princípio do Lead Engineer:** "O banco de dados é a verdade suprema. O Prisma deve refletir a realidade do negócio, não escondê-la com abstrações mágicas."

## 1. Core Principles

- **Schema is King:** O `schema.prisma` deve ser auto-explicativo. Use `@map` para nomes limpos no código e `@db` para tipos específicos.
- **Query Otimizada:** Evite N+1 queries. Use `include` com sabedoria, prefira `select` para reduzir payload.
- **Conexão Segura:** Em Serverless, use Connection Pooling (Prisma Accelerate ou PgBouncer).

## 2. Implementation Patterns (Do This)

### A. Repository Pattern (Soft)

Encapsule lógica de banco complexa para não sujar os Server Actions.

```typescript
// /lib/db/students.ts
export const getStudentWithClass = async (id: string, orgId: string) => {
  return prisma.student.findFirst({
    where: {
      id,
      organizationId: orgId, // 🔒 SEMPRE filtrar por Tenant
      deletedAt: null, // 🗑️ Soft Delete check
    },
    select: {
      id: true,
      name: true,
      class: { select: { name: true } },
    },
  });
};
```

### B. Transactions

Use Interactive Transactions para garantir atomicidade.

```typescript
return await prisma.$transaction(async (tx) => {
  const user = await tx.user.create({ ... });
  await tx.profile.create({ data: { userId: user.id } });
  return user;
});
```

### C. Extension para Soft Delete

Use Prisma Extensions para automatizar filtros globais (ex: Soft Delete).

## 3. Anti-Patterns (Don't Do This)

- ❌ **Logic in Loops:** Executar `prisma.update` dentro de um `map` ou `forEach`. Use `updateMany` ou `transaction`.
- ❌ **Select \*:** Retornar o objeto inteiro (incluindo senhas/hashes) para o frontend. Sempre use `select` ou DTOs.
- ❌ **Implicit Many-to-Many:** Prefira tabelas pivô explícitas (`StudentOnClass`) para poder adicionar metadados na relação (ex: `enrolledAt`).

## 4. Performance Checklist

- [ ] Índices cobrindo campos de busca (`WHERE`) e ordenação (`ORDER BY`).
- [ ] `relationMode = "prisma"` se usar PlanetScale/Neon.
- [ ] Paginação via Cursor (não Offset) para listas grandes.
