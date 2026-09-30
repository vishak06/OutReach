import dotenv from 'dotenv';

dotenv.config();

function toNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: toNumber(process.env.PORT, 5000),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  sessionSecret: process.env.SESSION_SECRET ?? 'fallback_secret',
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://outreach:outreach_pass@localhost:5432/outreach_db',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  elasticsearchUrl: process.env.ELASTICSEARCH_URL ?? 'http://localhost:9200',
  bullBoardPath: process.env.BULL_BOARD_PATH ?? '/admin/queues',
  workerConcurrency: toNumber(process.env.WORKER_CONCURRENCY, 4),
  runWorkerInApi: process.env.RUN_WORKER_IN_API === 'true',
  minSendDelayMs: toNumber(process.env.MIN_SEND_DELAY_MS, 2000),
  hourlyLimit: toNumber(process.env.MAX_EMAILS_PER_HOUR, 200),
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL ?? `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/api/auth/google/callback`,
};
