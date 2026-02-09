/**
 * Seed SkillVantix admin user.
 * Run after: 1) database/migrations/add_skillvantix_admin_role.sql  2) database/seed_user_roles.sql (optional, for user_roles table)
 *
 * Usage: node scripts/seed-skillvantix-admin.js
 * Requires: .env with DB_* and app running from backend root so config/db and models load.
 */
require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../config/db');

const EMAIL = 'mdfaridh142002@gmail.com';
const PASSWORD = 'Faridh@sv1';
const NAME = 'SkillVantix Admin';
const ROLE = 'skillvantix_admin';

async function seed() {
  try {
    const hashedPassword = await bcrypt.hash(PASSWORD, 10);
    const [result] = await pool.execute(
      `INSERT INTO users (name, email, password, role, password_set) 
       VALUES (?, ?, ?, ?, TRUE) 
       ON DUPLICATE KEY UPDATE role = VALUES(role), password = VALUES(password), password_set = TRUE, updated_at = CURRENT_TIMESTAMP`,
      [NAME, EMAIL, hashedPassword, ROLE]
    );
    if (result.affectedRows === 1 && result.insertId) {
      console.log('SkillVantix admin user created:', EMAIL);
    } else if (result.affectedRows === 2) {
      console.log('SkillVantix admin user updated (existing email):', EMAIL);
    } else {
      console.log('No change (user may already exist with same role):', EMAIL);
    }
  } catch (err) {
    console.error('Seed failed:', err.message);
    if (err.code === 'ER_INVALID_ENUM_VALUE') {
      console.error('Run database/migrations/add_skillvantix_admin_role.sql first to add skillvantix_admin to users.role ENUM.');
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
