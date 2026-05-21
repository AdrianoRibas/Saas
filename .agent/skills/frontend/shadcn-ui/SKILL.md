---
name: frontend:shadcn-ui
description: Integra componentes shadcn/ui garantindo que as customizações respeitem o sistema de acessibilidade do projeto.
---

# shadcn/ui Integration (Adaptado: Adaptador Docs)

## Regras de Ouro

1. **Nomes Claros**: Não altere os nomes padrão do shadcn para manter compatibilidade.
2. **Acessibilidade**: Componentes como `Dialog`, `Popover` e `Tooltip` devem ser auditados para garantir que o foco seja gerenciado corretamente (Keyboard navigation).
3. **Theming**: Todas as cores do `globals.css` do shadcn devem referenciar as nossas variáveis de tema (`--primary`, `--background`, etc).
