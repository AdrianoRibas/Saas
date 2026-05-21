import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import * as aiService from './ai.service.js';
import { z } from 'zod';

const router = Router();

// Todas as rotas de IA requerem autenticação
router.use(requireAuth);

/**
 * POST /api/ai/stream
 * Proxy de streaming para o Gemini
 */
router.post('/stream', asyncHandler(async (req: Request, res: Response) => {
    const aiStreamSchema = z.object({
        text: z.string().optional(),
        type: z.enum(['braille', 'high-legibility', 'audio', 'autism']),
        customInstructions: z.string().optional(),
        file: z.string().optional(),
        mimeType: z.string().optional()
    }).refine(data => data.text || data.file, {
        message: "Texto ou arquivo é obrigatório",
        path: ["text_or_file"]
    });

    const { text, type, customInstructions, file, mimeType } = aiStreamSchema.parse(req.body);

    // Configura headers para streaming
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    try {
        const organizationId = (req as any).user?.organizationId;
        const stream = aiService.adaptContentStream(text || '', type, customInstructions, file, mimeType, organizationId);

        for await (const chunk of stream) {
            res.write(chunk);
        }

        res.end();
    } catch (error: any) {
        console.error('[AI_STREAM_ROUTE_ERROR]', error);
        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        } else {
            res.end();
        }
    }
}));

export default router;
