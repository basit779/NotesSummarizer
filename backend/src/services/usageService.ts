import { prisma } from '../config/db';
import { env } from '../config/env';

function startOfUtcDay(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function logUsage(userId: string, action: 'UPLOAD' | 'PROCESS') {
  await prisma.usageLog.create({ data: { userId, action } });
}

export async function getDailyUsage(userId: string, plan: 'FREE' | 'PRO') {
  const gte = startOfUtcDay();
  const [uploads, processed] = await Promise.all([
    prisma.usageLog.count({ where: { userId, action: 'UPLOAD', createdAt: { gte } } }),
    prisma.usageLog.count({ where: { userId, action: 'PROCESS', createdAt: { gte } } }),
  ]);
  const limit = plan === 'PRO' ? null : env.freeDailyUploadLimit;
  return { uploads, processed, limit, plan };
}
