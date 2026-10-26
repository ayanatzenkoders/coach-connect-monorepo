/** The wording and look of the emails we send. Plain text first (always works), HTML for nice clients. */

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export interface CodeEmailInput {
  /** e.g. "verification" or "password reset". Used as: "Your {label} code is 123456". */
  label: string;
  heading: string;
  intro: string;
  code: string;
  minutes: number;
  footer: string;
  /** Small tag above the heading, e.g. "Email verification". */
  tag?: string;
  /** Accent colour of the tag and the code box (hex pair: text, background). */
  accent?: { text: string; bg: string };
}

export function codeEmail({ label, heading, intro, code, minutes, footer, tag, accent = { text: '#174a3d', bg: '#e3ede8' } }: CodeEmailInput): { text: string; html: string } {
  // The text version contains the code exactly once, as "<label> code is 123456".
  const text = `${heading}\n\n${intro}\n\nYour ${label} code is ${code}\nIt expires in ${minutes} minutes.\n\n${footer}\n\nCoach Connect`;
  const html = `<!doctype html>
<html lang="en"><body style="margin:0;padding:24px;background:#f3f4f1;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#141a17">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
    <table role="presentation" width="480" cellspacing="0" cellpadding="0" style="max-width:480px;background:#ffffff;border:1px solid #dde0d9;border-radius:16px">
      <tr><td style="padding:28px 28px 8px;font-size:18px;font-weight:700;color:#1d5c4c">Coach Connect</td></tr>
      ${tag ? `<tr><td style="padding:4px 28px 0;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${accent.text}">${escape(tag)}</td></tr>` : ''}
      <tr><td style="padding:8px 28px 0;font-size:22px;font-weight:600">${escape(heading)}</td></tr>
      <tr><td style="padding:8px 28px 0;font-size:15px;line-height:22px;color:#464e49">${escape(intro)}</td></tr>
      <tr><td align="center" style="padding:24px 28px">
        <div style="display:inline-block;padding:14px 24px;background:${accent.bg};border-radius:12px;font-size:32px;font-weight:700;letter-spacing:8px;color:${accent.text}">${escape(code)}</div>
      </td></tr>
      <tr><td style="padding:0 28px;font-size:14px;color:#464e49">This code expires in ${minutes} minutes.</td></tr>
      <tr><td style="padding:16px 28px 28px;font-size:13px;line-height:20px;color:#646b66">${escape(footer)}</td></tr>
    </table>
  </td></tr></table>
</body></html>`;
  return { text, html };
}

/** Sent after sign-up (and on "Resend"): proves the address is real. */
export function verifyEmailEmail(code: string, minutes: number) {
  return {
    subject: 'Your Coach Connect verification code',
    ...codeEmail({
      label: 'verification',
      tag: 'Email verification',
      heading: 'Verify your email',
      intro: 'Welcome to Coach Connect! Enter this code in the app to confirm your email address and finish setting up your account.',
      code,
      minutes,
      footer: 'If you did not create a Coach Connect account, you can ignore this email.',
    }),
  };
}

/** Sent by "Forgot password". Amber accent so it is easy to tell apart from the verification email. */
export function passwordResetEmail(code: string, minutes: number) {
  return {
    subject: 'Reset your Coach Connect password',
    ...codeEmail({
      label: 'password reset',
      tag: 'Password reset',
      heading: 'Reset your password',
      intro: 'We received a request to reset your password. Enter this code in the app, then choose a new one.',
      code,
      minutes,
      footer: 'If you did not ask to reset your password, ignore this email: nothing changes. Never share this code with anyone.',
      accent: { text: '#8a4b08', bg: '#fbefdc' },
    }),
  };
}
