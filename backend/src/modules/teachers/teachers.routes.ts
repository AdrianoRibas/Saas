import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { requireAuth, requireOrganization, requireAdmin } from '../../middleware/auth.js';
import {
    createTeacherSchema,
    updateTeacherSchema,
    listTeachersQuerySchema,
} from './teachers.schema.js';
import * as teacherService from './teachers.service.js';

const router = Router();

// Todas as rotas requerem autenticação e organização
router.use(requireAuth, requireOrganization);

// GET /api/teachers - Listar professores
router.get('/', asyncHandler(async (req: Request, res: Response) => {
    const query = listTeachersQuerySchema.parse(req.query);
    const result = await teacherService.listTeachers(req.organizationId!, query);
    res.json(result);
}));

// GET /api/teachers/:id - Buscar professor
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
    const teacher = await teacherService.getTeacherById(
        req.organizationId!,
        req.params.id as string
    );
    res.json({ teacher });
}));

// POST /api/teachers - Criar professor (requer admin)
router.post('/', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const input = createTeacherSchema.parse(req.body);
    const teacher = await teacherService.createTeacher(req.organizationId!, input);

    res.status(201).json({
        message: 'Professor criado com sucesso!',
        teacher,
    });
}));

// PUT /api/teachers/:id - Atualizar professor (requer admin)
router.put('/:id', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const input = updateTeacherSchema.parse(req.body);
    const teacher = await teacherService.updateTeacher(
        req.organizationId!,
        req.params.id as string,
        input
    );

    res.json({
        message: 'Professor atualizado com sucesso!',
        teacher,
    });
}));

// DELETE /api/teachers/:id - Excluir professor (requer admin)
router.delete('/:id', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const result = await teacherService.deleteTeacher(
        req.organizationId!,
        req.params.id as string
    );
    res.json(result);
}));

export default router;
