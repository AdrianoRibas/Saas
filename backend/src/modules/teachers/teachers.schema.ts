import { z } from 'zod';

// Schema para criar professor
export const createTeacherSchema = z.object({
    registration: z.string().optional(),
    department: z.string().optional(),
    userId: z.string().optional(), // Vincular a um usuário existente
    // Se não vincular a usuário, criar dados básicos
    name: z.string().min(2).optional(),
    email: z.string().email('Email inválido').optional(),
});

// Schema para atualizar professor
export const updateTeacherSchema = z.object({
    registration: z.string().optional(),
    department: z.string().optional(),
});

// Schema para query params
export const listTeachersQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    search: z.string().optional(),
});

export type CreateTeacherInput = z.infer<typeof createTeacherSchema>;
export type UpdateTeacherInput = z.infer<typeof updateTeacherSchema>;
export type ListTeachersQuery = z.infer<typeof listTeachersQuerySchema>;
