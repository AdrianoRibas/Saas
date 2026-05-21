import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// Mensagem de erro padrão
const createRateLimitMessage = (retryAfter: number) => ({
    error: 'Muitas requisições. Tente novamente mais tarde.',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter,
});

// ============================================================================
// RATE LIMITERS
// ============================================================================

// Rate limiter global (100 req/min por IP)
export const globalLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
        res.status(429).json(createRateLimitMessage(60));
    },
});

// Rate limiter para autenticação (5 tentativas/min)
export const authLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Não conta requisições bem-sucedidas
    handler: (req: Request, res: Response) => {
        res.status(429).json({
            error: 'Muitas tentativas de login. Aguarde 1 minuto.',
            code: 'AUTH_RATE_LIMIT',
            retryAfter: 60,
        });
    },
});

// Rate limiter para criação de recursos (30 req/min)
export const createLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
        res.status(429).json(createRateLimitMessage(60));
    },
});

// Rate limiter para upload/processamento de documentos (10 req/min)
export const uploadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
        res.status(429).json({
            error: 'Limite de uploads atingido. Aguarde 1 minuto.',
            code: 'UPLOAD_RATE_LIMIT',
            retryAfter: 60,
        });
    },
});

// Rate limiter para convites (10 req/hora)
export const inviteLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
        res.status(429).json({
            error: 'Limite de convites atingido. Aguarde 1 hora.',
            code: 'INVITE_RATE_LIMIT',
            retryAfter: 3600,
        });
    },
});
