---
name: frontend:design-md
description: Gera o DESIGN.md extraindo identidade visual do Stitch, com foco em Acessibilidade e Auditoria de Contraste.
---

# Stitch DESIGN.md Skill (Adaptado: Adaptador Docs)

Esta habilidade extrai a identidade visual de um design Stitch e a transforma em um guia técnico `DESIGN.md`.

## ⚠️ REGRAS CRÍTICAS (ADAPTADOR DOCS)

1. **Auditoria de Contraste**: Ao mapear a paleta de cores, verifique se as combinações texto/fundo respeitam o rácio mínimo de 4.5:1 (WCAG AA). Informe no `DESIGN.md` se houver falhas.
2. **Whitelabel**: Todas as cores devem ser mapeadas para variáveis CSS (`--color-*`) para suportar o sistema de temas do projeto.

## Instruções de Análise

1. **Extrair Identidade**: Analise o JSON do Stitch para identificar a marca.
2. **Definir a Atmosfera**: Descreva o estilo visual (Glassmorphism, Minimalista, etc.).
3. **Mapear Paleta**: Gere o `tailwind.config` usando as variáveis do nosso sistema.

## Formato de Saída (DESIGN.md)

O arquivo deve conter seções para: Identidade, Cores, Tipografia, Componentes e **Relatório de Acessibilidade**.
