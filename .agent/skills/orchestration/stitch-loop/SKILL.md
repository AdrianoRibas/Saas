---
name: orchestration:stitch-loop
description: Loop de build automatizado para sincronizar design e código de forma contínua.
---

# Stitch Build Loop (Adaptado: Adaptador Docs)

## Protocolo de Execução

1. **Check Baton**: Leia o status atual da integração.
2. **Sync**: Force a atualização do `DESIGN.md` antes de qualquer alteração de código.
3. **Commit**: Sempre use commits lógicos e curtos após cada passo do loop de build.
4. **Verify**: Teste o componente gerado em isolamento antes de integrar à produção.
