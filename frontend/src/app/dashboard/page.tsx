"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { AppUser, DashboardResponse, EmailRecord } from '@/lib/types';

type TabKey = 'scheduled' | 'sent';

function formatDate(value: string | null): string {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function statusTone(status: string): string {
  switch (status) {
    case 'sent':
      return 'bg-[rgba(92,224,164,0.12)] text-[var(--success)] border-[rgba(92,224,164,0.25)]';
    case 'failed':
      return 'bg-[rgba(255,123,123,0.12)] text-[var(--danger)] border-[rgba(255,123,123,0.25)]';
    case 'scheduled':
      return 'bg-[rgba(184,255,106,0.12)] text-[var(--accent)] border-[rgba(184,255,106,0.25)]';
    case 'sending':
      return 'bg-[rgba(255,201,93,0.12)] text-[var(--warning)] border-[rgba(255,201,93,0.25)]';
    default:
      return 'bg-[rgba(255,255,255,0.08)] text-[var(--foreground)] border-[rgba(255,255,255,0.12)]';
  }
}

function parseRecipients(raw: string): string[] {
  return raw
    .split(/[\n,;]/g)
    .map((value) => value.trim())
    .filter(Boolean);
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('scheduled');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<EmailRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    from: 'ReachInbox <scheduler@reachinbox.ai>',
    recipients: 'lead@customer.io',
    subject: 'Your outreach campaign is scheduled',
    body: '<p>Hello, this email was scheduled from ReachInbox.</p>',
    scheduledAt: '',
    delaySeconds: '120',
    hourlyLimit: '200',
  });

  useEffect(() => {
    let active = true;

    async function bootstrap(): Promise<void> {
      try {
        const session = await api.getSession();
        if (!active) {
          return;
        }

        setUser(session.user ?? null);
        if (!session.authenticated) {
          router.replace('/');
          return;
        }

        const data = await api.getDashboard();
        if (!active) {
          return;
        }

        setDashboard(data);
      } catch {
        router.replace('/');
      } finally {
        if (active) {
          setLoading(false);
          setLoadingDashboard(false);
        }
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, [router]);

  const visibleEmails = useMemo(() => {
    if (searchResults) {
      return searchResults;
    }

    return activeTab === 'scheduled' ? dashboard?.scheduled ?? [] : dashboard?.sent ?? [];
  }, [activeTab, dashboard, searchResults]);

  async function refreshDashboard(): Promise<void> {
    setLoadingDashboard(true);
    try {
      const data = await api.getDashboard();
      setDashboard(data);
      setSearchResults(null);
    } finally {
      setLoadingDashboard(false);
    }
  }

  async function handleSearch(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    setLoadingDashboard(true);
    try {
      const result = await api.searchEmails(searchQuery.trim());
      setSearchResults(result.emails);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Search failed');
    } finally {
      setLoadingDashboard(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      await api.scheduleEmails({
        from: form.from,
        recipients: parseRecipients(form.recipients),
        subject: form.subject,
        body: form.body,
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
        delaySeconds: Number(form.delaySeconds) || 0,
        hourlyLimit: Number(form.hourlyLimit) || undefined,
      });

      setComposeOpen(false);
      await refreshDashboard();
      setMessage('Email batch scheduled successfully.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to schedule emails.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout(): Promise<void> {
    await api.logout();
    router.replace('/');
  }

  async function handleSendNow(emailId: string): Promise<void> {
    await api.sendNow(emailId);
    await refreshDashboard();
    setMessage('Email sent immediately via Ethereal.');
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 hero-grid opacity-25" />
      <div className="absolute left-1/3 top-0 h-80 w-80 rounded-full bg-[rgba(184,255,106,0.08)] blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1600px] gap-6 p-4 lg:p-6">
        <aside className="panel flex w-full max-w-[290px] flex-col rounded-[2rem] p-5 lg:p-6">
          <div className="flex items-center gap-3 border-b border-[rgba(255,255,255,0.08)] pb-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(184,255,106,0.14)] text-sm font-semibold text-[var(--accent)]">
              RI
            </div>
            <div>
              <p className="display-font text-lg text-white">ReachInbox</p>
              <p className="text-xs text-[var(--muted)]">Email scheduler</p>
            </div>
          </div>

          <div className="mt-5 rounded-[1.5rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">Signed in</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-[rgba(255,255,255,0.08)] text-sm font-semibold">
                {user?.picture ? <img alt={user.name ?? user.email} src={user.picture} className="h-full w-full object-cover" /> : user?.name?.slice(0, 2).toUpperCase() ?? 'RI'}
              </div>
              <div>
                <p className="font-medium text-white">{user?.name ?? 'Demo User'}</p>
                <p className="text-xs text-[var(--muted)]">{user?.email ?? 'demo@reachinbox.ai'}</p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setComposeOpen(true)}
            className="mt-5 rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[#08111d] transition hover:bg-[var(--accent-strong)]"
          >
            Compose New Email
          </button>

          <nav className="mt-6 flex flex-1 flex-col gap-2">
            {([
              ['scheduled', 'Scheduled Emails'],
              ['sent', 'Sent Emails'],
            ] as Array<[TabKey, string]>).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setActiveTab(key);
                  setSearchResults(null);
                }}
                className={`rounded-2xl px-4 py-3 text-left text-sm transition ${activeTab === key ? 'bg-[rgba(184,255,106,0.12)] text-white' : 'text-[var(--muted)] hover:bg-[rgba(255,255,255,0.04)] hover:text-white'}`}
              >
                {label}
              </button>
            ))}
            <a
              href={api.baseUrl.replace(/\/$/, '') + '/admin/queues'}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl px-4 py-3 text-sm text-[var(--muted)] transition hover:bg-[rgba(255,255,255,0.04)] hover:text-white"
            >
              BullMQ Admin
            </a>
          </nav>

          <button
            type="button"
            onClick={handleLogout}
            className="mt-4 rounded-full border border-[rgba(255,255,255,0.12)] px-4 py-3 text-sm text-white transition hover:bg-[rgba(255,255,255,0.05)]"
          >
            Logout
          </button>
        </aside>

        <section className="panel flex min-w-0 flex-1 flex-col rounded-[2rem] p-5 lg:p-6">
          <header className="flex flex-col gap-4 border-b border-[rgba(255,255,255,0.08)] pb-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Dashboard</p>
              <h1 className="display-font mt-2 text-3xl text-white lg:text-5xl">Scheduled and sent mail in one place.</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                Compose batches, review queue health, and inspect each email as it moves through BullMQ, Redis, Postgres, and Ethereal.
              </p>
            </div>

            <form onSubmit={handleSearch} className="flex w-full max-w-xl gap-3">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search subject, body, recipient"
                className="w-full rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)] px-5 py-3 text-sm text-white outline-none placeholder:text-[var(--muted)] focus:border-[rgba(184,255,106,0.35)]"
              />
              <button
                type="submit"
                className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[#08111d] transition hover:bg-[var(--accent-strong)]"
              >
                Search
              </button>
            </form>
          </header>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {[
              ['Scheduled', dashboard?.summary.scheduledCount ?? 0],
              ['Sent', dashboard?.summary.sentCount ?? 0],
              ['Failed', dashboard?.summary.failedCount ?? 0],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-[1.5rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-5">
                <p className="text-sm text-[var(--muted)]">{label as string}</p>
                <p className="mt-2 display-font text-4xl text-white">{value as number}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex min-h-0 flex-1 flex-col rounded-[1.5rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)]">
            <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.08)] px-5 py-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('scheduled')}
                  className={`rounded-full px-4 py-2 text-sm ${activeTab === 'scheduled' ? 'bg-[rgba(184,255,106,0.12)] text-white' : 'text-[var(--muted)]'}`}
                >
                  Scheduled
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('sent')}
                  className={`rounded-full px-4 py-2 text-sm ${activeTab === 'sent' ? 'bg-[rgba(184,255,106,0.12)] text-white' : 'text-[var(--muted)]'}`}
                >
                  Sent
                </button>
              </div>
              <button
                type="button"
                onClick={refreshDashboard}
                className="rounded-full border border-[rgba(255,255,255,0.12)] px-4 py-2 text-sm text-white transition hover:bg-[rgba(255,255,255,0.05)]"
              >
                Refresh
              </button>
            </div>

            <div className="scrollbar min-h-0 flex-1 overflow-auto px-5 py-2">
              {message ? <p className="mb-4 rounded-2xl border border-[rgba(184,255,106,0.18)] bg-[rgba(184,255,106,0.06)] px-4 py-3 text-sm text-[var(--accent)]">{message}</p> : null}

              {loadingDashboard ? (
                <div className="px-2 py-10 text-sm text-[var(--muted)]">Loading emails...</div>
              ) : visibleEmails.length === 0 ? (
                <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.02)] text-center">
                  <p className="display-font text-2xl text-white">No emails yet</p>
                  <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
                    Schedule a batch or clear the search filter to see queued and sent jobs.
                  </p>
                </div>
              ) : (
                <table className="w-full border-separate border-spacing-y-3">
                  <thead className="text-left text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
                    <tr>
                      <th className="px-4 py-2">Email</th>
                      <th className="px-4 py-2">Subject</th>
                      <th className="px-4 py-2">Scheduled / Sent</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleEmails.map((email) => (
                      <tr key={email.id} className="table-row rounded-2xl bg-[rgba(255,255,255,0.03)]">
                        <td className="rounded-l-2xl px-4 py-4 text-sm text-white">{email.to}</td>
                        <td className="px-4 py-4 text-sm text-white">{email.subject}</td>
                        <td className="px-4 py-4 text-sm text-[var(--muted)]">{formatDate(activeTab === 'sent' ? email.sentAt : email.scheduledAt)}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${statusTone(email.status)}`}>
                            {email.status}
                          </span>
                        </td>
                        <td className="rounded-r-2xl px-4 py-4 text-right text-sm">
                          <div className="inline-flex gap-2">
                            <Link
                              href={`/emails/${email.id}`}
                              className="rounded-full border border-[rgba(255,255,255,0.12)] px-3 py-2 text-[var(--foreground)] transition hover:bg-[rgba(255,255,255,0.05)]"
                            >
                              View
                            </Link>
                            {email.status !== 'sent' ? (
                              <button
                                type="button"
                                onClick={() => void handleSendNow(email.id)}
                                className="rounded-full bg-[rgba(184,255,106,0.12)] px-3 py-2 font-medium text-[var(--accent)] transition hover:bg-[rgba(184,255,106,0.18)]"
                              >
                                Send now
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </section>
      </div>

      {composeOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(6,10,18,0.72)] p-4 backdrop-blur-sm">
          <div className="panel-strong w-full max-w-4xl rounded-[2rem] p-6 lg:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Compose</p>
                <h2 className="display-font mt-2 text-3xl text-white">Schedule a new email batch</h2>
              </div>
              <button type="button" onClick={() => setComposeOpen(false)} className="rounded-full border border-[rgba(255,255,255,0.12)] px-4 py-2 text-sm text-white">
                Close
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 grid gap-5 lg:grid-cols-2">
              <label className="grid gap-2 text-sm text-white">
                From
                <input value={form.from} onChange={(event) => setForm((current) => ({ ...current, from: event.target.value }))} className="rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)] px-4 py-3 outline-none" />
              </label>
              <label className="grid gap-2 text-sm text-white">
                Recipients
                <textarea value={form.recipients} onChange={(event) => setForm((current) => ({ ...current, recipients: event.target.value }))} rows={4} className="rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)] px-4 py-3 outline-none" />
                <span className="text-xs text-[var(--muted)]">Paste CSV, newline-separated addresses, or semicolon-separated values.</span>
              </label>
              <label className="grid gap-2 text-sm text-white lg:col-span-2">
                Subject
                <input value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} className="rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)] px-4 py-3 outline-none" />
              </label>
              <label className="grid gap-2 text-sm text-white lg:col-span-2">
                Body
                <textarea value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} rows={7} className="rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)] px-4 py-3 outline-none" />
              </label>
              <label className="grid gap-2 text-sm text-white">
                Start time
                <input type="datetime-local" value={form.scheduledAt} onChange={(event) => setForm((current) => ({ ...current, scheduledAt: event.target.value }))} className="rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)] px-4 py-3 outline-none" />
              </label>
              <label className="grid gap-2 text-sm text-white">
                Delay between emails (seconds)
                <input type="number" min="0" value={form.delaySeconds} onChange={(event) => setForm((current) => ({ ...current, delaySeconds: event.target.value }))} className="rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)] px-4 py-3 outline-none" />
              </label>
              <label className="grid gap-2 text-sm text-white">
                Hourly limit
                <input type="number" min="1" value={form.hourlyLimit} onChange={(event) => setForm((current) => ({ ...current, hourlyLimit: event.target.value }))} className="rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)] px-4 py-3 outline-none" />
              </label>
              <div className="flex items-end gap-3 lg:col-span-2">
                <button type="submit" disabled={submitting} className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[#08111d] transition hover:bg-[var(--accent-strong)] disabled:opacity-60">
                  {submitting ? 'Scheduling...' : 'Schedule batch'}
                </button>
                <button type="button" onClick={() => setComposeOpen(false)} className="rounded-full border border-[rgba(255,255,255,0.12)] px-5 py-3 text-sm text-white">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
