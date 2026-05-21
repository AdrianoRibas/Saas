---
name: nextjs-best-practices
description: Diretrizes para arquitetura Next.js 14+ (App Router), Server Actions e React Server Components.
---

# ⚛️ Next.js Best Practices (App Router)

> **Princípio do Lead Engineer:** "Mova para o servidor o que puder. Mantenha no cliente apenas o que interage."

## 1. Core Principles

- **Server by Default:** Todo componente é Server Component até que precise de interatividade (`onClick`, `useState`).
- **Data on the Edge:** Busque dados o mais próximo possível de onde são usados (Colocation).
- **URL as State:** Mantenha filtros, paginação e buscas na URL (`searchParams`), não em `useState`.

## 2. Implementation Patterns (Do This)

### A. Server Actions com Validação (Zod)

Nunca confie no input do cliente.

```typescript
// /actions/create-student.ts
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

const schema = z.object({
  name: z.string().min(3),
  email: z.string().email(),
});

export async function createStudent(prevState: any, formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { error: parsed.error.flatten() };
  }

  // Mutação no BD...
  revalidatePath("/students");
  return { success: true };
}
```

### B. Suspense Streaming

Não bloqueie a página inteira. Use `<Suspense>` para partes lentas.

```tsx
export default function Dashboard() {
  return (
    <main>
      <h1>Bem-vindo</h1>
      <Suspense fallback={<StatsSkeleton />}>
        <StatsWidget />
      </Suspense>
      <Suspense fallback={<ListSkeleton />}>
        <RecentActivity />
      </Suspense>
    </main>
  );
}
```

## 3. Anti-Patterns (Don't Do This)

- ❌ **"use client" no topo de tudo:** Vício de quem vem do Pages Router. Só use se realmente precisar de hooks do React.
- ❌ **API Routes desnecessárias:** Se interage com seu próprio DB, use Server Actions. API Routes (`route.ts`) são para webhooks ou acesso externo.
- ❌ **Prop Drilling gigante:** Use Context ou Zusland para estado global _se necessário_, mas prefira Composição de Componentes.

## 4. Performance

- Use `next/image` sempre.
- Otimize fontes com `next/font`.
- Gere metadados estáticos ou dinâmicos (`generateMetadata`) para SEO.
