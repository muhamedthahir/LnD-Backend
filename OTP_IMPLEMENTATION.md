# OTP Email Verification Implementation

## Overview
This implementation adds OTP (One-Time Password) email verification for newly created users. When a user is created (individually or in bulk), they receive an OTP via email that is valid for 7 days. They use this OTP to set their password on first login.

## Changes Made

### 1. Database Schema
- Added `otp` field (VARCHAR(10)) to store the OTP
- Added `otp_expires_at` (TIMESTAMP) to track expiration
- Added `password_set` (BOOLEAN) to track if password has been set
- Made `password` field nullable (users can exist without password initially)

**Migration File**: `database/migration_add_otp.sql`

### 2. Backend Changes

#### New Files:
- `utils/otpGenerator.js` - Generates 6-digit OTP and expiration date
- `utils/emailService.js` - Handles email sending via nodemailer

#### Updated Files:
- `models/User.js` - Added `findByOTP()` and `setPassword()` methods
- `controllers/adminController.js` - Updated to generate and send OTP on user creation
- `controllers/groupController.js` - Updated bulk user creation to use OTP
- `controllers/authController.js` - Added `setPassword()` endpoint
- `config/passport.js` - Updated to handle OTP login
- `routes/authRoutes.js` - Added `/set-password` route
- `app.js` - Fixed CORS configuration

### 3. Frontend Changes

#### New Files:
- `components/PasswordSetup.jsx` - Modal for setting password after OTP verification
- `components/PasswordSetup.css` - Styles for password setup modal

#### Updated Files:
- `pages/Login.jsx` - Updated to handle OTP login and password setup flow

## User Flow

1. **Admin creates user** → OTP generated and sent via email
2. **User receives email** → Contains 6-digit OTP valid for 7 days
3. **User logs in** → Enters email and OTP in password field
4. **System verifies OTP** → If valid, shows password setup modal
5. **User sets password** → Creates new password
6. **User logs in again** → Uses email and new password

## Email Configuration

See `EMAIL_SETUP.md` for email configuration options. The system supports:
- Gmail (with app password)
- Custom SMTP
- Ethereal Email (automatic in development)

If email is not configured, OTPs are logged to console in development mode.

## API Endpoints

### POST `/api/auth/set-password`
Sets password after OTP verification.

**Request Body:**
```json
{
  "userId": 1,
  "otp": "123456",
  "newPassword": "newpassword123"
}
```

## Testing

1. Create a user via admin panel
2. Check console/logs for OTP (if email not configured)
3. Login with email and OTP
4. Set password in the modal
5. Login again with email and new password

## Notes

- OTPs expire after 7 days
- Users cannot login with password until OTP is verified and password is set
- In development mode, OTPs are always logged to console for testing

