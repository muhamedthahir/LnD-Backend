const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ensureColumns = require('../utils/ensureColumns');

function loadModel(file, db) {
  const sandbox = { module: { exports: {} }, console, require: name => {
    if (name === '../config/db') return db;
    if (name === '../utils/ensureColumns') return ensureColumns;
    throw new Error(`Unexpected dependency ${name}`);
  }};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), sandbox);
  return sandbox.module.exports;
}
const plain = value => JSON.parse(JSON.stringify(value));

test('administration page avoids a quadratic enrollment join and preserves institution filters', async () => {
  const calls = [];
  const Model = loadModel('models/CourseAdministration.js', { execute: async (sql, params) => {
    calls.push({ sql, params });
    return sql.startsWith('SELECT COUNT(*) as total FROM course_administrations') ? [[{ total: 1 }]] : [[{ id: 5, total_invites: 1000, colleges: 'College A' }]];
  }});
  const result = plain(await Model.getAll({ limit: 10, filters: { college: 'College A', status: 'published' } }));
  assert.equal(result.total, 1);
  assert.equal(result.administrations[0].total_invites, 1000);
  assert.equal(calls.length, 2);
  assert.ok(!calls[0].sql.includes('LEFT JOIN enrollments'));
  assert.match(calls[0].sql, /EXISTS/);
  assert.deepEqual(plain(calls[0].params), ['College A', 'published', 'College A', 'College A']);
  assert.deepEqual(plain(calls[1].params), ['published', 'College A', 'College A']);
  calls.length = 0;
  assert.equal((await Model.getRecentSummary(5)).length, 1);
  assert.equal(calls.length, 1);
});

test('unscoped dashboard status counts do not join all enrollments', async () => {
  let query;
  const Model = loadModel('models/CourseAdministration.js', { execute: async sql => {
    query = sql;
    return [[{ status: 'published', count: 2 }, { status: 'draft', count: 3 }]];
  }});
  assert.deepEqual(plain(await Model.getStatusStats()), { total: 5, published: 2, draft: 3 });
  assert.ok(!query.includes('JOIN'));
});

for (const count of [0, 1, 100]) {
  test(`question page with ${count} rows needs at most three queries`, async () => {
    const calls = [];
    const rows = Array.from({ length: count }, (_, i) => ({ id: i + 1 }));
    const Question = loadModel('models/Question.js', { execute: async (sql, params) => {
      calls.push({ sql, params });
      if (sql.includes('COUNT(*)')) return [[{ total: count }]];
      if (sql.includes('FROM question_tags')) return [[{ question_id: count, id: 7, name: 'Tag' }]];
      return [rows];
    }});
    const result = plain(await Question.getAllPaginated({ institutionId: 6, questionBankId: 4, limit: 100 }));
    assert.equal(calls.length, count ? 3 : 2);
    assert.equal(result.total, count);
    if (count) {
      assert.deepEqual(result.questions[count - 1].tags, [{ id: 7, name: 'Tag' }]);
      for (const row of result.questions.slice(0, -1)) assert.deepEqual(row.tags, []);
      assert.deepEqual(plain(calls[2].params), rows.map(row => row.id));
    }
    for (const call of calls.slice(0, 2)) assert.deepEqual(plain(call.params), [4, 6]);
    assert.ok(!calls.find(call => call.sql.includes('COUNT(*)')).sql.includes('JOIN users'));
  });
}

test('schema checks are shared and existing columns never trigger ALTER', async () => {
  let calls = 0;
  const db = { execute: async sql => { calls++; assert.match(sql, /^SHOW COLUMNS/); return [[{ Field: 'reset_token' }]]; } };
  const columns = [{ name: 'reset_token', definition: 'VARCHAR(255) NULL' }];
  await Promise.all(Array.from({ length: 20 }, () => ensureColumns(db, 'users', columns)));
  await ensureColumns(db, 'users', columns);
  assert.equal(calls, 1);
});

test('schema errors propagate and permit a later retry', async () => {
  let fail = true;
  const calls = [];
  const db = { execute: async sql => {
    calls.push(sql);
    if (sql.startsWith('SHOW')) return [[]];
    if (fail) throw Object.assign(new Error('denied'), { code: 'ER_TABLEACCESS_DENIED_ERROR' });
    return [{}];
  }};
  const columns = [{ name: 'reset_token', definition: 'VARCHAR(255) NULL' }];
  await assert.rejects(ensureColumns(db, 'users', columns), { code: 'ER_TABLEACCESS_DENIED_ERROR' });
  fail = false;
  await ensureColumns(db, 'users', columns);
  await ensureColumns(db, 'users', columns);
  assert.equal(calls.length, 4);
});

test('concurrent migration duplicate-column errors are harmless', async () => {
  const db = { execute: async sql => {
    if (sql.startsWith('SHOW')) return [[]];
    throw Object.assign(new Error('duplicate'), { code: 'ER_DUP_FIELDNAME' });
  }};
  await ensureColumns(db, 'users', [{ name: 'reset_token', definition: 'VARCHAR(255) NULL' }]);
});

test('user count and page reads overlap and use identical filters', async () => {
  const calls = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const User = loadModel('models/User.js', { execute: async (sql, params) => {
    calls.push({ sql, params });
    if (calls.length === 2) release();
    await gate;
    return sql.includes('COUNT(*)') ? [[{ total: 1 }]] : [[{ id: 8, name: 'Student', password_set: 1 }]];
  }});
  const result = await User.getAllPaginated({ college: 'College A', excludePrimaryAdmin: true, excludeCurrentUser: 2 });
  assert.equal(result.users[0].status, 'activated');
  assert.equal(result.total, 1);
  assert.deepEqual(plain(calls[0].params), plain(calls[1].params));
  assert.deepEqual(plain(calls[0].params), ['primary_admin', 'campuszen_admin', 2, 'College A']);
});
