import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { requireAuth, requireOrganization, requireAdmin } from '../../middleware/auth.js';
import * as billingService from './billing.service.js';

const router = Router();

// POST /api/billing/webhook - Webhook do Stripe (sem autenticação)
router.post('/webhook', asyncHandler(async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
        return res.status(400).json({ error: 'Signature ausente' });
    }

    const result = await billingService.handleWebhook(req.body, signature);
    res.json(result);
}));

// Rotas autenticadas
router.use(requireAuth, requireOrganization);

// GET /api/billing/status - Status da assinatura
router.get('/status', asyncHandler(async (req: Request, res: Response) => {
    const result = await billingService.getSubscriptionStatus(req.user!.organizationId!);
    res.json(result);
}));

// POST /api/billing/checkout - Criar sessão de checkout (requer admin)
router.post('/checkout', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const result = await billingService.createCheckoutSession(
        req.user!.organizationId!,
        req.user!.id
    );
    res.json(result);
}));

// POST /api/billing/portal - Criar sessão do portal do cliente (requer admin)
router.post('/portal', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const result = await billingService.createCustomerPortalSession(req.user!.organizationId!);
    res.json(result);
}));

export default router;
