import { Worker } from 'bullmq';
import prisma from './db';
import { config } from './config';
import { emailQueue, emailQueueName, redisConnection } from './queue';
import { checkHourlyRateLimit } from './rate-limiter';
import { sendEmail } from './mail';
import { refreshEmailIndex } from './search';

async function markSending(emailId: string): Promise<boolean> {
  const result = await prisma.email.updateMany({
    where: {
      id: emailId,
      status: 'scheduled',
    },
    data: {
      status: 'sending',
    },
  });

  return result.count === 1;
}

const worker = new Worker(
  emailQueueName,
  async (job) => {
    const { emailId } = job.data as { emailId: string };
    const email = await prisma.email.findUnique({ where: { id: emailId } });

    if (!email) {
      return;
    }

    const readyToSend = await markSending(email.id);

    if (!readyToSend) {
      return;
    }

    const hourlyLimit = email.hourlyLimit ?? config.hourlyLimit;
    const rateLimit = await checkHourlyRateLimit(email.from, hourlyLimit);

    if (!rateLimit.allowed) {
      const nextWindowStart = new Date(rateLimit.resetAt.getTime() + 1000);

      await prisma.email.update({
        where: { id: email.id },
        data: {
          status: 'scheduled',
          rateLimitedUntil: rateLimit.resetAt,
          scheduledAt: nextWindowStart,
        },
      });

      await emailQueue.add(
        'send-email',
        { emailId: email.id },
        {
          jobId: email.id,
          delay: Math.max(0, nextWindowStart.getTime() - Date.now()),
        },
      );

      return;
    }

    const sent = await sendEmail({
      from: email.from,
      to: email.to,
      subject: email.subject,
      body: email.body,
    });

    const updated = await prisma.email.update({
      where: { id: email.id },
      data: {
        status: 'sent',
        sentAt: new Date(),
        sentMessageId: sent.messageId,
        errorMessage: null,
        rateLimitedUntil: null,
      },
    });

    await refreshEmailIndex(updated.id);
  },
  {
    connection: redisConnection,
    concurrency: config.workerConcurrency,
    limiter: {
      max: 1,
      duration: config.minSendDelayMs,
    },
  },
);

worker.on('completed', (job) => {
  void prisma.email.updateMany({
    where: {
      id: (job.data as { emailId: string }).emailId,
    },
    data: {
      queueJobId: null,
    },
  });
});

worker.on('failed', async (job, error) => {
  if (!job) {
    return;
  }

  const emailId = (job.data as { emailId: string }).emailId;

  await prisma.email.updateMany({
    where: { id: emailId },
    data: {
      status: 'failed',
      errorMessage: error.message,
      queueJobId: null,
    },
  });

  await refreshEmailIndex(emailId);
});

process.on('SIGINT', async () => {
  await worker.close();
  await redisConnection.quit();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await worker.close();
  await redisConnection.quit();
  process.exit(0);
});
