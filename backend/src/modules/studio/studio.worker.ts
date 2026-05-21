import { prisma } from '../../config/database.js';
import * as storage from '../../lib/storage.js';
import * as notificationService from '../notifications/notifications.service.js';
import { StudioArtifactType } from '@prisma/client';

// ==============================================================================
// STUDIO WORKER - Processamento assíncrono de artefatos do Estúdio
// ==============================================================================

const POLLING_INTERVAL = 8000; // 8 segundos
let isRunning = false;

/**
 * Inicia o worker do Estúdio
 */
export function startStudioWorker() {
    console.log('🎨 [studio-worker] Iniciando Studio Worker...');
    processQueuedArtifacts();
    setInterval(processQueuedArtifacts, POLLING_INTERVAL);
}

/**
 * Busca e processa artefatos com status QUEUED
 */
async function processQueuedArtifacts() {
    if (isRunning) return;

    try {
        isRunning = true;

        const artifact = await prisma.studioArtifact.findFirst({
            where: { status: 'QUEUED' },
            orderBy: { createdAt: 'asc' },
            include: {
                document: {
                    select: {
                        id: true,
                        originalName: true,
                        originalKey: true,
                        organizationId: true,
                    },
                },
            },
        });

        if (!artifact) {
            isRunning = false;
            return;
        }

        console.log(`\n🎨 [studio-worker] Processando artefato: ${artifact.id} (${artifact.type})`);

        // Marcar como PROCESSING
        await prisma.studioArtifact.update({
            where: { id: artifact.id },
            data: {
                status: 'PROCESSING',
                processingStartedAt: new Date(),
            },
        });

        try {
            // 1. Extrair conteúdo do documento original (reaproveitar do storage)
            const textContent = await extractDocumentText(artifact.document.originalKey, artifact.document.originalName);

            // 2. Processar conforme o tipo
            const result = await processArtifactByType(artifact.type, textContent, artifact.config as any);

            // 3. Salvar resultado
            if (result.binary) {
                // Resultado binário (áudio, imagem) → upload para storage
                const key = storage.generateFileKey(
                    artifact.organizationId,
                    `studio-${artifact.type.toLowerCase()}-${artifact.id}`,
                    artifact.type.toLowerCase() as any
                );
                await storage.uploadFile(key, result.binary, result.mimeType || 'application/octet-stream');

                await prisma.studioArtifact.update({
                    where: { id: artifact.id },
                    data: {
                        status: 'COMPLETED',
                        processingCompletedAt: new Date(),
                        resultKey: key,
                    },
                });
            } else {
                // Resultado JSON (quiz, flashcards, slides markdown)
                await prisma.studioArtifact.update({
                    where: { id: artifact.id },
                    data: {
                        status: 'COMPLETED',
                        processingCompletedAt: new Date(),
                        resultData: result.data,
                    },
                });
            }

            console.log(`✅ [studio-worker] Artefato concluído: ${artifact.id}`);

            // Notificar usuário
            await notificationService.createNotification(
                artifact.userId,
                `${getArtifactTypeName(artifact.type)} Pronto! 🎉`,
                `O ${getArtifactTypeName(artifact.type)} do documento "${artifact.document.originalName}" foi gerado com sucesso.`,
                'SUCCESS'
            );

        } catch (error: any) {
            console.error(`❌ [studio-worker] Erro ao processar artefato ${artifact.id}:`, error);

            await prisma.studioArtifact.update({
                where: { id: artifact.id },
                data: {
                    status: 'FAILED',
                    errorMessage: error.message || 'Erro desconhecido no processamento.',
                },
            });

            await notificationService.createNotification(
                artifact.userId,
                `Falha na Geração ❌`,
                `Não foi possível gerar o ${getArtifactTypeName(artifact.type)}: ${error.message}`,
                'ERROR'
            );
        }

        isRunning = false;
        setImmediate(processQueuedArtifacts);

    } catch (error) {
        console.error('🔥 [studio-worker] Erro crítico no loop:', error);
        isRunning = false;
    }
}

/**
 * Extrai texto do documento (reutiliza lógica do adaptation.worker)
 */
async function extractDocumentText(originalKey: string, originalName: string): Promise<string> {
    const fileBuffer = await storage.downloadFile(originalKey);

    if (originalName.toLowerCase().endsWith('.pdf')) {
        // Importação dinâmica com cast para any para evitar erros de build no Render (TS2339)
        const pdfModule: any = await import('pdf-parse');
        const pdfParse = pdfModule.default || pdfModule;
        const pdfData = await pdfParse(fileBuffer);
        return pdfData.text;
    }

    return fileBuffer.toString('utf-8');
}

/**
 * Processa artefato conforme o tipo — INTEGRAÇÃO REAL COM GEMINI 2.5 FLASH
 *
 * Cada tipo possui um system prompt especializado que gera conteúdo estruturado
 * em formato JSON para fácil consumo pelo frontend.
 */
async function processArtifactByType(
    type: StudioArtifactType,
    textContent: string,
    config: Record<string, any>
): Promise<{ binary?: Buffer; mimeType?: string; data?: any }> {

    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY não configurada. Configure no .env para usar o Estúdio.');
    }

    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Truncar texto se muito longo (evitar estouro de contexto)
    const maxChars = 30000;
    const truncatedText = textContent.length > maxChars
        ? textContent.substring(0, maxChars) + '\n\n[... texto truncado por limite de contexto ...]'
        : textContent;

    switch (type) {
        case 'AUDIO_SUMMARY':
            return generateAudioSummary(model, truncatedText, config);

        case 'SLIDES':
            return generateSlides(model, truncatedText, config);

        case 'INFOGRAPHIC':
            return generateInfographic(model, truncatedText, config);

        case 'QUIZ':
            return generateQuiz(model, truncatedText, config);

        case 'FLASHCARDS':
            return generateFlashcards(model, truncatedText, config);

        default:
            throw new Error(`Tipo de artefato não suportado: ${type}`);
    }
}

// ==============================================================================
// GERADORES ESPECIALIZADOS — Cada um com seu prompt de sistema
// ==============================================================================

async function generateAudioSummary(model: any, text: string, config: Record<string, any>) {
    const formatDescriptions: Record<string, string> = {
        DETAILED_ANALYSIS: 'uma análise detalhada e aprofundada',
        SUMMARY: 'um resumo claro e conciso',
        CRITIQUE: 'uma análise crítica com pontos fortes e fracos',
        DEBATE: 'um debate entre dois pontos de vista sobre o conteúdo',
    };
    const durationHint = config.duration === 'SHORT' ? 'curto (máximo 500 palavras)' : 'padrão (1000-1500 palavras)';
    const langMap: Record<string, string> = { 'pt-BR': 'português brasileiro', 'en': 'inglês', 'es': 'espanhol' };
    const language = langMap[config.language] || 'português brasileiro';

    const prompt = `Você é um roteirista educacional. Crie ${formatDescriptions[config.format] || 'um resumo'} do seguinte documento acadêmico.

REGRAS:
- Escreva em ${language}
- Tamanho: ${durationHint}
- O texto será lido em voz alta por um TTS, então:
  - Não use símbolos, fórmulas complexas ou markdown
  - Use frases fluidas e naturais
  - Descreva tabelas e gráficos verbalmente
- Estruture com introdução, desenvolvimento e conclusão

DOCUMENTO:
"""
${text}
"""

Responda APENAS com o roteiro/script pronto para narração.`;

    const result = await model.generateContent(prompt);
    const transcript = result.response.text();

    return {
        data: {
            format: config.format,
            duration: config.duration,
            language: config.language,
            transcript,
        },
    };
}

async function generateSlides(model: any, text: string, config: Record<string, any>) {
    const formatHint = config.format === 'PRESENTER'
        ? 'Slides limpos com bullet points e notas do apresentador. Cada slide deve ter no máximo 4 bullet points.'
        : 'Slides detalhados com texto completo, perfeitos para enviar por e-mail ou ler por si só.';
    const slideCount = config.duration === 'SHORT' ? '5-8' : '10-15';
    const langMap: Record<string, string> = { 'pt-BR': 'português brasileiro', 'en': 'inglês', 'es': 'espanhol' };
    const language = langMap[config.language] || 'português brasileiro';

    const prompt = `Você é um designer de apresentações educacionais. Crie uma apresentação de slides didática.

PERFIL: ${formatHint}
QUANTIDADE: ${slideCount} slides
IDIOMA: ${language}
PROMPT DO PROFESSOR: ${config.prompt || 'Crie uma apresentação usando um estilo ousado e divertido com foco em didática.'}

DOCUMENTO BASE:
"""
${text}
"""

Responda ESTRITAMENTE em JSON válido, sem markdown, neste formato:
{
  "slides": [
    {
      "title": "Título do Slide",
      "content": "Conteúdo completo do slide",
      "speakerNotes": "Notas para o apresentador (opcional)"
    }
  ]
}`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    const parsed = safeJsonParse(raw, { slides: [{ title: 'Erro', content: raw }] });

    return {
        data: {
            format: config.format,
            duration: config.duration,
            language: config.language,
            ...parsed,
        },
    };
}

async function generateInfographic(model: any, text: string, config: Record<string, any>) {
    const styleNames: Record<string, string> = {
        SKETCH: 'esboço de anotação à mão',
        KAWAII: 'kawaii/fofo japonês',
        PROFESSIONAL: 'corporativo/profissional',
        SCIENTIFIC: 'científico/diagrama técnico',
        ANIME: 'anime/mangá',
        CLAY: 'argila/3D clay render',
        EDITORIAL: 'editorial/revista',
        INSTRUCTIVE: 'instrutivo/manual didático',
        BENTO_GRID: 'grade bento/modular',
        BRICKS: 'blocos de construção/LEGO',
    };
    const detailMap: Record<string, string> = {
        LOW: 'resumido (apenas conceitos chave, 3-5 itens)',
        MEDIUM: 'nível médio (8-12 itens com explicações breves)',
        HIGH: 'detalhado (15+ itens com explicações completas)',
    };
    const orientationHint = config.orientation === 'LANDSCAPE' ? 'paisagem (horizontal)' : 'retrato (vertical)';

    const prompt = `Você é um designer de infográficos educacionais. Extraia os conceitos-chave e organize visualmente.

ESTILO: ${styleNames[config.visual_style] || config.visual_style}
ORIENTAÇÃO: ${orientationHint}
DETALHAMENTO: ${detailMap[config.detail_level] || 'médio'}

DOCUMENTO:
"""
${text}
"""

Responda ESTRITAMENTE em JSON válido neste formato:
{
  "title": "Título do Infográfico",
  "sections": [
    {
      "heading": "Título da Seção",
      "icon": "emoji representativo",
      "points": ["ponto 1", "ponto 2"]
    }
  ],
  "summary": "Resumo de conclusão em 1-2 frases"
}`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    const parsed = safeJsonParse(raw, { title: 'Infográfico', sections: [], summary: raw });

    return {
        data: {
            style: config.visual_style,
            orientation: config.orientation,
            detailLevel: config.detail_level,
            ...parsed,
        },
    };
}

async function generateQuiz(model: any, text: string, config: Record<string, any>) {
    const countMap: Record<string, number> = { LESS: 3, DEFAULT: 5, MORE: 10 };
    const difficultyMap: Record<string, string> = {
        EASY: 'fácil (conceitos básicos, respostas diretas)',
        MEDIUM: 'médio (requer compreensão e aplicação)',
        HARD: 'difícil (análise crítica, pegadinhas plausíveis)',
    };
    const questionCount = countMap[config.questionCount] || 5;
    const difficulty = difficultyMap[config.difficulty] || 'médio';

    const prompt = `Você é um professor especialista em avaliações educacionais. Crie um teste de múltipla escolha.

QUANTIDADE: exatamente ${questionCount} questões
DIFICULDADE: ${difficulty}
${config.topic ? `FOCO/TEMA: ${config.topic}` : ''}

DOCUMENTO:
"""
${text}
"""

REGRAS IMPORTANTES:
- Cada questão deve ter EXATAMENTE 4 alternativas
- Apenas UMA alternativa correta por questão
- correctOption é o ÍNDICE (0-3) da alternativa correta
- Inclua uma explicação didática para cada resposta

Responda ESTRITAMENTE em JSON válido neste formato:
{
  "questions": [
    {
      "question": "Pergunta aqui?",
      "options": ["Alternativa A", "Alternativa B", "Alternativa C", "Alternativa D"],
      "correctOption": 0,
      "explanation": "Explicação de por que a resposta A é correta."
    }
  ]
}`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    const parsed = safeJsonParse(raw, { questions: [] });

    // Validar integridade do quiz
    if (parsed.questions) {
        parsed.questions = parsed.questions.map((q: any, i: number) => ({
            index: i,
            question: q.question || `Questão ${i + 1}`,
            options: Array.isArray(q.options) && q.options.length === 4
                ? q.options
                : ['Opção A', 'Opção B', 'Opção C', 'Opção D'],
            correctOption: typeof q.correctOption === 'number' && q.correctOption >= 0 && q.correctOption <= 3
                ? q.correctOption
                : 0,
            explanation: q.explanation || 'Sem explicação disponível.',
        }));
    }

    return {
        data: {
            difficulty: config.difficulty,
            questionCount: config.questionCount,
            topic: config.topic,
            ...parsed,
        },
    };
}

async function generateFlashcards(model: any, text: string, config: Record<string, any>) {
    const langMap: Record<string, string> = { 'pt-BR': 'português brasileiro', 'en': 'inglês', 'es': 'espanhol' };
    const language = langMap[config.language] || 'português brasileiro';

    const prompt = `Você é um especialista em técnicas de estudo e memorização. Crie flashcards educacionais.

IDIOMA: ${language}
QUANTIDADE: 8-12 cartões

DOCUMENTO:
"""
${text}
"""

REGRAS:
- "front" = pergunta ou conceito-chave (curto, direto)
- "back" = resposta ou definição (clara, concisa)
- Cubra os conceitos mais importantes do documento
- Varie entre perguntas, definições e relações causais

Responda ESTRITAMENTE em JSON válido neste formato:
{
  "cards": [
    { "front": "O que é...?", "back": "É a definição de..." }
  ]
}`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    const parsed = safeJsonParse(raw, { cards: [] });

    return {
        data: {
            language: config.language,
            ...parsed,
        },
    };
}

// ==============================================================================
// UTILS
// ==============================================================================

/**
 * Parse JSON robusto — lida com respostas que vêm envoltas em markdown code blocks
 */
function safeJsonParse(raw: string, fallback: any): any {
    try {
        // Tentar parse direto
        return JSON.parse(raw);
    } catch {
        // Tentar extrair JSON de code block ```json ... ```
        const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (match) {
            try { return JSON.parse(match[1].trim()); } catch {}
        }
        // Tentar encontrar o primeiro { ... } ou [ ... ]
        const jsonMatch = raw.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
        if (jsonMatch) {
            try { return JSON.parse(jsonMatch[1]); } catch {}
        }
        console.warn('[studio-worker] Falha ao parsear JSON da IA. Usando fallback.');
        return fallback;
    }
}

/**
 * Nome amigável do tipo de artefato
 */
function getArtifactTypeName(type: StudioArtifactType): string {
    const names: Record<StudioArtifactType, string> = {
        AUDIO_SUMMARY: 'Resumo em Áudio',
        SLIDES: 'Apresentação de Slides',
        INFOGRAPHIC: 'Infográfico',
        QUIZ: 'Teste',
        FLASHCARDS: 'Cartões Didáticos',
    };
    return names[type] || type;
}
