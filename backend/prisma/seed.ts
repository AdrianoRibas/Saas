import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// ==============================================================================
// SEED SCRIPT - Popula o banco com dados de teste
// ==============================================================================

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Iniciando seed do banco de dados...\n');

    // 1. LIMPAR DADOS EXISTENTES (ordem inversa de dependências)
    console.log('🗑️ Limpando dados existentes...');
    await prisma.classStudent.deleteMany();
    await prisma.document.deleteMany();
    await prisma.docTemplate.deleteMany();
    await prisma.student.deleteMany();
    await prisma.class.deleteMany();
    await prisma.discipline.deleteMany();
    await prisma.teacher.deleteMany();
    await prisma.user.deleteMany();
    await prisma.organization.deleteMany();
    console.log('✅ Dados limpos!\n');

    // 2. CRIAR ORGANIZAÇÃO
    console.log('🏡 Criando organização...');
    const organization = await prisma.organization.create({
        data: {
            name: 'Universidade Exemplo',
            slug: 'universidade-exemplo',
            logoUrl: 'https://via.placeholder.com/200x80?text=Universidade+Exemplo',
            primaryColor: '#1E40AF',
            secondaryColor: '#3B82F6',
            accentColor: '#10B981',
            subscriptionStatus: 'ACTIVE',
        },
    });

    // 3. SENHA PADRÃO PARA TESTES
    const passwordHash = await bcrypt.hash('123456', 12);

    // 4. CRIAR USUÁRIO ADMIN (OWNER)
    console.log('👤 Criando usuário admin...');
    const adminUser = await prisma.user.create({
        data: {
            email: 'admin@exemplo.com',
            passwordHash,
            name: 'Administrador',
            role: 'OWNER',
            organizationId: organization.id,
        },
    });

    // 5. CRIAR USUÁRIO PROFESSOR (TEACHER)
    console.log('👨‍🏫 Criando usuário professor...');
    const teacherUser = await prisma.user.create({
        data: {
            email: 'professor@exemplo.com',
            passwordHash,
            name: 'Prof. Exemplo',
            role: 'TEACHER', // Role vital para testar Slides
            organizationId: organization.id,
        },
    });
    const teacher = await prisma.teacher.create({
        data: {
            registration: 'PROF-001',
            department: 'Núcleo de Acessibilidade',
            userId: teacherUser.id,
            organizationId: organization.id,
        },
    });

    // 6. CRIAR USUÁRIO ALUNO (STUDENT)
    console.log('🧑‍🎓 Criando usuário aluno...');
    const studentUser = await prisma.user.create({
        data: {
            email: 'aluno@exemplo.com',
            passwordHash,
            name: 'João da Silva',
            role: 'STUDENT', // Role vital para testar Infográficos e bloqueios
            organizationId: organization.id,
        },
    });
    const student = await prisma.student.create({
        data: {
            name: 'João da Silva',
            registration: 'ALU-2024-001',
            email: 'aluno@exemplo.com',
            isPcd: true,
            accessibilityTypes: ['BLIND'],
            prefersBraille: true,
            prefersAudio: true,
            userId: studentUser.id, // Vínculo crucial pro Login
            organizationId: organization.id,
        },
    });

    // 7. CRIAR DISCIPLINA E TURMA
    const discipline = await prisma.discipline.create({
        data: {
            name: 'Acessibilidade 101',
            code: 'ACESS-101',
            teacherId: teacher.id,
            organizationId: organization.id,
        },
    });

    const classEntity = await prisma.class.create({
        data: {
            name: 'Turma 2024-A',
            shift: 'MORNING',
            disciplineId: discipline.id,
            organizationId: organization.id,
        },
    });

    // MATRICULAR ALUNO
    await prisma.classStudent.create({
        data: {
            classId: classEntity.id,
            studentId: student.id,
        },
    });

    console.log('═'.repeat(60));
    console.log('🎉 SEED CONCLUÍDO COM SUCESSO!');
    console.log('═'.repeat(60));
    console.log(`
🔐 CREDENCIAIS DE ACESSO PARA VISÃO ESPECÍFICA (Senha igual para todos: 123456):
   • Admin: admin@exemplo.com
   • Professor: professor@exemplo.com (Testa os Slides)
   • Aluno: aluno@exemplo.com (Testa Infográficos)
`);
}

main()
    .catch((e) => {
        console.error('❌ Erro ao executar seed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
