import { Resend } from 'resend';
import { env } from './env';

let client: Resend | null = null;
function getClient(): Resend | null {
  if (!env.resendApiKey) return null;
  if (!client) client = new Resend(env.resendApiKey);
  return client;
}

export interface ResetEmailArgs {
  to: string;
  resetUrl: string;
  expiresInMinutes?: number;
}

export async function sendPasswordResetEmail(args: ResetEmailArgs): Promise<{ delivered: boolean; error?: string }> {
  const resend = getClient();
  if (!resend) {
    console.warn('[mailer] RESEND_API_KEY not set — skipping email for', args.to);
    return { delivered: false, error: 'RESEND_NOT_CONFIGURED' };
  }

  const minutes = args.expiresInMinutes ?? 15;
  const { to, resetUrl } = args;

  const html = `<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#09090b;color:#e5e5e5;margin:0;padding:40px 16px;">
  <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#111113;border:1px solid #1f1f22;border-radius:16px;padding:32px;">
    <tr><td>
      <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;color:#10b981;">// studysnap</div>
      <h1 style="margin:12px 0 8px;font-size:22px;color:#fff;">Reset your password</h1>
      <p style="margin:0 0 20px;color:#a3a3a3;font-size:14px;line-height:1.6;">
        You (or someone) requested a password reset for your StudySnap account. This link is valid for ${minutes} minutes.
      </p>
      <a href="${resetUrl}" style="display:inline-block;background:#10b981;color:#09090b;font-weight:600;padding:12px 22px;border-radius:10px;text-decoration:none;font-size:14px;">Reset password</a>
      <p style="margin:24px 0 0;color:#737373;font-size:12px;line-height:1.6;">
        If you didn't request this, ignore this email — your password won't change.
      </p>
      <p style="margin:16px 0 0;color:#404040;font-size:11px;word-break:break-all;">
        Or paste this URL: ${resetUrl}
      </p>
    </td></tr>
  </table>
</body></html>`;

  const text = `Reset your StudySnap password

This link is valid for ${minutes} minutes:
${resetUrl}

If you didn't request this, ignore this email.`;

  try {
    const { error } = await resend.emails.send({
      from: env.resendFrom,
      to,
      subject: 'Reset your StudySnap password',
      html,
      text,
    });
    if (error) {
      console.error('[mailer] Resend error:', error);
      return { delivered: false, error: error.message ?? 'RESEND_ERROR' };
    }
    return { delivered: true };
  } catch (err: any) {
    console.error('[mailer] send failed:', err);
    return { delivered: false, error: err?.message ?? 'SEND_FAILED' };
  }
}
