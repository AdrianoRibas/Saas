import { z } from 'zod';

// Schema para criar convite
export const createInviteSchema = z.object({
    email: z.string().email('Email inválido'),
    role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'), // OWNER não pode ser convidado
});

// Schema para listar convites
export const listInvitesQuerySchema = z.object({
    status: z.enum(['PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED']).optional(),
});

// Schema para aceitar convite (público)
export const acceptInviteSchema = z.object({
    token: z.string(),
    name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
    password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

export type CreateInviteInput = z.infer<typeof createInviteSchema>;
export type ListInvitesQuery = z.infer<typeof listInvitesQuerySchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
