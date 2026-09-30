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
    return <div className="flex min-h-screen items-center justify-center text-sm text-[#a0a8a3]">Loading email detail...</div>;
  }

  if (!email) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[#a0a8a3]">
        <div className="panel p-8 text-center">
          <p className="display-font text-3xl text-[#25312a]">Email not found</p>
          <Link href="/dashboard" className="mt-4 inline-flex rounded-full bg-[#00a941] px-5 py-3 text-sm font-semibold text-white">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell min-h-screen px-4 py-6 lg:px-8">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6">
        <div className="panel flex items-center justify-between px-2 py-4 lg:px-3">
          <div>
            <p className="text-[10px] text-[#a0a8a3]">Email detail</p>
            <h1 className="display-font mt-2 text-2xl text-[#25312a]">{email.subject}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="px-4 py-2 text-[11px] text-[#78817b]">
              Back
            </Link>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
          <div className="panel p-6">
            <p className="text-[10px] text-[#a0a8a3]">Recipients</p>
            <p className="mt-2 text-xl font-semibold text-[#25312a]">{email.to}</p>
            <div className="mt-6 grid gap-4 text-[11px] text-[#a0a8a3]">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#a0a8a3]">From</p>
                <p className="mt-1 text-[#25312a]">{email.from}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#a0a8a3]">Scheduled for</p>
                <p className="mt-1 text-[#25312a]">{prettyDate(email.scheduledAt)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#a0a8a3]">Sent at</p>
                <p className="mt-1 text-[#25312a]">{prettyDate(email.sentAt)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#a0a8a3]">Status</p>
                <p className="mt-1 text-[#25312a]">{email.status}</p>
              </div>
              {user ? (
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#a0a8a3]">Owner</p>
                  <p className="mt-1 text-[#25312a]">{user.email}</p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="panel p-6">
            <div className="flex items-center justify-between gap-4 pb-4">
              <div>
                <p className="text-[10px] text-[#a0a8a3]">Body</p>
                <h2 className="display-font mt-2 text-2xl text-[#25312a]">Rendered message</h2>
              </div>
              {email.status !== 'sent' ? (
                <button
                  type="button"
                  onClick={async () => {
                    await api.sendNow(email.id);
                    const refreshed = await api.getEmail(email.id);
                    setEmail(refreshed.email);
                  }}
                  className="rounded-full bg-[#00a941] px-4 py-2 text-[11px] font-semibold text-white"
                >
                  Send now
                </button>
              ) : null}
            </div>

            <div className="mt-6 bg-[#f7f9f8] p-5 text-[12px] leading-7 text-[#25312a] [&_a]:text-[#00a941] [&_p]:my-3">
              <div dangerouslySetInnerHTML={{ __html: email.body }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
