import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- RELATÓRIO DE DADOS ---');

    // 1. Check Users
    const users = await prisma.user.findMany();
    console.log(`\n👥 Usuários Encontrados (${users.length}):`);
    users.forEach(u => console.log(` - [${u.role}] ${u.name} (${u.email}) ID: ${u.id}`));

    // 2. Check Classes
    const classes = await prisma.class.findMany({
        include: { discipline: true }
    });
    console.log(`\n🏫 Turmas Encontradas (${classes.length}):`);
    classes.forEach(c => {
        console.log(` - "${c.name}" | Disc: ${c.discipline?.name} | Ano: ${c.year} | Sem: ${c.semester} | ID: ${c.id}`);
    });

    console.log('\n--------------------------');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
