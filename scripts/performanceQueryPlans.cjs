// Read-only plans: print query metadata, never student records or credentials.
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
async function main() {
  const connection = await mysql.createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER,
    password: process.env.DB_PASS, database: process.env.DB_NAME, port: Number(process.env.DB_PORT || 3306),
    connectTimeout: 10000, ssl: process.env.USE_SSL === 'true' ? { rejectUnauthorized: false,
      ...(process.env.SSL_CA_PATH && fs.existsSync(process.env.SSL_CA_PATH) ? { ca: fs.readFileSync(process.env.SSL_CA_PATH) } : {}) } : undefined });
  try {
    const queries = [
      ['question-bank-tags', 'SELECT qbt.question_bank_id, t.id FROM question_bank_tags qbt JOIN tags t ON t.id = qbt.tag_id WHERE qbt.question_bank_id IN (1,2,3)'],
      ['practice-options', 'SELECT id FROM options WHERE mcq_multiselect_question_id IN (1,2,3) ORDER BY mcq_multiselect_question_id, `order`'],
      ['report-programming', 'SELECT p.practice_segment_id, q.id FROM practice_segment_programming_questions p JOIN questions q ON q.id = p.question_id WHERE p.practice_segment_id IN (1,2,3) ORDER BY p.practice_segment_id, p.order_index'],
      ['assessment-list', 'SELECT id FROM assessments WHERE institution_id = 1 ORDER BY created_at DESC, id DESC LIMIT 10'],
      ['mail-status-list', "SELECT id FROM mail_status WHERE status = 'success' ORDER BY queued_at DESC, id DESC LIMIT 50"]
    ];
    for (const [name, sql] of queries) {
      try {
        const [rows] = await connection.query('EXPLAIN ' + sql);
        console.log(JSON.stringify({ name, plan: rows.map(row => ({ table: row.table, access: row.type, index: row.key, estimatedRows: row.rows, extra: row.Extra })) }));
      } catch (error) { console.log(JSON.stringify({ name, unavailable: error.code })); }
    }
  } finally { await connection.end(); }
}
main().catch(error => { console.error('Query plan audit failed:', error.code || error.name); process.exitCode = 1; });
