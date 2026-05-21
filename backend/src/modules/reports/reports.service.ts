import { prisma } from '../../config/database.js';

export async function getOrganizationStats(organizationId: string, period: 'month' | 'quarter' | 'semester' | 'year' = 'month') {
    const now = new Date();
    let startDate = new Date();

    switch (period) {
        case 'month':
            startDate.setMonth(now.getMonth() - 1);
            break;
        case 'quarter':
            startDate.setMonth(now.getMonth() - 3);
            break;
        case 'semester':
            startDate.setMonth(now.getMonth() - 6);
            break;
        case 'year':
            startDate.setFullYear(now.getFullYear() - 1);
            break;
    }

    const [totalAdapted, brailleCount, highLegibilityCount] = await Promise.all([
        // Total de documentos únicos que tiveram pelo menos uma versão baixada
        prisma.document.count({
            where: {
                organizationId,
                OR: [
                    { brailleDownloaded: true },
                    { highLegibilityDownloaded: true }
                ],
                updatedAt: { gte: startDate }
            }
        }),
        // Contagem de versões Braille baixadas
        prisma.document.count({
            where: {
                organizationId,
                brailleDownloaded: true,
                updatedAt: { gte: startDate }
            }
        }),
        // Contagem de versões Alta Legibilidade baixadas
        prisma.document.count({
            where: {
                organizationId,
                highLegibilityDownloaded: true,
                updatedAt: { gte: startDate }
            }
        })
    ]);

    // Calcular crescimento (comparando com o período anterior)
    let previousStartDate = new Date(startDate);
    switch (period) {
        case 'month': previousStartDate.setMonth(previousStartDate.getMonth() - 1); break;
        case 'quarter': previousStartDate.setMonth(previousStartDate.getMonth() - 3); break;
        case 'semester': previousStartDate.setMonth(previousStartDate.getMonth() - 6); break;
        case 'year': previousStartDate.setFullYear(previousStartDate.getFullYear() - 1); break;
    }

    const previousTotal = await prisma.document.count({
        where: {
            organizationId,
            OR: [
                { brailleDownloaded: true },
                { highLegibilityDownloaded: true }
            ],
            updatedAt: {
                gte: previousStartDate,
                lt: startDate
            }
        }
    });

    const growth = previousTotal === 0 ? 100 : Math.round(((totalAdapted - previousTotal) / previousTotal) * 100);

    return {
        total: totalAdapted,
        byType: {
            braille: brailleCount,
            highLegibility: highLegibilityCount
        },
        growth,
        period,
        startDate
    };
}

export async function exportReportCsv(organizationId: string) {
    // Limite de segurança para evitar crash
    const LIMIT = 10000;
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const documents = await prisma.document.findMany({
        where: {
            organizationId,
            OR: [
                { brailleDownloaded: true },
                { highLegibilityDownloaded: true }
            ],
            updatedAt: {
                gte: ninetyDaysAgo
            }
        },
        orderBy: { updatedAt: 'desc' },
        take: LIMIT
    });

    let csv = 'Data,Titulo,Disciplina,Professor,Braille,Alta Legibilidade\n';

    for (const doc of documents) {
        const date = doc.updatedAt.toLocaleDateString('pt-BR');
        const hasBraille = doc.brailleDownloaded ? 'Sim' : 'Não';
        const hasHighLegibility = doc.highLegibilityDownloaded ? 'Sim' : 'Não';

        csv += `"${date}","${doc.titulo || doc.originalName}","${doc.disciplina || ''}","${doc.professor || ''}","${hasBraille}","${hasHighLegibility}"\n`;
    }

    return csv;
}

// Dashboard completo para admin panel
export async function getDashboardStats(organizationId: string) {
    const [
        totalDocuments,
        totalAdapted,
        totalPagesResult, // Captura o resultado da agregação
        brailleCount,
        highLegibilityCount,
        totalTeachers,
        totalStudents,
        totalPcdStudents,
        totalDisciplines,
        totalClasses,
        recentDocuments
    ] = await Promise.all([
        // Total de documentos da organização
        prisma.document.count({ where: { organizationId } }),
        // Total adaptados (baixados)
        prisma.document.count({
            where: {
                organizationId,
                OR: [
                    { brailleDownloaded: true },
                    { highLegibilityDownloaded: true }
                ]
            }
        }),
        // Soma de páginas de documentos adaptados para cálculo de ROI
        prisma.document.aggregate({
            _sum: { originalPages: true },
            where: {
                organizationId,
                OR: [
                    { brailleDownloaded: true },
                    { highLegibilityDownloaded: true }
                ]
            }
        }),
        prisma.document.count({
            where: { organizationId, brailleDownloaded: true }
        }),
        prisma.document.count({
            where: { organizationId, highLegibilityDownloaded: true }
        }),
        prisma.teacher.count({ where: { organizationId } }),
        prisma.student.count({ where: { organizationId } }),
        prisma.student.count({ where: { organizationId, isPcd: true } }),
        prisma.discipline.count({ where: { organizationId } }),
        prisma.class.count({ where: { organizationId } }),
        // 5 documentos mais recentes
        prisma.document.findMany({
            where: { organizationId },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
                id: true,
                originalName: true,
                titulo: true,
                disciplina: true,
                professor: true,
                status: true,
                brailleDownloaded: true,
                highLegibilityDownloaded: true,
                createdAt: true,
            }
        }),

    ]);

    // Top 5 professores que mais adaptaram (usando campo legado `professor`)
    const topTeachers = await prisma.document.groupBy({
        by: ['professor'],
        where: {
            organizationId,
            professor: { not: null },
            OR: [
                { brailleDownloaded: true },
                { highLegibilityDownloaded: true }
            ]
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
    });

    // Calcular horas economizadas
    // Fórmula do cliente: 20 páginas = 3 dias de trabalho manual.
    // Considerando 1 dia = 8 horas úteis -> 3 dias = 24 horas.
    // 24 horas / 20 páginas = 1.2 horas por página.
    // Se o documento não tiver páginas definidas, assumimos 1 página por segurança (ou média de 10, mas vamos ser conservadores: 5)
    
    // O aggregate retorna null se não houver docs
    const totalPages = (totalPagesResult as any)?._sum?.originalPages || 0; 
    
    // Se totalPages for 0 mas tivermos documentos adaptados (legado sem contagem), 
    // usamos um fallback de 5 páginas por doc para não zerar o ROI.
    // Mas se tivermos pages, usamos a fórmula exata.
    
    // totalAdapted é um number vindo do count() direto
    const countAdapted = typeof totalAdapted === 'number' ? totalAdapted : 0;
    const safeTotalPages = totalPages > 0 ? totalPages : (countAdapted * 5); 

    const hoursPerPageManual = 1.2; 
    const hoursSaved = safeTotalPages * hoursPerPageManual;

    // Remover cálculo financeiro conforme solicitado

    return {
        overview: {
            totalDocuments,
            totalAdapted: countAdapted,
            brailleCount,
            highLegibilityCount,
        },
        academic: {
            totalTeachers,
            totalStudents,
            totalPcdStudents,
            pcdCoverage: totalPcdStudents > 0
                ? Math.round((totalAdapted / totalPcdStudents) * 100)
                : 0,
            totalDisciplines,
            totalClasses,
        },
        roi: {
            hoursSaved: Math.round(hoursSaved * 10) / 10, // 1 casa decimal
             // moneySaved removido
            documentsPerDay: countAdapted > 0
                ? Math.round(countAdapted / 30 * 10) / 10
                : 0,
        },
        topTeachers: topTeachers.map(t => ({
            name: t.professor || 'Não informado',
            count: t._count.id,
        })),
        recentDocuments,
    };
}

// Cobertura de acessibilidade por aluno PCD
export async function getStudentCoverage(organizationId: string) {
    const pcdStudents = await prisma.student.findMany({
        where: { organizationId, isPcd: true },
        include: {
            classes: {
                include: {
                    class: {
                        include: {
                            discipline: { select: { id: true, name: true } },
                        },
                    },
                },
            },
            documents: {
                where: {
                    OR: [
                        { brailleDownloaded: true },
                        { highLegibilityDownloaded: true },
                    ],
                },
                select: {
                    id: true,
                    disciplineId: true,
                    disciplina: true,
                },
            },
        },
        orderBy: { name: 'asc' },
    });

    return pcdStudents.map(student => {
        // Get all disciplines the student is enrolled in via classes
        const enrolledDisciplines = new Map<string, string>();
        for (const cs of student.classes) {
            if (cs.class.discipline) {
                enrolledDisciplines.set(cs.class.discipline.id, cs.class.discipline.name);
            }
        }

        // Get disciplines that have adapted documents for this student
        const coveredDisciplineIds = new Set(
            student.documents
                .filter(d => d.disciplineId)
                .map(d => d.disciplineId!)
        );

        const totalDisciplines = enrolledDisciplines.size;
        const coveredCount = [...enrolledDisciplines.keys()].filter(id => coveredDisciplineIds.has(id)).length;
        const coveragePercent = totalDisciplines > 0 ? Math.round((coveredCount / totalDisciplines) * 100) : 0;

        // Identify uncovered disciplines (risk alerts)
        const uncovered = [...enrolledDisciplines.entries()]
            .filter(([id]) => !coveredDisciplineIds.has(id))
            .map(([id, name]) => ({ id, name }));

        return {
            id: student.id,
            name: student.name,
            registration: student.registration,
            accessibilityTypes: student.accessibilityTypes,
            totalDisciplines,
            coveredCount,
            coveragePercent,
            totalDocuments: student.documents.length,
            uncoveredDisciplines: uncovered,
            riskLevel: coveragePercent >= 80 ? 'LOW' : coveragePercent >= 50 ? 'MEDIUM' : 'HIGH',
        };
    });
}
