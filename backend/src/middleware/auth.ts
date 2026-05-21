import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { prisma } from '../config/database.js';

// Extende o tipo Request do Express para incluir o usuário e o tenant
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                email: string;
                role: string;
                organizationId: string | null;
            };
            organizationId?: string; // ID da organização extraído
            tenantSource?: 'jwt' | 'header'; // Rastreabilidade
        }
    }
}

interface JwtPayload {
    userId: string;
    email: string;
}

// Middleware que exige autenticação
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
    try {
        // Otimização: Se o usuário já foi carregado pelo tenantGuard
        if (req.user) {
            return next();
        }

        let decoded: JwtPayload;

        // Otimização: Se o token já foi verificado pelo tenantGuard
        if ((req as any).jwtPayload) {
            decoded = (req as any).jwtPayload;
        } else {
            const authHeader = req.headers.authorization;

            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ error: 'Token não fornecido' });
            }

            const token = authHeader.substring(7);
            decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
        }

        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                email: true,
                role: true,
                organizationId: true,
            },
        });

        if (!user) {
            return res.status(401).json({ error: 'Usuário não encontrado' });
        }

        req.user = user;
        next();
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            return res.status(401).json({ error: 'Token inválido' });
        }
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({ error: 'Token expirado' });
        }
        return res.status(500).json({ error: 'Erro interno de autenticação' });
    }
}

// Middleware que exige que o usuário tenha uma organização
export async function requireOrganization(req: Request, res: Response, next: NextFunction) {
    if (!req.user?.organizationId) {
        return res.status(403).json({ error: 'Você precisa pertencer a uma organização' });
    }
    next();
}

// Middleware que exige que o usuário seja OWNER ou ADMIN
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
    if (!req.user || (req.user.role !== 'OWNER' && req.user.role !== 'ADMIN')) {
        return res.status(403).json({ error: 'Acesso negado. Requer permissão de administrador.' });
    }
    next();
}

// Middleware que exige assinatura ativa
export async function requireActiveSubscription(req: Request, res: Response, next: NextFunction) {
    if (!req.user?.organizationId) {
        return res.status(403).json({ error: 'Organização não encontrada' });
    }

    // DEV BYPASS: O desenvolvedor tem acesso total
    if (req.user.email === config.superAdminEmail) {
        return next();
    }

    const organization = await prisma.organization.findUnique({
        where: { id: req.user.organizationId },
        select: { subscriptionStatus: true },
    });

    if (!organization || organization.subscriptionStatus !== 'ACTIVE') {
        return res.status(403).json({
            error: 'Assinatura inativa. Por favor, ative seu plano Enterprise.',
            code: 'SUBSCRIPTION_REQUIRED'
        });
    }

    next();
}
