import { prisma } from '../../config/database.js';

// ==============================================================================
// NOTIFICATIONS SERVICE - Gestão de Alertas em Tempo Real
// ==============================================================================

/**
 * Cria uma nova notificação para um usuário
 */
export async function createNotification(
    userId: string,
    title: string,
    message: string,
    type: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR' = 'INFO'
) {
    return prisma.notification.create({
        data: {
            userId,
            title,
            message,
            type,
        },
    });
}

/**
 * Lista notificações de um usuário (lidas e não lidas)
 */
export async function listUserNotifications(userId: string) {
    return prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
    });
}

/**
 * Lista notificações não lidas de um usuário
 */
export async function listUnreadNotifications(userId: string) {
    return prisma.notification.findMany({
        where: {
            userId,
            read: false,
        },
        orderBy: {
            createdAt: 'desc'
        },
    });
}

/**
 * Marca notificações específicas como lidas
 */
export async function markAsRead(notificationIds: string | string[], userId: string) {
    const ids = Array.isArray(notificationIds) ? notificationIds : [notificationIds];
    return prisma.notification.updateMany({
        where: {
            id: { in: ids },
            userId,
        },
        data: {
            read: true,
        },
    });
}

/**
 * Marca todas as notificações de um usuário como lidas
 */
export async function markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
        where: { userId, read: false },
        data: { read: true },
    });
}

/**
 * Notifica o sucesso de uma adaptação de documento
 */
export async function notifyAdaptationSuccess(userId: string, docTitle: string, docId: string) {
    return createNotification(
        userId,
        'Adaptação Concluída! 🎉',
        `O documento "${docTitle}" foi processado com sucesso e está pronto para download.`,
        'SUCCESS'
    );
}

/**
 * Notifica falha na adaptação de documento
 */
export async function notifyAdaptationFailure(userId: string, docTitle: string, error: string) {
    return createNotification(
        userId,
        'Falha na Adaptação ❌',
        `Não foi possível processar o documento "${docTitle}". Motivo: ${error}`,
        'ERROR'
    );
}
