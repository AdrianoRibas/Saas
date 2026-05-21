import { prisma } from '../../config/database.js';
import { AppError } from '../../middleware/errorHandler.js';
import type { UpdateOrganizationSettingsInput } from './organizations.schema.js';

// Buscar organização atual
export async function getOrganization(organizationId: string) {
    const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
            id: true,
            name: true,
            headerTitle: true,
            headerLegalText: true,
            headerExtraInfo: true,
            subscriptionStatus: true,
            createdAt: true,
            _count: {
                select: { users: true, documents: true },
            },
        },
    });

    if (!organization) {
        throw new AppError('Organização não encontrada', 404, 'ORG_NOT_FOUND');
    }

    return organization;
}

// Atualizar configurações da organização (incluindo cabeçalho)
export async function updateSettings(organizationId: string, input: UpdateOrganizationSettingsInput) {
    const organization = await prisma.organization.update({
        where: { id: organizationId },
        data: {
            name: input.name,
            headerTitle: input.headerTitle,
            headerLegalText: input.headerLegalText,
            headerExtraInfo: input.headerExtraInfo,
        },
        select: {
            id: true,
            name: true,
            headerTitle: true,
            headerLegalText: true,
            headerExtraInfo: true,
        },
    });

    return organization;
}

// Listar membros da organização
export async function getMembers(organizationId: string) {
    const members = await prisma.user.findMany({
        where: { organizationId },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
    });

    return members;
}

// Obter configuração do cabeçalho para documentos
export async function getHeaderConfig(organizationId: string) {
    const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
            name: true,
            headerTitle: true,
            headerLegalText: true,
            headerExtraInfo: true,
        },
    });

    if (!organization) {
        throw new AppError('Organização não encontrada', 404, 'ORG_NOT_FOUND');
    }

    // Retorna configuração do cabeçalho com valores padrão se não definidos
    return {
        title: organization.headerTitle || organization.name,
        legalText: organization.headerLegalText ||
            'Esta é uma adaptação de texto para acessibilidade, de acordo com a Lei Brasileira de Inclusão Nº 13.146.',
        extraInfo: organization.headerExtraInfo || '',
    };
}

// Remover membro da organização
export async function removeMember(
    organizationId: string,
    memberId: string,
    currentUserId: string
) {
    // Não pode remover a si mesmo
    if (memberId === currentUserId) {
        throw new AppError('Você não pode remover a si mesmo', 400, 'CANNOT_REMOVE_SELF');
    }

    const member = await prisma.user.findFirst({
        where: {
            id: memberId,
            organizationId,
        },
    });

    if (!member) {
        throw new AppError('Membro não encontrado', 404, 'MEMBER_NOT_FOUND');
    }

    // Não pode remover o OWNER
    if (member.role === 'OWNER') {
        throw new AppError('Não é possível remover o proprietário da organização', 400, 'CANNOT_REMOVE_OWNER');
    }

    // Remover o usuário da organização (não deletar o usuário)
    await prisma.user.update({
        where: { id: memberId },
        data: { organizationId: null },
    });

    return { message: 'Membro removido com sucesso' };
}

// Alterar role de membro
export async function changeMemberRole(
    organizationId: string,
    memberId: string,
    newRole: 'ADMIN' | 'MEMBER',
    currentUserId: string
) {
    // Não pode alterar próprio role
    if (memberId === currentUserId) {
        throw new AppError('Você não pode alterar seu próprio cargo', 400, 'CANNOT_CHANGE_OWN_ROLE');
    }

    const member = await prisma.user.findFirst({
        where: {
            id: memberId,
            organizationId,
        },
    });

    if (!member) {
        throw new AppError('Membro não encontrado', 404, 'MEMBER_NOT_FOUND');
    }

    // Não pode alterar role do OWNER
    if (member.role === 'OWNER') {
        throw new AppError('Não é possível alterar o cargo do proprietário', 400, 'CANNOT_CHANGE_OWNER');
    }

    const updatedMember = await prisma.user.update({
        where: { id: memberId },
        data: { role: newRole },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
        },
    });

    return updatedMember;
}
