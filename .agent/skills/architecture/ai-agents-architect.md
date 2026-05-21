---
name: ai-agents-architect
description: Padrões de arquitetura para Sistemas Multi-Agentes (Squad Model) e integração de LLMs.
---

# 🏗️ AI Agents Architect

> **Princípio do Lead Engineer:** "Um agente é um especialista limitado. A inteligência emerge da orquestração, não de um 'super-prompt' gigante."

## 1. Core Principles

- **Especialização:** Divida tarefas complexas em agentes menores (e.g., "Reviewer", "Coder", "Architect").
- **Contexto Limitado:** Não inunde o contexto. Use RAG ou resumos para manter a precisão.
- **Fail-Fast:** Se o agente alucinar ou falhar, reinicie o passo com feedback, não tente corrigir infinitamente.

## 2. Implementation Patterns (Do This)

### A. Squad Model (Orchestrator Pattern)

Um agente central (Router) decide qual especialista chamar.

```typescript
// Exemplo Conceitual
async function orchestrateTask(task: string) {
  const plan = await plannerAgent.createPlan(task);

  for (const step of plan.steps) {
    switch (step.type) {
      case "code":
        await codingAgent.execute(step);
        break;
      case "review":
        await reviewerAgent.audit(step);
        break;
      case "test":
        await qaAgent.validate(step);
        break;
    }
  }
}
```

### B. Structured Outputs (JSON Mode)

Sempre force output estruturado. Texto livre é difícil de integrar.

```typescript
// ✅ BOM: Usando Zod para validar output da LLM
const ResultSchema = z.object({
  reasoning: z.string(),
  code: z.string(),
  confidence: z.number().min(0).max(1),
});
```

## 3. Anti-Patterns (Don't Do This)

- ❌ **God Prompt:** Um único prompt de 500 linhas tentando fazer tudo.
- ❌ **Loop Infinito:** Agentes conversando entre si sem condição de parada clara.
- ❌ **Trust without Verify:** Executar código gerado por LLM sem sandbox ou revisão humana (copilot mode).

## 4. Integração no Projeto

- Use para: Classificação de documentos, extração de metadados, geração de drafts.
- Não use para: Lógica de auth crítica, migrações de banco destrutivas (sem supervisão).
