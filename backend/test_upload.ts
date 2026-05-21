import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({ where: { role: 'OWNER' } });
  if (!user) { console.log('No user'); return; }
  console.log('User:', user.email, 'Org:', user.organizationId);

  try {
    const doc = await prisma.document.create({
      data: {
        originalName: 'test.pdf',
        originalKey: 'test/test.pdf',
        originalUrl: 'https://test.com/test.pdf',
        status: 'PENDING',
        userId: user.id,
        organizationId: user.organizationId!,
      }
    });
    console.log('Created doc:', doc.id);
  } catch (e: any) {
    console.error('Error name:', e.name);
    console.error('Error message:', e.message);
    console.error('Error code:', e.code);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
