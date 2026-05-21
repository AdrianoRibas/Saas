import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../../config/database.js';
import * as knowledgeService from '../knowledge/knowledge.service.js';
import { AppError } from '../../middleware/errorHandler.js';

// ==============================================================================
// MULTI-AGENT TEA SERVICE
// ==============================================================================

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const MODEL_NAME = 'gemini-2.5-flash';

/**
 * Interface para os resultados dos agentes
 */
interface AgentOutcome {
    analystNotes: string;
    scientificGuidelines: string;
    adaptedContent: string;
    reviewPassed: boolean;
    reviewNotes?: string;
}

/**
 * Orquestra a adaptação multi-agente para autismo (TEA)
 */
export async function adaptForAutism(
    textContent: string,
    organizationId: string,
    studentId?: string
): Promise<string> {
    if (!process.env.GEMINI_API_KEY) {
        throw new AppError('Gemini API Key não configurada', 500, 'AI_CONFIG_ERROR');
    }

    try {
        console.log(`🤖 [Multi-Agent] Iniciando adaptação TEA para Org: ${organizationId}`);

        // 1. AGENTE ANALISTA: Identifica barreiras cognitivas
        const analystNotes = await runAnalyst(textContent);
        console.log('✅ [Multi-Agent] Agente Analista concluiu diagnóstico.');
        
        // Novo: Buscar nível de autismo do aluno se disponível
        let autismLevel: number | undefined;
        if (studentId) {
            const student = await prisma.student.findUnique({
                where: { id: studentId },
                select: { autismLevel: true }
            });
            autismLevel = student?.autismLevel || undefined;
            if (autismLevel) {
                console.log(`ℹ️ [Multi-Agent] Nível de Autismo detectado: ${autismLevel}`);
            }
        }

        // 2. AGENTE PESQUISADOR (RAG): Busca diretrizes científicas
        const guidelines = await runResearcher(analystNotes, organizationId, autismLevel);
        console.log('✅ [Multi-Agent] Agente Pesquisador recuperou diretrizes.');
        
        // Contexto cognitivo avançado com base no nível de suporte
        let levelContextDesc = "";
        if (autismLevel === 1) levelContextDesc = "Perfil de Suporte Leve: pensamento inflexível ou literal, dificuldades com ambiguidades e ironias, necessidade de enunciados diretos e literais, e controle de sobrecarga de dados extrínsecos.";
        if (autismLevel === 2) levelContextDesc = "Perfil de Suporte Substancial: limitação moderada na linguagem verbal ou compreensão, necessidade estrita de fragmentação de informações (chunking) e pareamento de instruções com dicas visuais preditivas.";
        if (autismLevel === 3) levelContextDesc = "Perfil de Suporte Muito Substancial: severas restrições linguísticas/não-verbais, dependência central de Comunicação Aumentativa Alternativa (CAA/AAC), foco total em material concreto e frases elementares reduzidas.";
        
        const levelContext = autismLevel ? `\n\n[PERFIL NEUROCOGNITIVO DA ADAPTAÇÃO]\nMolde a adaptação estritamente nestas premissas de processamento cognitivo e de linguagem: ${levelContextDesc}` : "";

        // 3. AGENTE ADAPTADOR: Executa a reescrita
        let adaptedContent = await runAdapter(textContent, analystNotes, guidelines, undefined, levelContext);
        console.log('✅ [Multi-Agent] Agente Adaptador gerou primeira versão.');

        // 4. AGENTE REVISOR: Valida e refina
        const review = await runReviewer(textContent, adaptedContent, guidelines);
        
        if (!review.reviewPassed && review.reviewNotes) {
            console.log('⚠️ [Multi-Agent] Agente Revisor solicitou ajustes. Refinando...');
            adaptedContent = await runAdapter(textContent, analystNotes, guidelines, review.reviewNotes, levelContext);
        }

        console.log('✅ [Multi-Agent] Adaptação concluída com sucesso.');
        return adaptedContent;

    } catch (error: any) {
        console.error('[MULTI_AGENT_ERROR] Falha na orquestração:', error);
        throw new AppError(`Falha no sistema multi-agente: ${error.message}`, 500, 'MULTI_AGENT_FAILED');
    }
}

/**
 * AGENTE 1: ANALISTA COGNITIVO
 */
async function runAnalyst(content: string): Promise<string> {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `Você é um Analista Psicopedagógico especializado em TEA.
        Analise o texto abaixo e identifique barreiras à compreensão para alunos autistas.
        Foque em: metáforas, ambiguidades, textos longos, falta de estrutura sequencial e linguagem figurada.
        
        Texto Original:
        ${content}
        
        Retorne um relatório sucinto das barreiras encontradas.`;

    const result = await model.generateContent(prompt);
    return result.response.text();
}

/**
 * AGENTE 2: PESQUISADOR (RAG)
 */
async function runResearcher(analystNotes: string, organizationId: string, autismLevel?: number): Promise<string> {
    // Busca na base de conhecimento (KnowledgeBase) usando palavras-chave do analista e nível de autismo
    // Extraímos os termos principais das notas do analista para a busca
    const knowledgeEntries = await knowledgeService.findRelevant(analystNotes, organizationId, autismLevel);

    const context = knowledgeEntries.length > 0 
        ? knowledgeEntries.map((e: any) => `Artigo: ${e.title}\nConteúdo: ${e.content}`).join('\n\n')
        : "Nenhuma diretriz específica encontrada na base de conhecimento. Use diretrizes gerais de WCAG e linguagem simples.";

    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `Você é um Pesquisador Acadêmico em Inclusão Escolar.
        Com base nestas notas do analista e na literatura científica abaixo, extraia as REGRAS EXATAS que devem ser aplicadas nesta adaptação.
        
        Notas do Analista:
        ${analystNotes}
        
        Literatura Científica (Knowledge Base):
        ${context}
        
        Retorne apenas a lista de diretrizes científicas a serem seguidas.`;

    const result = await model.generateContent(prompt);
    return result.response.text();
}

/**
 * AGENTE 3: ADAPTADOR
 */
async function runAdapter(
    originalContent: string, 
    analystNotes: string, 
    guidelines: string,
    revisionNotes?: string,
    levelContext: string = ""
): Promise<string> {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `Você é um Designer Instrucional de Conteúdo Acessível especializado em autismo${levelContext}.
        Sua missão é adaptar o texto original seguindo o diagnóstico do analista e as diretrizes científicas recuperadas.
        
        Texto Original:
        ${originalContent}
        
        Diagnóstico das Barreiras:
        ${analystNotes}
        
        Diretrizes Científicas (Aplique estas regras):
        ${guidelines}
        
        ${revisionNotes ? `ATENÇÃO: Revisor solicitou estas correções: ${revisionNotes}` : ''}
        
        Retorne o texto adaptado (formato Markdown).`;

    const result = await model.generateContent(prompt);
    return result.response.text();
}

/**
 * AGENTE 4: REVISOR
 */
async function runReviewer(
    originalContent: string,
    adaptedContent: string,
    guidelines: string
): Promise<{ reviewPassed: boolean; reviewNotes?: string }> {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `Você é o Coordenador do Núcleo de Inclusão.
        Valide se a adaptação realizada respeita as diretrizes científicas e resolve as barreiras do texto original.
        
        Diretrizes Científicas:
        ${guidelines}
        
        Texto Adaptado:
        ${adaptedContent}
        
        Se a adaptação estiver excelente, responda "APROVADO".
        Se houver falhas (ex: ainda há metáforas, linguagem complexa), responda "AJUSTAR: [descreva o que corrigir]".`;

    const result = await model.generateContent(prompt);
    const feedback = result.response.text();

    if (feedback.toUpperCase().includes('APROVADO')) {
        return { reviewPassed: true };
    }

    return { 
        reviewPassed: false, 
        reviewNotes: feedback.replace('AJUSTAR:', '').trim() 
    };
}
