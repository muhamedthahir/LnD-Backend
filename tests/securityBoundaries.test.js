const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const requestBudget = require('../middleware/requestBudget');

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json() { return this; },
    set() {}
  };
}

test('authentication budget rejects excess attempts independently by client', () => {
  const limit = requestBudget(2, 60_000);
  let accepted = 0;
  const next = () => accepted++;
  const client = { ip: '127.0.0.1' };
  limit(client, response(), next);
  limit(client, response(), next);
  const blocked = response();
  limit(client, blocked, next);
  limit({ ip: '127.0.0.2' }, response(), next);
  assert.equal(blocked.statusCode, 429);
  assert.equal(accepted, 3);
});

test('assessment guard rejects records outside the authenticated institution', async () => {
  const queries = [];
  const pool = {
    async execute(sql, params) {
      queries.push({ sql, params });
      if (sql.includes('FROM institutions')) return [[{ id: 7 }]];
      return [params[0] === '11' && params[1] === 7 ? [{ id: 11 }] : []];
    }
  };
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '../middleware/assessmentScope.js'), 'utf8');
  vm.runInNewContext(source, { module, require: () => pool });
  const guard = module.exports('assessment', req => req.params.id);
  const user = { role: 'college_admin', college_name: 'QA Campus' };
  let passed = false;
  await guard({ user, params: { id: '11' } }, response(), error => {
    if (error) throw error;
    passed = true;
  });
  assert.equal(passed, true);
  const denied = response();
  await guard({ user, params: { id: '12' } }, denied, () => assert.fail('foreign record allowed'));
  assert.equal(denied.statusCode, 403);
  assert.match(queries.at(-1).sql, /institution_id = \?/);
  const move = response();
  await guard({ user, params: { id: '11' }, body: { institution_id: 8 } }, move, () => assert.fail('foreign institution accepted'));
  assert.equal(move.statusCode, 403);
});
