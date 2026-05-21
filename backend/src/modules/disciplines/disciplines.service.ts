import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/errorHandler.js';
import type { CreateDisciplineInput, UpdateDisciplineInput, ListDisciplinesQuery } from './disciplines.schema.js';

// Listar disciplinas com paginação
export async function listDisciplines(organizationId: string, query: ListDisciplinesQuery) {
    const { page, limit, search, teacherId } = query;
    const skip = (page - 1) * limit;

    const where: any = { organizationId };

    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
        ];
    }

    if (teacherId) {
        where.teacherId = teacherId;
    }

    const [disciplines, total] = await Promise.all([
        prisma.discipline.findMany({
            where,
            skip,
            take: limit,
            include: {
                teacher: {
                    include: {
                        user: {
                            select: {
                                name: true,
                                email: true,
                            },
                        },
                    },
                },
                _count: {
                    select: {
                        classes: true,
                    },
                },
            },
            orderBy: { name: 'asc' },
        }),
        prisma.discipline.count({ where }),
    ]);

    return {
        disciplines,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

// Buscar disciplina por ID
export async function getDisciplineById(organizationId: string, disciplineId: string) {
    const discipline = await prisma.discipline.findFirst({
        where: {
            id: disciplineId,
            organizationId,
        },
        include: {
            teacher: {
                include: {
                    user: {
                        select: {
                            name: true,
                            email: true,
                        },
                    },
                },
            },
            classes: {
                select: {
                    id: true,
                    name: true,
                    year: true,
                    semester: true,
                    shift: true,
                },
            },
        },
    });

    if (!discipline) {
        throw new AppError('Disciplina não encontrada', 404, 'DISCIPLINE_NOT_FOUND');
    }

    return discipline;
}

// Criar disciplina
export async function createDiscipline(organizationId: string, input: CreateDisciplineInput) {
    // Se teacherId fornecido, verificar se existe e pertence à organização
    if (input.teacherId) {
        const teacher = await prisma.teacher.findFirst({
            where: {
                id: input.teacherId,
                organizationId,
            },
        });

        if (!teacher) {
            throw new AppError('Professor não encontrado', 404, 'TEACHER_NOT_FOUND');
        }
    }

    // Verificar unicidade do código (se fornecido)
    if (input.code) {
        const existingCode = await prisma.discipline.findFirst({
            where: {
                organizationId,
                code: input.code,
                // Na criação não precisamos excluir ID atual
            },
        });
        if (existingCode) {
            throw new AppError('Já existe uma disciplina com este código', 400, 'DUPLICATE_CODE');
        }
    }

    const discipline = await prisma.discipline.create({
        data: {
            name: input.name,
            code: input.code,
            description: input.description,
            teacherId: input.teacherId,
            organizationId,
        },
        include: {
            teacher: {
                include: {
                    user: {
                        select: {
                            name: true,
                            email: true,
                        },
                    },
                },
            },
        },
    });

    return discipline;
}

// Atualizar disciplina
export async function updateDiscipline(
    organizationId: string,
    disciplineId: string,
    input: UpdateDisciplineInput
) {
    // Verificar se existe
    const existing = await prisma.discipline.findFirst({
        where: {
            id: disciplineId,
            organizationId,
        },
    });

    if (!existing) {
        throw new AppError('Disciplina não encontrada', 404, 'DISCIPLINE_NOT_FOUND');
    }

    // Se teacherId fornecido, verificar se existe
    if (input.teacherId) {
        const teacher = await prisma.teacher.findFirst({
            where: {
                id: input.teacherId,
                organizationId,
            },
        });

        if (!teacher) {
            throw new AppError('Professor não encontrado', 404, 'TEACHER_NOT_FOUND');
        }
    }

    // Verificar unicidade do código (se alterado)
    if (input.code && input.code !== existing.code) {
        const existingCode = await prisma.discipline.findFirst({
            where: {
                organizationId,
                code: input.code,
                id: { not: disciplineId },
            },
        });
        if (existingCode) {
            throw new AppError('Já existe uma disciplina com este código', 400, 'DUPLICATE_CODE');
        }
    }

    const discipline = await prisma.discipline.update({
        where: { id: disciplineId },
        data: input,
        include: {
            teacher: {
                include: {
                    user: {
                        select: {
                            name: true,
                            email: true,
                        },
                    },
                },
            },
        },
    });

    return discipline;
}

// Deletar disciplina
export async function deleteDiscipline(organizationId: string, disciplineId: string) {
    const existing = await prisma.discipline.findFirst({
        where: {
            id: disciplineId,
            organizationId,
        },
        include: {
            _count: {
                select: {
                    classes: true,
                },
            },
        },
    });

    if (!existing) {
        throw new AppError('Disciplina não encontrada', 404, 'DISCIPLINE_NOT_FOUND');
    }

    if (existing._count.classes > 0) {
        throw new AppError(
            `Não é possível excluir: disciplina possui ${existing._count.classes} turma(s) vinculada(s)`,
            400,
            'DISCIPLINE_HAS_CLASSES'
        );
    }

    await prisma.discipline.delete({
        where: { id: disciplineId },
    });

    return { message: 'Disciplina excluída com sucesso' };
}
