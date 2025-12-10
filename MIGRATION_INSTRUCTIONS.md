# Database Migration Instructions

## Problem
The error "Unknown column 'roll_number' in 'field list'" means your database is missing the new columns we added for OTP functionality.

## Solution

You have **3 options** to fix this:

### Option 1: Run SQL Manually (Recommended)
1. Open your MySQL client (MySQL Workbench, phpMyAdmin, or command line)
2. Connect to your database
3. Run the SQL file: `database/RUN_THIS_MIGRATION.sql`
   - Make sure to replace `your_database_name` with your actual database name
4. If you get errors about columns already existing, that's fine - just continue

### Option 2: Use the Migration Script
1. Make sure your `.env` file has the correct database credentials:
   ```
   DB_HOST=localhost
   DB_USER=your_username
   DB_PASS=your_password
   DB_NAME=your_database_name
   ```
2. Run: `npm run migrate`

### Option 3: Run SQL Commands Directly
Copy and paste these commands into your MySQL client:

```sql
USE your_database_name;

ALTER TABLE users ADD COLUMN roll_number VARCHAR(50) NULL;
ALTER TABLE users ADD COLUMN department VARCHAR(255) NULL;
ALTER TABLE users ADD COLUMN section VARCHAR(50) DEFAULT '1';
ALTER TABLE users ADD COLUMN otp VARCHAR(10) NULL;
ALTER TABLE users ADD COLUMN otp_expires_at TIMESTAMP NULL;
ALTER TABLE users ADD COLUMN password_set BOOLEAN DEFAULT FALSE;
ALTER TABLE users MODIFY COLUMN password VARCHAR(255) NULL;
CREATE INDEX idx_roll_number ON users(roll_number);
CREATE INDEX idx_department ON users(department);
CREATE INDEX idx_otp ON users(otp);
```

**Note:** If you get "Duplicate column name" errors, those columns already exist - that's fine!

## Verify Migration
After running the migration, verify it worked:

```sql
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'users' 
ORDER BY ORDINAL_POSITION;
```

You should see: `roll_number`, `department`, `section`, `otp`, `otp_expires_at`, and `password_set` in the list.

