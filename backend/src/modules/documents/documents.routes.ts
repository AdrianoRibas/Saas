import { Router, Request, Response } from 'express';
import multer from 'multer';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { requireAuth, requireActiveSubscription } from '../../middleware/auth.js';
import { createDocumentSchema, listDocumentsQuerySchema, updateDocumentSchema } from './documents.schema.js';
import * as docService from './documents.service.js';
import { z } from 'zod';

// ==============================================================================
// DOCUMENTS ROUTES - Rotas de Documentos com Multi-tenancy
// ==============================================================================

const router = Router();

// ==============================================================================
// CONFIGURAÇÃO DO MULTER
// ==============================================================================

const upload = multer({
    dest: 'uploads/', // Armazenamento em disco temporário
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        ];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Formato de arquivo não suportado. Use PDF, DOC, DOCX ou PPTX.'));
        }
    },
});

// ==============================================================================
// MIDDLEWARES
// ==============================================================================

// Todas as rotas de documentos requerem autenticação
// O tenantGuard já foi aplicado globalmente em /api/*
router.use(requireAuth);

// ==============================================================================
// ROTAS
// ==============================================================================

/**
 * GET /api/documents
 * Lista documentos da organização com filtros opcionais
 * 
 * Query params:
 * - page: número da página (default: 1)
 * - limit: itens por página (default: 20, max: 100)
 * - status: filtrar por status (PENDING, PROCESSING, COMPLETED, FAILED)
 * - teacherId: filtrar por professor
 * - disciplineId: filtrar por disciplina
 * - classId: filtrar por turma
 * - studentId: filtrar por aluno
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId!;

    // Valida query params
    const query = listDocumentsQuerySchema.parse(req.query);

    const result = await docService.listDocuments(organizationId, query);
    res.json(result);
}));

/**
 * POST /api/documents/upload
 * Upload de novo documento
 * Requer assinatura ativa
 */
router.post('/upload', requireActiveSubscription, upload.single('file'), asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId!;
    const userId = req.user!.id;

    if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    // Parse dos metadados enviados como JSON no campo 'metadata'
    const input = createDocumentSchema.parse(JSON.parse(req.body.metadata || '{}'));

    const document = await docService.createDocument(
        userId,
        organizationId,
        req.file,
        input
    );

    res.status(201).json({
        message: 'Documento enviado com sucesso!',
        document,
    });
}));

/**
 * GET /api/documents/:id
 * Busca documento por ID
 * 
 * SEGURANÇA: Retorna 404 se o documento for de outra organização
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId!;
    const documentId = req.params.id as string;

    const document = await docService.getDocument(documentId, organizationId);
    res.json({ document });
}));

/**
 * PATCH /api/documents/:id
 * Atualiza metadados do documento
 */
router.patch('/:id', asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId!;
    const documentId = req.params.id as string;

    const input = updateDocumentSchema.parse(req.body);
    const document = await docService.updateDocument(documentId, organizationId, input);

    res.json({
        message: 'Documento atualizado com sucesso',
        document
    });
}));

/**
 * DELETE /api/documents/:id
 * Deleta documento e arquivos associados
 */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId!;
    const documentId = req.params.id as string;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    await docService.deleteDocument(documentId, organizationId, userId, userRole);
    res.json({ message: 'Documento deletado com sucesso' });
}));

export const updateDocumentStatusHandler = asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId!;
    const documentId = req.params.id as string;
    const userRole = req.user!.role;
    const userId = req.user!.id;

    const doc = await docService.getDocument(documentId, organizationId);
    if (userRole === 'MEMBER' && doc.userId !== userId) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    const statusSchema = z.object({
        status: z.enum(['PROCESSING', 'COMPLETED', 'FAILED']),
    }).catchall(z.any());
    const { status, ...data } = statusSchema.parse(req.body);

    const document = await docService.updateDocumentStatus(
        documentId,
        organizationId,
        status,
        data
    );

    res.json({
        message: 'Status atualizado com sucesso',
        document
    });
});

/**
 * PATCH /api/documents/:id/status
 * Atualiza status do documento (usado internamente após processamento)
 */
router.patch('/:id/status', updateDocumentStatusHandler);

/**
 * PATCH /api/documents/:id/download
 * Marca versão como baixada (para relatórios)
 * 
 * Body: { type: 'braille' | 'high_legibility' | 'audio' }
 */
router.patch('/:id/download', asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId!;
    const documentId = req.params.id as string;
    const downloadSchema = z.object({
        type: z.enum(['braille', 'high_legibility', 'audio'])
    });
    const { type } = downloadSchema.parse(req.body);

    const document = await docService.markAsDownloaded(documentId, organizationId, type);

    res.json({
        message: 'Download registrado com sucesso',
        document
    });
}));

export const completeDocumentHandler = asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId!;
    const documentId = req.params.id as string;
    const userRole = req.user!.role;
    const userId = req.user!.id;

    const doc = await docService.getDocument(documentId, organizationId);
    if (userRole === 'MEMBER' && doc.userId !== userId) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    const document = await docService.updateDocumentStatus(
        documentId,
        organizationId,
        'COMPLETED'
    );

    res.json({
        message: 'Documento marcado como concluído',
        document
    });
});

/**
 * PATCH /api/documents/:id/complete (DEPRECATED - use /status)
 * Mantido para compatibilidade retroativa
 */
router.patch('/:id/complete', completeDocumentHandler);

/**
 * POST /api/documents/:id/email
 * Envia o documento adaptado por e-mail para o aluno
 */
router.post('/:id/email', asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId!;
    const documentId = req.params.id as string;

    const result = await docService.sendDocumentEmail(documentId, organizationId);

    res.json({
        message: 'E-mail enviado com sucesso!',
        recipient: result.email
    });
}));

export default router;
