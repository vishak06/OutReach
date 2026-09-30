import nodemailer from 'nodemailer';

export interface SentMessage {
  messageId: string;
  previewUrl: string | false | null;
}

let transporterPromise: Promise<nodemailer.Transporter> | null = null;

async function createTransporter(): Promise<nodemailer.Transporter> {
  const smtpUser = process.env.SMTP_USER ?? process.env.ETHEREAL_USER;
  const smtpPass = process.env.SMTP_PASS ?? process.env.ETHEREAL_PASS;

  if (process.env.SMTP_HOST && smtpUser && smtpPass) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
  }

  const account = await nodemailer.createTestAccount();

  return nodemailer.createTransport({
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
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
