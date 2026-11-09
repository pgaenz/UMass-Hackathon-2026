import { createTransport, type Transporter } from "nodemailer";

/**
 * Email delivery (plan D6).
 *
 * Development/test: when no SMTP server is configured the message is printed to
 * the server console so reset/verification links are reachable without a
 * provider. Production: an unconfigured SMTP server is an error — we must not
 * pretend a password-reset email was sent.
 *
 * Any SMTP provider works (Resend, SendGrid, Postmark, …); see `.env.example`.
 */

interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

let cached: Transporter | null = null;

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

function getTransport(): Transporter {
  if (!cached) {
    cached = createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    });
  }
  return cached;
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  if (!smtpConfigured()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Cannot send email in production: set SMTP_HOST and SMTP_FROM (and SMTP_USER/SMTP_PASSWORD if required).",
      );
    }
    console.log(
      `\n[email] To: ${message.to}\n[email] Subject: ${message.subject}\n${message.text}\n`,
    );
    return;
  }

  await getTransport().sendMail({
    from: process.env.SMTP_FROM,
    to: message.to,
    subject: message.subject,
    text: message.text,
  });
}
