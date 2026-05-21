import { prisma } from '../../config/database.js';
import { AppError } from '../../middleware/errorHandler.js';

export interface CreateKnowledgeInput {
    title: string;
    content: string;
    sourceUrl?: string;
    tags?: string[];
    autismLevel?: number;
    organizationId?: string;
}

/**
 * SERVIÇO DE GESTÃO DA BASE DE CONHECIMENTO (RAG)
 */
export async function createEntry(data: CreateKnowledgeInput) {
    return prisma.knowledgeBase.create({
        data: {
            title: data.title,
            content: data.content,
            sourceUrl: data.sourceUrl,
            tags: data.tags || [],
            autismLevel: data.autismLevel,
            organizationId: data.organizationId
        }
    });
}

export async function listEntries(organizationId: string) {
    return prisma.knowledgeBase.findMany({
        where: {
            OR: [
                { organizationId: organizationId },
                { organizationId: null }
            ]
        },
        orderBy: { createdAt: 'desc' }
    });
}

export async function deleteEntry(id: string, organizationId: string) {
    // Verificar se pertence à org ou se é global (somente SuperAdmin deleta global - lógica simplificada p/ MVP)
    const entry = await prisma.knowledgeBase.findUnique({ where: { id } });

    if (!entry) throw new AppError('Entrada não encontrada', 404);
    
    if (entry.organizationId && entry.organizationId !== organizationId) {
        throw new AppError('Acesso negado', 403);
    }

    return prisma.knowledgeBase.delete({ where: { id } });
}

/**
 * Busca diretrizes científicas relevantes com base em palavras-chave e nível de autismo
 * Usado pelo Agente Pesquisador para lidar com 100+ artigos
 */
export async function findRelevant(keywords: string, organizationId: string, autismLevel?: number) {
    const searchTerms = keywords.split(' ').filter(word => word.length > 3);
    
    return prisma.knowledgeBase.findMany({
        where: {
            AND: [
                {
                    OR: [
                        { organizationId: organizationId },
                        { organizationId: null }
                    ]
                },
                {
                    OR: [
                        { autismLevel: autismLevel },
                        { autismLevel: null }
                    ]
                },
                {
                    OR: [
                        { title: { contains: searchTerms[0] || '', mode: 'insensitive' } },
                        { content: { contains: searchTerms[0] || '', mode: 'insensitive' } },
                        { tags: { hasSome: searchTerms } }
                    ]
                }
            ]
        },
        take: 5 
    });
}
