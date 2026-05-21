---
name: accessibility-audit-wcag
description: Framework de decisão para garantir acessibilidade nível WCAG 2.1 AA/AAA em todas as interfaces.
---

# ♿ Accessibility Audit (WCAG 2.1 AA)

> **Princípio do Lead Engineer:** "Acessibilidade não é uma feature, é a fundação. Se não é acessível, não está pronto."

## 1. Core Principles

- **Semântica Primeiro:** Use HTML nativo (`<button>`, `<nav>`, `<main>`) antes de ARIA.
- **Teclado Navegável:** Tudo deve ser operável apenas com Tab/Enter/Space.
- **Contraste Rígido:** Mínimo de 4.5:1 para texto normal, 3:1 para grande.
- **Feedback Sensorial:** Não dependa apenas de cor para indicar estado (erro/sucesso).

## 2. Implementation Patterns (Do This)

### A. Auditoria Automatizada (axe-core)

Integre `axe-core` nos testes E2E (Playwright/Cypress) ou via Jest.

```typescript
// Exemplo com Playwright
import { injectAxe, checkA11y } from "axe-playwright";

test("deve passar na auditoria de acessibilidade", async ({ page }) => {
  await page.goto("/dashboard");
  await injectAxe(page);
  await checkA11y(page, null, {
    detailedReport: true,
    detailedReportOptions: { html: true },
  });
});
```

### B. Componentes Acessíveis (Headless UI/Radix)

Não reinvente a roda. Use bibliotecas _headless_ que já tratam focus management.

```tsx
// ✅ BOM: Usando Radix UI Dialog
import * as Dialog from "@radix-ui/react-dialog";

export const Modal = () => (
  <Dialog.Root>
    <Dialog.Trigger>Abrir</Dialog.Trigger>
    <Dialog.Content>
      <Dialog.Title>Título Acessível</Dialog.Title>
      <Dialog.Description>Descrição para leitores de tela.</Dialog.Description>
      <Dialog.Close>Fechar</Dialog.Close>
    </Dialog.Content>
  </Dialog.Root>
);
```

### C. Gestão de Foco

Sempre gerencie o foco ao abrir/fechar modais, gavetas ou rotas.

## 3. Anti-Patterns (Don't Do This)

- ❌ **Div Soup:** `<div onClick={...}>` (Use `<button type="button">`).
- ❌ **ARIA Abuse:** Usar `aria-label` para corrigir HTML ruim. Se o elemento tem texto visível, ele não precisa de `aria-label` redundante.
- ❌ **Focus Outline: none:** Nunca remova o outline de foco via CSS sem prover uma alternativa clara (`box-shadow`).
- ❌ **Placeholder como Label:** Placeholders somem e contrastam mal. Use `<label>` real.

## 4. Checklist de Release (Definition of Done)

- [ ] Navegação completa via Tab (sem focus trap indesejado).
- [ ] Zoom de 200% não quebra o layout.
- [ ] Leitor de tela (NVDA/VoiceOver) lê a ordem lógica.
- [ ] Sem erros no Axe DevTools (Chrome Extension).
