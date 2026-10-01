import nodemailer from 'nodemailer';
import { config } from './config';

export interface SentMessage {
  messageId: string;
  previewUrl: string | false | null;
}

let transporterPromise: Promise<nodemailer.Transporter> | null = null;

async function createTransporter(): Promise<nodemailer.Transporter> {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      requireTLS: process.env.SMTP_SECURE !== 'true',
      tls: {
        maxVersion: 'TLSv1.2',
      },
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  const account = await nodemailer.createTestAccount();

  return nodemailer.createTransport({
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
    requireTLS: !account.smtp.secure,
    tls: {
      maxVersion: 'TLSv1.2',
    },
    auth: {
      user: account.user,
      pass: account.pass,
    },
  });
}

async function getTransporter(): Promise<nodemailer.Transporter> {
  transporterPromise ??= createTransporter();
  return transporterPromise;
}

export async function sendEmail(params: { from: string; to: string; subject: string; body: string }): Promise<SentMessage> {
  if (config.brevoApiKey && config.brevoFrom) {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': config.brevoApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { email: config.brevoFrom },
        to: [{ email: params.to }],
        subject: params.subject,
        htmlContent: params.body,
      }),
    });

    if (!response.ok) {
      throw new Error(`Brevo API returned ${response.status}: ${await response.text()}`);
    }

    const result = await response.json() as { messageId?: string };

    return {
      messageId: result.messageId ?? `brevo-${Date.now()}`,
      previewUrl: null,
    };
  }

  if (config.resendApiKey) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.resendFrom ?? params.from,
        to: [params.to],
        subject: params.subject,
        html: params.body,
      }),
    });

    if (!response.ok) {
      throw new Error(`Resend API returned ${response.status}: ${await response.text()}`);
    }

    const result = await response.json() as { id?: string };

    return {
      messageId: result.id ?? `resend-${Date.now()}`,
      previewUrl: null,
    };
  }

  const transporter = await getTransporter();
  const result = await transporter.sendMail({
    from: params.from,
    to: params.to,
    subject: params.subject,
    html: params.body,
  });

  return {
    messageId: result.messageId,
    previewUrl: nodemailer.getTestMessageUrl(result),
  };
}
