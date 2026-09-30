require('dotenv').config();
const bcrypt = require('bcrypt');
const AssessmentUserMapping = require('../models/AssessmentUserMapping');

(async () => {
  const pool = require('../config/db');
  const adminId = 10;
  const email = 'demouser@gmail.com';

  const [users] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
  if (!users[0]) throw new Error('Demo user not found');
  const userId = users[0].id;

  const passwordHash = await bcrypt.hash('12345678', 10);
  await pool.execute('UPDATE users SET password = ? WHERE id = ?', [passwordHash, userId]);
  console.log('Password reset for', email);

  await pool.execute(
    'UPDATE access_configs SET max_attempts = GREATEST(max_attempts, 10) WHERE assessment_administrator_id = ?',
    [adminId]
  );

  const [latest] = await pool.execute(
    `SELECT id FROM assessment_user_mappings
     WHERE user_id = ? AND assessment_administrator_id = ?
     ORDER BY attempt_number DESC LIMIT 1`,
    [userId, adminId]
  );

  const result = await AssessmentUserMapping.createReattempt(latest[0].id);
  console.log('New attempt created:', result);
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
