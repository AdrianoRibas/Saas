import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database.js';

// ==============================================================================
// MIDDLEWARE: requireTeacher — Restringe acesso a usuários com vínculo Teacher
// ==============================================================================

/**
 * Verifica se o usuário autenticado tem role TEACHER
 * ou possui um registro Teacher vinculado ao User.
 * 
 * Injeta `req.teacher` com os dados do professor para uso posterior
 * (ex: buscar disciplina para injeção de prompt nos Slides).
 */
export async function requireTeacher(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void | Response> {
    try {
        const userId = req.user?.id;
        const organizationId = req.organizationId;

        if (!userId || !organizationId) {
            return res.status(403).json({
                error: 'Acesso restrito a professores',
                code: 'TEACHER_REQUIRED',
            });
        }

        // Verifica Role diretamente OU busca vínculo Teacher
        if (req.user?.role === 'TEACHER') {
            // Se a role é TEACHER, busca os dados do professor
            const teacher = await prisma.teacher.findFirst({
                where: { userId, organizationId },
                include: {
                    disciplines: {
                        select: { id: true, name: true, code: true },
                    },
                },
            });

            if (teacher) {
                (req as any).teacher = teacher;
                return next();
            }
        }

        // Mesmo sem role TEACHER, checa se tem vínculo Teacher (retrocompatibilidade)
        const teacher = await prisma.teacher.findFirst({
            where: { userId, organizationId },
            include: {
                disciplines: {
                    select: { id: true, name: true, code: true },
                },
            },
        });

        if (!teacher) {
            return res.status(403).json({
                error: 'Acesso restrito a professores',
                code: 'TEACHER_REQUIRED',
            });
        }

        (req as any).teacher = teacher;
        next();
    } catch (error) {
        console.error('[REQUIRE_TEACHER] Erro:', error);
        return res.status(500).json({
            error: 'Erro ao verificar permissão de professor',
        });
    }
}

// ==============================================================================
// MIDDLEWARE: requireStudent — Restringe acesso a usuários com role STUDENT
// ==============================================================================

export async function requireStudent(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void | Response> {
    try {
        const userId = req.user?.id;
        const organizationId = req.organizationId;

        if (!userId || !organizationId) {
            return res.status(403).json({
                error: 'Acesso restrito a alunos',
                code: 'STUDENT_REQUIRED',
            });
        }

        if (req.user?.role === 'STUDENT') {
            return next();
        }

        // Checa vínculo Student (retrocompatibilidade)
        const student = await prisma.student.findFirst({
            where: { userId, organizationId },
        });

        if (!student) {
            return res.status(403).json({
                error: 'Acesso restrito a alunos',
                code: 'STUDENT_REQUIRED',
            });
        }

        (req as any).studentProfile = student;
        next();
    } catch (error) {
        console.error('[REQUIRE_STUDENT] Erro:', error);
        return res.status(500).json({
            error: 'Erro ao verificar permissão de aluno',
        });
    }
}
