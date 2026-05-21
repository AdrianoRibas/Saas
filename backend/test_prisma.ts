import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ log: ['query', 'info', 'warn', 'error'] });

async function main() {
  const user = await prisma.user.findFirst({
    where: { role: 'OWNER' }
  });

  if (!user) {
    console.log("No owner user found in DB.");
    return;
  }

  console.log(`Using User: ${user.id} and Org: ${user.organizationId}`);

  try {
    const doc = await prisma.document.create({
      data: {
        originalName: 'teste-bug.pdf',
        originalKey: 'tenant-123/teste-bug.pdf',
        originalUrl: 'https://storage.googleapis.com/teste-bug.pdf',
        status: 'PENDING',
        userId: user.id,
        organizationId: user.organizationId!,
        disciplina: '',
        professor: '',
        titulo: 'Teste',
        dataAdaptacao: null,
        teacherId: null,
        disciplineId: null,
        classId: null,
        studentId: null,
      }
    });
    console.log('Success! Created document:', doc.id);
    
    // Cleanup
    await prisma.document.delete({ where: { id: doc.id } });
  } catch (err: any) {
    console.error('--- ERRO DETECTADO ---');
    console.error('Nome:', err.name);
    console.error('Código:', err.code);
    console.error('Mensagem:', err.message);
    console.error('Meta:', err.meta);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
