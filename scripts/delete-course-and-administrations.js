/**
 * Delete a course by name and all its administrations (and related enrollments, groups).
 * Usage: node scripts/delete-course-and-administrations.js "Fundamentals of Programming Java"
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

const COURSE_NAME = process.argv[2] || 'Fundamentals of Programming Java';

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER,
    password: process.env.DB_PASS || process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306
  });

  try {
    const [courses] = await connection.execute(
      'SELECT id, name FROM courses WHERE name LIKE ?',
      [`%${COURSE_NAME.trim()}%`]
    );

    if (courses.length === 0) {
      console.log('No course found matching:', COURSE_NAME);
      return;
    }
    if (courses.length > 1) {
      console.log('Multiple courses match. Using first:', courses[0].name, '(id:', courses[0].id, ')');
    }

    const courseId = courses[0].id;
    const courseName = courses[0].name;
    console.log('Deleting course:', courseName, '(id:', courseId, ')');

    const [admins] = await connection.execute(
      'SELECT id, administration_name FROM course_administrations WHERE course_id = ?',
      [courseId]
    );
    console.log('Found', admins.length, 'administration(s) for this course.');

    for (const admin of admins) {
      const aid = admin.id;
      await connection.execute('DELETE FROM enrollments WHERE administration_id = ?', [aid]);
      await connection.execute('DELETE FROM administration_groups WHERE administration_id = ?', [aid]);
      await connection.execute('DELETE FROM course_progress_invites WHERE administration_id = ?', [aid]);
      await connection.execute('DELETE FROM course_administrations WHERE id = ?', [aid]);
      console.log('  Deleted administration:', admin.administration_name, '(id:', aid, ')');
    }

    await connection.execute('DELETE FROM user_courses WHERE course_id = ?', [courseId]);
    await connection.execute('DELETE FROM courses WHERE id = ?', [courseId]);
    console.log('Deleted course:', courseName);
    console.log('Done.');
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
