---
name: tailwind-patterns
description: Padrões para estilos escaláveis, manuteníveis e consistentes usando Tailwind CSS.
---

# 🎨 Tailwind CSS Patterns

> **Princípio do Lead Engineer:** "Utilidade não significa bagunça. Componentize padrões repetitivos e mantenha o HTML legível."

## 1. Core Principles

- **Single Source of Truth:** Cores, fontes e espaçamentos definidos no `tailwind.config.ts`, não hardcoded (`text-[#123456]` ❌).
- **Mobile First:** Escreva classes base para mobile, depois `sm:`, `md:`, `lg:` para telas maiores.
- **Clareza > Brevidade:** Agrupe classes logicamente (layout, spacing, typography, colors, interactions).

## 2. Implementation Patterns (Do This)

### A. `cn` Utility (clsx + tailwind-merge)

Essencial para criar componentes reutilizáveis que aceitam overrides.

```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Uso:
// <Button className="bg-red-500" /> // Sobrescreve bg-primary com segurança
```

### B. Componentes Primitivos (Atomic Design)

Evite `@apply` no CSS. Crie componentes React pequenos.

```tsx
// components/ui/Button.tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
```

## 3. Anti-Patterns (Don't Do This)

- ❌ **Classes Arbitrárias:** `w-[321px]`. Use o sistema de grid/espaçamento (`w-80` ou calc).
- ❌ **Estilo em JavaScript:** O tempo do CSS-in-JS passou. Use Tailwind ou CSS Modules para animações complexas.
- ❌ **Linhas Quilométricas:** Se a string de classes tem 3 linhas, extraia para um componente ou use variáveis para agrupar (variantes).

## 4. Acessibilidade Visual

- Use `sr-only` para texto visível apenas para leitores de tela.
- Garanta `focus-visible:ring` em elementos interativos.
