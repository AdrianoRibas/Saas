import { prisma } from "../../config/database.js";
import * as storage from "../../lib/storage.js";
import * as aiService from "./ai.service.js";
import * as multiAgent from "./multi-agent.service.js";
import * as notificationService from "../notifications/notifications.service.js";
import { DocStatus } from "@prisma/client";
import _pdfParse from "pdf-parse";

// Workaround para o erro de 'has no call signatures' no NodeNext com essa lib CommonJS
const pdfParse = _pdfParse as unknown as (data: Buffer) => Promise<{ text: string }>;

/**
 * ADAPTATION WORKER
 *
 * Este worker orquestra o processamento de documentos em background.
 * Para simplificar nesta fase, usaremos um loop de "Polling" interno,
 * mas a estrutura já permite migração para BullMQ/Redis facilmente.
 */

const POLLING_INTERVAL = 10000; // 10 segundos
let isRunning = false;

/**
 * Inicia o worker de processamento
 */
export function startWorker() {
  console.log("🚀 [worker] Iniciando AI Adaptation Worker...");

  // Executa a primeira vez e agenda o loop
  processPendingDocuments();
  setInterval(processPendingDocuments, POLLING_INTERVAL);
}

/**
 * Busca e processa documentos com status PENDING
 */
async function processPendingDocuments() {
  if (isRunning) return; // Evita execuções sobrepostas

  try {
    isRunning = true;

    // Busca o próximo documento da fila
    const document = await prisma.document.findFirst({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
    });

    if (!document) {
      isRunning = false;
      return;
    }

    console.log(
      `\n📦 [worker] Processando documento: ${document.id} (${document.originalName})`,
    );

    // 1. Marcar como PROCESSING para evitar que outros workers peguem
    await prisma.document.update({
      where: { id: document.id },
      data: {
        status: "PROCESSING",
        processingStartedAt: new Date(),
      },
    });

    try {
      // 2. Download do conteúdo original
      const fileBuffer = await storage.downloadFile(document.originalKey);
      let textContent = "";

      // [Melhoria do Debate]: Parseamento de PDF real em vez de cast cego para utf-8
      if (document.originalName.toLowerCase().endsWith(".pdf")) {
        console.log(
          `📄 [worker] Extraindo texto de PDF... (${document.originalName})`,
        );
        const pdfData = await pdfParse(fileBuffer);
        textContent = pdfData.text;
      } else {
        console.log(
          `📄 [worker] Carregando arquivo de texto genérico... (${document.originalName})`,
        );
        textContent = fileBuffer.toString("utf-8");
      }

      // Fallback de segurança se falhar na extração
      if (!textContent || textContent.trim().length === 0) {
        throw new Error(
          "Não foi possível extrair texto do documento original. O arquivo pode estar vazio ou ser uma imagem escaneada sem OCR.",
        );
      }

      // 3. Executar as adaptações em paralelo
      console.log(
        `🤖 [worker] Chamando IA (Incluindo Multi-Agent TEA) para ${document.id}...`,
      );

      const [braille, highLegibility, autism] = await Promise.all([
        aiService.adaptContent(textContent, "braille"),
        aiService.adaptContent(textContent, "high-legibility"),
        multiAgent.adaptForAutism(
          textContent,
          document.organizationId,
          document.studentId || undefined,
        ),
      ]);

      // 4. Upload das versões adaptadas para o Supabase
      const brailleKey = storage.generateFileKey(
        document.organizationId,
        document.originalName,
        "braille",
      );
      const highLegibilityKey = storage.generateFileKey(
        document.organizationId,
        document.originalName,
        "high-legibility",
      );
      const autismKey = storage.generateFileKey(
        document.organizationId,
        document.originalName,
        "autism",
      );

      // 4. Upload das versões adaptadas para o Supabase
      // Nota: uploadFile agora retorna { key }, não mais URL pública para segurança
      await Promise.all([
        storage.uploadFile(
          brailleKey,
          Buffer.from(braille.content),
          "text/plain",
        ),
        storage.uploadFile(
          highLegibilityKey,
          Buffer.from(highLegibility.content),
          "text/markdown",
        ),
        storage.uploadFile(autismKey, Buffer.from(autism), "text/markdown"),
      ]);

      // 5. Finalizar Documento
      await prisma.document.update({
        where: { id: document.id },
        data: {
          status: "COMPLETED",
          processingCompletedAt: new Date(),
          brailleKey,
          brailleUrl: null, // Segurança: Não persistir URL pública
          highLegibilityKey,
          highLegibilityUrl: null,
          autismKey,
          autismUrl: null,
        },
      });

      console.log(
        `✅ [worker] Documento concluído com sucesso: ${document.id}`,
      );

      // 6. Criar notificação para o usuário
      await notificationService.notifyAdaptationSuccess(
        document.userId,
        document.originalName,
        document.id,
      );
    } catch (error: any) {
      console.error(
        `❌ [worker] Erro ao processar documento ${document.id}:`,
        error,
      );

      await prisma.document.update({
        where: { id: document.id },
        data: {
          status: "FAILED",
          errorMessage: error.message || "Erro desconhecido no processamento.",
        },
      });

      // Notificar falha
      await notificationService.notifyAdaptationFailure(
        document.userId,
        document.originalName,
        error.message,
      );
    }

    isRunning = false;

    // Se processou um, tenta processar o próximo imediatamente sem esperar o intervalo
    setImmediate(processPendingDocuments);
  } catch (error) {
    console.error("🔥 [worker] Erro crítico no loop do worker:", error);
    isRunning = false;
  }
}
