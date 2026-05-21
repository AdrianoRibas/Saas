---
name: react:components
description: Converte designs do Stitch em componentes React modulares, garantindo Multi-tenancy e Tipagem Estrita.
---

# Stitch to React Components (Adaptado: Adaptador Docs)

## ⚠️ REGRAS INEGOCIÁVEIS

1. **Multi-tenancy Rígido**: Todo componente que buscar dados (via logs ou hooks) DEVE incluir ou respeitar o `organizationId`.
2. **Whitelabel**: Use `ThemeContext` e classes Tailwind que referenciem o tema dinâmico do projeto.
3. **Acessibilidade**: Todo elemento interativo DEVE possuir `aria-label` e suporte a teclado.

## Passo a Passo

1. **Metadata fetch**: Use `stitch:get_screen`.
2. **Logic isolation**: Mova handlers para hooks em `src/hooks/`.
3. **Type safety**: Use interfaces `Readonly<[ComponentName]Props>`.
4. **Validation**: Rode `npm test` para garantir que o componente não quebra os padrões de segurança.
