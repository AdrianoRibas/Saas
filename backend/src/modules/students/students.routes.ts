import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { requireAuth, requireOrganization, requireAdmin } from '../../middleware/auth.js';
import {
    createStudentSchema,
    updateStudentSchema,
    listStudentsQuerySchema,
} from './students.schema.js';
import * as studentService from './students.service.js';

const router = Router();

// Todas as rotas requerem autenticação e organização
router.use(requireAuth, requireOrganization);

// GET /api/students - Listar alunos
router.get('/', asyncHandler(async (req: Request, res: Response) => {
    const query = listStudentsQuerySchema.parse(req.query);
    const result = await studentService.listStudents(req.organizationId!, query);
    res.json(result);
}));

// GET /api/students/pcd - Listar alunos PCD (para seleção rápida)
router.get('/pcd', asyncHandler(async (req: Request, res: Response) => {
    const students = await studentService.listPcdStudents(req.organizationId!);
    res.json({ students });
}));

// GET /api/students/:id - Buscar aluno
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
    const student = await studentService.getStudentById(
        req.organizationId!,
        req.params.id as string
    );
    res.json({ student });
}));

// POST /api/students - Criar aluno (requer admin)
router.post('/', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const input = createStudentSchema.parse(req.body);
    const student = await studentService.createStudent(req.organizationId!, input);

    res.status(201).json({
        message: 'Aluno criado com sucesso!',
        student,
    });
}));

// PUT /api/students/:id - Atualizar aluno (requer admin)
router.put('/:id', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const input = updateStudentSchema.parse(req.body);
    const student = await studentService.updateStudent(
        req.organizationId!,
        req.params.id as string,
        input
    );

    res.json({
        message: 'Aluno atualizado com sucesso!',
        student,
    });
}));

// DELETE /api/students/:id - Excluir aluno (requer admin)
router.delete('/:id', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const result = await studentService.deleteStudent(
        req.organizationId!,
        req.params.id as string
    );
    res.json(result);
}));

export default router;
