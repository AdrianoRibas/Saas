import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { logRequest as logReq } from '../lib/logger.js';

// Extend Express Request
declare global {
    namespace Express {
        interface Request {
            requestId?: string;
            startTime?: number;
        }
    }
}

// Middleware para adicionar requestId e tracking
export function requestContext(req: Request, res: Response, next: NextFunction) {
    // Gerar ou usar requestId existente (para tracing distribuído)
    req.requestId = (req.headers['x-request-id'] as string) || randomUUID();
    req.startTime = Date.now();

    // Adicionar requestId no header de resposta
    res.setHeader('X-Request-ID', req.requestId);

    // Log ao finalizar resposta
    res.on('finish', () => {
        const duration = Date.now() - (req.startTime || Date.now());

        logReq(
            req.method,
            req.path,
            res.statusCode,
            duration,
            {
                requestId: req.requestId,
                userId: req.user?.id,
                organizationId: req.organizationId,
            }
        );
    });

    next();
}

// Middleware para logar erros
export function errorLogger(err: Error, req: Request, res: Response, next: NextFunction) {
    const { logger } = require('../lib/logger.js');

    logger.error('Request error', {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        userId: req.user?.id,
    }, err);

    next(err);
}
