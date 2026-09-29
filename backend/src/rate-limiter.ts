import prisma from './db';
import { config } from './config';
import { redisConnection } from './queue';

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  resetAt: Date;
}

function hourWindowKey(sender: string, date = new Date()): string {
  const windowStart = new Date(date);
  windowStart.setMinutes(0, 0, 0);
  return `${sender}:${windowStart.toISOString().slice(0, 13)}`;
}

export async function checkHourlyRateLimit(sender: string, limit = config.hourlyLimit): Promise<RateLimitResult> {
  const key = `rate:${hourWindowKey(sender)}`;
  const windowEnd = new Date();
  windowEnd.setMinutes(59, 59, 999);

  const count = await redisConnection.incr(key);
  if (count === 1) {
    const ttl = Math.max(1, Math.ceil((windowEnd.getTime() - Date.now()) / 1000));
    await redisConnection.expire(key, ttl);
  }

  if (count > limit) {
    const slackIntegration = await prisma.slackIntegration.findFirst({
      where: { user: { emails: { some: { from: sender } } } },
      include: { user: true },
    });

    if (slackIntegration?.webhookUrl) {
      await fetch(slackIntegration.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `Hourly rate limit reached for ${sender}. Further emails are deferred until the next window.`,
        }),
      }).catch(() => undefined);
    }

    return {
      allowed: false,
      currentCount: count,
      limit,
      resetAt: windowEnd,
    };
  }

  return {
    allowed: true,
    currentCount: count,
    limit,
    resetAt: windowEnd,
  };
}
