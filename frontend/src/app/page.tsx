"use client";

export default function Home() {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 hero-grid opacity-35" />
      <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-[rgba(184,255,106,0.16)] blur-3xl" />
      <div className="absolute right-0 top-24 h-96 w-96 rounded-full bg-[rgba(92,224,164,0.12)] blur-3xl" />

      <main className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-8 lg:px-10">
        <section className="grid flex-1 items-stretch gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="panel-strong flex flex-col justify-between rounded-[2rem] p-8 lg:p-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="display-font text-sm uppercase tracking-[0.35em] text-[var(--accent)]">ReachInbox</p>
                <h1 className="display-font mt-3 max-w-xl text-4xl leading-none text-white sm:text-5xl lg:text-7xl">
                  Schedule campaigns without losing control of the queue.
                </h1>
              </div>
              <a
                href={`${apiBase}/api/auth/google`}
                className="hidden rounded-full border border-[rgba(184,255,106,0.35)] px-4 py-2 text-sm font-medium text-[var(--accent)] transition hover:bg-[rgba(184,255,106,0.1)] md:inline-flex"
              >
                Continue with Google
              </a>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                ["Persistent queue", "BullMQ delayed jobs survive restarts."],
                ["Searchable email history", "Elasticsearch indexes every send and status change."],
                ["Live rate control", "Redis-backed counters throttle and defer overflow."],
              ].map(([title, description]) => (
                <article key={title} className="glass-card rounded-3xl p-5">
                  <h2 className="text-base font-semibold text-white">{title}</h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p>
                </article>
              ))}
            </div>

            <div className="mt-10 flex flex-wrap gap-3 text-sm text-[var(--muted)]">
              <span className="rounded-full border border-[rgba(255,255,255,0.1)] px-4 py-2">Google OAuth</span>
              <span className="rounded-full border border-[rgba(255,255,255,0.1)] px-4 py-2">BullMQ + Redis</span>
              <span className="rounded-full border border-[rgba(255,255,255,0.1)] px-4 py-2">Prisma + Postgres</span>
              <span className="rounded-full border border-[rgba(255,255,255,0.1)] px-4 py-2">Ethereal SMTP</span>
            </div>
          </div>

          <aside className="panel flex flex-col justify-between rounded-[2rem] p-6 lg:p-8">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-[var(--muted)]">Login</p>
              <h2 className="display-font mt-3 text-3xl text-white">A focused operator view for scheduled sends.</h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-[var(--muted)]">
                Sign in with Google to manage scheduled and sent emails. For local development, there is also a demo session path.
              </p>
            </div>

            <div className="mt-8 rounded-[1.5rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(184,255,106,0.14)] text-lg font-semibold text-[var(--accent)]">
                  RI
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Ready to run</p>
                  <p className="text-xs text-[var(--muted)]">Dashboard, compose, and detail flows are wired.</p>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3">
                <a
                  href={`${apiBase}/api/auth/google`}
                  className="inline-flex items-center justify-center rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[#09111e] transition hover:bg-[var(--accent-strong)]"
                >
                  Continue with Google
                </a>
                <form action={`${apiBase}/api/auth/dev-login`} method="post">
                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center rounded-full border border-[rgba(255,255,255,0.12)] px-5 py-3 text-sm font-medium text-white transition hover:bg-[rgba(255,255,255,0.05)]"
                  >
                    Use local demo session
                  </button>
                </form>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                ["Scheduled", "Delayed jobs stored in Redis"],
                ["Sent", "Messages rendered in Ethereal"],
                ["Search", "Full text on subject, body, recipient"],
                ["Slack", "Rate limit notifications"],
              ].map(([title, description]) => (
                <div key={title} className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] p-4">
                  <p className="text-sm font-medium text-white">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{description}</p>
                </div>
              ))}
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
