export interface AppUser {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  googleId: string | null;
}

export interface EmailRecord {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: string;
  sentAt: string | null;
  queueJobId: string | null;
  hourlyLimit: number | null;
  delaySeconds: number | null;
  sentMessageId: string | null;
  errorMessage: string | null;
  rateLimitedUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardResponse {
  summary: {
    scheduledCount: number;
    sentCount: number;
    failedCount: number;
  };
  scheduled: EmailRecord[];
  sent: EmailRecord[];
}

export interface SessionResponse {
  authenticated: boolean;
  user?: AppUser;
}

export interface SearchResponse {
  emails: EmailRecord[];
}
