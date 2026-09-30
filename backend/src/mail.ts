import nodemailer from 'nodemailer';

export interface SentMessage {
  messageId: string;
  previewUrl: string | false | null;
}

async function sendWithResend(params: { from: string; to: string; subject: string; body: string }): Promise<SentMessage> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM ?? params.from,
      to: [params.to],
      subject: params.subject,
      html: params.body,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend request failed (${response.status}): ${error}`);
  }

  const result = await response.json() as { id: string };

  return {
    messageId: result.id,
    previewUrl: null,
  };
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
  if (process.env.RESEND_API_KEY) {
    return sendWithResend(params);
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
