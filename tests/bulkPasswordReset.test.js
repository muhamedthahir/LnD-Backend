const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createBulkPasswordResetService, validateReset } = require('../services/bulkPasswordResetService');

const actor = { id: 99, role: 'college_admin', college_name: 'College A' };
const input = { groupId: 3, password: ' Sample-password-7 ' };

function fixture({ group = { id: 3, name: 'Class A', college_name: 'College A' }, members = [{ id: 1, role: 'student', college_name: 'College A' }, { id: 2, role: 'student', college_name: 'College A' }], failAt, missingTokens = false } = {}) {
  const events = [];
  const connection = {
    beginTransaction: async () => { events.push('begin'); },
    commit: async () => { events.push('commit'); },
    rollback: async () => { events.push('rollback'); },
    release: () => { events.push('release'); },
    execute: async (sql, params) => {
      events.push({ sql, params });
      if (sql.startsWith('SELECT id, name')) return [group ? [group] : []];
      if (sql.startsWith('SELECT u.id')) return [members];
      if (failAt && sql.includes(failAt)) throw Object.assign(new Error('simulated database failure'), { code: 'ER_LOCK_DEADLOCK' });
      if (missingTokens && sql.includes('UPDATE refresh_tokens')) throw Object.assign(new Error('missing'), { code: 'ER_NO_SUCH_TABLE' });
      return [{ affectedRows: members.length }];
    }
  };
  const db = {
    getConnection: async () => { events.push('acquire'); return connection; },
    execute: async (sql, params) => { events.push({ sql, params }); return sql.includes('AS total') ? [[{ total: 1 }]] : [[group]]; }
  };
  const service = createBulkPasswordResetService({ db,
    ensureResetColumns: async () => { events.push('schema'); },
    hashPassword: async (password, rounds) => {
      assert.equal(password, input.password); assert.equal(rounds, 10);
      events.push('hash'); return 'test-password-hash';
    }
  });
  return { service, events };
}

test('resets exactly the locked membership, activates pending users and revokes refresh tokens atomically', async () => {
  const { service, events } = fixture();
  assert.deepEqual(await service.reset(actor, input), { groupId: 3, groupName: 'Class A', updatedCount: 2 });
  assert.equal(events.filter(event => event === 'hash').length, 1);
  assert.ok(events.indexOf('schema') < events.indexOf('begin'));
  const updates = events.filter(event => event.sql?.startsWith('UPDATE'));
  assert.equal(updates.length, 2);
  assert.deepEqual(updates[0].params, ['test-password-hash', 1, 2]);
  assert.match(updates[0].sql, /password_set = TRUE/);
  assert.match(updates[0].sql, /reset_token = NULL/);
  assert.match(updates[0].sql, /otp = NULL/);
  assert.deepEqual(updates[1].params, [1, 2]);
  assert.deepEqual(events.slice(-2), ['commit', 'release']);
  assert.ok(!JSON.stringify(events).includes(input.password));
});

for (const [name, changes, status] of [
  ['missing group', { group: null }, 404],
  ['foreign institution group', { group: { id: 3, college_name: 'College B' } }, 403],
  ['foreign institution member', { members: [{ id: 8, role: 'student', college_name: 'College B' }] }, 403],
  ['administrator in group', { members: [{ id: 8, role: 'primary_admin', college_name: 'College A' }] }, 403],
  ['empty group', { members: [] }, 400]
]) {
  test(`rejects ${name} without any password update`, async () => {
    const { service, events } = fixture(changes);
    await assert.rejects(service.reset(actor, input), { status });
    assert.equal(events.filter(event => event.sql?.startsWith('UPDATE')).length, 0);
    assert.ok(!events.includes('hash'));
    assert.deepEqual(events.slice(-2), ['rollback', 'release']);
  });
}

for (const role of ['student', 'unknown']) {
  test(`rejects ${role} before database access`, async () => {
    const { service, events } = fixture();
    await assert.rejects(service.reset({ ...actor, role }, input), { status: 403 });
    await assert.rejects(service.listGroups({ ...actor, role }), { status: 403 });
    assert.deepEqual(events, []);
  });
}
test('rejects institution admins without an institution', async () => {
  const { service, events } = fixture();
  await assert.rejects(service.reset({ ...actor, college_name: null }, input), { status: 403 });
  await assert.rejects(service.listGroups({ ...actor, college_name: null }), { status: 403 });
  assert.deepEqual(events, []);
});

test('platform roles may reset students in another institution', async () => {
  for (const role of ['primary_admin', 'campuszen_admin']) {
    const { service } = fixture({ group: { id: 3, name: 'Other class', college_name: 'College B' }, members: [{ id: 8, role: 'student', college_name: 'College B' }] });
    assert.equal((await service.reset({ ...actor, role }, input)).updatedCount, 1);
  }
});

for (const failAt of ['UPDATE users', 'UPDATE refresh_tokens']) {
  test(`rolls back when ${failAt} fails`, async () => {
    const { service, events } = fixture({ failAt });
    await assert.rejects(service.reset(actor, input), { code: 'ER_LOCK_DEADLOCK' });
    assert.ok(!events.includes('commit'));
    assert.deepEqual(events.slice(-2), ['rollback', 'release']);
  });
}

test('large group uses bounded updates and one bcrypt operation', async () => {
  const members = Array.from({ length: 1201 }, (_, index) => ({ id: index + 1, role: 'student', college_name: 'College A' }));
  const { service, events } = fixture({ members });
  assert.equal((await service.reset(actor, input)).updatedCount, 1201);
  const updates = events.filter(event => event.sql?.startsWith('UPDATE users'));
  assert.deepEqual(updates.map(event => event.params.length - 1), [500, 500, 201]);
  assert.deepEqual(updates.flatMap(event => event.params.slice(1)), members.map(user => user.id));
  assert.equal(events.filter(event => event === 'hash').length, 1);
});

test('older installations without refresh_tokens remain supported', async () => {
  const { service } = fixture({ missingTokens: true });
  assert.equal((await service.reset(actor, input)).updatedCount, 2);
});

test('validates types, minimum length and bcrypt byte limit without trimming passwords', () => {
  for (const groupId of [0, -1, '1 OR 1=1', '2.5', null, [], [3], {}, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => validateReset({ ...input, groupId }), { status: 400 });
  }
  for (const password of ['', '12345', 123456, null, {}, 'é'.repeat(37), 'x'.repeat(73)]) {
    assert.throws(() => validateReset({ ...input, password }), { status: 400 });
  }
  assert.doesNotThrow(() => validateReset({ ...input, password: 'é'.repeat(36) }));
  assert.doesNotThrow(() => validateReset(input));
});

test('group picker is paginated and institution-scoped in both queries', async () => {
  const { service, events } = fixture();
  const result = await service.listGroups(actor, { search: 'math', limit: 999, offset: 50, college: 'College B' });
  assert.equal(result.limit, 50);
  assert.equal(result.offset, 50);
  for (const event of events) {
    assert.match(event.sql, /g.college_name = \?/);
    assert.deepEqual(event.params, ['College A', '%math%', '%math%']);
  }
});
