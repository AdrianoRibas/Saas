import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import * as knowledgeService from './knowledge.service.js';
import { z } from 'zod';

const router = Router();

// Todas as rotas de conhecimento requerem autenticação
router.use(requireAuth);

const createEntrySchema = z.object({
    title: z.string().min(3),
    content: z.string().min(10),
    sourceUrl: z.string().url().optional().or(z.literal('')),
    tags: z.array(z.string()).optional()
});

/**
 * GET /api/knowledge
 * Lista entradas da base de conhecimento (Org + Global)
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
    const organizationId = (req as any).user.organizationId;
    const entries = await knowledgeService.listEntries(organizationId);
    res.json(entries);
}));

/**
 * POST /api/knowledge
 * Cria uma nova entrada científica
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
    const organizationId = (req as any).user.organizationId;
    const data = createEntrySchema.parse(req.body);

    const entry = await knowledgeService.createEntry({
        ...data,
        organizationId
    });

    res.status(201).json(entry);
}));

/**
 * DELETE /api/knowledge/:id
 * Remove uma entrada
 */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
    const organizationId = (req as any).user.organizationId;
    const { id } = req.params;

    await knowledgeService.deleteEntry(id as string, organizationId);
    res.status(204).send();
}));

export default router;
