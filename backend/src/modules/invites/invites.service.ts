import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/errorHandler.js';
import bcrypt from 'bcryptjs';
import * as emailLib from '../../lib/email.js';
import type { CreateInviteInput, ListInvitesQuery, AcceptInviteInput } from './invites.schema.js';

// Listar convites da organização
export async function listInvites(organizationId: string, query: ListInvitesQuery) {
    const where: any = { organizationId };

    if (query.status) {
        where.status = query.status;
    }

    const invites = await prisma.invite.findMany({
        where,
        include: {
            invitedBy: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
        },
        orderBy: { createdAt: 'desc' },
    });

    return invites;
}

// Criar convite
export async function createInvite(
    organizationId: string,
    userId: string,
    input: CreateInviteInput
) {
    // Verificar se email já está registrado na organização
    const existingUser = await prisma.user.findFirst({
        where: {
            email: input.email,
            organizationId,
        },
    });

    if (existingUser) {
        throw new AppError('Este email já está registrado na organização', 400, 'USER_EXISTS');
    }

    // Verificar se já existe convite pendente
    const existingInvite = await prisma.invite.findFirst({
        where: {
            email: input.email,
            organizationId,
            status: 'PENDING',
        },
    });

    if (existingInvite) {
        throw new AppError('Já existe um convite pendente para este email', 400, 'INVITE_EXISTS');
    }

    // Criar convite (expira em 7 dias)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invite = await prisma.invite.create({
        data: {
            email: input.email,
            role: input.role,
            organizationId,
            invitedById: userId,
            expiresAt,
        },
        include: {
            organization: {
                select: {
                    name: true,
                },
            },
            invitedBy: {
                select: {
                    name: true,
                },
            },
        },
    });

    // Enviar email com link de convite (Resend)
    const acceptUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invite/accept?token=${invite.token}`;
    
    await emailLib.sendInviteEmail(
        invite.email, 
        invite.organization.name, 
        invite.invitedBy.name || 'Um Administrador', 
        acceptUrl
    );

    return invite;
}

// Revogar convite
export async function revokeInvite(organizationId: string, inviteId: string) {
    const invite = await prisma.invite.findFirst({
        where: {
            id: inviteId,
            organizationId,
            status: 'PENDING',
        },
    });

    if (!invite) {
        throw new AppError('Convite não encontrado ou já processado', 404, 'INVITE_NOT_FOUND');
    }

    await prisma.invite.update({
        where: { id: inviteId },
        data: { status: 'REVOKED' },
    });

    return { message: 'Convite revogado com sucesso' };
}

// Aceitar convite (endpoint público)
export async function acceptInvite(input: AcceptInviteInput) {
    const invite = await prisma.invite.findUnique({
        where: { token: input.token },
        include: {
            organization: true,
        },
    });

    if (!invite) {
        throw new AppError('Convite não encontrado', 404, 'INVITE_NOT_FOUND');
    }

    if (invite.status !== 'PENDING') {
        throw new AppError('Este convite já foi utilizado ou cancelado', 400, 'INVITE_INVALID');
    }

    if (new Date() > invite.expiresAt) {
        await prisma.invite.update({
            where: { id: invite.id },
            data: { status: 'EXPIRED' },
        });
        throw new AppError('Este convite expirou', 400, 'INVITE_EXPIRED');
    }

    // Verificar se email já está em uso
    const existingUser = await prisma.user.findUnique({
        where: { email: invite.email },
    });

    if (existingUser) {
        throw new AppError('Este email já está registrado', 400, 'EMAIL_EXISTS');
    }

    // Criar usuário e atualizar convite em transação
    const passwordHash = await bcrypt.hash(input.password, 10);

    const [user] = await prisma.$transaction([
        prisma.user.create({
            data: {
                email: invite.email,
                name: input.name,
                passwordHash,
                role: invite.role,
                organizationId: invite.organizationId,
            },
        }),
        prisma.invite.update({
            where: { id: invite.id },
            data: { status: 'ACCEPTED' },
        }),
    ]);

    return {
        message: 'Conta criada com sucesso!',
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            organization: invite.organization.name,
        },
    };
}

// Reenviar convite
export async function resendInvite(organizationId: string, inviteId: string) {
    const invite = await prisma.invite.findFirst({
        where: {
            id: inviteId,
            organizationId,
            status: 'PENDING',
        },
    });

    if (!invite) {
        throw new AppError('Convite não encontrado ou já processado', 404, 'INVITE_NOT_FOUND');
    }

    // Atualizar data de expiração
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.invite.update({
        where: { id: inviteId },
        data: { expiresAt },
    });

    // TODO: Reenviar email

    return { message: 'Convite reenviado com sucesso' };
}
