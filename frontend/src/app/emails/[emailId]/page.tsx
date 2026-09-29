"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { AppUser, EmailRecord } from '@/lib/types';

function prettyDate(value: string | null): string {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function EmailDetailPage() {
  const router = useRouter();
  const params = useParams<{ emailId: string }>();
  const [user, setUser] = useState<AppUser | null>(null);
  const [email, setEmail] = useState<EmailRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load(): Promise<void> {
      try {
        const session = await api.getSession();
        if (!session.authenticated) {
          router.replace('/');
          return;
        }

        const detail = await api.getEmail(params.emailId);

        if (!active) {
          return;
        }

        setUser(session.user ?? null);
        setEmail(detail.email);
      } catch {
        router.replace('/dashboard');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [params.emailId, router]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">Loading email detail...</div>;
  }

  if (!email) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">
        <div className="panel rounded-[2rem] p-8 text-center">
          <p className="display-font text-3xl text-white">Email not found</p>
          <Link href="/dashboard" className="mt-4 inline-flex rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[#08111d]">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-6 lg:px-8">
      <div className="absolute inset-0 hero-grid opacity-20" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6">
        <div className="panel flex items-center justify-between rounded-[2rem] px-5 py-4 lg:px-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Email detail</p>
            <h1 className="display-font mt-2 text-3xl text-white">{email.subject}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="rounded-full border border-[rgba(255,255,255,0.12)] px-4 py-2 text-sm text-white">
              Back
            </Link>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
          <div className="panel rounded-[2rem] p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Recipients</p>
            <p className="mt-2 text-2xl font-semibold text-white">{email.to}</p>
            <div className="mt-6 grid gap-4 text-sm text-[var(--muted)]">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-[var(--muted)]">From</p>
                <p className="mt-1 text-white">{email.from}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-[var(--muted)]">Scheduled for</p>
                <p className="mt-1 text-white">{prettyDate(email.scheduledAt)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-[var(--muted)]">Sent at</p>
                <p className="mt-1 text-white">{prettyDate(email.sentAt)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-[var(--muted)]">Status</p>
                <p className="mt-1 text-white">{email.status}</p>
              </div>
              {user ? (
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-[var(--muted)]">Owner</p>
                  <p className="mt-1 text-white">{user.email}</p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="panel rounded-[2rem] p-6">
            <div className="flex items-center justify-between gap-4 border-b border-[rgba(255,255,255,0.08)] pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Body</p>
                <h2 className="display-font mt-2 text-2xl text-white">Rendered message</h2>
              </div>
              {email.status !== 'sent' ? (
                <button
                  type="button"
                  onClick={async () => {
                    await api.sendNow(email.id);
                    const refreshed = await api.getEmail(email.id);
                    setEmail(refreshed.email);
                  }}
                  className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#08111d]"
                >
                  Send now
                </button>
              ) : null}
            </div>

            <div className="prose prose-invert mt-6 max-w-none text-[var(--foreground)] prose-p:text-[var(--foreground)] prose-a:text-[var(--accent)]">
              <div className="whitespace-pre-wrap rounded-[1.5rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-5 leading-7 text-[var(--foreground)]">
                {email.body}
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.5rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
                <p className="text-sm text-[var(--muted)]">Queue job</p>
                <p className="mt-1 font-medium text-white">{email.queueJobId ?? 'Completed'}</p>
              </div>
              <div className="rounded-[1.5rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
                <p className="text-sm text-[var(--muted)]">Error</p>
                <p className="mt-1 font-medium text-white">{email.errorMessage ?? 'None'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
