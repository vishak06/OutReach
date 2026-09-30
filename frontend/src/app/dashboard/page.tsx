"use client";

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  const [sendLaterOpen, setSendLaterOpen] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [recipientDraft, setRecipientDraft] = useState('');
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    from: '',
    recipients: '',
    subject: '',
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
        setForm((current) => ({ ...current, from: session.user?.email ?? '' }));
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

  useEffect(() => {
    if (composeOpen && editorRef.current && !editorRef.current.innerHTML) {
      editorRef.current.innerHTML = form.body;
    }
  }, [composeOpen]);

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

  useEffect(() => {
    if (loading || composeOpen) {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshDashboard();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [loading, composeOpen]);

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

    const recipients = [...parseRecipients(form.recipients), recipientDraft.trim()].filter(Boolean);

    if (!form.from.trim() || recipients.length === 0 || !form.subject.trim() || !form.body.trim()) {
      setMessage('Add a recipient, subject, and message before sending.');
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      await api.scheduleEmails({
        from: form.from,
        recipients,
        subject: form.subject,
        body: form.body,
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
        delaySeconds: Number(form.delaySeconds) || 0,
        hourlyLimit: Number(form.hourlyLimit) || undefined,
      });

      setComposeOpen(false);
      setRecipientDraft('');
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

  function setSchedule(daysFromNow: number, hour?: number): void {
    const scheduled = new Date();
    scheduled.setDate(scheduled.getDate() + daysFromNow);
    if (hour !== undefined) {
      scheduled.setHours(hour, 0, 0, 0);
    } else {
      scheduled.setMinutes(scheduled.getMinutes() + 30, 0, 0);
    }

    const localValue = new Date(scheduled.getTime() - scheduled.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setForm((current) => ({ ...current, scheduledAt: localValue }));
    setSendLaterOpen(false);
  }

  function handleRecipientFile(event: React.ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const contents = typeof reader.result === 'string' ? reader.result : '';
      setForm((current) => ({ ...current, recipients: parseRecipients(contents).join(', ') }));
    };
    reader.readAsText(file);
  }

  function handleAttachment(event: React.ChangeEvent<HTMLInputElement>): void {
    const files = Array.from(event.target.files ?? []).map((file) => file.name);
    setAttachments((current) => [...current, ...files]);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="app-shell min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-[1180px] gap-2 px-3 lg:px-5">
        <aside className="panel flex w-full max-w-[172px] flex-col px-2 pt-5">
          <div className="display-font px-3 text-[26px] font-black tracking-[-0.14em] text-[#131717]">OR</div>

          <div className="mt-5 rounded-[1.5rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">Signed in</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e8b995] text-[10px] font-semibold text-white">
                {user?.picture ? <img alt={user.name ?? user.email} src={user.picture} className="h-full w-full object-cover" /> : user?.name?.slice(0, 2).toUpperCase() ?? 'OR'}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-white">{user?.name ?? 'Demo User'}</p>
                <p className="text-xs text-[var(--muted)]">{user?.email ?? 'demo@reachinbox.ai'}</p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setComposeOpen(true)}
            className="mt-4 h-8 rounded-full border-2 border-[#00a941] px-4 text-[11px] font-medium text-[#00a941] transition hover:bg-[#effaf3]"
          >
            Compose New Email
          </button>

          <nav className="mt-6 flex flex-1 flex-col gap-1">
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
                  void refreshDashboard();
                }}
                className={`rounded-[10px] px-3 py-2 text-left text-[11px] transition ${activeTab === key ? 'bg-[#e4f5ec] text-[#25312a]' : 'text-[#69736d] hover:bg-[#f5f8f6] hover:text-[#25312a]'}`}
              >
                {label}
              </button>
            ))}
            <a
              href={api.baseUrl.replace(/\/$/, '') + '/admin/queues'}
              target="_blank"
              rel="noreferrer"
              className="rounded-[10px] px-3 py-2 text-[11px] text-[#69736d] transition hover:bg-[#f5f8f6] hover:text-[#25312a]"
            >
              BullMQ Admin
            </a>
          </nav>

          <button
            type="button"
            onClick={handleLogout}
            className="mt-4 px-3 py-3 text-left text-[11px] text-[#a0a8a3] transition hover:text-[#25312a]"
          >
            Logout
          </button>
        </aside>

        <section className="panel flex min-w-0 flex-1 flex-col px-3 pb-8 pt-8 lg:px-5">
          <header className="flex flex-col gap-4 pb-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="sr-only">Dashboard</p>
            </div>

            <form onSubmit={handleSearch} className="flex w-full max-w-xl gap-3">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search"
                className="quiet-input h-9 w-full rounded-full px-5 text-[11px] text-[#303934] outline-none placeholder:text-[#aeb7b1]"
              />
              <button
                type="submit"
                className="hidden"
              >
                Search
              </button>
            </form>
          </header>

          <div className="hidden">
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

          <div className="mt-2 flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between px-3 py-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setActiveTab('scheduled'); void refreshDashboard(); }}
                  className={`px-2 py-2 text-[11px] ${activeTab === 'scheduled' ? 'font-medium text-[#25312a]' : 'text-[#9ca49f]'}`}
                >
                  Scheduled
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab('sent'); void refreshDashboard(); }}
                  className={`px-2 py-2 text-[11px] ${activeTab === 'sent' ? 'font-medium text-[#25312a]' : 'text-[#9ca49f]'}`}
                >
                  Sent
                </button>
              </div>
              <button
                type="button"
                onClick={refreshDashboard}
                className="px-2 py-2 text-[11px] text-[#9ca49f] transition hover:text-[#25312a]"
              >
                Refresh
              </button>
            </div>

            <div className="scrollbar min-h-0 flex-1 overflow-auto px-1 py-2">
              {message ? <p className="mb-4 px-3 py-2 text-[11px] text-[var(--accent)]">{message}</p> : null}

              {loadingDashboard ? (
                <div className="px-2 py-10 text-sm text-[var(--muted)]">Loading emails...</div>
              ) : visibleEmails.length === 0 ? (
                <div className="flex min-h-[280px] flex-col items-center justify-center text-center">
                  <p className="display-font text-2xl text-[#25312a]">No emails yet</p>
                  <p className="mt-2 max-w-md text-[11px] text-[#a0a8a3]">
                    Schedule a batch or clear the search filter to see queued and sent jobs.
                  </p>
                </div>
              ) : (
                <table className="w-full border-separate border-spacing-y-0">
                  <thead className="text-left text-[10px] uppercase tracking-[0.18em] text-[#a0a8a3]">
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
                      <tr key={email.id} className="email-row">
                        <td className="px-3 py-3 text-[11px] text-[#25312a]">{email.to}</td>
                        <td className="px-3 py-3 text-[11px] text-[#25312a]">{email.subject}</td>
                        <td className="px-3 py-3 text-[11px] text-[#a0a8a3]">{formatDate(activeTab === 'sent' ? email.sentAt : email.scheduledAt)}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full px-3 py-1 text-[9px] font-medium ${statusTone(email.status)}`}>
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
        <div className="fixed inset-0 z-50 overflow-auto bg-white p-4 sm:p-8">
          <div className="panel mx-auto w-full max-w-[1000px] p-2 lg:p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setComposeOpen(false)} className="text-[22px] leading-none text-[#27302b]">←</button>
                <h2 className="text-[17px] font-medium text-[#25312a]">Compose New Email</h2>
              </div>
              <div className="flex items-center gap-4">
                <label className="cursor-pointer text-[17px] text-[#8f9992]" title="Attach files">
                  ♧
                  <input type="file" multiple className="hidden" onChange={handleAttachment} />
                </label>
                <button type="button" onClick={() => setSendLaterOpen((current) => !current)} className={`flex items-center gap-2 text-[11px] ${form.scheduledAt ? 'text-[#00a941]' : 'text-[#8f9992]'}`} title="Send later">
                  <span className="text-[17px]">◷</span>
                  {form.scheduledAt ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(form.scheduledAt)) : null}
                </button>
                <button type="submit" form="compose-form" className="h-8 rounded-full border border-[#00a941] px-5 text-[11px] text-[#00a941]">{submitting ? 'Sending' : form.scheduledAt ? 'Send Later' : 'Send'}</button>
              </div>
            </div>

            {sendLaterOpen ? (
              <div className="absolute right-8 top-16 z-10 w-[205px] rounded-[6px] bg-white p-3 shadow-[0_3px_12px_rgba(0,0,0,0.18)]">
                <p className="text-[12px] font-medium text-[#26302b]">Send Later</p>
                <label className="mt-4 flex items-center justify-between border-b border-[#edf0ee] pb-2 text-[10px] text-[#a2aaa5]">
                  Pick date &amp; time
                  <input type="datetime-local" value={form.scheduledAt} onChange={(event) => setForm((current) => ({ ...current, scheduledAt: event.target.value }))} className="absolute h-6 w-6 cursor-pointer opacity-0" />
                  <span>▣</span>
                </label>
                <div className="mt-3 space-y-3 text-[10px] text-[#65716a]">
                  <button type="button" onClick={() => setSchedule(1)} className="block w-full text-left hover:text-[#00a941]">Tomorrow</button>
                  <button type="button" onClick={() => setSchedule(1, 10)} className="block w-full text-left hover:text-[#00a941]">Tomorrow, 10:00 AM</button>
                  <button type="button" onClick={() => setSchedule(1, 11)} className="block w-full text-left hover:text-[#00a941]">Tomorrow, 11:00 AM</button>
                  <button type="button" onClick={() => setSchedule(1, 15)} className="block w-full text-left hover:text-[#00a941]">Tomorrow, 3:00 PM</button>
                </div>
                <div className="mt-5 flex items-center justify-end gap-4 text-[10px]">
                  <button type="button" onClick={() => setSendLaterOpen(false)} className="text-[#26302b]">Cancel</button>
                  <button type="button" onClick={() => setSendLaterOpen(false)} className="rounded-full border border-[#00a941] px-4 py-1 text-[#00a941]">Done</button>
                </div>
              </div>
            ) : null}

            <form id="compose-form" onSubmit={handleSubmit} className="mt-7 max-w-[680px] pl-8">
              <label className="flex min-h-[37px] items-center gap-8 text-[11px] text-[#25312a]">
                <span className="w-8">From</span>
                <span className="quiet-input rounded-[6px] px-3 py-2 text-[11px]">{form.from}⌄</span>
              </label>
              <label className="flex min-h-[48px] items-center gap-8 text-[11px] text-[#25312a]">
                <span className="w-8">To</span>
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                  {parseRecipients(form.recipients).map((recipient) => (
                    <span key={recipient} className="rounded-full border border-[#00a941] px-2 py-1 text-[10px] text-[#26302b]">{recipient}</span>
                  ))}
                  <input value={recipientDraft} onChange={(event) => setRecipientDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); const value = recipientDraft.trim(); if (value) { setForm((current) => ({ ...current, recipients: [...parseRecipients(current.recipients), value].join(', ') })); setRecipientDraft(''); } } }} placeholder="recipient@example.com" className="min-w-[150px] flex-1 border-0 px-1 py-2 text-[11px] outline-none placeholder:text-[#b3bab5]" />
                  <label className="cursor-pointer whitespace-nowrap text-[10px] text-[#00a941]">
                    ↑ Upload List
                    <input type="file" accept=".csv,.txt" className="hidden" onChange={handleRecipientFile} />
                  </label>
                </div>
              </label>
              <label className="flex min-h-[37px] items-center gap-8 text-[11px] text-[#25312a]">
                <span className="w-8">Subject</span>
                <input value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} placeholder="Subject" className="w-full border-0 px-0 py-2 text-[11px] outline-none placeholder:text-[#b3bab5]" />
              </label>
              <label className="grid gap-2 text-[11px] text-[#25312a] lg:col-span-2">
                Body
                <div className="quiet-input mt-2 overflow-hidden rounded-[8px]">
                  <div id="email-editor" ref={editorRef} contentEditable suppressContentEditableWarning onInput={(event) => { const body = event.currentTarget.innerHTML; setForm((current) => ({ ...current, body })); }} className="min-h-[260px] bg-[#f8faf9] px-3 py-3 text-[12px] leading-6 outline-none" />
                </div>
              </label>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-[#25312a]">
                <span>Delay between 2 emails</span>
                <input type="number" min="0" value={form.delaySeconds} onChange={(event) => setForm((current) => ({ ...current, delaySeconds: event.target.value }))} className="quiet-input h-8 w-[62px] rounded-[6px] px-3 text-[11px]" />
                <span className="ml-1">Hourly Limit</span>
                <input type="number" min="1" value={form.hourlyLimit} onChange={(event) => setForm((current) => ({ ...current, hourlyLimit: event.target.value }))} className="quiet-input h-8 w-[62px] rounded-[6px] px-3 text-[11px]" />
              </div>
              {attachments.length > 0 ? <div className="flex flex-wrap gap-2 text-[10px] text-[#77817a]">{attachments.map((file) => <span key={file} className="bg-[#f4f7f5] px-2 py-1">{file}</span>)}</div> : null}
              <label className="hidden text-[11px] text-[#25312a]">
                Start time
                <input type="datetime-local" value={form.scheduledAt} onChange={(event) => setForm((current) => ({ ...current, scheduledAt: event.target.value }))} className="quiet-input rounded-[6px] px-4 py-3 text-[11px] outline-none" />
              </label>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
