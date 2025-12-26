# JWT Authentication Migration

This document describes the migration from Passport.js session-based authentication to JWT (JSON Web Token) authentication.

## Changes Made

### Backend Changes

1. **Removed Dependencies:**
   - `passport` and `passport-local` removed from `package.json`
   - `express-session` still in dependencies but no longer used for authentication

2. **New JWT Utilities** (`utils/jwt.js`):
   - `generateToken(user)` - Creates JWT token with user data
   - `verifyToken(token)` - Verifies and decodes JWT token
   - `extractToken(req)` - Extracts token from Authorization header

3. **Updated Authentication Middleware** (`middleware/auth.js`):
   - Replaced Passport.js `req.isAuthenticated()` with JWT token verification
   - Token extracted from `Authorization: Bearer <token>` header
   - User data fetched from database on each request to ensure user still exists

4. **Updated Auth Controller** (`controllers/authController.js`):
   - `login()` - Now generates and returns JWT token instead of creating session
   - `logout()` - Simplified (JWT is stateless, client removes token)
   - `checkAuth()` - Verifies JWT token instead of checking session
   - `getProfile()` - Uses JWT middleware instead of Passport session

5. **Updated App Configuration** (`app.js`):
   - Removed `express-session` middleware
   - Removed Passport.js initialization
   - Removed session cookie configuration

### Frontend Changes

1. **Updated ApiContext** (`contexts/ApiContext.jsx`):
   - Added `token` state management
   - Added `setToken()` and `clearToken()` functions
   - Token stored in localStorage

2. **Updated Login** (`pages/Login/Login.jsx`):
   - Stores JWT token from login response
   - Removed `credentials: 'include'` (not needed for JWT)
   - Removed delay before navigation (not needed with JWT)

3. **Updated Layout** (`components/Layout/Layout.jsx`):
   - Sends JWT token in `Authorization` header for auth check
   - Clears token on logout
   - Simplified auth check logic (no retry needed)

4. **New API Utility** (`utils/api.js`):
   - `authenticatedFetch()` - Automatically adds Authorization header
   - `unauthenticatedFetch()` - For login/register endpoints

## Environment Variables

Add to `.env`:
```
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d  # Optional, defaults to 7 days
```

## Migration Steps

1. **Install Dependencies:**
   ```bash
   cd LnD-Backend
   npm install
   ```

2. **Set Environment Variables:**
   - Add `JWT_SECRET` to your `.env` file
   - Optionally set `JWT_EXPIRES_IN` (default: 7d)

3. **Remove Old Dependencies:**
   ```bash
   npm uninstall passport passport-local
   ```

4. **Restart Backend:**
   ```bash
   npm start
   ```

5. **Clear Browser Storage:**
   - Users should clear localStorage and cookies
   - Or deploy frontend update that handles token migration

## Benefits

1. **Stateless Authentication:**
   - No server-side session storage needed
   - Better for horizontal scaling
   - No cookie issues with cross-origin requests

2. **Simplified Deployment:**
   - No session cookie configuration needed
   - No CORS cookie issues
   - Works seamlessly across domains

3. **Better Performance:**
   - No session lookup on each request
   - Token verification is fast

4. **Mobile-Friendly:**
   - JWT works better with mobile apps
   - No cookie handling needed

## Security Considerations

1. **Token Storage:**
   - Tokens stored in localStorage (accessible to XSS)
   - Consider httpOnly cookies for production (requires additional setup)

2. **Token Expiration:**
   - Default: 7 days
   - Adjust `JWT_EXPIRES_IN` as needed

3. **Token Revocation:**
   - Currently not implemented (stateless)
   - For production, consider token blacklist or refresh tokens

4. **Secret Key:**
   - Use strong, random secret in production
   - Never commit secret to version control

## Testing

1. **Login:**
   - Should receive token in response
   - Token stored in localStorage

2. **Authenticated Requests:**
   - Token sent in `Authorization: Bearer <token>` header
   - Backend verifies token and sets `req.user`

3. **Logout:**
   - Token removed from localStorage
   - Subsequent requests fail authentication

4. **Token Expiration:**
   - Expired tokens return 401
   - Frontend redirects to login

## Rollback

If needed, rollback by:
1. Restore Passport.js dependencies
2. Restore `config/passport.js`
3. Restore session middleware in `app.js`
4. Revert auth controller and middleware changes
5. Revert frontend changes

