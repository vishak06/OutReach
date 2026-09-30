# ReachInbox Email Scheduler

Production-grade email scheduler and dashboard built as a monorepo with `backend/` and `frontend/`.

## What’s included

- Real Google OAuth and email/password signup/login with session cookies.
- BullMQ delayed email jobs backed by Redis.
- PostgreSQL + Prisma persistence for scheduled, sending, sent, and failed emails.
- Ethereal SMTP delivery for safe local testing.
- Elasticsearch indexing with a PostgreSQL fallback search path.
- Redis-backed hourly rate limiting and configurable worker concurrency.
- Configurable delay between individual sends.
- Slack webhook notifications when a sender reaches its hourly limit.
- Bull Board queue monitoring at `/admin/queues`.
- Next.js dashboard with scheduled and sent tabs, compose workspace, send-later picker, CSV recipient upload, attachments, search, and email detail pages.

## Run locally

### 1) Start infrastructure

```powershell
docker compose up -d
docker compose ps
```

This starts Redis, PostgreSQL, and Elasticsearch. The included compose file exposes PostgreSQL on host port `5433` to avoid conflicts with another local PostgreSQL installation.

Required services:

| Service | Host address |
| --- | --- |
| PostgreSQL | `localhost:5433` |
| Redis | `localhost:6379` |
| Elasticsearch | `localhost:9200` |

### 2) Backend

```powershell
cd backend
npm install
Copy-Item .env.example .env
npx prisma generate
npx prisma db push
npm run dev
```

Run the worker in a separate terminal:

```powershell
cd backend
npm run worker
```

The API runs on `http://localhost:5000`. The worker is a separate long-running process and must remain open to process scheduled jobs.

### 3) Frontend

```powershell
cd frontend
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

### 4) Development terminals

Run these processes at the same time:

1. `docker compose up -d`
2. `cd backend; npm run dev`
3. `cd backend; npm run worker`
4. `cd frontend; npm run dev`

Health check: `http://localhost:5000/api/health`.

Bull Board: `http://localhost:5000/admin/queues`.

## Architecture

### Scheduling

The compose form sends the sender, recipients, subject, body, start time, per-email delay, and hourly limit to `POST /api/emails`. The API creates one PostgreSQL `Email` row and one BullMQ delayed job per recipient. The job delay is calculated from the selected start time and recipient index. No cron process is used.

### Persistence and idempotency

PostgreSQL is the source of truth for email state. BullMQ stores delayed jobs in Redis, so future jobs survive an API or worker restart. On startup, the backend rehydrates future scheduled rows whose queue jobs are missing. The worker atomically changes an email from `scheduled` to `sending`; replayed jobs cannot send an email that is already `sending` or `sent`.

### Rate limiting

Each sender has a Redis counter keyed by sender and the current hour window. The configurable `MAX_EMAILS_PER_HOUR` value controls the limit. When the limit is reached, the email is returned to `scheduled`, moved to the next hour, and an optional Slack webhook notification is sent. The worker also uses BullMQ’s limiter to enforce `MIN_SEND_DELAY_MS` between sends.

### Concurrency and throughput

`WORKER_CONCURRENCY` controls how many BullMQ jobs a worker can process in parallel. The Redis rate counter and database status transition are shared across workers, so multiple worker instances do not bypass the hourly limit or send the same row twice. BullMQ retries transient failures with exponential backoff.

### SMTP delivery

The worker sends through Ethereal SMTP using Nodemailer. This repository caps STARTTLS at TLS 1.2 because the local Node/OpenSSL environment requires it for Ethereal. A successful Ethereal send returns a preview URL in the API response and is stored as `sent` in PostgreSQL.

### Search

Every create and status update is indexed into Elasticsearch. If Elasticsearch is unavailable, the backend falls back to database filtering so the API still works.

## Environment variables

Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env.local`.

### Required backend variables

```env
PORT=5000
FRONTEND_URL=http://localhost:3000
SESSION_SECRET=replace-with-a-long-random-value
DATABASE_URL=postgresql://outreach:outreach_pass@localhost:5433/outreach_db?schema=public
REDIS_URL=redis://localhost:6379
ELASTICSEARCH_URL=http://localhost:9200
MAX_EMAILS_PER_HOUR=200
MIN_SEND_DELAY_MS=2000
WORKER_CONCURRENCY=4
```

### Ethereal Email

Create a test account at [ethereal.email](https://ethereal.email), then use the SMTP credentials shown by Ethereal:

```env
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_ethereal_username
SMTP_PASS=your_ethereal_password
```

The worker requires a complete `SMTP_*` credential set to use a manually configured account. If these values are omitted, it creates a temporary Ethereal account automatically.

### Optional Google OAuth

```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
```

Register `http://localhost:5000/api/auth/google/callback` as an authorized redirect URI in Google Cloud Console.

### Optional Slack notifications

```env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/your/webhook/url
```

The webhook is called when a sender reaches the hourly limit. If it is not configured, rate limiting still works and no Slack request is made.

## Implemented feature map

### Backend

- **Scheduler:** Express `POST /api/emails` creates one delayed BullMQ job per recipient.
- **Persistence:** Prisma/PostgreSQL stores user accounts, email content, status, scheduling metadata, sent time, and failure details.
- **Restart recovery:** Startup rehydrates future scheduled emails that are not present in Redis.
- **Idempotency:** A guarded `scheduled` to `sending` transition prevents duplicate sends.
- **SMTP:** Nodemailer sends through Ethereal with TLS 1.2 compatibility and preview URLs.
- **Rate limiting:** Redis sender/hour counters enforce `MAX_EMAILS_PER_HOUR`.
- **Throttling:** BullMQ limiter enforces `MIN_SEND_DELAY_MS`.
- **Concurrency:** `WORKER_CONCURRENCY` controls parallel job processing.
- **Search:** Elasticsearch indexes email creation and status changes, with database fallback.
- **Notifications:** Optional Slack webhook alerts on rate-limit hits.
- **Operations:** Bull Board exposes live queue state at `/admin/queues`.
- **Authentication:** Google OAuth and hashed email/password sessions.

### Frontend

- **Login:** Google OAuth button plus real email/password account creation and login.
- **Dashboard:** OR-branded sidebar, signed-in profile, scheduled/sent tabs, search, refresh, and automatic five-second refresh.
- **Compose:** From identity, recipient chips, CSV/text upload, subject, plain body editor, attachment picker, delay, hourly limit, and send action.
- **Send later:** Preset and custom date/time scheduling with a visible selected schedule indicator.
- **Tables:** Scheduled and sent email rows with recipient, subject, time, status, and detail actions.
- **Email detail:** Sender, recipient, status, schedule, owner, and rendered HTML body.
- **States:** Loading, empty, validation, and success/error feedback.

## Important source files

- Login: `frontend/src/app/page.tsx`
- Dashboard and compose: `frontend/src/app/dashboard/page.tsx`
- Email detail: `frontend/src/app/emails/[emailId]/page.tsx`
- API: `backend/src/app.ts`
- Worker: `backend/src/worker.ts`
- Queue: `backend/src/queue.ts`
- Rate limiting: `backend/src/rate-limiter.ts`
- Prisma schema: `backend/prisma/schema.prisma`
