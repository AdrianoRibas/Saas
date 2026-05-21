import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/errorHandler.js';
import bcrypt from 'bcryptjs';
import type { CreateTeacherInput, UpdateTeacherInput, ListTeachersQuery } from './teachers.schema.js';

// Listar professores com paginação
export async function listTeachers(organizationId: string, query: ListTeachersQuery) {
    const { page, limit, search } = query;
    const skip = (page - 1) * limit;

    const where: any = { organizationId };

    if (search) {
        where.OR = [
            { registration: { contains: search, mode: 'insensitive' } },
            { department: { contains: search, mode: 'insensitive' } },
            { user: { name: { contains: search, mode: 'insensitive' } } },
            { user: { email: { contains: search, mode: 'insensitive' } } },
        ];
    }

    const [teachers, total] = await Promise.all([
        prisma.teacher.findMany({
            where,
            skip,
            take: limit,
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                _count: {
                    select: {
                        disciplines: true,
                        documents: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        }),
        prisma.teacher.count({ where }),
    ]);

    return {
        teachers,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

// Buscar professor por ID
export async function getTeacherById(organizationId: string, teacherId: string) {
    const teacher = await prisma.teacher.findFirst({
        where: {
            id: teacherId,
            organizationId,
        },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
            disciplines: {
                select: {
                    id: true,
                    name: true,
                    code: true,
                },
            },
        },
    });

    if (!teacher) {
        throw new AppError('Professor não encontrado', 404, 'TEACHER_NOT_FOUND');
    }

    return teacher;
}

// Criar professor
export async function createTeacher(organizationId: string, input: CreateTeacherInput) {
    let userId = input.userId;

    // Se userId NÃO fornecido, precisamos encontrar ou criar o usuário
    if (!userId) {
        if (!input.email || !input.name) {
            throw new AppError('Nome e Email são obrigatórios para novo cadastro', 400, 'MISSING_DATA');
        }

        // Verificar se usuário já existe pelo email
        let user = await prisma.user.findUnique({
            where: { email: input.email },
        });

        if (!user) {
            // Criar novo usuário
            const passwordHash = await bcrypt.hash('Mudar@123', 10); // Senha padrão
            user = await prisma.user.create({
                data: {
                    name: input.name,
                    email: input.email,
                    passwordHash,
                    role: 'MEMBER', // Professor é um membro com privilégios de professor via tabela Teacher
                    organizationId,
                },
            });
        }

        // Se encontrou usuário existente, verificar se pertence à mesma organização (ou se é livre)
        if (user.organizationId && user.organizationId !== organizationId) {
            // Opcional: Permitir vincular se o usuário não tiver organização? Por enquanto bloqueamos.
            // Se multi-tenant estrito, e o email já existe em outro tenant, isso é um problema se email for unique global.
            // Schema diz: email String @unique globalmente.
            // Então se o email existe em outra org, não podemos usar.
            throw new AppError('Este email já está cadastrado em outra organização', 400, 'USER_IN_OTHER_ORG');
        }

        userId = user.id;
    } else {
        // Se userId fornecido, verificar se existe na organização
        const user = await prisma.user.findFirst({
            where: {
                id: userId,
                organizationId,
            },
        });

        if (!user) {
            throw new AppError('Usuário não encontrado', 404, 'USER_NOT_FOUND');
        }
    }

    // Verificar se já é professor
    const existingTeacher = await prisma.teacher.findUnique({
        where: { userId },
    });

    if (existingTeacher) {
        throw new AppError('Este usuário já está cadastrado como professor', 400, 'TEACHER_EXISTS');
    }

    const teacher = await prisma.teacher.create({
        data: {
            registration: input.registration,
            department: input.department,
            userId: userId!,
            organizationId,
        },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
        },
    });

    return teacher;
}

// Atualizar professor
export async function updateTeacher(
    organizationId: string,
    teacherId: string,
    input: UpdateTeacherInput
) {
    // Verificar se existe
    const existing = await prisma.teacher.findFirst({
        where: {
            id: teacherId,
            organizationId,
        },
    });

    if (!existing) {
        throw new AppError('Professor não encontrado', 404, 'TEACHER_NOT_FOUND');
    }

    const teacher = await prisma.teacher.update({
        where: { id: teacherId },
        data: input,
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
        },
    });

    return teacher;
}

// Deletar professor
export async function deleteTeacher(organizationId: string, teacherId: string) {
    // Verificar se existe
    const existing = await prisma.teacher.findFirst({
        where: {
            id: teacherId,
            organizationId,
        },
        include: {
            _count: {
                select: {
                    disciplines: true,
                    documents: true,
                },
            },
        },
    });

    if (!existing) {
        throw new AppError('Professor não encontrado', 404, 'TEACHER_NOT_FOUND');
    }

    // Verificar se tem disciplinas ou documentos vinculados
    if (existing._count.disciplines > 0) {
        throw new AppError(
            `Não é possível excluir: professor possui ${existing._count.disciplines} disciplina(s) vinculada(s)`,
            400,
            'TEACHER_HAS_DISCIPLINES'
        );
    }

    await prisma.teacher.delete({
        where: { id: teacherId },
    });

    return { message: 'Professor excluído com sucesso' };
}
