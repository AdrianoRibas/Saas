import { prisma } from '../../lib/prisma.js'; // force update
import { AppError } from '../../middleware/errorHandler.js';
import type { CreateStudentInput, UpdateStudentInput, ListStudentsQuery } from './students.schema.js';

// Listar alunos com paginação
export async function listStudents(organizationId: string, query: ListStudentsQuery) {
    const { page, limit, search, isPcd, accessibilityType } = query;
    const skip = (page - 1) * limit;

    const where: any = { organizationId };

    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { registration: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
        ];
    }

    if (isPcd !== undefined) {
        where.isPcd = isPcd;
    }

    if (accessibilityType) {
        where.accessibilityTypes = { has: accessibilityType };
    }

    const [students, total] = await Promise.all([
        prisma.student.findMany({
            where,
            skip,
            take: limit,
            include: {
                classes: {
                    include: {
                        class: {
                            select: {
                                id: true,
                                name: true,
                                discipline: {
                                    select: {
                                        name: true,
                                    },
                                },
                            },
                        },
                    },
                },
                _count: {
                    select: {
                        documents: true,
                    },
                },
            },
            orderBy: { name: 'asc' },
        }),
        prisma.student.count({ where }),
    ]);

    return {
        students,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

// Buscar aluno por ID
export async function getStudentById(organizationId: string, studentId: string) {
    const student = await prisma.student.findFirst({
        where: {
            id: studentId,
            organizationId,
        },
        include: {
            classes: {
                include: {
                    class: {
                        include: {
                            discipline: {
                                select: {
                                    id: true,
                                    name: true,
                                    code: true,
                                },
                            },
                        },
                    },
                },
            },
            documents: {
                select: {
                    id: true,
                    originalName: true,
                    status: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'desc' },
                take: 10,
            },
        },
    });

    if (!student) {
        throw new AppError('Aluno não encontrado', 404, 'STUDENT_NOT_FOUND');
    }

    return student;
}

// Criar aluno
export async function createStudent(organizationId: string, input: CreateStudentInput) {
    // Verificar se matrícula já existe na organização
    if (input.registration) {
        const existingStudent = await prisma.student.findFirst({
            where: {
                registration: input.registration,
                organizationId,
            },
        });

        if (existingStudent) {
            throw new AppError('Já existe um aluno com esta matrícula', 400, 'REGISTRATION_EXISTS');
        }
    }

    // Validar Unicidade de Email (Users e Students)
    // Agora que o email é obrigatório no schema, sempre validamos
    if (input.email) {
        // 1. Checar se já existe usuário com este email (Global - Case Insensitive)
        const existingUser = await prisma.user.findFirst({
            where: {
                email: { equals: input.email, mode: 'insensitive' }
            }
        });
        if (existingUser) {
            throw new AppError('Este email já está em uso por um usuário do sistema', 400, 'EMAIL_EXISTS_USER');
        }

        // 2. Checar se já existe outro aluno com este email na mesma organização (Case Insensitive)
        const existingStudentEmail = await prisma.student.findFirst({
            where: {
                email: { equals: input.email, mode: 'insensitive' },
                organizationId
            }
        });
        if (existingStudentEmail) {
            throw new AppError('Este email já está cadastrado para outro aluno nesta organização', 400, 'EMAIL_EXISTS_STUDENT');
        }
    }

    const student = await prisma.student.create({
        data: {
            name: input.name,
            registration: input.registration,
            email: input.email,
            isPcd: input.isPcd,
            accessibilityTypes: input.accessibilityTypes || [],
            accessibilityNotes: input.accessibilityNotes,
            prefersBraille: input.prefersBraille,
            prefersLargePrint: input.prefersLargePrint,
            prefersAudio: input.prefersAudio,
            organizationId,
        },
    });

    // Matricular nas turmas selecionadas
    if (input.classIds && input.classIds.length > 0) {
        await prisma.classStudent.createMany({
            data: input.classIds.map((classId) => ({
                studentId: student.id,
                classId,
            })),
            skipDuplicates: true,
        });
    }

    return student;
}

// Atualizar aluno
export async function updateStudent(
    organizationId: string,
    studentId: string,
    input: UpdateStudentInput
) {
    const existing = await prisma.student.findFirst({
        where: {
            id: studentId,
            organizationId,
        },
    });

    if (!existing) {
        throw new AppError('Aluno não encontrado', 404, 'STUDENT_NOT_FOUND');
    }

    // Verificar unicidade de matrícula
    if (input.registration && input.registration !== existing.registration) {
        const duplicateReg = await prisma.student.findFirst({
            where: {
                registration: input.registration,
                organizationId,
                id: { not: studentId },
            },
        });

        throw new AppError('Já existe um aluno com esta matrícula', 400, 'REGISTRATION_EXISTS');
    }

    // Verificar unicidade de Email (se fornecido e alterado)
    if (input.email && input.email !== existing.email) {
        // 1. Checar se já existe usuário com este email (Global - Case Insensitive)
        const existingUser = await prisma.user.findFirst({
            where: {
                email: { equals: input.email, mode: 'insensitive' }
            }
        });
        if (existingUser) {
            throw new AppError('Este email já está em uso por um usuário do sistema', 400, 'EMAIL_EXISTS_USER');
        }

        // 2. Checar se já existe outro aluno com este email na mesma organização
        const existingStudentEmail = await prisma.student.findFirst({
            where: {
                email: { equals: input.email, mode: 'insensitive' },
                organizationId,
                id: { not: studentId } // Ignorar o próprio aluno
            }
        });
        if (existingStudentEmail) {
            throw new AppError('Este email já está cadastrado para outro aluno nesta organização', 400, 'EMAIL_EXISTS_STUDENT');
        }
    }

    // Sincronizar turmas se fornecido
    if (input.classIds) {
        // Remover atuais
        await prisma.classStudent.deleteMany({
            where: {
                studentId,
                classId: { notIn: input.classIds },
            },
        });

        // Adicionar novas
        if (input.classIds.length > 0) {
            await prisma.classStudent.createMany({
                data: input.classIds.map((classId) => ({
                    studentId,
                    classId,
                })),
                skipDuplicates: true,
            });
        }
    }

    const student = await prisma.student.update({
        where: { id: studentId },
        data: {
            name: input.name,
            registration: input.registration,
            email: input.email,
            isPcd: input.isPcd,
            accessibilityTypes: input.accessibilityTypes,
            accessibilityNotes: input.accessibilityNotes,
            prefersBraille: input.prefersBraille,
            prefersLargePrint: input.prefersLargePrint,
            prefersAudio: input.prefersAudio,
            preferredFontSize: input.preferredFontSize,
        },
    });

    return student;
}

// Deletar aluno
export async function deleteStudent(organizationId: string, studentId: string) {
    const existing = await prisma.student.findFirst({
        where: {
            id: studentId,
            organizationId,
        },
        include: {
            _count: {
                select: {
                    documents: true,
                },
            },
        },
    });

    if (!existing) {
        throw new AppError('Aluno não encontrado', 404, 'STUDENT_NOT_FOUND');
    }

    // Removida verificação de bloqueio por documentos.
    // O schema define onDelete: SetNull para documentos, então eles ficarão sem aluno (preservados).
    // O schema define onDelete: Cascade para ClassStudent, então as matrículas são removidas automaticamente.

    await prisma.student.delete({
        where: { id: studentId },
    });

    return { message: 'Aluno excluído com sucesso' };
}

// Listar alunos PCD (para seleção rápida)
export async function listPcdStudents(organizationId: string) {
    const students = await prisma.student.findMany({
        where: {
            organizationId,
            isPcd: true,
        },
        select: {
            id: true,
            name: true,
            registration: true,
            accessibilityTypes: true,
            prefersBraille: true,
            prefersAudio: true,
            prefersLargePrint: true,
        },
        orderBy: { name: 'asc' },
    });

    return students;
}
