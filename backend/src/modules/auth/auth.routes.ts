import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from './auth.schema.js';
import * as authService from './auth.service.js';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

const router = Router();

// ============================================================================
// RATE LIMITERS (Camada 2 - Edge Functions validam os acessos)
// ============================================================================

// Rate limiter para login: 5 tentativas por 15 minutos por IP
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5,
    skipSuccessfulRequests: true,
    message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Rate limiter para registro: 3 contas por hora por IP
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 3,
    message: { error: 'Limite de criação de contas excedido. Tente novamente mais tarde.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Rate limiter para esqueci minha senha: 3 solicitações por hora por IP
const forgotPasswordLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 3,
    message: { error: 'Muitas solicitações de recuperação. Tente novamente em 1 hora.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// ============================================================================
// ROTAS PÚBLICAS
// ============================================================================

// POST /api/auth/register
router.post('/register', registerLimiter, asyncHandler(async (req: Request, res: Response) => {
    const input = registerSchema.parse(req.body);
    const result = await authService.register(input);

    res.status(201).json({
        message: 'Conta criada com sucesso!',
        ...result,
    });
}));

// POST /api/auth/login
router.post('/login', loginLimiter, asyncHandler(async (req: Request, res: Response) => {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input);

    res.json({
        message: 'Login realizado com sucesso!',
        ...result,
    });
}));

// POST /api/auth/forgot-password — Envia email com link de recuperação
router.post('/forgot-password', forgotPasswordLimiter, asyncHandler(async (req: Request, res: Response) => {
    const { email } = forgotPasswordSchema.parse(req.body);
    const result = await authService.forgotPassword(email);

    // Sempre retorna 200 para não revelar se o email existe no sistema
    res.status(200).json(result);
}));

// POST /api/auth/reset-password — Redefine a senha com o token do email
router.post('/reset-password', asyncHandler(async (req: Request, res: Response) => {
    const { token, password } = resetPasswordSchema.parse(req.body);
    const result = await authService.resetPassword(token, password);

    res.json(result);
}));

// POST /api/auth/refresh - Renovar access token
router.post('/refresh', asyncHandler(async (req: Request, res: Response) => {
    const refreshSchema = z.object({ refreshToken: z.string().min(1) });
    const { refreshToken } = refreshSchema.parse(req.body);

    const result = await authService.refreshAccessToken(refreshToken);

    res.json({
        message: 'Token renovado com sucesso!',
        ...result,
    });
}));

// ============================================================================
// ROTAS AUTENTICADAS
// ============================================================================

// GET /api/auth/me - Retorna dados do usuário logado
router.get('/me', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.getMe(req.user!.id);
    res.json({ user });
}));

// POST /api/auth/logout - Revogar refresh token
router.post('/logout', asyncHandler(async (req: Request, res: Response) => {
    const logoutSchema = z.object({ refreshToken: z.string().optional() });
    const { refreshToken } = logoutSchema.parse(req.body);

    if (refreshToken) {
        await authService.revokeRefreshToken(refreshToken);
    }

    res.json({ message: 'Logout realizado com sucesso!' });
}));

// POST /api/auth/logout-all - Revogar todos os tokens (requer auth)
router.post('/logout-all', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    await authService.revokeAllUserTokens(req.user!.id);
    res.json({ message: 'Todas as sessões foram encerradas!' });
}));

export default router;
