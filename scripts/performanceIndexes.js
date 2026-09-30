// Read-only by default. Run with --apply to add missing covering indexes.
const path = require('node:path');
const fs = require('node:fs');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });

const indexes = [
  ['topics', 'idx_topics_course_order', ['course_id', 'order_index']],
  ['segments', 'idx_segments_topic_order', ['topic_id', 'order_index']],
  ['user_topic_progress', 'idx_utp_user_course', ['user_id', 'course_id']],
  ['user_segment_progress', 'idx_usp_user_segment', ['user_id', 'segment_id']],
  ['user_segment_progress', 'idx_usp_user_practice', ['user_id', 'practice_segment_id']],
  ['practice_segments', 'idx_practice_topic', ['topic_id']],
  ['enrollments', 'idx_enrollments_student_date', ['student_id', 'enrolled_at']],
  ['user_courses', 'idx_user_courses_access', ['user_id', 'last_accessed_at']],
  ['users', 'idx_users_created_id', ['created_at', 'id']],
  ['users', 'idx_users_college_created', ['college_name', 'created_at']],
  ['groups', 'idx_groups_college_name', ['college_name', 'name']],
  ['groups', 'idx_groups_name', ['name']],
  ['group_members', 'idx_members_group_user', ['group_id', 'user_id']],
  ['questions', 'idx_questions_created_id', ['created_at', 'id']],
  ['questions', 'idx_questions_bank_created', ['question_bank_id', 'created_at']],
  ['question_tags', 'idx_question_tags_question', ['question_id']],
  ['course_administrations', 'idx_administrations_created', ['created_at']],
  ['enrollments', 'idx_enrollments_admin_student', ['administration_id', 'student_id']],
  ['assessment_user_mappings', 'idx_aum_admin_status_created', ['assessment_administrator_id', 'status', 'created_at']],
  ['assessment_user_mappings', 'idx_aum_admin_user_attempt', ['assessment_administrator_id', 'user_id', 'attempt_number']],
  ['user_question_assignments', 'idx_uqa_mapping_segment', ['assessment_user_mapping_id', 'assessment_segment_id']],
  ['random_fetch_criteria', 'idx_rfc_segment_active', ['assessment_segment_id', 'is_active']]
];

async function main() {
  const apply = process.argv.includes('--apply');
  const ssl = process.env.USE_SSL === 'true'
    ? { rejectUnauthorized: false, ...(process.env.SSL_CA_PATH && fs.existsSync(process.env.SSL_CA_PATH)
      ? { ca: fs.readFileSync(process.env.SSL_CA_PATH) } : {}) }
    : undefined;
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS,
    database: process.env.DB_NAME, port: Number(process.env.DB_PORT || 3306),
    connectTimeout: 10000, ssl
  });
  try {
    // Bound metadata lock waiting. Never fall back to a blocking table-copy DDL.
    if (apply) await connection.query('SET SESSION lock_wait_timeout = 5');
    for (const [table, name, columns] of indexes) {
      const [schema] = await connection.execute(
        'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?', [table]
      );
      if (!columns.every(column => schema.some(row => row.COLUMN_NAME === column))) {
        console.log(`SKIP ${table}: table or required columns missing`);
        continue;
      }
      const [existing] = await connection.query('SHOW INDEX FROM ??', [table]);
      const grouped = new Map();
      for (const row of existing) {
        if (row.Visible === 'NO' || row.Sub_part != null) continue;
        if (!grouped.has(row.Key_name)) grouped.set(row.Key_name, []);
        grouped.get(row.Key_name)[row.Seq_in_index - 1] = row.Column_name;
      }
      if ([...grouped.values()].some(keys => columns.every((column, i) => keys[i] === column))) {
        console.log(`COVERED ${table} (${columns.join(', ')})`);
        continue;
      }
      if (grouped.has(name)) throw new Error(`Index name ${name} already exists with a different definition`);
      const sql = `ALTER TABLE ${mysql.escapeId(table)} ADD INDEX ${mysql.escapeId(name)} (${columns.map(column => mysql.escapeId(column)).join(', ')}), ALGORITHM=INPLACE, LOCK=NONE`;
      if (apply) {
        await connection.query(sql);
        console.log(`ADDED ${name}`);
      } else {
        console.log(`PLANNED ${sql};`);
      }
    }
  } finally {
    await connection.end();
  }
}

if (require.main === module) main().catch(error => {
  console.error(`Index audit failed: ${error.code || error.message}`);
  process.exitCode = 1;
});
