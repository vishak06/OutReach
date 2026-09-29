# ReachInbox Email Scheduler

Production-grade email scheduler and dashboard built as a monorepo with `backend/` and `frontend/`.

## What’s included

- Google OAuth login flow with a demo fallback for local development.
- BullMQ delayed jobs backed by Redis.
- PostgreSQL + Prisma persistence for scheduled, sent, failed, and rate-limited emails.
- Ethereal SMTP delivery for safe email sending in development.
- Elasticsearch indexing and search for subject, body, and recipient.
- Redis-backed hourly rate limiting and worker-level send delay.
- Slack webhook notifications when the hourly limit is hit.
- Bull Board admin dashboard at `/admin/queues`.
- Next.js dashboard with scheduled and sent tabs, compose drawer, search, and email detail view.

## Run locally

### 1) Start infrastructure

```bash
docker compose up -d
```

This starts Redis, PostgreSQL, and Elasticsearch.

### 2) Backend

```bash
cd backend
npm install
cp .env.example .env
npx prisma generate
npx prisma db push
npm run dev
```

Run the worker in a separate terminal:

```bash
cd backend
npm run worker
```

### 3) Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Architecture

### Scheduling

Email batches are saved in PostgreSQL and each recipient becomes a BullMQ delayed job. The queue stores the delay, so jobs survive restarts without cron.

### Persistence and idempotency

The worker marks an email as `sending` before dispatch. If a job is replayed, the status gate prevents duplicate sends. Scheduled rows are rehydrated on startup if they are missing from the queue.

### Rate limiting

Hourly limits are enforced with Redis counters keyed by sender and hour window. The worker also applies a minimum delay between individual sends using BullMQ’s worker limiter.

### Search

Every create and status update is indexed into Elasticsearch. If Elasticsearch is unavailable, the backend falls back to database filtering so the API still works.

## Environment

Copy the example env files in `backend/.env.example` and `frontend/.env.example`. The backend supports optional Google OAuth, Slack webhooks, and explicit SMTP overrides. Without SMTP settings it uses Ethereal automatically.

## Feature map

- Login page: `frontend/src/app/page.tsx`
- Dashboard: `frontend/src/app/dashboard/page.tsx`
- Email detail view: `frontend/src/app/emails/[emailId]/page.tsx`
- API and worker: `backend/src/app.ts` and `backend/src/worker.ts`
- Data model: `backend/prisma/schema.prisma`
