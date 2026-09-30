import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import passport from 'passport';
import { createBullBoard } from '@bull-board/api';
import { ExpressAdapter } from '@bull-board/express';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import prisma from './db';
import { config } from './config';
import { configurePassport } from './auth';
import { emailQueue } from './queue';
import { rehydrateScheduledEmails } from './seed';
import { refreshEmailIndex, searchEmails, indexEmail } from './search';
import { checkHourlyRateLimit } from './rate-limiter';
import { sendEmail } from './mail';
import { hashPassword, verifyPassword } from './password';
import type { CreateEmailRequest, AppUser } from './types';

const passportInstance = configurePassport();

export function createApp(): express.Express {
  const app = express();

  const bullBoardAdapter = new ExpressAdapter();
  bullBoardAdapter.setBasePath(config.bullBoardPath);

  createBullBoard({
    queues: [new BullMQAdapter(emailQueue) as any],
    serverAdapter: bullBoardAdapter,
  });

  app.use(cors({
    origin: config.frontendUrl,
    credentials: true,
  }));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: config.nodeEnv === 'production' ? 'none' : 'lax',
      secure: config.nodeEnv === 'production',
    },
  }));
  app.use(passportInstance.initialize());
  app.use(passportInstance.session());

  app.use(config.bullBoardPath, bullBoardAdapter.getRouter());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', message: 'Backend is running' });
  });

  app.get('/api/auth/session', (req, res) => {
    const user = req.user as AppUser | undefined;

    if (!user) {
      res.status(401).json({ authenticated: false });
      return;
    }

    res.json({ authenticated: true, user });
  });

  app.get('/api/auth/google', passportInstance.authenticate('google', { scope: ['profile', 'email'] }));

  app.get('/api/auth/google/callback', passportInstance.authenticate('google', { failureRedirect: '/' }), (_req, res) => {
    res.redirect(`${config.frontendUrl}/dashboard`);
  });

  app.post('/api/auth/logout', (req, res, next) => {
    req.logout((error) => {
      if (error) {
        next(error);
        return;
      }

      req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.json({ ok: true });
      });
    });
  });

  app.post('/api/auth/email', async (req, res, next) => {
    try {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const password = typeof req.body?.password === 'string' ? req.body.password : '';

      if (!email || !password || password.length < 6) {
        res.redirect(`${config.frontendUrl}/?error=invalid_credentials`);
        return;
      }

      const existingUser = await prisma.user.findUnique({ where: { email } });
      let user = existingUser;

      if (existingUser?.passwordHash) {
        const validPassword = await verifyPassword(password, existingUser.passwordHash);

        if (!validPassword) {
          res.redirect(`${config.frontendUrl}/?error=invalid_credentials`);
          return;
        }
      } else if (existingUser) {
        user = await prisma.user.update({
          where: { id: existingUser.id },
          data: { passwordHash: await hashPassword(password) },
        });
      } else {
        user = await prisma.user.create({
          data: {
            email,
            name: email.split('@')[0],
            passwordHash: await hashPassword(password),
          },
        });
      }

      if (!user) {
        res.redirect(`${config.frontendUrl}/?error=invalid_credentials`);
        return;
      }

      req.login(user, (error) => {
        if (error) {
          next(error);
          return;
        }

        res.redirect(`${config.frontendUrl}/dashboard`);
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/dev-login', async (req, res, next) => {
    try {
      const email = typeof req.body?.email === 'string' ? req.body.email : 'demo@reachinbox.ai';
      const name = typeof req.body?.name === 'string' ? req.body.name : 'Demo User';

      const user = await prisma.user.upsert({
        where: { email },
        update: { name },
        create: {
          email,
          name,
          picture: null,
          googleId: null,
        },
      });

      req.login(user, (error) => {
        if (error) {
          next(error);
          return;
        }

        res.redirect(`${config.frontendUrl}/dashboard`);
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/emails', async (req, res, next) => {
    try {
      const user = req.user as AppUser | undefined;

      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const status = typeof req.query.status === 'string' ? req.query.status : undefined;

      const emails = await prisma.email.findMany({
        where: {
          userId: user.id,
          ...(status ? { status } : {}),
        },
        orderBy: { scheduledAt: 'desc' },
      });

      res.json({ emails });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/emails/:id', async (req, res, next) => {
    try {
      const user = req.user as AppUser | undefined;

      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const email = await prisma.email.findFirst({
        where: { id: req.params.id, userId: user.id },
      });

      if (!email) {
        res.status(404).json({ error: 'Email not found' });
        return;
      }

      res.json({ email });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/emails', async (req: Request<unknown, unknown, CreateEmailRequest>, res, next) => {
    try {
      const user = req.user as AppUser | undefined;

      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { from, recipients, subject, body, scheduledAt, delaySeconds, hourlyLimit } = req.body;

      if (!from || !recipients?.length || !subject || !body) {
        res.status(400).json({ error: 'from, recipients, subject, and body are required' });
        return;
      }

      const startAt = scheduledAt ? new Date(scheduledAt) : new Date();
      const results = [] as Array<{ id: string; queueJobId: string | null }>;

      for (let index = 0; index < recipients.length; index += 1) {
        const recipient = recipients[index]?.trim();

        if (!recipient) {
          continue;
        }

        const scheduledFor = new Date(startAt.getTime() + index * (delaySeconds ?? 0) * 1000);

        const email = await prisma.email.create({
          data: {
            from,
            to: recipient,
            subject,
            body,
            status: 'scheduled',
            scheduledAt: scheduledFor,
            userId: user.id,
            hourlyLimit: hourlyLimit ?? null,
            delaySeconds: delaySeconds ?? null,
          },
        });

        const job = await emailQueue.add(
          'send-email',
          { emailId: email.id },
          {
            jobId: email.id,
            delay: Math.max(0, scheduledFor.getTime() - Date.now()),
          },
        );

        const updated = await prisma.email.update({
          where: { id: email.id },
          data: { queueJobId: job.id ?? email.id },
        });

        await indexEmail(updated);
        results.push({ id: updated.id, queueJobId: updated.queueJobId });
      }

      res.status(201).json({ ok: true, emails: results });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/emails/:id/send-now', async (req, res, next) => {
    try {
      const user = req.user as AppUser | undefined;

      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const email = await prisma.email.findFirst({
        where: { id: req.params.id, userId: user.id },
      });

      if (!email) {
        res.status(404).json({ error: 'Email not found' });
        return;
      }

      const sent = await sendEmail({
        from: email.from,
        to: email.to,
        subject: email.subject,
        body: email.body,
      });

      const updated = await prisma.email.update({
        where: { id: email.id },
        data: {
          status: 'sent',
          sentAt: new Date(),
          sentMessageId: sent.messageId,
          errorMessage: null,
        },
      });

      await refreshEmailIndex(updated.id);
      res.json({ ok: true, email: updated, previewUrl: sent.previewUrl });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/search', async (req, res, next) => {
    try {
      const user = req.user as AppUser | undefined;

      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const query = typeof req.query.q === 'string' ? req.query.q : '';
      const emails = query ? await searchEmails(user.id, query) : [];
      res.json({ emails });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/dashboard', async (req, res, next) => {
    try {
      const user = req.user as AppUser | undefined;

      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const [scheduledCount, sentCount, failedCount, recentScheduled, recentSent] = await Promise.all([
        prisma.email.count({ where: { userId: user.id, status: 'scheduled' } }),
        prisma.email.count({ where: { userId: user.id, status: 'sent' } }),
        prisma.email.count({ where: { userId: user.id, status: 'failed' } }),
        prisma.email.findMany({
          where: { userId: user.id, status: 'scheduled' },
          orderBy: { scheduledAt: 'asc' },
          take: 8,
        }),
        prisma.email.findMany({
          where: { userId: user.id, status: 'sent' },
          orderBy: { sentAt: 'desc' },
          take: 8,
        }),
      ]);

      res.json({
        summary: {
          scheduledCount,
          sentCount,
          failedCount,
        },
        scheduled: recentScheduled,
        sent: recentSent,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/slack/connect', async (req, res, next) => {
    try {
      const user = req.user as AppUser | undefined;

      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const webhookUrl = typeof req.body?.webhookUrl === 'string' ? req.body.webhookUrl : config.slackWebhookUrl;

      await prisma.slackIntegration.upsert({
        where: { userId: user.id },
        update: {
          webhookUrl,
          accessToken: 'configured',
        },
        create: {
          userId: user.id,
          webhookUrl,
          accessToken: 'configured',
          channelId: null,
        },
      });

      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({
      error: error.message,
    });
  });

  void rehydrateScheduledEmails();

  return app;
}
