const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');

dotenv.config();

const ADMIN_NAME = 'CampusZen Admin';
const ADMIN_EMAIL = 'admin@campuszen.in';
const ADMIN_PASSWORD = 'campuszen@2026';
const ADMIN_ROLE = 'campuszen_admin';

async function createCampuszenAdmin() {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS || process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
      connectTimeout: 30000,
      ssl: process.env.USE_SSL === 'true' ? { rejectUnauthorized: false } : undefined
    });

    console.log('Connected to database successfully!');

    console.log('Updating users.role ENUM to include campuszen_admin...');
    await connection.execute(
      `ALTER TABLE users
       MODIFY COLUMN role ENUM('student', 'college_admin', 'primary_admin', 'campuszen_admin') NOT NULL DEFAULT 'student'`
    );

    console.log('Ensuring campuszen_admin exists in user_roles...');
    await connection.execute(
      `INSERT INTO user_roles (name, description, role_rank)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE description = VALUES(description), role_rank = VALUES(role_rank)`,
      [ADMIN_ROLE, 'CampusZen administrator with the same access as primary admin', 1]
    );

    const [roleRows] = await connection.execute(
      'SELECT id FROM user_roles WHERE name = ?',
      [ADMIN_ROLE]
    );
    const roleId = roleRows[0] ? roleRows[0].id : null;

    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const [existing] = await connection.execute(
      'SELECT id, email, role FROM users WHERE email = ?',
      [ADMIN_EMAIL]
    );

    if (existing.length > 0) {
      try {
        await connection.execute(
          `UPDATE users
           SET name = ?, password = ?, role = ?, role_id = ?, password_set = TRUE, otp = NULL, otp_expires_at = NULL
           WHERE email = ?`,
          [ADMIN_NAME, hashedPassword, ADMIN_ROLE, roleId, ADMIN_EMAIL]
        );
      } catch (updateError) {
        if (updateError.code === 'ER_BAD_FIELD_ERROR') {
          await connection.execute(
            `UPDATE users
             SET name = ?, password = ?, role = ?, password_set = TRUE
             WHERE email = ?`,
            [ADMIN_NAME, hashedPassword, ADMIN_ROLE, ADMIN_EMAIL]
          );
        } else {
          throw updateError;
        }
      }
      console.log('\nCampusZen admin already existed — credentials and role were updated.');
      console.log('  ID:', existing[0].id);
    } else {
      try {
        const [result] = await connection.execute(
          `INSERT INTO users (name, email, password, role, role_id, password_set)
           VALUES (?, ?, ?, ?, ?, TRUE)`,
          [ADMIN_NAME, ADMIN_EMAIL, hashedPassword, ADMIN_ROLE, roleId]
        );
        console.log('\nCampusZen admin created successfully!');
        console.log('  ID:', result.insertId);
      } catch (insertError) {
        if (insertError.code === 'ER_BAD_FIELD_ERROR') {
          const [result] = await connection.execute(
            `INSERT INTO users (name, email, password, role, password_set)
             VALUES (?, ?, ?, ?, TRUE)`,
            [ADMIN_NAME, ADMIN_EMAIL, hashedPassword, ADMIN_ROLE]
          );
          console.log('\nCampusZen admin created successfully!');
          console.log('  ID:', result.insertId);
        } else {
          throw insertError;
        }
      }
    }

    console.log('  Name:', ADMIN_NAME);
    console.log('  Email:', ADMIN_EMAIL);
    console.log('  Role:', ADMIN_ROLE);
  } catch (error) {
    console.error('\nError creating CampusZen admin:', error.message);

    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      console.error('Database connection failed. Check DB_* values in .env.');
    } else if (error.code === 'ER_DUP_ENTRY') {
      console.error('A user with this email already exists.');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('Database access denied. Check DB_USER and DB_PASS.');
    } else {
      console.error('Error code:', error.code);
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\nDatabase connection closed.');
    }
  }
}

createCampuszenAdmin();
