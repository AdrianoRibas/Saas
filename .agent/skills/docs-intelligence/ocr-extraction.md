---
name: document-intelligence-ocr
description: Padrões para extração inteligente de dados e layout de documentos (PDF, Imagens) focando em estrutura semântica.
---

# 📄 Document Intelligence & OCR Patterns

> **Princípio do Lead Engineer:** "Texto bruto é lixo. Precisamos da _estrutura_ (títulos, tabelas, parágrafos) para gerar acessibilidade real."

## 1. Core Principles

- **Estrutura > Texto:** Não extraia apenas strings. Preserve headers, listas e tabelas para reconstruir a semântica.
- **Cloud Native:** Use serviços robustos (Azure AI/AWS Textract) em vez de libs locais frágeis para documentos complexos.
- **Fail Gracefully:** Se o OCR falhar, tenha um fluxo de fallback ou alerta claro para o usuário.

## 2. Implementation Patterns (Do This)

### A. Azure Document Intelligence (Node.js SDK)

Use o modelo de layout (`prebuilt-layout`) para identificar estrutura.

```typescript
import {
  DocumentAnalysisClient,
  AzureKeyCredential,
} from "@azure/ai-form-recognizer";

const client = new DocumentAnalysisClient(
  endpoint,
  new AzureKeyCredential(key),
);

async function analyzeDocument(fileUrl: string) {
  // Use 'prebuilt-layout' para detectar parágrafos, tabelas e seleção
  const poller = await client.beginAnalyzeDocumentFromUrl(
    "prebuilt-layout",
    fileUrl,
  );
  const result = await poller.pollUntilDone();

  return {
    paragraphs: result.paragraphs.map((p) => ({
      content: p.content,
      role: p.role,
    })), // role identifica titulo, etc
    tables: result.tables,
    // Mapear para nosso formato interno limpo
  };
}
```

### B. Limpeza e Normalização

Sempre sanitize o output do OCR antes de salvar.

```typescript
const cleanText = (text: string) => {
  return text
    .replace(/\s+/g, " ") // Remove white-space excessivo
    .trim();
};
```

### C. Pipeline de Processamento (Queue)

OCR é lento. Nunca faça na thread de request principal.

1. Upload → Storage.
2. Publish Message (RabbitMQ/Redis).
3. Worker processa OCR.
4. Worker salva resultado e notifica (Webhook/Socket).

## 3. Anti-Patterns (Don't Do This)

- ❌ **Regex Parsing:** Tentar extrair dados de PDFs complexos usando Regex em texto plano. É frágil e inmanutenível.
- ❌ **Síncrono:** Bloquear o request HTTP esperando o OCR terminar (pode levar 30s+).
- ❌ **Ignorar Confiança:** Aceitar qualquer resultado. Verifique o `confidence score`. Se < 0.8, marque para revisão humana.
- ❌ **Dependência de Layout Visual:** Assumir que "texto na coordenada X,Y é sempre o cabeçalho". Layouts mudam.

## 4. Decisão de Stack

- **Simples/Rápido:** `pdf-parse` (apenas texto, sem estrutura).
- **Estruturado/Enterprise:** Azure Document Intelligence (Layout Model).
- **Híbrido:** `tesseract.js` (apenas se precisar rodar local/edge, mas qualidade é inferior).
