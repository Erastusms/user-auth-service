import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '@/config/env';
import { createLogger } from './logger';

const log = createLogger('email');

// ── Singleton Transporter ─────────────────────────────────────
let _transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (_transporter) return _transporter;

  _transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth:
      env.SMTP_USER
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
        : undefined,
  });

  return _transporter;
}

// ── Base Send ─────────────────────────────────────────────────
interface SendOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(opts: SendOptions): Promise<boolean> {
  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from: `"${env.EMAIL_FROM_NAME}" <${env.EMAIL_FROM}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text ?? opts.html.replace(/<[^>]+>/g, ''),
    });

    log.info({ messageId: info.messageId, to: opts.to, subject: opts.subject }, 'Email sent');
    return true;
  } catch (err) {
    // Email failure bukan alasan untuk crash — log dan lanjut
    log.error({ err, to: opts.to, subject: opts.subject }, 'Failed to send email');
    return false;
  }
}

// ── HTML Template Helper ──────────────────────────────────────
function baseTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Auth Service</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:8px;overflow:hidden;
                    box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#1E293B;padding:24px 32px;">
            <span style="color:#fff;font-size:20px;font-weight:bold;">Auth Service</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            ${content}
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
              Email ini dikirim secara otomatis. Harap tidak membalas email ini.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function ctaButton(href: string, label: string): string {
  return `
  <div style="text-align:center;margin:24px 0;">
    <a href="${href}"
       style="display:inline-block;background:#2563EB;color:#ffffff;
              font-size:15px;font-weight:bold;padding:14px 32px;
              border-radius:6px;text-decoration:none;">
      ${label}
    </a>
  </div>
  <p style="text-align:center;font-size:12px;color:#94a3b8;">
    Atau copy link berikut ke browser:<br/>
    <a href="${href}" style="color:#2563EB;word-break:break-all;">${href}</a>
  </p>`;
}

// ── Email Templates ───────────────────────────────────────────

export async function sendVerificationEmail(
  to: string,
  displayName: string,
  token: string
): Promise<boolean> {
  const url = `${env.FRONTEND_URL}/auth/verify-email?token=${token}`;
  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:22px;">Verifikasi Email Kamu</h2>
    <p style="color:#475569;line-height:1.6;">Halo <strong>${displayName}</strong>,</p>
    <p style="color:#475569;line-height:1.6;">
      Terima kasih sudah mendaftar. Klik tombol di bawah untuk memverifikasi
      alamat email kamu. Link ini berlaku selama
      <strong>${env.EMAIL_VERIFICATION_TTL_MINUTES / 60} jam</strong>.
    </p>
    ${ctaButton(url, 'Verifikasi Email')}
    <p style="color:#94a3b8;font-size:13px;margin-top:24px;">
      Jika kamu tidak merasa mendaftar, abaikan email ini.
    </p>
  `);

  return sendEmail({
    to,
    subject: 'Verifikasi Email Akun Kamu',
    html,
  });
}

export async function sendPasswordResetEmail(
  to: string,
  displayName: string,
  token: string
): Promise<boolean> {
  const url = `${env.FRONTEND_URL}/auth/reset-password?token=${token}`;
  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:22px;">Reset Password</h2>
    <p style="color:#475569;line-height:1.6;">Halo <strong>${displayName}</strong>,</p>
    <p style="color:#475569;line-height:1.6;">
      Kami menerima permintaan reset password untuk akun ini. Klik tombol di bawah
      untuk membuat password baru. Link berlaku selama
      <strong>${env.PASSWORD_RESET_TTL_MINUTES} menit</strong>.
    </p>
    ${ctaButton(url, 'Reset Password')}
    <p style="color:#dc2626;font-size:13px;margin-top:16px;">
      ⚠️ Jika kamu tidak meminta reset password, segera amankan akun kamu dan abaikan email ini.
    </p>
  `);

  return sendEmail({
    to,
    subject: 'Reset Password Akun',
    html,
  });
}

export async function sendMagicLinkEmail(
  to: string,
  displayName: string,
  token: string
): Promise<boolean> {
  const url = `${env.FRONTEND_URL}/auth/magic-link?token=${token}`;
  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:22px;">Login Tanpa Password</h2>
    <p style="color:#475569;line-height:1.6;">Halo <strong>${displayName}</strong>,</p>
    <p style="color:#475569;line-height:1.6;">
      Klik tombol di bawah untuk langsung masuk ke akun kamu. Link ini berlaku
      selama <strong>${env.MAGIC_LINK_TTL_MINUTES} menit</strong> dan hanya bisa digunakan sekali.
    </p>
    ${ctaButton(url, 'Login Sekarang')}
    <p style="color:#94a3b8;font-size:13px;margin-top:24px;">
      Jika kamu tidak meminta magic link ini, abaikan email ini.
    </p>
  `);

  return sendEmail({
    to,
    subject: 'Link Login Kamu',
    html,
  });
}
