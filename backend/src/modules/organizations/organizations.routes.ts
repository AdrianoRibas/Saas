import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { requireAuth, requireOrganization, requireAdmin } from '../../middleware/auth.js';
import { updateOrganizationSettingsSchema } from './organizations.schema.js';
import * as orgService from './organizations.service.js';
import { z } from 'zod';

const router = Router();

// Todas as rotas requerem autenticação e organização
router.use(requireAuth, requireOrganization);

// GET /api/organizations/current - Dados da organização atual
router.get('/current', asyncHandler(async (req: Request, res: Response) => {
    const organization = await orgService.getOrganization(req.user!.organizationId!);
    res.json({ organization });
}));

// PUT /api/organizations/settings - Atualizar configurações (requer admin)
router.put('/settings', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const input = updateOrganizationSettingsSchema.parse(req.body);
    const organization = await orgService.updateSettings(req.user!.organizationId!, input);

    res.json({
        message: 'Configurações atualizadas com sucesso!',
        organization,
    });
}));

// GET /api/organizations/header - Configuração do cabeçalho para documentos
router.get('/header', asyncHandler(async (req: Request, res: Response) => {
    const headerConfig = await orgService.getHeaderConfig(req.user!.organizationId!);
    res.json({ headerConfig });
}));

// GET /api/organizations/members - Listar membros
router.get('/members', asyncHandler(async (req: Request, res: Response) => {
    const members = await orgService.getMembers(req.user!.organizationId!);
    res.json({ members });
}));

// DELETE /api/organizations/members/:id - Remover membro (requer admin)
router.delete('/members/:id', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const result = await orgService.removeMember(
        req.user!.organizationId!,
        req.params.id as string,
        req.user!.id
    );
    res.json(result);
}));

// PUT /api/organizations/members/:id/role - Alterar cargo (requer OWNER)
router.put('/members/:id/role', asyncHandler(async (req: Request, res: Response) => {
    // Apenas OWNER pode alterar cargos
    if (req.user!.role !== 'OWNER') {
        return res.status(403).json({ error: 'Apenas o proprietário pode alterar cargos' });
    }

    const roleSchema = z.object({
        role: z.enum(['ADMIN', 'MEMBER'])
    });
    const { role } = roleSchema.parse(req.body);

    const member = await orgService.changeMemberRole(
        req.user!.organizationId!,
        req.params.id as string,
        role,
        req.user!.id
    );

    res.json({
        message: 'Cargo alterado com sucesso!',
        member,
    });
}));

export default router;
