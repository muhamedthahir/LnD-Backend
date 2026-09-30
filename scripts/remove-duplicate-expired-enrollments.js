/**
 * Remove duplicate enrollments: same (student_id, administration_id) should appear only once.
 * Deletes Expired duplicate rows and keeps one enrollment per user per administration.
 * Usage: node scripts/remove-duplicate-expired-enrollments.js
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER,
    password: process.env.DB_PASS || process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306
  });

  try {
    // Step 1: Delete Expired rows when the same pair has a non-Expired row (select IDs first to avoid MySQL DELETE subquery restriction)
    const [ids1] = await connection.execute(`
      SELECT e.id FROM enrollments e
      WHERE e.administration_id IS NOT NULL
        AND e.status = 'Expired'
        AND EXISTS (
          SELECT 1 FROM enrollments e2
          WHERE e2.student_id = e.student_id
            AND e2.administration_id = e.administration_id
            AND e2.id != e.id
            AND e2.status != 'Expired'
        )
    `);
    let deleted1 = 0;
    if (ids1.length > 0) {
      const placeholders = ids1.map(() => '?').join(',');
      const [r1] = await connection.execute(
        `DELETE FROM enrollments WHERE id IN (${placeholders})`,
        ids1.map((r) => r.id)
      );
      deleted1 = r1.affectedRows;
    }
    console.log('Step 1: Deleted', deleted1, 'Expired duplicate(s) where a non-Expired row exists.');

    // Step 2: For pairs with only Expired rows, keep one (min id) and delete the rest
    const [ids2] = await connection.execute(`
      SELECT e.id FROM enrollments e
      INNER JOIN (
        SELECT student_id, administration_id, MIN(id) AS keep_id
        FROM enrollments
        WHERE administration_id IS NOT NULL AND status = 'Expired'
        GROUP BY student_id, administration_id
        HAVING COUNT(*) > 1
      ) dup ON e.student_id = dup.student_id AND e.administration_id = dup.administration_id
      WHERE e.administration_id IS NOT NULL AND e.status = 'Expired' AND e.id != dup.keep_id
    `);
    let deleted2 = 0;
    if (ids2.length > 0) {
      const placeholders = ids2.map(() => '?').join(',');
      const [r2] = await connection.execute(
        `DELETE FROM enrollments WHERE id IN (${placeholders})`,
        ids2.map((r) => r.id)
      );
      deleted2 = r2.affectedRows;
    }
    console.log('Step 2: Deleted', deleted2, 'extra Expired row(s) where only Expired duplicates existed.');
    console.log('Done.');
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
