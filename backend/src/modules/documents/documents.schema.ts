import { z } from 'zod';

// ==============================================================================
// SCHEMA DE DOCUMENTOS - Validação com Zod
// ==============================================================================

// Schema para upload e adaptação de documento
export const createDocumentSchema = z.object({
    // === CAMPOS LEGADOS (mantidos para compatibilidade) ===
    disciplina: z.string().optional(),
    professor: z.string().optional(),
    titulo: z.string().optional(),
    dataAdaptacao: z.string().optional(), // ISO date string

    // === NOVOS CAMPOS RELACIONAIS (Hierarquia Acadêmica) ===
    teacherId: z.string().cuid().optional(),      // ID do Professor
    disciplineId: z.string().cuid().optional(),   // ID da Disciplina
    classId: z.string().cuid().optional(),        // ID da Turma
    studentId: z.string().cuid().optional(),      // ID do Aluno (documento específico)

    // === INSTRUÇÕES CUSTOMIZADAS PARA IA ===
    customInstructions: z.object({
        braille: z.string().optional(),
        highLegibility: z.string().optional(),
    }).optional(),
});

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;

// Schema para atualização de metadados do documento
export const updateDocumentSchema = z.object({
    titulo: z.string().optional(),
    disciplina: z.string().optional(),
    professor: z.string().optional(),
    teacherId: z.string().cuid().nullable().optional(),
    disciplineId: z.string().cuid().nullable().optional(),
    classId: z.string().cuid().nullable().optional(),
    studentId: z.string().cuid().nullable().optional(),
});

export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;

// Schema para filtros de listagem
export const listDocumentsQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']).optional(),
    teacherId: z.string().cuid().optional(),
    disciplineId: z.string().cuid().optional(),
    classId: z.string().cuid().optional(),
    studentId: z.string().cuid().optional(),
});

export type ListDocumentsQuery = z.infer<typeof listDocumentsQuerySchema>;
