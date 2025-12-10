# Passport.js Authentication Setup

## Overview
This application now uses Passport.js with local strategy for secure authentication with session-based management.

## Setup Instructions

### 1. Database Migration
If you have an existing database, run the migration to add the `college_name` column:
```sql
-- Run the migration script
SOURCE database/migration_add_college_name.sql;
```

Or manually:
```sql
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS college_name VARCHAR(255) NULL AFTER role;

ALTER TABLE users 
ADD INDEX IF NOT EXISTS idx_college_name (college_name);
```

### 2. Seed Users
Run the seed script to create the default users:
```bash
npm run seed
```

This will create:
- Primary Admin
- College Admin for MBU
- Student (with random name)

## User Credentials

After running the seed script, use these credentials to login:

### 1. Primary Administrator
- **Email:** `admin@edtech.com`
- **Password:** `Admin@123`
- **Role:** Primary Admin

### 2. College Administrator (MBU)
- **Email:** `mbu.admin@edtech.com`
- **Password:** `MBUAdmin@123`
- **Role:** College Admin
- **College:** MBU

### 3. Student
- **Email:** `student@edtech.com`
- **Password:** `Student@123`
- **Role:** Student
- **Name:** Randomly selected from a list

## Environment Variables

Make sure to set these in your `.env` file:
```
SESSION_SECRET=your-secret-key-change-in-production
FRONTEND_URL=http://localhost:5173
```

## Frontend Configuration

The frontend is configured to connect to `http://localhost:3000/api/auth`. Make sure:
1. Backend is running on port 3000
2. Frontend is running on port 5173 (or update FRONTEND_URL)
3. CORS is properly configured (already set in app.js)

## Testing

1. Start the backend: `npm run dev` (in LnD-Backend)
2. Start the frontend: `npm run dev` (in LnD-FrontEnd)
3. Navigate to `http://localhost:5173/login`
4. Login with any of the credentials above
5. You should be redirected to the dashboard page

## Features

- ✅ Passport.js local strategy authentication
- ✅ Session-based authentication (secure cookies)
- ✅ Role-based access control (primary_admin, college_admin, student)
- ✅ College association for college admins
- ✅ Protected routes with authentication middleware
- ✅ Logout functionality
- ✅ Dashboard page after successful login

