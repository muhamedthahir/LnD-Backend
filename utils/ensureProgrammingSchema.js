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
