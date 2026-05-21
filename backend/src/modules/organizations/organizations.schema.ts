import { z } from 'zod';

// Schema para atualizar configurações da organização
export const updateOrganizationSettingsSchema = z.object({
    name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').optional(),
    headerTitle: z.string().optional().nullable(),
    headerLegalText: z.string().optional().nullable(),
    headerExtraInfo: z.string().optional().nullable(),
});

// Schema para convidar membro
export const inviteMemberSchema = z.object({
    email: z.string().email('Email inválido'),
    role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
});

export type UpdateOrganizationSettingsInput = z.infer<typeof updateOrganizationSettingsSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
