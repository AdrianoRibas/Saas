import { prisma } from '../../lib/prisma.js';
import { Prisma } from '@prisma/client';

export class CoverageService {
    /**
     * Calcula o Mapa de Risco de Compliance
     * Compara disciplinas com alunos PCDs versus disciplinas com material adaptado.
     */
    async getRiskMap(organizationId: string) {
        // 1. Buscar disciplinas que TEM alunos matriculados com PCD
        // Precisamos de disciplinas -> turmas -> alunos (onde isPcd=true)
        const disciplinesWithPcd = await prisma.discipline.findMany({
            where: {
                organizationId,
                classes: {
                    some: {
                        students: {
                            some: {
                                student: {
                                    isPcd: true
                                }
                            }
                        }
                    }
                }
            },
            include: {
                _count: {
                    select: {
                        documents: {
                            where: {
                                status: 'COMPLETED'
                            }
                        },
                        classes: true
                    }
                }
            }
        });

        // 2. Classificar Risco
        const total = disciplinesWithPcd.length;
        let covered = 0;
        let critical = 0;

        const details = disciplinesWithPcd.map(disc => {
            const hasCoverage = disc._count.documents > 0;
            if (hasCoverage) covered++;
            else critical++;

            return {
                id: disc.id,
                name: disc.name,
                hasCoverage,
                totalClasses: disc._count.classes,
                status: hasCoverage ? 'COVERED' : 'CRITICAL'
            };
        });

        const coveragePercentage = total === 0 ? 100 : Math.round((covered / total) * 100);

        return {
            stats: {
                totalDisciplinesWithPcd: total,
                coveredDisciplines: covered,
                criticalDisciplines: critical,
                coveragePercentage
            },
            items: details
        };
    }

    /**
     * Monitoramento de Alunos (Reach)
     * Lista alunos PCD e quando foi o último material adaptado para eles.
     */
    async getStudentMonitoring(organizationId: string) {
        const students = await prisma.student.findMany({
            where: {
                organizationId,
                isPcd: true
            },
            include: {
                documents: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { createdAt: true, status: true }
                },
                _count: {
                    select: { documents: true }
                }
            },
            orderBy: {
                name: 'asc'
            }
        });

        return students.map(s => {
            const lastDoc = s.documents[0];
            const daysSinceLastDoc = lastDoc?.createdAt 
                ? Math.floor((new Date().getTime() - new Date(lastDoc.createdAt).getTime()) / (1000 * 3600 * 24))
                : -1; // Nunca recebeu

            return {
                id: s.id,
                name: s.name,
                registration: s.registration,
                accessibilityTypes: s.accessibilityTypes,
                totalDocs: s._count.documents,
                lastDocDate: lastDoc?.createdAt || null,
                daysSinceLastDoc,
                status: daysSinceLastDoc === -1 ? 'NEVER_SERVED' 
                      : daysSinceLastDoc > 30 ? 'AT_RISK' 
                      : 'ACTIVE'
            };
        });
    }

    /**
     * Biblioteca Compartilhada Interna
     * Busca documentos da organização.
     */
    async getLibrary(organizationId: string, query?: string) {
        const where: Prisma.DocumentWhereInput = {
            organizationId,
            status: 'COMPLETED'
        };

        if (query) {
            where.OR = [
                { originalName: { contains: query, mode: 'insensitive' } },
                { titulo: { contains: query, mode: 'insensitive' } },
                { discipline: { name: { contains: query, mode: 'insensitive' } } },
                { student: { name: { contains: query, mode: 'insensitive' } } }
            ];
        }

        const docs = await prisma.document.findMany({
            where,
            include: {
                discipline: { select: { name: true } },
                teacher: { select: { user: { select: { name: true } } } },
                student: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 50 // Paginação simplificada para MVP
        });

        return docs.map(d => ({
            id: d.id,
            title: d.titulo || d.originalName,
            discipline: d.discipline?.name || 'N/A',
            teacher: d.teacher?.user?.name || 'N/A',
            student: d.student?.name || 'Geral',
            date: d.createdAt,
            hasBraille: !!d.brailleUrl,
            hasHighLegibility: !!d.highLegibilityUrl
        }));
    }
}

export const coverageService = new CoverageService();
