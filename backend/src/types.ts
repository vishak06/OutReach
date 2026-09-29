export type EmailStatus = 'scheduled' | 'sending' | 'sent' | 'failed' | 'rate_limited';

export interface AppUser {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  googleId: string | null;
}

export interface CreateEmailRequest {
  from: string;
  recipients: string[];
  subject: string;
  body: string;
  scheduledAt?: string;
  delaySeconds?: number;
  hourlyLimit?: number;
}

export interface EmailRecord {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  status: EmailStatus | string;
  scheduledAt: Date;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  queueJobId: string | null;
  hourlyLimit: number | null;
  delaySeconds: number | null;
  sentMessageId: string | null;
  errorMessage: string | null;
  rateLimitedUntil: Date | null;
  userId: string;
}

export interface EmailSearchResult {
  id: string;
  subject: string;
  body: string;
  to: string;
  from: string;
  status: string;
  scheduledAt: string;
  sentAt: string | null;
}
