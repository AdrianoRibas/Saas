import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { inviteLimiter } from '../../middleware/rateLimiter.js';
import { requireAuth, requireOrganization, requireAdmin } from '../../middleware/auth.js';
import {
    createInviteSchema,
    listInvitesQuerySchema,
    acceptInviteSchema,
} from './invites.schema.js';
import * as inviteService from './invites.service.js';

const router = Router();

// ============================================================================
// ROTA PÚBLICA - Aceitar convite
// ============================================================================

// POST /api/invites/accept - Aceitar convite (sem autenticação)
router.post('/accept', inviteLimiter, asyncHandler(async (req: Request, res: Response) => {
    const input = acceptInviteSchema.parse(req.body);
    const result = await inviteService.acceptInvite(input);

    res.status(201).json(result);
}));

// ============================================================================
// ROTAS PROTEGIDAS
// ============================================================================

router.use(requireAuth, requireOrganization, requireAdmin);

// GET /api/invites - Listar convites
router.get('/', asyncHandler(async (req: Request, res: Response) => {
    const query = listInvitesQuerySchema.parse(req.query);
    const invites = await inviteService.listInvites(req.organizationId!, query);
    res.json({ invites });
}));

// POST /api/invites - Criar convite
router.post('/', asyncHandler(async (req: Request, res: Response) => {
    const input = createInviteSchema.parse(req.body);
    const invite = await inviteService.createInvite(
        req.organizationId!,
        req.user!.id,
        input
    );

    res.status(201).json({
        message: 'Convite criado com sucesso!',
        invite,
        // URL de aceite (frontend deve implementar esta página)
        acceptUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invite/accept?token=${invite.token}`,
    });
}));

// DELETE /api/invites/:id - Revogar convite
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
    const result = await inviteService.revokeInvite(
        req.organizationId!,
        req.params.id as string
    );
    res.json(result);
}));

// POST /api/invites/:id/resend - Reenviar convite
router.post('/:id/resend', asyncHandler(async (req: Request, res: Response) => {
    const result = await inviteService.resendInvite(
        req.organizationId!,
        req.params.id as string
    );
    res.json(result);
}));

export default router;
