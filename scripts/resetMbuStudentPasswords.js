/**
 * Reset passwords for all @mbu.asia student accounts.
 *
 * Usage: node scripts/resetMbuStudentPasswords.js [password]
 * Default password: 123456
 */
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');

dotenv.config();

async function main() {
  const newPassword = process.argv[2] || '123456';
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    ssl: process.env.USE_SSL === 'true' ? { rejectUnauthorized: false } : undefined
  });

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const [users] = await connection.execute(
      `SELECT id, name, email FROM users WHERE email LIKE '%@mbu.asia' AND role = 'student' ORDER BY email`
    );

    if (users.length === 0) {
      console.log('No @mbu.asia student accounts found.');
      return;
    }

    const [result] = await connection.execute(
      `UPDATE users SET password = ?, password_set = TRUE, updated_at = NOW()
       WHERE email LIKE '%@mbu.asia' AND role = 'student'`,
      [hashedPassword]
    );

    console.log(`Reset password for ${result.affectedRows} student(s):`);
    users.forEach((u) => console.log(`  - ${u.email} (${u.name})`));
    console.log(`\nNew password: ${newPassword}`);
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
