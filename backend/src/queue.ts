import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { config } from './config';

export const redisConnection = new IORedis(config.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export const emailQueueName = 'email-scheduler';

export const emailQueue = new Queue(emailQueueName, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 500,
    removeOnFail: 1000,
  },
});
