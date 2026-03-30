# 📧 Email Service Setup Guide

How to configure the email service for password reset functionality.

---

## ✅ Supported Email Providers

- **Gmail** (with app password) - Free ✓
- **Outlook/Office 365** - Free ✓
- **Custom SMTP Server** - Any provider
- **Resend API** - Modern email service (optional)
- **SendGrid** - Transactional email service (optional)

This guide uses **Gmail** as it's free and most accessible.

---

## 🔧 Gmail Setup (Recommended)

### Step 1: Enable 2-Factor Authentication

1. Go to [myaccount.google.com/security](https://myaccount.google.com/security)
2. Click **Security** in left menu
3. Find **2-Step Verification**
4. Click **Get Started**
5. Follow the steps to verify your phone

### Step 2: Generate App Password

1. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. If prompted, sign in to your Google account
3. Select:
   - **App**: Mail
   - **Device**: Windows Computer (or your OS)
4. Click **Generate**
5. Google shows a 16-character password in yellow box
   - **Copy this password** (you'll need it next)

### Step 3: Add to .env File

```bash
# Navigate to backend directory
cd book-recommendation-system-backend

# Open and edit .env file
# Add these lines:

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx     # 16-char app password from Step 2
SMTP_FROM="TekBook <your-email@gmail.com>"
SMTP_TLS=true

FRONTEND_URL=http://localhost:5173
API_BASE_URL=http://localhost:8080/api/v1
```

### Step 4: Test Email Connection

```bash
# From backend directory
npm run dev

# In another terminal, run:
node tests/forgotPassword.test.js

# Check for email sending errors in logs
```

---

## 🔌 Other SMTP Providers

### Outlook/Office 365

```bash
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
SMTP_FROM="TekBook <your-email@outlook.com>"
SMTP_TLS=true
```

### Custom SMTP Server

```bash
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587              # or 25, 465, etc.
SMTP_USER=admin@yourdomain.com
SMTP_PASS=your-smtp-password
SMTP_FROM="TekBook <noreply@yourdomain.com>"
SMTP_TLS=true              # Use TLS (usually true for port 587)
```

### Amazon SES

```bash
SMTP_HOST=email-smtp.{REGION}.amazonaws.com
SMTP_PORT=587
SMTP_USER=AKIA...           # Your AWS SMTP username
SMTP_PASS=your-aws-password
SMTP_FROM="TekBook <your-email@yourdomain.com>"
SMTP_TLS=true
```

---

## 🧪 Verify Email Configuration

### Option 1: Using Test Script

```bash
cd book-recommendation-system-backend
node tests/forgotPassword.test.js
```

### Option 2: Using Postman

1. Import `tests/ForgotPassword.postman_collection.json` to Postman
2. Run: "1. Setup - Create Test User" → Should return 201
3. Run: "2. Forgot Password - Valid Email" → Should return 200
4. Check email inbox for password reset link

### Option 3: Manual API Test

```bash
# Create test user
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!",
    "confirmPassword": "TestPass123!",
    "username": "testuser",
    "fullName": "Test User",
    "phoneNumber": "0901234567"
  }'

# Request password reset
curl -X POST http://localhost:8080/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'

# Check your email inbox for the reset link
```

---

## 🐛 Troubleshooting Email

### Email Not Sending

**Check Logs:**
```bash
# Look for these messages in backend console:
"Password reset token generated"
"Sending password reset email to: test@example.com"

# If you see error like:
"Error sending password reset email: connect ECONNREFUSED"
# → SMTP_HOST or SMTP_PORT is wrong

# If you see:
"Invalid login"
# → SMTP_USER or SMTP_PASS is incorrect
```

**Test SMTP Connection:**
```bash
# For Gmail:
telnet smtp.gmail.com 587

# For Outlook:
telnet smtp.office365.com 587

# Should show: "220 ..."
# Type: QUIT
```

**Gmail-Specific Issues:**

| Error | Solution |
|-------|----------|
| "Invalid login" | App password incorrect or 2FA not enabled |
| "Authentication failed" | Generate new app password |
| "Less secure apps blocked" | Gmail blocks basic auth - use app password |
| "Account has been locked" | Wait 24h, then enable 2FA |

### Email Goes to Spam

**Fix for Gmail:**
1. Check spam folder
2. Mark as "Not spam"
3. Gmail will learn to deliver future emails

**Fix for Custom Domain:**
1. Add SPF record: `v=spf1 include:smtp.gmail.com ~all`
2. Add DKIM record: Follow your mail provider's instructions
3. Add DMARC record: `v=DMARC1; p=none; rua=mailto:admin@yourdomain.com`

### Email HTML Template Not Showing

**Check:**
```bash
# Backend logs should say:
"sent successfully"

# If HTML not rendering:
# - Your email client doesn't support HTML
# - Template has syntax errors
# - Check emailService.js template formatting
```

---

## 📧 Email Template Customization

Edit reset link styling in `app/services/emailService.js`:

```javascript
export async function sendPasswordResetEmail(toEmail, resetUrl) {
  // ... existing code ...

  // Customize this HTML:
  const html = `
    <div style="...">
      <h1>Reset Your Password</h1>
      <p>Click the button below:</p>
      <a href="${resetUrl}">Reset Password</a>
      <!-- Add your custom styling here -->
    </div>
  `;

  // ...
}
```

---

## 🔐 Security Best Practices

### ✓ DO:
- [ ] Use app password for Gmail (not main password)
- [ ] Store SMTP credentials in `.env` (never in code)
- [ ] Use TLS/SSL for SMTP connection
- [ ] Set token expiry to 15 minutes
- [ ] Hash tokens in database (SHA-256)
- [ ] Rate limit forgot-password (3 per 15 min)

### ✗ DON'T:
- [ ] Don't commit `.env` to version control
- [ ] Don't log raw tokens
- [ ] Don't use plaintext SMTP (always TLS)
- [ ] Don't make reset links valid forever
- [ ] Don't send tokens in response body
- [ ] Don't reveal whether email exists

---

## 🚀 Production Deployment

### Before Going Live:

1. **Use HTTPS:**
   ```bash
   API_BASE_URL=https://api.yourdomain.com/api/v1
   FRONTEND_URL=https://yourdomain.com
   ```

2. **Use Production Email Service:**
   - Gmail: OK for small volume (~100/day)
   - For 1000+ emails/day: Use SendGrid, AWS SES, or Resend

3. **Set NODE_ENV:**
   ```bash
   NODE_ENV=production
   ```

4. **Verify Email Address Ownership:**
   - Most SMTP providers require verification
   - Complete email verification in your email provider dashboard

5. **Monitor Email Logs:**
   ```bash
   # Add email logging:
   logger.info('Email sent', { to: email, timestamp: new Date() });
   ```

6. **Setup Email Bounce Handling:**
   - Invalid emails should be marked
   - Bounce notifications should be logged

---

## 📞 Support

### Email Delivery Verification Services
- **Mailtr​ap**: Test emails without sending (free tier)
- **MailHog**: Local SMTP testing server
- **SendGrid Sandbox**: SendGrid free testing

### Resources
- [Gmail App Passwords Help](https://support.google.com/accounts/answer/185833)
- [SMTP Configuration Guide](https://nodemailer.com/smtp/)
- [Email Best Practices](https://nodemailer.com/smtp/well-known/)
