---
name: autonomous-agent-patterns
description: Padrões de otimização e orquestração para agentes autônomos e sistemas multi-agentes.
---

# 🤖 Agent Orchestration Patterns

> **Princípio do Lead Engineer:** "Agentes são como estagiários muito rápidos e muito confiantes. Eles precisam de supervisão constante e instruções claras."

## 1. Core Principles

- **Chain of Thought (CoT):** Force o agente a "pensar" antes de agir. (Ex: "Explain your reasoning step-by-step").
- **ReAct (Reason + Act):** O agente deve raciocinar, agir (tool call), observar o resultado e repetir.
- **Memory Management:** A memória é finita. Resuma conversas antigas para não estourar a janela de contexto.

## 2. Implementation Patterns (Do This)

### A. System Prompt Robusto

Defina persona, restrições e formato de saída de forma rígida.

```markdown
# Identity

You are a Senior Data Analyst.

# Rules

- Never invent data.
- Output JSON only.
- If unsure, ask clarifying questions.

# Tools

You have access to [pandas, sql_query].
```

### B. Human-in-the-Loop

Para ações críticas (deletar recursos, enviar email em massa), solicite aprovação.

```typescript
if (action.riskLevel === "HIGH") {
  await notifyUser("Agente quer deletar DB. Aprovar?", action.id);
  await waitForApproval(action.id);
}
```

### C. Multi-Agent Optimization

Use um agente "Crítico" para avaliar a saída do agente "Criador".

1. **Creator:** Gera o código.
2. **Reviewer:** Analisa segurança, performance e bugs.
3. **Manager:** Decide se aprova ou pede revisão.

## 3. Anti-Patterns (Don't Do This)

- ❌ **Open Loop:** Deixar o agente rodar `while(true)` sem limite de passos.
- ❌ **Tool Hallucination:** O agente tentar usar ferramentas que não tem. Liste as ferramentas explicitamente.
- ❌ **Context Overflow:** Passar o banco de dados inteiro no prompt. Use RAG (Retrieval Augmented Generation).

## 4. Métricas de Agente

- **Success Rate:** % de tarefas concluídas sem erro humano.
- **Steps to Completion:** Média de passos para resolver um problema.
- **Cost per Task:** Custo de tokens.
