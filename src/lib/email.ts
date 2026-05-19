/**
 * Minimal Resend wrapper.
 *
 * We already use Resend for Auth.js magic links; this is the same key reused
 * for application email (heirloom unlock invitations, weekly digest).
 *
 * Uses fetch against the REST API directly so we don't ship the full SDK to
 * the edge bundle.
 */

const API = "https://api.resend.com/emails";

function key(): string {
  const k = process.env.AUTH_RESEND_KEY;
  if (!k) throw new Error("AUTH_RESEND_KEY not set");
  return k;
}

function from(): string {
  return process.env.EMAIL_FROM ?? "onboarding@resend.dev";
}

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}): Promise<void> {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: from(),
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      reply_to: opts.replyTo,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend ${res.status}: ${body}`);
  }
}

/**
 * Wrap content in the tranquil email template. Soft palette, serif body,
 * works in all email clients.
 */
export function emailLayout(opts: {
  preheader?: string;
  body: string;
}): string {
  const preheader = opts.preheader ?? "";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>A Tranquil Space</title>
    <style>
      body { margin: 0; padding: 0; background: #FAF7F2; }
      .preheader { display:none; font-size:1px; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden; }
    </style>
  </head>
  <body>
    <span class="preheader">${escape(preheader)}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F2;padding:32px 0;">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#F2EDE4;border-radius:20px;padding:36px 32px;font-family:Georgia,serif;color:#2C2825;">
          <tr><td>
            <p style="font-family:Georgia,serif;font-size:14px;letter-spacing:0.18em;text-transform:uppercase;color:#A39E95;margin:0 0 24px 0;">A Tranquil Space</p>
            ${opts.body}
            <p style="margin:36px 0 0 0;color:#A39E95;font-size:12px;font-family:Helvetica,Arial,sans-serif;letter-spacing:0.05em;">
              Sent from your quiet place to think.
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
