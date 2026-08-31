/**
 * Set user mdfaridh142002@gmail.com (Faridh) to primary_admin.
 * If your DB still has skillvantix_admin in the role ENUM, run
 * database/migrations/set_faridh_primary_admin_and_remove_skillvantix_role.sql
 * to update the user and remove that role from the ENUM.
 * Usage: node scripts/set-faridh-primary-admin.js
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

const EMAIL = 'mdfaridh142002@gmail.com';

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER,
    password: process.env.DB_PASS || process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306
  });

  try {
    const [result] = await connection.execute(
      "UPDATE users SET role = 'primary_admin' WHERE email = ?",
      [EMAIL]
    );
    if (result.affectedRows === 0) {
      console.log('No user found with email:', EMAIL);
    } else {
      console.log('User', EMAIL, 'set to primary_admin.');
    }
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
