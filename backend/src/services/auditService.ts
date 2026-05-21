import { prisma } from '../lib/prisma.js';
import { Request } from 'express';
import type { AuditAction } from '@prisma/client';

interface AuditContext {
    userId: string;
    organizationId?: string | null;
    ipAddress?: string;
    userAgent?: string;
}

// Extrair contexto do request
export function getAuditContext(req: Request): Partial<AuditContext> {
    return {
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('User-Agent'),
    };
}

// Criar log de auditoria
export async function createAuditLog(
    action: AuditAction,
    context: AuditContext,
    description?: string,
    metadata?: Record<string, any>
) {
    try {
        await prisma.auditLog.create({
            data: {
                action,
                description,
                metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
                userId: context.userId,
                organizationId: context.organizationId,
                ipAddress: context.ipAddress,
                userAgent: context.userAgent,
            },
        });
    } catch (error) {
        // Log silencioso - não falhar a requisição por causa de audit
        console.error('Erro ao criar audit log:', error);
    }
}

// Buscar logs de auditoria (para admin)
export async function getAuditLogs(
    organizationId: string,
    options: {
        userId?: string;
        action?: AuditAction;
        limit?: number;
        offset?: number;
    } = {}
) {
    const { userId, action, limit = 50, offset = 0 } = options;

    const where: any = { organizationId };

    if (userId) where.userId = userId;
    if (action) where.action = action;

    const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
        }),
        prisma.auditLog.count({ where }),
    ]);

    return {
        logs,
        pagination: {
            total,
            limit,
            offset,
        },
    };
}
