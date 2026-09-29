import type { DashboardResponse, EmailRecord, SearchResponse, SessionResponse } from './types';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  baseUrl: apiBase,
  getSession: () => request<SessionResponse>('/api/auth/session'),
  devLogin: (body?: { email?: string; name?: string }) =>
    request<SessionResponse>('/api/auth/dev-login', {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    }),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  getDashboard: () => request<DashboardResponse>('/api/dashboard'),
  listEmails: (status?: string) => request<{ emails: EmailRecord[] }>(`/api/emails${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  getEmail: (id: string) => request<{ email: EmailRecord }>(`/api/emails/${id}`),
  scheduleEmails: (payload: {
    from: string;
    recipients: string[];
    subject: string;
    body: string;
    scheduledAt?: string;
    delaySeconds?: number;
    hourlyLimit?: number;
  }) =>
    request<{ ok: boolean; emails: Array<{ id: string; queueJobId: string | null }> }>('/api/emails', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  searchEmails: (query: string) => request<SearchResponse>(`/api/search?q=${encodeURIComponent(query)}`),
  sendNow: (id: string) => request<{ ok: boolean; email: EmailRecord; previewUrl: string | false | null }>(`/api/emails/${id}/send-now`, { method: 'POST' }),
};
