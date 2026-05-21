import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DIRECT_URL,
        },
    },
});

async function main() {
    console.log('🚀 Iniciando remoção de duplicatas (Modo Direto)...');

    const classes = await prisma.class.findMany({
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { students: true } } }
    });

    console.log(`📦 Total de turmas no banco: ${classes.length}`);

    const uniqueMap = new Map();
    const toDelete = [];

    for (const cls of classes) {
        // Chave única: Nome + Ano + Semestre + Disciplina
        const key = `${cls.name}-${cls.year}-${cls.semester}-${cls.disciplineId}`;

        if (!uniqueMap.has(key)) {
            uniqueMap.set(key, cls); // Mantém a mais recente (devido ao orderBy desc)
        } else {
            // Se já temos uma, essa é duplicata.
            // Mas cuidado: se a duplicata tiver alunos e a original não, deveríamos manter a com alunos.
            const existing = uniqueMap.get(key);

            if (cls._count.students > existing._count.students) {
                // A atual tem mais alunos, substitui a "existing"
                toDelete.push(existing.id);
                uniqueMap.set(key, cls);
            } else {
                toDelete.push(cls.id);
            }
        }
    }

    console.log(`🔥 Encontradas ${toDelete.length} duplicatas para deletar.`);

    if (toDelete.length > 0) {
        const result = await prisma.class.deleteMany({
            where: { id: { in: toDelete } }
        });
        console.log(`✅ ${result.count} turmas removidas com sucesso.`);
    } else {
        console.log('✨ Nenhuma duplicata encontrada.');
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
