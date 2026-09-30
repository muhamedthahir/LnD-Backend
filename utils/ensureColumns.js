// Share a single schema check among concurrent requests and retain successful checks.
// Only hard-coded schema definitions from models may be passed to this helper.
const checks = new WeakMap();

function ensureColumns(db, table, columns) {
  if (!/^[a-z_]+$/.test(table) || columns.some(column => !/^[a-z_]+$/.test(column.name))) {
    throw new Error('Invalid schema identifier');
  }
  if (!checks.has(db)) checks.set(db, new Map());
  const pending = checks.get(db);
  const key = JSON.stringify([table, columns]);
  if (!pending.has(key)) {
    const operation = (async () => {
      const [existing] = await db.execute(`SHOW COLUMNS FROM \`${table}\``);
      const names = new Set(existing.map(column => column.Field));
      for (const column of columns) {
        if (names.has(column.name)) continue;
        try {
          await db.execute(`ALTER TABLE \`${table}\` ADD COLUMN \`${column.name}\` ${column.definition}`);
        } catch (error) {
          // Another process may have completed the same migration concurrently.
          if (error.code !== 'ER_DUP_FIELDNAME') throw error;
        }
      }
    })().catch(error => { pending.delete(key); throw error; });
    pending.set(key, operation);
  }
  return pending.get(key);
}

module.exports = ensureColumns;
