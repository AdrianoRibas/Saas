import { z } from 'zod';

// Schema para criar turma
export const createClassSchema = z.object({
    name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
    year: z.number().min(2000).max(2100).optional(),
    semester: z.number().min(1).max(2).optional(),
    shift: z.enum(['MORNING', 'AFTERNOON', 'NIGHT']).optional(),
    disciplineId: z.string(),
});

// Schema para atualizar turma
export const updateClassSchema = z.object({
    name: z.string().min(2).optional(),
    year: z.number().min(2000).max(2100).optional(),
    semester: z.number().min(1).max(2).optional(),
    shift: z.enum(['MORNING', 'AFTERNOON', 'NIGHT']).optional(),
    disciplineId: z.string().optional(),
});

// Schema para query params
export const listClassesQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    search: z.string().optional(),
    disciplineId: z.string().optional(),
    year: z.coerce.number().optional(),
});

// Schema para matricular aluno
export const enrollStudentSchema = z.object({
    studentId: z.string(),
});

export type CreateClassInput = z.infer<typeof createClassSchema>;
export type UpdateClassInput = z.infer<typeof updateClassSchema>;
export type ListClassesQuery = z.infer<typeof listClassesQuerySchema>;
export type EnrollStudentInput = z.infer<typeof enrollStudentSchema>;
