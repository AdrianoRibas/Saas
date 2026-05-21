import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/errorHandler.js';
import type { CreateClassInput, UpdateClassInput, ListClassesQuery, EnrollStudentInput } from './classes.schema.js';

// Listar turmas com paginação
export async function listClasses(organizationId: string, query: ListClassesQuery) {
    const { page, limit, search, disciplineId, year } = query;
    const skip = (page - 1) * limit;

    const where: any = { organizationId };

    if (search) {
        where.name = { contains: search, mode: 'insensitive' };
    }

    if (disciplineId) {
        where.disciplineId = disciplineId;
    }

    if (year) {
        where.year = year;
    }

    const [classes, total] = await Promise.all([
        prisma.class.findMany({
            where,
            skip,
            take: limit,
            include: {
                discipline: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                    },
                },
                _count: {
                    select: {
                        students: true,
                        documents: true,
                    },
                },
            },
            orderBy: [{ year: 'desc' }, { name: 'asc' }],
        }),
        prisma.class.count({ where }),
    ]);

    return {
        classes,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

// Buscar turma por ID
export async function getClassById(organizationId: string, classId: string) {
    const classEntity = await prisma.class.findFirst({
        where: {
            id: classId,
            organizationId,
        },
        include: {
            discipline: {
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
            },
            students: {
                include: {
                    student: {
                        select: {
                            id: true,
                            name: true,
                            registration: true,
                            isPcd: true,
                            accessibilityTypes: true,
                        },
                    },
                },
            },
        },
    });

    if (!classEntity) {
        throw new AppError('Turma não encontrada', 404, 'CLASS_NOT_FOUND');
    }

    return classEntity;
}

// Criar turma
export async function createClass(organizationId: string, input: CreateClassInput) {
    // Verificar se disciplina existe e pertence à organização
    const discipline = await prisma.discipline.findFirst({
        where: {
            id: input.disciplineId,
            organizationId,
        },
    });

    if (!discipline) {
        throw new AppError('Disciplina não encontrada', 404, 'DISCIPLINE_NOT_FOUND');
    }

    // Validar duplicidade (Nome + Ano + Semestre + Disciplina)
    const existingClass = await prisma.class.findFirst({
        where: {
            organizationId,
            disciplineId: input.disciplineId,
            name: { equals: input.name, mode: 'insensitive' }, // Case insensitive check
            year: input.year,
            semester: input.semester,
        }
    });

    if (existingClass) {
        throw new AppError('Já existe uma turma com este nome para esta disciplina/período', 400, 'DUPLICATE_CLASS');
    }

    const classEntity = await prisma.class.create({
        data: {
            name: input.name,
            year: input.year,
            semester: input.semester,
            shift: input.shift,
            disciplineId: input.disciplineId,
            organizationId,
        },
        include: {
            discipline: {
                select: {
                    id: true,
                    name: true,
                    code: true,
                },
            },
        },
    });

    return classEntity;
}

// Atualizar turma
export async function updateClass(
    organizationId: string,
    classId: string,
    input: UpdateClassInput
) {
    const existing = await prisma.class.findFirst({
        where: {
            id: classId,
            organizationId,
        },
    });

    if (!existing) {
        throw new AppError('Turma não encontrada', 404, 'CLASS_NOT_FOUND');
    }

    if (input.disciplineId) {
        const discipline = await prisma.discipline.findFirst({
            where: {
                id: input.disciplineId,
                organizationId,
            },
        });

        if (!discipline) {
            throw new AppError('Disciplina não encontrada', 404, 'DISCIPLINE_NOT_FOUND');
        }
    }

    const classEntity = await prisma.class.update({
        where: { id: classId },
        data: input,
        include: {
            discipline: {
                select: {
                    id: true,
                    name: true,
                    code: true,
                },
            },
        },
    });

    return classEntity;
}

// Deletar turma
export async function deleteClass(organizationId: string, classId: string) {
    const existing = await prisma.class.findFirst({
        where: {
            id: classId,
            organizationId,
        },
        include: {
            _count: {
                select: {
                    students: true,
                    documents: true,
                },
            },
        },
    });

    if (!existing) {
        throw new AppError('Turma não encontrada', 404, 'CLASS_NOT_FOUND');
    }

    if (existing._count.documents > 0) {
        throw new AppError(
            `Não é possível excluir: turma possui ${existing._count.documents} documento(s) vinculado(s)`,
            400,
            'CLASS_HAS_DOCUMENTS'
        );
    }

    // Remover matrículas primeiro
    await prisma.classStudent.deleteMany({
        where: { classId },
    });

    await prisma.class.delete({
        where: { id: classId },
    });

    return { message: 'Turma excluída com sucesso' };
}

import { createNotification } from '../notifications/notifications.service.js';

// ... (existing imports)

// Matricular aluno na turma
export async function enrollStudent(
    organizationId: string,
    classId: string,
    input: EnrollStudentInput
) {
    const classEntity = await prisma.class.findFirst({
        where: {
            id: classId,
            organizationId,
        },
        include: {
            discipline: {
                include: {
                    teacher: true,
                },
            },
        },
    });

    if (!classEntity) {
        throw new AppError('Turma não encontrada', 404, 'CLASS_NOT_FOUND');
    }

    const student = await prisma.student.findFirst({
        where: {
            id: input.studentId,
            organizationId,
        },
    });

    if (!student) {
        throw new AppError('Aluno não encontrado', 404, 'STUDENT_NOT_FOUND');
    }

    // Verificar se já está matriculado
    const existingEnrollment = await prisma.classStudent.findUnique({
        where: {
            classId_studentId: {
                classId,
                studentId: input.studentId,
            },
        },
    });

    if (existingEnrollment) {
        throw new AppError('Aluno já está matriculado nesta turma', 400, 'ALREADY_ENROLLED');
    }

    await prisma.classStudent.create({
        data: {
            classId,
            studentId: input.studentId,
        },
    });

    // NOTIFICAÇÃO: Se aluno for PCD e a turma tiver professor associado
    if (student.isPcd && classEntity.discipline?.teacher?.userId) {
        const teacherUserId = classEntity.discipline.teacher.userId;
        const className = classEntity.name;
        const disciplineName = classEntity.discipline.name;

        await createNotification(
            teacherUserId,
            'Novo Aluno PCD Matriculado',
            `O aluno ${student.name} (PCD) foi matriculado na sua turma ${className} de ${disciplineName}. Necessidades: ${student.accessibilityTypes.join(', ')}.`,
            'WARNING'
        );

        console.log(`[MOCK EMAIL] Para professor ${classEntity.discipline.teacher.userId}: Novo aluno PCD ${student.name} na turma ${className}.`);
    }

    return { message: 'Aluno matriculado com sucesso' };
}

// Remover matrícula
export async function unenrollStudent(
    organizationId: string,
    classId: string,
    studentId: string
) {
    const classEntity = await prisma.class.findFirst({
        where: {
            id: classId,
            organizationId,
        },
    });

    if (!classEntity) {
        throw new AppError('Turma não encontrada', 404, 'CLASS_NOT_FOUND');
    }

    const enrollment = await prisma.classStudent.findUnique({
        where: {
            classId_studentId: {
                classId,
                studentId,
            },
        },
    });

    if (!enrollment) {
        throw new AppError('Matrícula não encontrada', 404, 'ENROLLMENT_NOT_FOUND');
    }

    await prisma.classStudent.delete({
        where: {
            classId_studentId: {
                classId,
                studentId,
            },
        },
    });

    return { message: 'Matrícula removida com sucesso' };
}
