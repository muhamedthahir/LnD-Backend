/**
 * Set or reset password for SkillVantix admin (mdfaridh142002@gmail.com).
 * Use this if login returns "Invalid email or password".
 *
 * - If user exists: updates password and password_set.
 * - If user does not exist: creates user with role skillvantix_admin (requires
 *   database/migrations/add_skillvantix_admin_role.sql to be run first).
 *
 * Usage: node scripts/reset-skillvantix-admin-password.js
 */
require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../config/db');

const EMAIL = 'mdfaridh142002@gmail.com';
const PASSWORD = 'Faridh@sv1';
const NAME = 'SkillVantix Admin';
const ROLE = 'skillvantix_admin';

async function run() {
  try {
    const hashedPassword = await bcrypt.hash(PASSWORD, 10);

    // Check if user exists
    const [rows] = await pool.execute(
      'SELECT id, email, role, password_set FROM users WHERE email = ?',
      [EMAIL]
    );

    if (rows.length > 0) {
      await pool.execute(
        'UPDATE users SET password = ?, password_set = TRUE, role = ? WHERE email = ?',
        [hashedPassword, ROLE, EMAIL]
      );
      console.log('Password and role updated for:', EMAIL);
      console.log('You can now log in with this email and password.');
    } else {
      // Insert new user (role ENUM must include skillvantix_admin)
      await pool.execute(
        `INSERT INTO users (name, email, password, role, password_set) VALUES (?, ?, ?, ?, TRUE)`,
        [NAME, EMAIL, hashedPassword, ROLE]
      );
      console.log('User created:', EMAIL);
      console.log('You can now log in with this email and password.');
    }
  } catch (err) {
    console.error('Error:', err.message);
    if (err.code === 'ER_INVALID_ENUM_VALUE') {
      console.error('Run database/migrations/add_skillvantix_admin_role.sql first to add skillvantix_admin to users.role.');
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
