import { z } from 'zod';

// Schema para criar disciplina
export const createDisciplineSchema = z.object({
    name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
    code: z.string().optional(),
    description: z.string().optional(),
    teacherId: z.string().optional(), // Professor responsável
});

// Schema para atualizar disciplina
export const updateDisciplineSchema = z.object({
    name: z.string().min(2).optional(),
    code: z.string().optional(),
    description: z.string().optional(),
    teacherId: z.string().nullable().optional(),
});

// Schema para query params
export const listDisciplinesQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    search: z.string().optional(),
    teacherId: z.string().optional(),
});

export type CreateDisciplineInput = z.infer<typeof createDisciplineSchema>;
export type UpdateDisciplineInput = z.infer<typeof updateDisciplineSchema>;
export type ListDisciplinesQuery = z.infer<typeof listDisciplinesQuerySchema>;
