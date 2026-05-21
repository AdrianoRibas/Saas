import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import * as notificationService from './notifications.service.js';
import { asyncHandler } from '../../middleware/errorHandler.js';

const router = Router();

router.use(requireAuth);

// GET /api/notifications - Listar notificações
router.get('/', asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const notifications = await notificationService.listUserNotifications(userId);
    res.json(notifications);
}));

// PUT /api/notifications/:id/read - Marcar como lida
router.put('/:id/read', asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const notification = await notificationService.markAsRead(req.params.id as string, userId);
    res.json(notification);
}));

// POST /api/notifications/mark-all-read - Marcar todas como lidas
router.post('/mark-all-read', asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    await notificationService.markAllAsRead(userId);
    res.json({ success: true });
}));

export default router;
