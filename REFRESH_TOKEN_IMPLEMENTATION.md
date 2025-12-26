# Refresh Token Implementation

This document describes the refresh token implementation with "Remember Me" functionality.

## Overview

The application now uses a dual-token system:
- **Access Token**: Short-lived (15 minutes default) for API requests
- **Refresh Token**: Long-lived (7 days default, 30 days with "Remember Me") stored in database

## Backend Implementation

### Token Generation

**Access Token:**
- Expires in 15 minutes (configurable via `ACCESS_TOKEN_EXPIRES_IN`)
- Contains user data (id, email, role, etc.)
- Sent in `Authorization: Bearer <token>` header

**Refresh Token:**
- Random 128-character hex string
- Stored in `refresh_tokens` database table
- Expires in 7 days (default) or 30 days (with "Remember Me")
- Used to obtain new access tokens

### Database Schema

The `refresh_tokens` table is created automatically on first login:

```sql
CREATE TABLE refresh_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  revoked BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_token (token),
  INDEX idx_expires_at (expires_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### API Endpoints

**POST /api/auth/login**
- Accepts `rememberMe` boolean
- Returns `accessToken` and `refreshToken`
- Stores refresh token in database

**POST /api/auth/refresh**
- Accepts `refreshToken` in request body
- Validates refresh token from database
- Returns new `accessToken` and updated `user` data

**POST /api/auth/logout**
- Accepts `refreshToken` in request body (optional)
- Revokes refresh token(s)
- Can revoke all tokens for a user if authenticated

## Frontend Implementation

### Token Storage

- `accessToken`: Stored in localStorage and ApiContext state
- `refreshToken`: Stored in localStorage and ApiContext state
- `user`: Stored in localStorage for quick UI rendering

### Auto-Refresh Logic

The `ApiContext` automatically:
1. Checks access token expiration every minute
2. Refreshes token if it expires in less than 5 minutes
3. Handles refresh failures by clearing tokens and redirecting to login

### Remember Me Feature

- Checkbox in login form
- When checked:
  - Refresh token expires in 30 days (instead of 7)
  - User stays logged in longer
- When unchecked:
  - Refresh token expires in 7 days
  - Standard session duration

## Environment Variables

Add to `.env`:

```env
# JWT Configuration
JWT_SECRET=your-secret-key-change-in-production
JWT_REFRESH_SECRET=your-secret-key-change-in-production-refresh  # Optional, defaults to JWT_SECRET + '-refresh'

# Token Expiration
ACCESS_TOKEN_EXPIRES_IN=15m        # Access token lifetime (default: 15m)
REFRESH_TOKEN_EXPIRES_IN=7d        # Refresh token lifetime without "Remember Me" (default: 7d)
REMEMBER_ME_REFRESH_TOKEN_EXPIRES_IN=30d  # Refresh token lifetime with "Remember Me" (default: 30d)
```

## Security Features

1. **Token Revocation**: Refresh tokens can be revoked on logout
2. **Automatic Cleanup**: Expired tokens are automatically invalidated
3. **User Validation**: User existence is verified on each token refresh
4. **Database Storage**: Refresh tokens stored securely in database
5. **Short Access Token Lifetime**: Limits exposure if token is compromised

## Usage Flow

1. **Login:**
   - User enters credentials and optionally checks "Remember Me"
   - Backend generates access and refresh tokens
   - Tokens stored in localStorage

2. **API Requests:**
   - Access token sent in `Authorization` header
   - If expired, frontend automatically refreshes

3. **Token Refresh:**
   - Frontend detects expiring access token
   - Sends refresh token to `/api/auth/refresh`
   - Receives new access token
   - Updates localStorage and state

4. **Logout:**
   - Refresh token sent to backend for revocation
   - All tokens cleared from localStorage
   - User redirected to login

## Migration Notes

- Existing single-token system replaced with dual-token system
- Old `token` in localStorage will be ignored
- Users need to log in again to get new tokens
- Refresh token table created automatically on first login

## Testing

1. **Login without "Remember Me":**
   - Refresh token expires in 7 days
   - Access token expires in 15 minutes

2. **Login with "Remember Me":**
   - Refresh token expires in 30 days
   - Access token still expires in 15 minutes

3. **Token Refresh:**
   - Wait for access token to expire
   - Verify automatic refresh works
   - Check new access token is stored

4. **Logout:**
   - Verify refresh token is revoked in database
   - Verify tokens cleared from localStorage

