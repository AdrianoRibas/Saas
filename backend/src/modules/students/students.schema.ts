import { z } from 'zod';

// Schema para criar aluno
export const createStudentSchema = z.object({
    name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
    registration: z.string().optional(),
    email: z.union([z.string().email(), z.literal('')]).optional().transform(v => v === '' ? undefined : v),
    isPcd: z.boolean().default(false),
    accessibilityTypes: z.array(z.enum([
        'BLIND',
        'LOW_VISION',
        'DYSLEXIA',
        'DEAF',
        'MOTOR',
        'COGNITIVE',
        'OTHER',
    ])).optional(),
    accessibilityNotes: z.string().optional(),
    prefersBraille: z.boolean().default(false),
    prefersLargePrint: z.boolean().default(false),
    prefersAudio: z.boolean().default(false),
    preferredFontSize: z.number().min(8).max(72).optional(),
    classIds: z.array(z.string()).optional(), // Turmas para matricular
});

// Schema para atualizar aluno
export const updateStudentSchema = z.object({
    name: z.string().min(2).optional(),
    registration: z.string().optional(),
    email: z.union([z.string().email(), z.literal('')]).optional().transform(v => v === '' ? undefined : v),
    isPcd: z.boolean().optional(),
    accessibilityTypes: z.array(z.enum([
        'BLIND',
        'LOW_VISION',
        'DYSLEXIA',
        'DEAF',
        'MOTOR',
        'COGNITIVE',
        'OTHER',
    ])).optional(),
    accessibilityNotes: z.string().optional(),
    prefersBraille: z.boolean().optional(),
    prefersLargePrint: z.boolean().optional(),
    prefersAudio: z.boolean().optional(),
    preferredFontSize: z.number().min(8).max(72).optional(),
    classIds: z.array(z.string()).optional(), // Turmas para sincronizar
});

// Schema para query params
export const listStudentsQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    search: z.string().optional(),
    isPcd: z.enum(['true', 'false']).optional().transform(v => v === 'true' ? true : v === 'false' ? false : undefined),
    accessibilityType: z.enum([
        'BLIND',
        'LOW_VISION',
        'DYSLEXIA',
        'DEAF',
        'MOTOR',
        'COGNITIVE',
        'OTHER',
    ]).optional(),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>;
