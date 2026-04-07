import nodemailer from 'nodemailer';
import { logger } from '#utils/index.js';

// =============================================================================
// TRANSPORTER CONFIGURATION
// =============================================================================

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const DEFAULT_FROM = process.env.SMTP_FROM || `"TekBook" <${process.env.SMTP_USER}>`;

// =============================================================================
// EMAIL TEMPLATES
// =============================================================================

function passwordResetHtml(resetUrl) {
  return `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f4f4f7">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden">
        <tr><td style="background:#ef4444;padding:24px;text-align:center">
          <h1 style="color:#ffffff;margin:0;font-size:24px">TekBook</h1>
        </td></tr>
        <tr><td style="padding:32px">
          <h2 style="margin:0 0 16px;color:#1f2937">Đặt lại mật khẩu</h2>
          <p style="color:#4b5563;line-height:1.6;margin:0 0 24px">
            Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.
            Nhấn nút bên dưới để tạo mật khẩu mới. Liên kết này sẽ hết hạn sau <strong>15 phút</strong>.
          </p>
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px">
            <tr><td style="background:#ef4444;border-radius:6px;text-align:center">
              <a href="${resetUrl}" target="_blank"
                 style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:bold;font-size:16px">
                Đặt lại mật khẩu
              </a>
            </td></tr>
          </table>
          <p style="color:#6b7280;font-size:13px;line-height:1.5;margin:0 0 16px">
            Nếu nút không hoạt động, sao chép và dán liên kết sau vào trình duyệt:
          </p>
          <p style="color:#6b7280;font-size:13px;word-break:break-all;margin:0 0 24px">
            <a href="${resetUrl}" style="color:#ef4444">${resetUrl}</a>
          </p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
          <p style="color:#9ca3af;font-size:12px;margin:0">
            Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này. Tài khoản của bạn vẫn an toàn.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// =============================================================================
// ACTIVATION ACCOUNT TEMPLATES
// =============================================================================

function accountActivationHtml(activationUrl) {
  return `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f4f4f7">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden">
        <tr><td style="background:#ef4444;padding:24px;text-align:center">
          <h1 style="color:#ffffff;margin:0;font-size:24px">TekBook</h1>
        </td></tr>
        
        <tr><td style="padding:32px">
          <h2 style="margin:0 0 16px;color:#1f2937">Chào mừng bạn đến với TekBook!</h2>
          <p style="color:#4b5563;line-height:1.6;margin:0 0 24px">
            Cảm ơn bạn đã đăng ký tài khoản. Để hoàn tất quá trình đăng ký và bắt đầu khám phá kho tàng tri thức tại TekBook, vui lòng nhấn nút bên dưới để kích hoạt tài khoản của bạn.
          </p>
          
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px">
            <tr><td style="background:#ef4444;border-radius:6px;text-align:center">
              <a href="${activationUrl}" target="_blank"
                 style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:bold;font-size:16px">
                Kích hoạt tài khoản
              </a>
            </td></tr>
          </table>
          
          <p style="color:#4b5563;line-height:1.6;margin:0 0 16px">
            Lưu ý: Liên kết này sẽ hết hạn sau <strong>24 giờ</strong>. Sau thời gian này, bạn sẽ cần yêu cầu mã kích hoạt mới.
          </p>

          <p style="color:#6b7280;font-size:13px;line-height:1.5;margin:0 0 16px">
            Nếu nút không hoạt động, sao chép và dán liên kết sau vào trình duyệt:
          </p>
          <p style="color:#6b7280;font-size:13px;word-break:break-all;margin:0 0 24px">
            <a href="${activationUrl}" style="color:#ef4444">${activationUrl}</a>
          </p>
          
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
          
          <p style="color:#9ca3af;font-size:12px;margin:0">
            Nếu bạn không đăng ký tài khoản trên TekBook, vui lòng bỏ qua email này. Không ai có thể sử dụng email của bạn để đăng ký khi chưa có sự xác nhận từ bạn.
          </p>
        </td></tr>
      </table>
      
      <p style="color:#9ca3af;font-size:12px;margin-top:20px;text-align:center">
        &copy; 2026 TekBook System. Đã đăng ký bản quyền.
      </p>
    </td></tr>
  </table>
</body>
</html>`;
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Send a password-reset email containing a one-time link.
 *
 * @param {string} toEmail - Recipient address
 * @param {string} resetUrl - Full URL the user should visit to reset their password
 */
export async function sendPasswordResetEmail(toEmail, resetUrl) {
  const mailOptions = {
    from: DEFAULT_FROM,
    to: toEmail,
    subject: 'Đặt lại mật khẩu — TekBook',
    html: passwordResetHtml(resetUrl),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info('Password reset email sent', { to: toEmail, messageId: info.messageId });
  } catch (error) {
    logger.error('Failed to send password reset email', { to: toEmail, error: error.message });
    throw new Error('Không thể gửi email đặt lại mật khẩu');
  }
}

/**
 * Send an account activation email containing a one-time link.
 *
 * @param {string} toEmail - Recipient address
 * @param {string} activationUrl - Full URL the user should visit to activate their account
 */
export async function sendAccountActivationEmail(toEmail, activationUrl) {
  const mailOptions = {
    from: DEFAULT_FROM,
    to: toEmail,
    subject: 'Kích hoạt tài khoản — TekBook',
    html: accountActivationHtml(activationUrl),
  };
  try{
    const info = await transporter.sendMail(mailOptions);
    logger.info('Account activation email sent', { to: toEmail, messageId: info.messageId });
  } catch (error) {
    logger.error('Failed to send account activation email', { to: toEmail, error: error.message });
    throw new Error('Không thể gửi email kích hoạt tài khoản');
  }
}