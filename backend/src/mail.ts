import nodemailer from 'nodemailer';

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
