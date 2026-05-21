import { z } from 'zod';

// ============================================================================
// POLÍTICA DE SENHA FORTE (Camada 2 - Defesa em Camadas)
// ============================================================================
const strongPassword = z.string()
    .min(8, 'Senha deve ter no mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Senha deve ter pelo menos 1 letra maiúscula')
    .regex(/[0-9]/, 'Senha deve ter pelo menos 1 número')
    .regex(/[^A-Za-z0-9]/, 'Senha deve ter pelo menos 1 caractere especial (!@#$%...)');

// Schema de registro
export const registerSchema = z.object({
    email: z.string().email('Email inválido'),
    password: strongPassword,
    name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').optional(),
    organizationName: z.string().min(2, 'Nome da organização deve ter no mínimo 2 caracteres'),
});

// Schema de login
export const loginSchema = z.object({
    email: z.string().email('Email inválido'),
    password: z.string().min(1, 'Senha é obrigatória'),
});

// Schema de esqueci a senha
export const forgotPasswordSchema = z.object({
    email: z.string().email('Email inválido'),
});

// Schema de reset de senha
export const resetPasswordSchema = z.object({
    token: z.string().min(1, 'Token é obrigatório'),
    password: strongPassword,
    confirmPassword: z.string().min(1, 'Confirmação obrigatória'),
}).refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
});

// Tipos derivados dos schemas
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
