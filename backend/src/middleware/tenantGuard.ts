import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { prisma } from '../config/database.js';

interface JwtPayload {
    userId: string;
    email: string;
    organizationId?: string; // Pode estar no token (melhor prática)
}

// ============================================================================
// TENANT GUARD MIDDLEWARE - Barreira de Segurança Multi-tenant
// ============================================================================

/**
 * Middleware de Proteção Multi-tenant
 * 
 * FLUXO DE SEGURANÇA:
 * 1. Tenta extrair organizationId do JWT (prioridade)
 * 2. Se não houver no JWT, tenta ler o header x-tenant-id (fallback para APIs públicas)
 * 3. Valida se a organização existe e está ativa
 * 4. Injeta o organizationId validado no req
 * 
 * BLOQUEIOS:
 * - Se não encontrar organizationId: 403 Forbidden
 * - Se organização não existir: 403 Forbidden (não 404 para não revelar existência)
 * - Se assinatura estiver inativa: 402 Payment Required
 */
export async function tenantGuard(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void | Response> {
    try {
        let organizationId: string | undefined;
        let source: 'jwt' | 'header' = 'header';

        // ========== PRIORIDADE 1: EXTRAÇÃO DO JWT (Mais Seguro) ==========
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const token = authHeader.substring(7);
                const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
                
                // Armazena payload decodificado para evitar re-verificação no requireAuth
                (req as any).jwtPayload = decoded;

                // Se o token contém organizationId, use-o (melhor prática)
                if (decoded.organizationId) {
                    organizationId = decoded.organizationId;
                    source = 'jwt';
                } else {
                    // Se não tem no token, busca do usuário no banco
                    // Busca campos adicionais para popular req.user antecipadamente
                    const user = await prisma.user.findUnique({
                        where: { id: decoded.userId },
                        select: { 
                            id: true, 
                            email: true, 
                            role: true, 
                            organizationId: true 
                        },
                    });

                    if (user) {
                        // Se encontrou usuário, já popula o req.user
                        (req as any).user = user;
                        
                        if (user.organizationId) {
                            organizationId = user.organizationId;
                            source = 'jwt';
                        }
                    }
                }
            } catch (jwtError) {
                // Token inválido/expirado - continue para tentar header
                console.warn('[TENANT_GUARD] JWT inválido, tentando header:', jwtError);
            }
        }

        // ========== PRIORIDADE 2: HEADER X-TENANT-ID (Fallback) ==========
        // Útil para webhooks, APIs públicas ou integrações externas
        if (!organizationId) {
            const headerTenantId = req.headers['x-tenant-id'] as string;

            if (headerTenantId && typeof headerTenantId === 'string') {
                organizationId = headerTenantId;
                source = 'header';
            }
        }

        // ========== BLOQUEIO: NENHUM TENANT IDENTIFICADO ==========
        if (!organizationId) {
            res.status(403).json({
                error: 'Acesso negado: Organização não identificada',
                code: 'TENANT_REQUIRED',
                hint: 'Forneça x-tenant-id no header ou faça login com uma conta vinculada a uma organização',
            });
            return;
        }

        // ========== VALIDAÇÃO: ORGANIZAÇÃO EXISTE E ESTÁ ATIVA ==========
        const organization = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: {
                id: true,
                name: true,
                subscriptionStatus: true,
            },
        });

        // Organização não existe (retorna 403, não 404, para não revelar IDs válidos)
        if (!organization) {
            console.error(`[TENANT_GUARD] Tentativa de acesso com organizationId inválido: ${organizationId}`);
            res.status(403).json({
                error: 'Acesso negado: Organização inválida',
                code: 'INVALID_TENANT',
            });
            return;
        }

        // ========== VERIFICAÇÃO DE ASSINATURA (Opcional - pode ser desabilitada em algumas rotas) ==========
        // Permite bypass para super-admin (dev) ou para rotas de billing
        const isBillingRoute = req.path.startsWith('/api/billing');
        const isSuperAdmin = (req as any).user?.email === config.superAdminEmail; // Dev bypass

        if (!isBillingRoute && !isSuperAdmin) {
            if (organization.subscriptionStatus !== 'ACTIVE') {
                res.status(402).json({
                    error: 'Assinatura inativa',
                    code: 'SUBSCRIPTION_REQUIRED',
                    message: 'Sua organização precisa de uma assinatura ativa para acessar este recurso',
                    subscriptionStatus: organization.subscriptionStatus,
                });
                return;
            }
        }

        // ========== SUCESSO: INJETA ORGANIZATIONID NO REQUEST ==========
        req.organizationId = organizationId;
        req.tenantSource = source;

        // Log de auditoria (útil para compliance)
        console.log(`[TENANT_GUARD] ✅ Acesso permitido - Org: ${organization.name} (${organizationId}) via ${source}`);

        next();

    } catch (error) {
        console.error('[TENANT_GUARD] Erro inesperado:', error);
        res.status(500).json({
            error: 'Erro ao validar organização',
            code: 'TENANT_VALIDATION_ERROR',
        });
        return;
    }
}

// ============================================================================
// WHITELIST DE ROTAS SEM TENANT GUARD
// ============================================================================

/**
 * Middleware para permitir rotas públicas (sem exigência de tenant)
 * Usado em: /auth/register, /auth/login, /webhooks, /health
 */
export function optionalTenant(
    req: Request,
    res: Response,
    next: NextFunction
): void {
    // Tenta extrair tenant, mas não bloqueia se não encontrar
    const headerTenantId = req.headers['x-tenant-id'] as string;

    if (headerTenantId) {
        req.organizationId = headerTenantId;
        req.tenantSource = 'header';
    }

    next();
}
