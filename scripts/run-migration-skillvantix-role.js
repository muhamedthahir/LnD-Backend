/**
 * Run migration: add skillvantix_admin to users.role ENUM.
 * Usage: node scripts/run-migration-skillvantix-role.js
 */
require('dotenv').config();
const pool = require('../config/db');
const fs = require('fs');
const path = require('path');

const migrationSql = `ALTER TABLE users
MODIFY COLUMN role ENUM('student', 'college_admin', 'primary_admin', 'skillvantix_admin') NOT NULL DEFAULT 'student';`;

async function run() {
  try {
    await pool.execute(migrationSql);
    console.log('Migration completed: users.role ENUM now includes skillvantix_admin.');
  } catch (err) {
    if (err.code === 'ER_INVALID_ENUM_VALUE' || err.message?.includes('ENUM')) {
      console.error('Migration failed - check that existing rows do not have invalid role values.');
    }
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
