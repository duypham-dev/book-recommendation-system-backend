# 📋 Forgot Password Feature - Implementation Documentation

Complete documentation of the password reset feature implementation.

---

## 🎯 Overview

A production-ready "Forgot Password" feature implementing:
- Secure token generation (SHA-256 hashing)
- Email delivery via SMTP (Nodemailer)
- 15-minute token expiry
- Rate limiting (3 requests / 15 min per IP)
- Anti-enumeration security
- One-time use tokens

---

## 🏗️ Architecture

```
User Flow:
┌─────────────────────┐
│   Frontend Modal    │  "Quên mật khẩu?" button
├─────────────────────┤
│  Enter Email        │
└────────┬────────────┘
         │ POST /forgot-password
         ▼
┌─────────────────────┐
│  Backend - Check    │  Find user by email
│  User Exists        │  Generate token (32 bytes)
│  Generate Token     │  Hash token (SHA-256)
└────────┬────────────┘
         │ Store: reset_password_token, reset_password_token_expiry
         │ Send: Email with reset link
         │
         ▼
┌─────────────────────┐
│  Email Service      │  Nodemailer SMTP
│  HTML Template      │  Styled reset link
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  User's Email       │  Click reset link
│  Reset Link         │  /reset-password?token=...
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Frontend Page      │  New password form
│  /reset-password    │  Password strength validation
└────────┬────────────┘
         │ POST /reset-password { token, newPassword }
         ▼
┌─────────────────────┐
│  Backend - Verify   │  Hash token, find in DB
│  Token & Reset      │  Check expiry (15 min)
│  Password           │  Hash new password (bcrypt)
└────────┬────────────┘
         │ Update: password, clear token fields
         │ Return: 200 Success
         ▼
┌─────────────────────┐
│  Success Page       │  "Password reset!"
│  Redirect to Login  │  User can login
└─────────────────────┘
```

---

## 📁 Files Modified/Created

### Backend

#### Created (3 files)

**1. `app/services/emailService.js`**
- Nodemailer transporter configuration
- `sendPasswordResetEmail(toEmail, resetUrl)` function
- HTML email template with reset link
- Error handling and logging

```javascript
// Key exports:
export async function sendPasswordResetEmail(toEmail, resetUrl)
```

**2. `app/services/passwordResetService.js`**
- `generateResetToken()` - Cryptographically secure random token
- `hashToken(token)` - SHA-256 hash for database storage
- `requestPasswordReset(email)` - Find user, generate token, send email
- `resetPassword(plainToken, newPassword)` - Verify, hash, update

```javascript
// Key exports:
export async function requestPasswordReset(email)
export async function resetPassword(plainToken, newPassword)
```

**3. `app/controllers/Auth/PasswordResetController.js`**
- `forgotPassword(req, res)` - Handle forgot password requests
- `resetPasswordHandler(req, res)` - Handle password reset

```javascript
// Key exports:
export const forgotPassword
export const resetPasswordHandler
```

#### Modified (3 files)

**1. `app/middlewares/rateLimit.middleware.js`**
- Added `forgotPasswordRateLimit` (3 per 15 min per IP)

```javascript
// New export:
export const forgotPasswordRateLimit
```

**2. `app/routes/authRoute.js`**
- Added route: `POST /auth/forgot-password`
- Added route: `POST /auth/reset-password`

```javascript
router.post("/auth/forgot-password",
  forgotPasswordRateLimit,
  validate(forgotPasswordValidationSchema),
  forgotPassword
);
router.post("/auth/reset-password",
  validate(resetPasswordValidationSchema),
  resetPasswordHandler
);
```

**3. `package.json`**
- Added dependency: `nodemailer@^8.0.2`

### Frontend

#### Created (1 file)

**1. `src/pages/Auth/ResetPassword.jsx`**
- Full page component for password reset
- Reads `?token=` from URL
- Password input with show/hide toggle
- Client-side validation
- Success/error/invalid-token states

```javascript
// Props: None
// Reads: useSearchParams() for token
// Uses: useMessage hook, API call
```

#### Modified (4 files)

**1. `src/components/auth/ForgotPassword.jsx`**
- Completely rewritten from stub
- Email input field
- API integration
- Loading, success, error states
- Generic error messages (anti-enumeration)

**2. `src/services/authService.js`**
- Updated `resetPassword` function signature:
  ```javascript
  export const resetPassword = async (token, newPassword, confirmPassword)
  ```

**3. `src/constants/routePaths.js`**
- Added: `RESET_PASSWORD: "/reset-password"`

**4. `src/App.jsx`**
- Added import: `import ResetPassword from "./pages/Auth/ResetPassword.jsx"`
- Added route: `<Route path={PATHS.RESET_PASSWORD} element={<ResetPassword />} />`

**5. `src/utils/validatorInput.js`**
- Added: `validateResetPassword(form)` function

---

## 🔐 Security Implementation

### 1. Token Generation & Storage

```javascript
// Generate: 32 random bytes = 256-bit entropy
const plainToken = crypto.randomBytes(32).toString('hex');

// Store in DB: SHA-256 hash (64-char hex string)
const hashedToken = crypto.createHash('sha256')
  .update(plainToken)
  .digest('hex');

// Send to user: plainToken only (never hashed version)
const resetUrl = `${FRONTEND_URL}/reset-password?token=${plainToken}`;
```

**Why**: Even if database is compromised, attacker cannot use hashed tokens.

### 2. Token Verification

```javascript
// User has: plainToken from email link
// Database has: hashedToken

// Verify by hashing user's token and comparing:
const hashedUserToken = hashToken(plainToken);
const user = await db.findUser({ reset_password_token: hashedUserToken });
```

### 3. Token Expiry

```javascript
// Set expiry when generating:
const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
await db.updateUser({ reset_password_token_expiry: expiry });

// Verify when resetting:
const user = await db.findUser({
  reset_password_token: hashedToken,
  reset_password_token_expiry: { gt: new Date() } // Not expired
});
if (!user) throw Error('Token invalid or expired');
```

### 4. One-Time Use

```javascript
// After successful reset:
await db.updateUser({
  password: hashedNewPassword,
  reset_password_token: null,  // CRUCIAL: Clear token
  reset_password_token_expiry: null
});
// Token now unusable for future reset attempts
```

### 5. Anti-Enumeration

```javascript
// Both email exists and doesn't exist return same response:
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    await requestPasswordReset(email); // Silently fails if email not found
    return ApiResponse.success(res, null,
      'Nếu email tồn tại, chúng tôi đã gửi...'
    );
  } catch (error) {
    // Still return same 200 response
    return ApiResponse.success(res, null,
      'Nếu email tồn tại, chúng tôi đã gửi...'
    );
  }
};
```

### 6. Rate Limiting

```javascript
export const forgotPasswordRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // 3 requests per window
  keyGenerator: (req) => `forgot_${ipKeyGenerator(req)}`,
  // Returns 429 on 4th+ request
});
```

### 7. Password Hashing

```javascript
// Uses bcrypt with 12 salt rounds (pre-existing utility)
const hashedPassword = await hashPassword(newPassword);
// Password is work-factor resistant to brute force
```

### 8. HTTPS Enforcement (Production)

```javascript
// In production, SMTP uses TLS
SMTP_TLS=true  // Port 587 with STARTTLS
// And frontend must be HTTPS for reset links
FRONTEND_URL=https://yourdomain.com
```

---

## 📊 Database Schema

```sql
-- Users table (partial - existing)
CREATE TABLE users (
  user_id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  reset_password_token VARCHAR(64), -- SHA-256 hash (64 chars)
  reset_password_token_expiry TIMESTAMP,
  is_ban BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_reset_password_token
  ON users(reset_password_token, reset_password_token_expiry);
```

---

## 🔄 State Management (Frontend)

### ForgotPassword Modal State
```javascript
const [email, setEmail] = useState('');
const [loading, setLoading] = useState(false);
const [success, setSuccess] = useState(false);
const [error, setError] = useState('');
```

### ResetPassword Page State
```javascript
const [formData, setFormData] = useState({
  newPassword: '',
  confirmPassword: ''
});
const [showPassword, setShowPassword] = useState(false);
const [showConfirmPassword, setShowConfirmPassword] = useState(false);
const [loading, setLoading] = useState(false);
const [success, setSuccess] = useState(false);
```

---

## 🧪 API Endpoints

### POST `/auth/forgot-password`

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Nếu email tồn tại trong hệ thống..."
}
```

**Errors:**
- `400` - Invalid email format
- `422` - Validation failed
- `429` - Rate limit exceeded

### POST `/auth/reset-password`

**Request:**
```json
{
  "token": "abc123def456...",
  "newPassword": "NewPass123!",
  "confirmPassword": "NewPass123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Mật khẩu đã được đặt lại thành công"
}
```

**Errors:**
- `400` - Invalid/expired token
- `400` - Password mismatch
- `400` - Weak password
- `422` - Validation failed

---

## 📝 Validation Rules

### Email (Joi)
```javascript
Joi.string()
  .trim()
  .lowercase()
  .pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)
  .required()
```

### New Password (Joi)
```javascript
Joi.string()
  .min(8)
  .max(128)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/)
  .required()
```

### Confirm Password (Joi)
```javascript
Joi.string()
  .valid(Joi.ref('newPassword'))
  .required()
```

---

## 📧 Email Configuration

### Environment Variables
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=app-password-16-chars
SMTP_FROM="TekBook <noreply@tekbook.com>"
SMTP_TLS=true
```

### Email Template (HTML)
- Styled reset button with link
- Expiry information (15 minutes)
- Branding with app name
- Fallback plaintext link

---

## 🚀 Performance Considerations

### Database Indexes
```sql
-- Speed up token lookups during reset
CREATE INDEX idx_reset_password_token_expiry
  ON users(reset_password_token, reset_password_token_expiry);
```

### Email Queueing (Optional)
Consider using a job queue (Bull, RabbitMQ) for large volumes to avoid blocking requests.

### Rate Limiting
- Uses in-memory store by default
- For distributed systems, use Redis store

---

## 📚 Dependencies

**New:**
- `nodemailer@^8.0.2` - SMTP email sending

**Existing (Reused):**
- `jsonwebtoken` - Token utilities
- `bcrypt` - Password hashing
- `joi` - Validation
- `express-rate-limit` - Rate limiting
- `prisma` - Database ORM
- `crypto` - Token generation

---

## 🔍 Testing Coverage

See [TESTING_GUIDE.md](./tests/TESTING_GUIDE.md) for comprehensive test suite covering:
- ✓ Valid email forgot-password
- ✓ Non-existent email (anti-enumeration)
- ✓ Invalid email format
- ✓ Rate limiting (3 per 15 min)
- ✓ Valid token reset
- ✓ Invalid token
- ✓ Password mismatch
- ✓ Weak password
- ✓ Token expiry
- ✓ Token one-time use
- ✓ Frontend routing
- ✓ Email delivery

---

## 📋 Checklist

### Backend Implementation
- [x] Email service (emailService.js)
- [x] Password reset service (passwordResetService.js)
- [x] Password reset controller (PasswordResetController.js)
- [x] Rate limiting middleware
- [x] API routes
- [x] Validation schemas
- [x] Error handling
- [x] Logging

### Frontend Implementation
- [x] ForgotPassword modal component
- [x] ResetPassword page component
- [x] Auth service integration
- [x] Routes configuration
- [x] Client-side validation
- [x] Message notifications
- [x] Loading/success/error states

### Security
- [x] Token generation (32 bytes)
- [x] Token hashing (SHA-256)
- [x] Token expiry (15 min)
- [x] One-time use (cleared after reset)
- [x] Anti-enumeration
- [x] Rate limiting
- [x] Password strength requirements
- [x] HTTPS ready

### Documentation
- [x] Implementation guide (this file)
- [x] Testing guide
- [x] Email setup guide
- [x] Quick start guide

---

## 🎓 Learning Resources

- **OWASP Forgot Password**: https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
- **Nodemailer Docs**: https://nodemailer.com/
- **JWT Best Practices**: https://tools.ietf.org/html/rfc8725
- **NIST Password Guidelines**: https://pages.nist.gov/800-63-3/sp800-63b.html

---

## 📞 Troubleshooting

See [EMAIL_SETUP.md](../EMAIL_SETUP.md#troubleshooting-email) for email issues.
See [tests/TESTING_GUIDE.md](./tests/TESTING_GUIDE.md#troubleshooting) for testing issues.
