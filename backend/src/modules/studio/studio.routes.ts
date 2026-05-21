import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireTeacher, requireStudent } from './studio.middleware.js';
import * as studioService from './studio.service.js';
import {
    createAudioSchema,
    createSlidesSchema,
    createInfographicSchema,
    createQuizSchema,
    createFlashcardsSchema,
    createBatchSchema,
    submitQuizAttemptSchema,
} from './studio.schema.js';

// ==============================================================================
// STUDIO ROUTES - Rotas do Estúdio de Conteúdo Educacional
// ==============================================================================

const router = Router();

// Todas as rotas do Estúdio requerem autenticação
router.use(requireAuth);

// ==============================================================================
// GERAÇÃO DE CONTEÚDO
// ==============================================================================

/**
 * POST /api/studio/:documentId/audio
 * Gera resumo em áudio
 * Acesso: TODOS os autenticados
 */
router.post('/:documentId/audio', asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId!;
    const userId = req.user!.id;
    const documentId = req.params.documentId as string;

    const input = createAudioSchema.parse(req.body);
    const artifact = await studioService.generateAudio(documentId, userId, organizationId, input);

    res.status(201).json({
        message: 'Resumo em áudio em geração!',
        artifact,
    });
}));

/**
 * POST /api/studio/:documentId/slides
 * Gera apresentação de slides
 * Acesso: APENAS PROFESSORES (middleware requireTeacher)
 */
router.post('/:documentId/slides', requireTeacher, asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId!;
    const userId = req.user!.id;
    const documentId = req.params.documentId as string;
    const teacher = (req as any).teacher;

    const input = createSlidesSchema.parse(req.body);
    const artifact = await studioService.generateSlides(
        documentId, userId, organizationId, input, teacher.id
    );

    res.status(201).json({
        message: 'Apresentação em geração!',
        artifact,
    });
}));

/**
 * POST /api/studio/:documentId/infographic
 * Gera infográfico
 * Acesso: APENAS ALUNOS (middleware requireStudent)
 */
router.post('/:documentId/infographic', requireStudent, asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId!;
    const userId = req.user!.id;
    const documentId = req.params.documentId as string;

    const input = createInfographicSchema.parse(req.body);
    const artifact = await studioService.generateInfographic(documentId, userId, organizationId, input);

    res.status(201).json({
        message: 'Infográfico em geração!',
        artifact,
    });
}));

/**
 * POST /api/studio/:documentId/quiz
 * Gera quiz interativo
 * Acesso: TODOS (professores e alunos)
 */
router.post('/:documentId/quiz', asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId!;
    const userId = req.user!.id;
    const documentId = req.params.documentId as string;

    const input = createQuizSchema.parse(req.body);
    const artifact = await studioService.generateQuiz(documentId, userId, organizationId, input);

    res.status(201).json({
        message: 'Quiz em geração!',
        artifact,
    });
}));

/**
 * POST /api/studio/:documentId/flashcards
 * Gera cartões didáticos (flashcards)
 * Acesso: TODOS
 */
router.post('/:documentId/flashcards', asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId!;
    const userId = req.user!.id;
    const documentId = req.params.documentId as string;

    const input = createFlashcardsSchema.parse(req.body);
    const artifact = await studioService.generateFlashcards(documentId, userId, organizationId, input);

    res.status(201).json({
        message: 'Flashcards em geração!',
        artifact,
    });
}));

/**
 * POST /api/studio/:documentId/batch
 * Gera múltiplos artefatos de uma vez ("Gerar Tudo")
 * Acesso: TODOS (RBAC é verificado por tipo individualmente no service)
 */
router.post('/:documentId/batch', asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId!;
    const userId = req.user!.id;
    const documentId = req.params.documentId as string;
    const userRole = req.user!.role;

    const input = createBatchSchema.parse(req.body);

    // Validar permissões por tipo
    if (input.types.includes('SLIDES') && userRole !== 'TEACHER') {
        return res.status(403).json({
            error: 'Geração de Slides é restrita a professores',
            code: 'TEACHER_REQUIRED',
        });
    }
    if (input.types.includes('INFOGRAPHIC') && userRole !== 'STUDENT') {
        return res.status(403).json({
            error: 'Geração de Infográficos é restrita a alunos',
            code: 'STUDENT_REQUIRED',
        });
    }

    const artifacts = await studioService.generateBatch(
        documentId, userId, organizationId, input.types, input
    );

    res.status(201).json({
        message: `${artifacts.length} artefato(s) em geração!`,
        artifacts,
    });
}));

// ==============================================================================
// CONSULTAS
// ==============================================================================

/**
 * GET /api/studio/:documentId/artifacts
 * Lista artefatos gerados para um documento
 */
router.get('/:documentId/artifacts', asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId!;
    const documentId = req.params.documentId as string;

    const artifacts = await studioService.getArtifactsByDocument(documentId, organizationId);
    res.json({ artifacts });
}));

/**
 * GET /api/studio/artifact/:id
 * Detalhe de um artefato (resultado completo)
 */
router.get('/artifact/:id', asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId!;
    const artifactId = req.params.id as string;

    const artifact = await studioService.getArtifactById(artifactId, organizationId);
    res.json({ artifact });
}));

// ==============================================================================
// INTERAÇÕES
// ==============================================================================

/**
 * POST /api/studio/artifact/:id/quiz-attempt
 * Submete tentativa de quiz
 */
router.post('/artifact/:id/quiz-attempt', asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId!;
    const userId = req.user!.id;
    const artifactId = req.params.id as string;

    const input = submitQuizAttemptSchema.parse(req.body);
    const attempt = await studioService.submitQuizAttempt(artifactId, userId, organizationId, input);

    res.status(201).json({
        message: 'Tentativa registrada!',
        attempt,
    });
}));

/**
 * POST /api/studio/artifact/:id/favorite
 * Toggle favorito (adicionar/remover)
 */
router.post('/artifact/:id/favorite', asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId!;
    const userId = req.user!.id;
    const artifactId = req.params.id as string;

    const result = await studioService.toggleFavorite(artifactId, userId, organizationId);
    res.json(result);
}));

/**
 * GET /api/studio/favorites
 * Biblioteca pessoal do usuário
 */
router.get('/favorites', asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId!;
    const userId = req.user!.id;

    const favorites = await studioService.getFavorites(userId, organizationId);
    res.json({ favorites });
}));

/**
 * GET /api/studio/analytics
 * Dashboard de analytics (Professores/Admins)
 */
router.get('/analytics', requireTeacher, asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId!;

    const analytics = await studioService.getAnalytics(organizationId);
    res.json({ analytics });
}));

export default router;
