import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { requireAuth, requireOrganization, requireAdmin } from '../../middleware/auth.js';
import {
    createClassSchema,
    updateClassSchema,
    listClassesQuerySchema,
    enrollStudentSchema,
} from './classes.schema.js';
import * as classService from './classes.service.js';

const router = Router();

// Todas as rotas requerem autenticação e organização
router.use(requireAuth, requireOrganization);

// GET /api/classes - Listar turmas
router.get('/', asyncHandler(async (req: Request, res: Response) => {
    const query = listClassesQuerySchema.parse(req.query);
    const result = await classService.listClasses(req.organizationId!, query);
    res.json(result);
}));

// GET /api/classes/:id - Buscar turma
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
    const classEntity = await classService.getClassById(
        req.organizationId!,
        req.params.id as string
    );
    res.json({ class: classEntity });
}));

// POST /api/classes - Criar turma (requer admin)
router.post('/', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const input = createClassSchema.parse(req.body);
    const classEntity = await classService.createClass(req.organizationId!, input);

    res.status(201).json({
        message: 'Turma criada com sucesso!',
        class: classEntity,
    });
}));

// PUT /api/classes/:id - Atualizar turma (requer admin)
router.put('/:id', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const input = updateClassSchema.parse(req.body);
    const classEntity = await classService.updateClass(
        req.organizationId!,
        req.params.id as string,
        input
    );

    res.json({
        message: 'Turma atualizada com sucesso!',
        class: classEntity,
    });
}));

// DELETE /api/classes/:id - Excluir turma (requer admin)
router.delete('/:id', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const result = await classService.deleteClass(
        req.organizationId!,
        req.params.id as string
    );
    res.json(result);
}));

// POST /api/classes/:id/enroll - Matricular aluno (requer admin)
router.post('/:id/enroll', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const input = enrollStudentSchema.parse(req.body);
    const result = await classService.enrollStudent(
        req.organizationId!,
        req.params.id as string,
        input
    );
    res.json(result);
}));

// DELETE /api/classes/:id/students/:studentId - Remover matrícula (requer admin)
router.delete('/:id/students/:studentId', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const result = await classService.unenrollStudent(
        req.organizationId!,
        req.params.id as string,
        req.params.studentId as string
    );
    res.json(result);
}));

export default router;
