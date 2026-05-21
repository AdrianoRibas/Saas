import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { requireAuth, requireOrganization, requireAdmin } from '../../middleware/auth.js';
import {
    createDisciplineSchema,
    updateDisciplineSchema,
    listDisciplinesQuerySchema,
} from './disciplines.schema.js';
import * as disciplineService from './disciplines.service.js';

const router = Router();

// Todas as rotas requerem autenticação e organização
router.use(requireAuth, requireOrganization);

// GET /api/disciplines - Listar disciplinas
router.get('/', asyncHandler(async (req: Request, res: Response) => {
    const query = listDisciplinesQuerySchema.parse(req.query);
    const result = await disciplineService.listDisciplines(req.organizationId!, query);
    res.json(result);
}));

// GET /api/disciplines/:id - Buscar disciplina
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
    const discipline = await disciplineService.getDisciplineById(
        req.organizationId!,
        req.params.id as string
    );
    res.json({ discipline });
}));

// POST /api/disciplines - Criar disciplina (requer admin)
router.post('/', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const input = createDisciplineSchema.parse(req.body);
    const discipline = await disciplineService.createDiscipline(req.organizationId!, input);

    res.status(201).json({
        message: 'Disciplina criada com sucesso!',
        discipline,
    });
}));

// PUT /api/disciplines/:id - Atualizar disciplina (requer admin)
router.put('/:id', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const input = updateDisciplineSchema.parse(req.body);
    const discipline = await disciplineService.updateDiscipline(
        req.organizationId!,
        req.params.id as string,
        input
    );

    res.json({
        message: 'Disciplina atualizada com sucesso!',
        discipline,
    });
}));

// DELETE /api/disciplines/:id - Excluir disciplina (requer admin)
router.delete('/:id', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const result = await disciplineService.deleteDiscipline(
        req.organizationId!,
        req.params.id as string
    );
    res.json(result);
}));

export default router;
