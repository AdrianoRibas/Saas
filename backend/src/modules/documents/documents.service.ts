import { prisma } from '../../config/database.js';
import { AppError } from '../../middleware/errorHandler.js';
import * as storage from '../../lib/storage.js';
import type { CreateDocumentInput, ListDocumentsQuery, UpdateDocumentInput } from './documents.schema.js';
import fs from 'fs';

// ==============================================================================
// DOCUMENTS SERVICE - Operações de Documentos com Isolamento Multi-tenant
// ==============================================================================

// ==============================================================================
// LISTAGEM DE DOCUMENTOS
// ==============================================================================

/**
 * Lista documentos da organização com filtros opcionais
 * 
 * SEGURANÇA: Sempre filtra por organizationId para garantir isolamento de tenant
 */
export async function listDocuments(
    organizationId: string,
    query: ListDocumentsQuery = { page: 1, limit: 20 }
) {
    const { page, limit, status, teacherId, disciplineId, classId, studentId } = query;
    const skip = (page - 1) * limit;

    // Constrói filtro dinâmico
    const where: any = { organizationId };

    if (status) where.status = status;
    if (teacherId) where.teacherId = teacherId;
    if (disciplineId) where.disciplineId = disciplineId;
    if (classId) where.classId = classId;
    if (studentId) where.studentId = studentId;

    const [documents, total] = await Promise.all([
        prisma.document.findMany({
            where,
            select: {
                id: true,
                originalName: true,
                status: true,
                titulo: true,
                // Campos legados
                disciplina: true,
                professor: true,
                dataAdaptacao: true,
                // Relações
                teacher: {
                    select: {
                        id: true,
                        user: { select: { name: true } }
                    }
                },
                discipline: {
                    select: { id: true, name: true, code: true }
                },
                class: {
                    select: { id: true, name: true, shift: true }
                },
                student: {
                    select: { id: true, name: true, isPcd: true }
                },
                user: {
                    select: { name: true, email: true }
                },
                createdAt: true,
                updatedAt: true,
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
        }),
        prisma.document.count({ where }),
    ]);

    return {
        documents,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

// ==============================================================================
// CRIAÇÃO DE DOCUMENTO
// ==============================================================================

/**
 * Cria um novo documento após upload
 * 
 * SEGURANÇA: Vincula o documento à organização do usuário
 */
export async function createDocument(
    userId: string,
    organizationId: string,
    file: Express.Multer.File,
    input: CreateDocumentInput
) {
    // ==== VALIDAÇÃO DE RELAÇÕES (opcional) ====
    // Verifica se os IDs relacionais pertencem à mesma organização
    if (input.teacherId) {
        const teacher = await prisma.teacher.findFirst({
            where: { id: input.teacherId, organizationId }
        });
        if (!teacher) {
            throw new AppError('Professor não encontrado', 404, 'TEACHER_NOT_FOUND');
        }
    }

    if (input.disciplineId) {
        const discipline = await prisma.discipline.findFirst({
            where: { id: input.disciplineId, organizationId }
        });
        if (!discipline) {
            throw new AppError('Disciplina não encontrada', 404, 'DISCIPLINE_NOT_FOUND');
        }
    }

    if (input.classId) {
        const classEntity = await prisma.class.findFirst({
            where: { id: input.classId, organizationId }
        });
        if (!classEntity) {
            throw new AppError('Turma não encontrada', 404, 'CLASS_NOT_FOUND');
        }
    }

    if (input.studentId) {
        const student = await prisma.student.findFirst({
            where: { id: input.studentId, organizationId }
        });
        if (!student) {
            throw new AppError('Aluno não encontrado', 404, 'STUDENT_NOT_FOUND');
        }
    }

    // ==== VERIFICAÇÃO DE DEDUPLICAÇÃO ====
    const existingDocument = await prisma.document.findFirst({
        where: {
            originalName: {
                equals: file.originalname,
                mode: 'insensitive'
            },
            organizationId,
        },
        select: {
            id: true,
            originalName: true,
            originalUrl: true,
            status: true,
        },
    });

    if (existingDocument) {
        console.log(`[DOC_SERVICE] Documento duplicado encontrado: ${existingDocument.id} (${file.originalname})`);

        // Se já existe, atualizamos os metadados
        const updated = await prisma.document.update({
            where: { id: existingDocument.id },
            data: {
                // Campos legados
                disciplina: input.disciplina,
                professor: input.professor,
                titulo: input.titulo,
                dataAdaptacao: input.dataAdaptacao ? new Date(input.dataAdaptacao) : null,
                // Novos campos relacionais
                teacherId: input.teacherId || null,
                disciplineId: input.disciplineId || null,
                classId: input.classId || null,
                studentId: input.studentId || null,
            }
        });

        return updated;
    }

    // ==== UPLOAD DO ARQUIVO ====
    const fileKey = storage.generateFileKey(organizationId, file.originalname, 'original');

    try {
        // Usando stream do arquivo temporário em disco
        const fileStream = fs.createReadStream(file.path);
        const { url } = await storage.uploadFile(fileKey, fileStream, file.mimetype);
        console.log(`[STORAGE] Upload concluído: ${url}`);

        // Limpeza do arquivo temporário
        fs.unlink(file.path, (err) => {
            if (err) console.error(`[TEMP_CLEANUP] Erro ao deletar arquivo temporário: ${file.path}`, err);
        });

        // ==== CRIAÇÃO DO REGISTRO ====
        const document = await prisma.document.create({
            data: {
                originalName: file.originalname,
                originalKey: fileKey,
                // Segurança: Não salvamos URL pública. O originalUrl é mantido apenas por compatibilidade de schema (Required),
                // mas será sobrescrito por uma Signed URL no getDocument. // <- Mantendo a nota do dev anterior, vamos salvar vazio
                originalUrl: url || "", 
                status: 'PENDING',
                // Campos legados
                disciplina: input.disciplina,
                professor: input.professor,
                titulo: input.titulo,
                dataAdaptacao: input.dataAdaptacao ? new Date(input.dataAdaptacao) : null,
                // Novos campos relacionais
                teacherId: input.teacherId || null,
                disciplineId: input.disciplineId || null,
                classId: input.classId || null,
                studentId: input.studentId || null,
                // Tenant isolation
                userId,
                organizationId,
            },
            select: {
                id: true,
                originalName: true,
                originalUrl: true,
                status: true,
            },
        });

        return document;
    } catch (error) {
        // Limpeza em caso de erro
        if (file.path) {
            fs.unlink(file.path, () => {});
        }
        console.error('[DOC_SERVICE] Erro ao criar documento:', error);
        throw error;
    }
}

// ==============================================================================
// BUSCAR DOCUMENTO POR ID
// ==============================================================================

/**
 * Busca documento por ID com isolamento de tenant
 * 
 * SEGURANÇA: Retorna 404 (não 403) se o documento for de outra organização
 * Isso evita que atacantes descubram IDs válidos de outras organizações
 */
export async function getDocument(documentId: string, organizationId: string) {
    const document = await prisma.document.findFirst({
        where: {
            id: documentId,
            organizationId, // CRÍTICO: Filtro de tenant
        },
        select: {
            id: true,
            originalName: true,
            // Selecionamos as chaves para gerar URLs assinadas
            originalKey: true,
            brailleKey: true,
            highLegibilityKey: true,
            audioKey: true,
            autismKey: true,
            
            // Campos de URL originais mantidos na query para compatibilidade de tipo,
            // mas serão sobrescritos
            originalUrl: true,
            brailleUrl: true,
            highLegibilityUrl: true,
            audioUrl: true,
            autismUrl: true,
            
            status: true,
            errorMessage: true,
            studentId: true,
            // Campos legados
            disciplina: true,
            professor: true,
            titulo: true,
            dataAdaptacao: true,
            // Relações
            organization: {
                select: { name: true }
            },
            teacher: {
                select: {
                    id: true,
                    user: { select: { name: true, email: true } }
                }
            },
            discipline: {
                select: { id: true, name: true, code: true }
            },
            class: {
                select: { id: true, name: true, shift: true, year: true, semester: true }
            },
            student: {
                select: { id: true, name: true, registration: true, isPcd: true, email: true }
            },
            user: {
                select: { name: true, email: true }
            },
            userId: true,
            createdAt: true,
            updatedAt: true,
        },
    });

    // SEGURANÇA: Sempre 404, nunca 403 (não revelar existência)
    if (!document) {
        throw new AppError('Documento não encontrado', 404, 'DOC_NOT_FOUND');
    }

    // Gerar URLs assinadas dinamicamente
    const [originalSigned, brailleSigned, highLegibilitySigned, audioSigned, autismSigned] = await Promise.all([
        storage.getSignedDownloadUrl(document.originalKey),
        document.brailleKey ? storage.getSignedDownloadUrl(document.brailleKey) : null,
        document.highLegibilityKey ? storage.getSignedDownloadUrl(document.highLegibilityKey) : null,
        document.audioKey ? storage.getSignedDownloadUrl(document.audioKey) : null,
        document.autismKey ? storage.getSignedDownloadUrl(document.autismKey) : null,
    ]);

    return {
        ...document,
        originalUrl: originalSigned,
        brailleUrl: brailleSigned,
        highLegibilityUrl: highLegibilitySigned,
        audioUrl: audioSigned,
        autismUrl: autismSigned
    };
}

// ==============================================================================
// ATUALIZAR METADADOS DO DOCUMENTO
// ==============================================================================

/**
 * Atualiza metadados de um documento existente
 */
export async function updateDocument(
    documentId: string,
    organizationId: string,
    input: UpdateDocumentInput
) {
    // Verifica se o documento pertence à organização
    const existing = await prisma.document.findFirst({
        where: { id: documentId, organizationId }
    });

    if (!existing) {
        throw new AppError('Documento não encontrado', 404, 'DOC_NOT_FOUND');
    }

    // ==== VALIDAÇÃO DE RELAÇÕES ====
    // Verifica se os IDs relacionais pertencem à mesma organização
    if (input.teacherId) {
        const teacher = await prisma.teacher.findFirst({
            where: { id: input.teacherId, organizationId }
        });
        if (!teacher) {
            throw new AppError('Professor não encontrado', 404, 'TEACHER_NOT_FOUND');
        }
    }

    if (input.disciplineId) {
        const discipline = await prisma.discipline.findFirst({
            where: { id: input.disciplineId, organizationId }
        });
        if (!discipline) {
            throw new AppError('Disciplina não encontrada', 404, 'DISCIPLINE_NOT_FOUND');
        }
    }

    if (input.classId) {
        const classEntity = await prisma.class.findFirst({
            where: { id: input.classId, organizationId }
        });
        if (!classEntity) {
            throw new AppError('Turma não encontrada', 404, 'CLASS_NOT_FOUND');
        }
    }

    if (input.studentId) {
        const student = await prisma.student.findFirst({
            where: { id: input.studentId, organizationId }
        });
        if (!student) {
            throw new AppError('Aluno não encontrado', 404, 'STUDENT_NOT_FOUND');
        }
    }

    const document = await prisma.document.update({
        where: { id: documentId },
        data: {
            titulo: input.titulo,
            disciplina: input.disciplina,
            professor: input.professor,
            teacherId: input.teacherId,
            disciplineId: input.disciplineId,
            classId: input.classId,
            studentId: input.studentId,
        },
    });

    return document;
}

// ==============================================================================
// ATUALIZAR STATUS DO DOCUMENTO
// ==============================================================================

/**
 * Atualiza status do documento após processamento pela IA
 * 
 * NOTA: Esta função é chamada internamente pelo sistema, não pelo usuário
 */
export async function updateDocumentStatus(
    documentId: string,
    organizationId: string,
    status: 'PROCESSING' | 'COMPLETED' | 'FAILED',
    data?: {
        brailleKey?: string;
        brailleUrl?: string;
        highLegibilityKey?: string;
        highLegibilityUrl?: string;
        audioKey?: string;
        audioUrl?: string;
        errorMessage?: string;
        processingStartedAt?: Date;
        processingCompletedAt?: Date;
    }
) {
    // Verifica se o documento pertence à organização
    const existing = await prisma.document.findFirst({
        where: { id: documentId, organizationId }
    });

    if (!existing) {
        throw new AppError('Documento não encontrado', 404, 'DOC_NOT_FOUND');
    }

    // SEGURANÇA: Validação para garantir que as chaves apontam para a organização correta
    const keysToCheck = [
        { key: data?.brailleKey, label: 'brailleKey' },
        { key: data?.highLegibilityKey, label: 'highLegibilityKey' },
        { key: data?.audioKey, label: 'audioKey' }
    ];

    for (const { key, label } of keysToCheck) {
        if (key && !key.startsWith(`${organizationId}/`)) {
            console.error(`[SECURITY] Tentativa de injeção de chave inválida em ${label}: ${key} (Org: ${organizationId})`);
            throw new AppError(`Chave inválida para ${label}. Deve pertencer à organização.`, 403, 'INVALID_FILE_KEY');
        }
    }

    const document = await prisma.document.update({
        where: { id: documentId },
        data: {
            status,
            ...data,
        },
    });

    return document;
}

// ==============================================================================
// MARCAR COMO BAIXADO
// ==============================================================================

/**
 * Marca uma versão do documento como baixada
 * Usado para contabilização de relatórios
 */
export async function markAsDownloaded(
    documentId: string,
    organizationId: string,
    type: 'braille' | 'high_legibility' | 'audio'
) {
    // Verifica se o documento pertence à organização
    const existing = await prisma.document.findFirst({
        where: { id: documentId, organizationId }
    });

    if (!existing) {
        throw new AppError('Documento não encontrado', 404, 'DOC_NOT_FOUND');
    }

    let data: any = {};
    const now = new Date();

    switch (type) {
        case 'braille':
            data = { brailleDownloaded: true, brailleDownloadedAt: now };
            break;
        case 'high_legibility':
            data = { highLegibilityDownloaded: true, highLegibilityDownloadedAt: now };
            break;
        case 'audio':
            data = { audioDownloaded: true, audioDownloadedAt: now };
            break;
    }

    const document = await prisma.document.update({
        where: { id: documentId },
        data,
    });

    return document;
}

// ==============================================================================
// DELETAR DOCUMENTO
// ==============================================================================

/**
 * Deleta documento e arquivos associados
 * 
 * SEGURANÇA: Verifica se o documento pertence à organização antes de deletar
 */
export async function deleteDocument(
    documentId: string,
    organizationId: string,
    userId: string,
    userRole: string
) {
    const document = await prisma.document.findFirst({
        where: { id: documentId, organizationId },
    });

    // SEGURANÇA: 404, não 403
    if (!document) {
        throw new AppError('Documento não encontrado', 404, 'DOC_NOT_FOUND');
    }

    // Validação de permissão: Apenas dono ou admin podem deletar
    const isOwner = document.userId === userId;
    const isAdmin = userRole === 'ADMIN' || userRole === 'OWNER';

    if (!isOwner && !isAdmin) {
        throw new AppError('Acesso negado', 403, 'FORBIDDEN');
    }

    // Deleta arquivos do storage
    const deletePromises = [storage.deleteFile(document.originalKey)];
    if (document.brailleKey) deletePromises.push(storage.deleteFile(document.brailleKey));
    if (document.highLegibilityKey) deletePromises.push(storage.deleteFile(document.highLegibilityKey));
    if (document.audioKey) deletePromises.push(storage.deleteFile(document.audioKey));

    await Promise.all(deletePromises);

    // Deleta do banco
    await prisma.document.delete({ where: { id: documentId } });

    return { success: true };
}

/**
 * Envia o documento adaptado por e-mail para o aluno
 */
export async function sendDocumentEmail(documentId: string, organizationId: string) {
    const doc = await getDocument(documentId, organizationId);

    if (!doc.studentId || !doc.student?.email) {
        throw new AppError('Este documento não possui um aluno vinculado com e-mail cadastrado.', 400, 'STUDENT_EMAIL_MISSING');
    }

    if (doc.status !== 'COMPLETED') {
        throw new AppError('O documento ainda não foi processado.', 400, 'DOC_NOT_READY');
    }

    const { sendEmail } = await import('../../lib/email.js');

    const links = [];
    if (doc.brailleUrl) links.push(`<li><a href="${doc.brailleUrl}">Versão Braille (Texto)</a></li>`);
    if (doc.highLegibilityUrl) links.push(`<li><a href="${doc.highLegibilityUrl}">Versão Alta Legibilidade (Markdown)</a></li>`);
    if (doc.audioUrl) links.push(`<li><a href="${doc.audioUrl}">Versão Áudio</a></li>`);

    if (links.length === 0) {
        throw new AppError('Nenhuma adaptação disponível para envio.', 400, 'NO_ADAPTATIONS_FOUND');
    }

    await sendEmail({
        to: doc.student.email,
        subject: `Material Adaptado: ${doc.titulo || doc.originalName}`,
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6;">
                <h1 style="color: #3B82F6;">Olá, ${doc.student.name}!</h1>
                <p>Seu material de estudo para a disciplina <strong>${doc.discipline?.name || doc.disciplina || 'Geral'}</strong> já foi adaptado pela equipe de acessibilidade.</p>
                <p>Você pode acessar as versões adaptadas pelos links abaixo:</p>
                <ul>
                    ${links.join('')}
                </ul>
                <p style="margin-top: 1.5rem; color: #ef4444; font-weight: bold; font-size: 0.9rem;">
                    ⚠️ Atenção: Por motivos de segurança e privacidade, os links para download logo acima são temporários e irão expirar em 1 hora.
                </p>
                <p style="margin-top: 2rem;">Bons estudos!</p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 2rem 0;">
                <p style="font-size: 0.8rem; color: #999;">Enviado via Adaptador Docs SaaS - ${doc.organization.name}</p>
            </div>
        `
    });

    return { success: true, email: doc.student.email };
}
