---
name: orchestration:enhance-prompt
description: Refina prompts do usuário usando Chain of Thought e restrições de segurança LGPD/Acessibilidade.
---

# Enhance Prompt for Stitch (Adaptado: Adaptador Docs)

## Missão

Transformar intenções vagas do usuário em instruções estruturadas que respeitem as leis brasileiras (LBI e LGPD) e as restrições técnicas do projeto.

## Pipeline de Melhoria

1. **Chain of Thought**: Sempre force a IA a pensar antes de agir usando `<thinking>`.
2. **Restrições de Segurança**:
   - "Não esqueça do filtro por `organizationId`."
   - "Garanta que campos sensíveis de deficiência sejam tratados via LGPD."
3. **Acessibilidade**: Se o prompt for sobre UI, adicione automaticamente: "Implemente seguindo WCAG 2.1 AA".

## Saída Estruturada

Force a saída em tags XML: `<analysis>`, `<plan>`, `<execution>`.
