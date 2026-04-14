import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = 'basitraja334411@gmail.com';
  const newPassword = 'password123';
  const hash = await bcrypt.hash(newPassword, 10);
  const user = await prisma.user.update({
    where: { email },
    data: { passwordHash: hash },
    select: { id: true, email: true, name: true },
  });
  console.log('✓ Password reset for:', user);
  console.log('  New password:', newPassword);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
