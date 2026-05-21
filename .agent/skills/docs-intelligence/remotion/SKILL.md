---
name: docs:remotion
description: Gera vídeos de walkthrough ou vídeos de acessibilidade (LIBRAS/Legendas) usando o Video-Service Remotion.
---

# Stitch to Remotion (Adaptado: Adaptador Docs)

## Objetivo

Criar vídeos programáticos no diretório `/video-service` para demonstrar funcionalidades ou fornecer conteúdo acessível.

## Fluxo de Trabalho

1. **Assets**: Capture os assets das telas via Stitch.
2. **Composição**: Crie os componentes Remotion seguindo o design original.
3. **Acessibilidade**: Vídeos que contenham áudio DEVEM prever espaço para janelas de LIBRAS e legendas dinâmicas.
4. **Render**: Use `npm run render` dentro de `/video-service`.

## Arquitetura

- `/video-service/src/compositions`: Local para os vídeos.
- `/video-service/src/components`: Componentes reutilizáveis do vídeo.
