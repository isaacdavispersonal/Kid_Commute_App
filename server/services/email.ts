import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
const APP_NAME = "Kid Commute";

export async function sendPasswordResetEmail(
  to: string,
  resetToken: string,
  resetUrl: string
): Promise<{ success: boolean; error?: string }> {
  if (!resend) {
    console.log("[email] Resend not configured - RESEND_API_KEY missing");
    console.log(`[email] Would send password reset to: ${to}`);
    console.log(`[email] Reset URL: ${resetUrl}`);
    return { success: false, error: "Email service not configured" };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject: `Reset Your ${APP_NAME} Password`,
      html: getPasswordResetEmailHtml(resetUrl),
      text: getPasswordResetEmailText(resetUrl),
    });

    if (error) {
      console.error("[email] Resend error:", error);
      return { success: false, error: error.message };
    }

    console.log(`[email] Password reset email sent to ${to}, id: ${data?.id}`);
    return { success: true };
  } catch (error) {
    console.error("[email] Failed to send email:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

function getPasswordResetEmailHtml(resetUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 480px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 40px 20px;">
              <h1 style="margin: 0 0 24px; font-size: 24px; font-weight: 600; color: #18181b; text-align: center;">
                Reset Your Password
              </h1>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 24px; color: #3f3f46;">
                We received a request to reset your ${APP_NAME} password. Click the button below to choose a new password.
              </p>
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 16px 0;">
                    <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; font-size: 16px; font-weight: 600; color: #ffffff; background-color: #2563eb; text-decoration: none; border-radius: 6px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 24px 0 0; font-size: 14px; line-height: 20px; color: #71717a;">
                This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; font-size: 12px; line-height: 18px; color: #a1a1aa; text-align: center;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${resetUrl}" style="color: #2563eb; text-decoration: underline; word-break: break-all;">${resetUrl}</a>
              </p>
            </td>
          </tr>
        </table>
        <p style="margin: 24px 0 0; font-size: 12px; color: #a1a1aa; text-align: center;">
          ${APP_NAME} Transportation Services
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function getPasswordResetEmailText(resetUrl: string): string {
  return `
Reset Your ${APP_NAME} Password

We received a request to reset your password. Visit the link below to choose a new password:

${resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email.

---
${APP_NAME} Transportation Services
  `.trim();
}
