const ensureColumns = require('./ensureColumns');
const checks = new WeakMap();
module.exports = function ensureProgrammingSchema(db, table = 'programming_submissions') {
  if (!['programming_submissions', 'mcq_submissions'].includes(table)) throw new Error('Invalid submission table');
  if (!checks.has(db)) checks.set(db, new Map());
  const pending = checks.get(db);
  if (!pending.has(table)) {
    const operation = (async () => {
      await ensureColumns(db, table, [
        { name: 'assessment_user_mapping_id', definition: 'INT DEFAULT NULL' },
        { name: 'assessment_segment_id', definition: 'INT DEFAULT NULL' },
        ...(table === 'programming_submissions' ? [{ name: 'execution_result', definition: 'JSON DEFAULT NULL' }] : [])
      ]);
      const [columns] = await db.execute(`SHOW COLUMNS FROM ${table}`);
      const status = columns.find(column => column.Field === 'status');
      if (status && !status.Type.includes("'attempted'")) {
        const definition = table === 'programming_submissions'
          ? "ENUM('pending', 'running', 'completed', 'error', 'attempted') DEFAULT 'pending'"
          : "ENUM('unanswered', 'answered', 'skipped', 'attempted') DEFAULT 'unanswered'";
        await db.execute(`ALTER TABLE ${table} MODIFY COLUMN status ${definition}`);
      }
      const submission = columns.find(column => column.Field === 'submission_id');
      if (submission && submission.Null === 'NO') {
        await db.execute(`ALTER TABLE ${table} MODIFY COLUMN submission_id INT DEFAULT NULL`);
      }
      const practice = columns.find(column => column.Field === 'practice_segment_id');
      if (practice && practice.Null === 'NO') {
        await db.execute(`ALTER TABLE ${table} MODIFY COLUMN practice_segment_id INT DEFAULT NULL`);
      }
      const questionColumn = table === 'mcq_submissions' ? 'mcq_question_id' : 'programming_question_id';
      const legacyKey = table === 'mcq_submissions' ? 'unique_user_mcq_question' : 'unique_user_programming_question';
      const [indexes] = await db.execute(`SHOW INDEX FROM ${table}`);
      if (indexes.some(index => index.Key_name === legacyKey)) {
        // A question may be reused in different practices and assessment attempts.
        // Keep uniqueness within each context before removing the global key.
        for (const [key, context] of [['unique_practice_question', 'practice_segment_id'], ['unique_assessment_question', 'assessment_user_mapping_id']]) {
          if (!indexes.some(index => index.Key_name === key)) {
            await db.execute(`ALTER TABLE ${table} ADD UNIQUE KEY ${key} (user_id, ${questionColumn}, ${context})`);
          }
        }
        await db.execute(`ALTER TABLE ${table} DROP INDEX ${legacyKey}`);
      }
      const [keys] = await db.execute(`SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
        AND CONSTRAINT_TYPE = 'FOREIGN KEY' AND CONSTRAINT_NAME = ?`, [table, `${table}_ibfk_1`]);
      if (keys.length) {
        try { await db.execute(`ALTER TABLE ${table} DROP FOREIGN KEY ${table}_ibfk_1`); }
        catch (error) { if (error.code !== 'ER_CANT_DROP_FIELD_OR_KEY') throw error; }
      }
    })().catch(error => { pending.delete(table); throw error; });
    pending.set(table, operation);
  }
  return pending.get(table);
};
