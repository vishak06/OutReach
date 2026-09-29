import prisma from './db';
import { emailQueue } from './queue';
import { indexEmail } from './search';

export async function rehydrateScheduledEmails(): Promise<void> {
  const scheduledEmails = await prisma.email.findMany({
    where: {
      status: 'scheduled',
      scheduledAt: {
        gte: new Date(),
      },
    },
    orderBy: { scheduledAt: 'asc' },
  });

  for (const email of scheduledEmails) {
    const existing = email.queueJobId
      ? await emailQueue.getJob(email.queueJobId)
      : null;

    if (existing) {
      continue;
    }

    const job = await emailQueue.add(
      'send-email',
      { emailId: email.id },
      {
        delay: Math.max(0, email.scheduledAt.getTime() - Date.now()),
        jobId: email.id,
      },
    );

    await prisma.email.update({
      where: { id: email.id },
      data: { queueJobId: job.id ?? email.id },
    });

    await indexEmail(email);
  }
}
