import { GoogleGenerativeAI } from '@google/generative-ai';
import * as multiAgent from './multi-agent.service.js';
import { config } from '../../config/index.js';
import { AppError } from '../../middleware/errorHandler.js';

// ==============================================================================
// AI SERVICE - Motor de Adaptação com Gemini 2.5 Flash
// ==============================================================================

if (!process.env.GEMINI_API_KEY) {
    console.warn('⚠️ GEMINI_API_KEY não configurada. Funcionalidade de IA desativada.');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Sugerimos o modelo 2.5 Flash conforme instrução do Head
const MODEL_NAME = 'gemini-2.5-flash';

/**
 * Interface para o resultado da adaptação
 */
export interface AdaptationResult {
    content: string;
    originalLanguage?: string;
}

/**
 * Tipo de adaptação solicitada
 */
export type AdaptationType = 'braille' | 'high-legibility' | 'audio' | 'autism';

// ==============================================================================
// PROMPTS DO SISTEMA (Prompts "Prime")
// ==============================================================================

const SYSTEM_PROMPTS = {
    braille: `Você é um especialista em transcrição para Braille (Grau 1 e 2). 
        Sua tarefa é converter o texto de entrada em uma representação textual clara que será enviada para uma impressora Braille.
        Mantenha a estrutura de parágrafos. Remova elementos visuais irrelevantes, mas descreva imagens importantes se houver "alt-text".
        Retorne APENAS o texto para transcrição.`,

    'high-legibility': `Você é um especialista em acessibilidade e inclusão escolar (WCAG 2.1 AA). 
        Sua tarefa é adaptar o texto para alunos com baixa visão ou dislexia.
        REGRAS:
        1. Use linguagem clara e direta.
        2. Organize o conteúdo com títulos semânticos claros (H1, H2).
        3. Aumente o espaçamento entre parágrafos na descrição textual.
        4. Descreva todas as imagens e gráficos de forma detalhada.
        5. Se houver fórmulas complexas, simplifique a explicação textual.
        Retorne o conteúdo em formato Markdown estruturado.`,

    audio: `Você é um roteirista especializado em acessibilidade auditiva. 
        Sua tarefa é converter o texto de entrada em um script fluido para ser lido por uma IA de conversão de texto em fala (TTS).
        Descreva elementos visuais e tabelas de forma narrativa para que façam sentido apenas pelo som.`,
    
    autism: `Você é um especialista em acessibilidade cognitiva (TEA). 
        Sua tarefa é simplificar o texto seguindo diretrizes científicas. 
        (Esta é uma instrução base, a adaptação real é processada via sistema multi-agente).`
};

/**
 * Executa a adaptação de um texto usando IA
 */
export async function adaptContent(
    text: string,
    type: AdaptationType,
    customInstructions?: string,
    file?: string,
    mimeType?: string,
    organizationId?: string
): Promise<AdaptationResult> {
    if (!process.env.GEMINI_API_KEY) {
        throw new AppError('Gemini API Key não configurada', 500, 'AI_CONFIG_ERROR');
    }

    if (type === 'autism') {
        if (!organizationId) throw new Error('organizationId é obrigatório para adaptação TEA');
        const content = await multiAgent.adaptForAutism(text, organizationId);
        return { content };
    }

    try {
        const model = genAI.getGenerativeModel({ 
            model: MODEL_NAME,
            systemInstruction: SYSTEM_PROMPTS[type]
        });

        const prompt = customInstructions 
            ? `Instruções Adicionais do Professor: ${customInstructions}`
            : ``;

        const contentParts: any[] = [];
        if (text) contentParts.push(text);
        if (prompt) contentParts.push(prompt);
        
        if (file && mimeType) {
            contentParts.push({
                inlineData: {
                    data: file,
                    mimeType: mimeType
                }
            });
        }

        const result = await model.generateContent(contentParts);
        const response = await result.response;
        const content = response.text();

        if (!content) {
            throw new Error('A IA retornou um conteúdo vazio.');
        }

        return { content };
    } catch (error: any) {
        console.error(`[AI_SERVICE_ERROR] Falha na adaptação (${type}):`, error);
        throw new AppError(
            `Falha na adaptação via IA: ${error.message}`,
            500,
            'AI_ADAPTATION_FAILED'
        );
    }
}

/**
 * Executa a adaptação em streaming
 */
export async function* adaptContentStream(
    text: string,
    type: AdaptationType,
    customInstructions?: string,
    file?: string,
    mimeType?: string,
    organizationId?: string
) {
    if (!process.env.GEMINI_API_KEY) {
        throw new AppError('Gemini API Key não configurada', 500, 'AI_CONFIG_ERROR');
    }

    if (type === 'autism') {
        if (!organizationId) throw new Error('organizationId é obrigatório para adaptação TEA');
        const content = await multiAgent.adaptForAutism(text, organizationId);
        yield content;
        return;
    }

    try {
        const model = genAI.getGenerativeModel({ 
            model: MODEL_NAME,
            systemInstruction: SYSTEM_PROMPTS[type]
        });

        const prompt = customInstructions 
            ? `Instruções Adicionais do Professor: ${customInstructions}`
            : ``;

        const contentParts: any[] = [];
        if (text) contentParts.push(text);
        if (prompt) contentParts.push(prompt);
        
        if (file && mimeType) {
            contentParts.push({
                inlineData: {
                    data: file,
                    mimeType: mimeType
                }
            });
        }

        const result = await model.generateContentStream(contentParts);

        for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            if (chunkText) {
                yield chunkText;
            }
        }
    } catch (error: any) {
        console.error(`[AI_SERVICE_STREAM_ERROR] Falha no streaming (${type}):`, error);
        throw new AppError(
            `Falha no streaming via IA: ${error.message}`,
            500,
            'AI_STREAM_FAILED'
        );
    }
}

/**
 * Gera um resumo rápido do documento para o Dashboard
 */
export async function generateSummary(text: string): Promise<string> {
    try {
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });
        const prompt = `Faça um resumo de no máximo 2 parágrafos para este documento acadêmico:\n\n${text}`;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error('[AI_SERVICE_ERROR] Falha ao gerar resumo:', error);
        return 'Resumo indisponível.';
    }
}
