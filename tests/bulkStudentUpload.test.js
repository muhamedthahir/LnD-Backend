const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createBulkStudentUploadService } = require('../services/bulkStudentUploadService');
const { normalizeRows, validateStudent } = require('../utils/bulkStudentRows');

const student = (index = 0) => ({ rowNumber: index + 2, name: `Student ${index}`, email: `student${index}@example.test`, roll_number: String(index), department: 'Computer Science', section: '1', degree: 'B.Tech' });
const actor = { id: 1, role: 'college_admin', college_name: 'Example College' };
const job = rows => ({ id: '00000000-0000-0000-0000-000000000001', created_by: 1, college_name: 'Example College', status: 'queued', total: rows.length, rows_json: rows, processed: 0, created: 0, email_warnings: 0, errors_json: [], pending_invite: null });

function setup(options = {}) {
  const calls = [];
  const inserted = [];
  const connection = {
    async beginTransaction() { calls.push('begin'); },
    async commit() { calls.push('commit'); },
    async rollback() { calls.push('rollback'); },
    release() { calls.push('release'); },
    async execute(sql, params) {
      calls.push({ sql, params });
      if (options.execute) return options.execute(sql, params);
      if (sql.startsWith('SELECT id FROM users')) return [options.existing ? [{ id: 10 }] : []];
      if (sql.includes('GET_LOCK')) return [[{ acquired: options.lock ?? 1 }]];
      if (sql.includes("status IN ('queued', 'running')")) return [options.queuedJob ? [options.queuedJob] : []];
      return [{ affectedRows: 1 }];
    }
  };
  const db = { execute: (...args) => connection.execute(...args), getConnection: async () => connection };
  const service = createBulkStudentUploadService({ db, log: () => {}, generateOTP: () => '123456', getOTPExpiration: () => new Date(),
    ensureDepartment: async value => { calls.push('department'); return value; },
    ensureDegree: async value => { calls.push('degree'); return value; },
    createUser: async (value, executor) => { assert.equal(executor, connection); if (options.createError) throw options.createError; inserted.push(value); calls.push('insert'); },
    sendInvite: async (...args) => { calls.push('email'); if (options.sendInvite) return options.sendInvite(...args); return { success: true }; }
  });
  return { service, connection, calls, inserted };
}

test('normalizes spreadsheet headers and cells, preserves Excel row numbers and zero rolls', () => {
  const rows = normalizeRows([{ ' Name ': ' Student ', EMAIL: ' STUDENT@EXAMPLE.TEST ', roll_number: 0, department: ' CSE ', Section: '', __rowNum__: 4 }]);
  assert.equal(rows[0].email, 'student@example.test');
  assert.equal(rows[0].roll_number, '0');
  assert.equal(rows[0].section, '1');
  assert.equal(rows[0].rowNumber, 5);
  assert.equal(validateStudent(rows[0]), null);
  assert.throws(() => normalizeRows([]), /no student/);
  assert.throws(() => normalizeRows([{ Name: 'Student', Email: 'test@example.test' }]), /template columns/);
  assert.match(validateStudent({ ...student(), email: 'invalid' }), /email/);
});

test('student and durable checkpoint commit before email; repeated catalogs resolve once', async () => {
  const { service, connection, calls, inserted } = setup();
  const upload = job([student(0), student(1)]);
  await service.processJob(connection, upload);
  assert.equal(inserted.length, 2);
  assert.equal(calls.filter(value => value === 'department').length, 1);
  assert.equal(calls.filter(value => value === 'degree').length, 1);
  assert.ok(calls.indexOf('commit') < calls.indexOf('email'));
  assert.ok(calls.some(value => value.sql?.includes('processed = ?') && value.params[1] === 2));
  assert.ok(calls.some(value => value.sql?.includes("status = 'completed', rows_json = NULL")));
  assert.equal(inserted[0].college_name, actor.college_name);
  assert.equal(inserted[0].password, null);
});

test('a restart resumes the committed row and pending invitation instead of creating it again', async () => {
  const { service, connection, inserted, calls } = setup();
  const upload = { ...job([student(0), student(1)]), processed: 1, created: 1, pending_invite: { email: student(0).email, name: student(0).name, otp: '123456' } };
  await service.processJob(connection, upload);
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].email, student(1).email);
  assert.equal(calls.filter(value => value === 'email').length, 2);
  assert.equal(upload.created, 2);
});

test('duplicate and invalid students produce row errors without invitations', async () => {
  const { service, connection, inserted, calls } = setup({ existing: true });
  await service.processJob(connection, job([student(0), { ...student(1), roll_number: '' }]));
  assert.equal(inserted.length, 0);
  assert.equal(calls.includes('email'), false);
  const checkpoint = calls.filter(value => value.sql?.includes('processed = ?')).at(-1);
  assert.match(checkpoint.params[2], /Row 2: A user/);
  assert.match(checkpoint.params[2], /Row 3: Roll number/);
});

test('email failures are warnings; creation failures roll back the student and checkpoint', async () => {
  const warnings = setup({ sendInvite: async () => ({ success: false }) });
  const upload = job([student()]);
  await warnings.service.processJob(warnings.connection, upload);
  assert.equal(upload.created, 1);
  assert.equal(upload.email_warnings, 1);
  const failed = setup({ createError: Object.assign(new Error('database unavailable'), { code: 'ER_ACCESS_DENIED_ERROR' }) });
  await assert.rejects(failed.service.processJob(failed.connection, job([student()])), /database unavailable/);
  assert.ok(failed.calls.includes('rollback'));
  assert.equal(failed.calls.includes('commit'), false);
  assert.equal(failed.calls.includes('email'), false);
});

test('worker uses a cross-instance lock and always releases its connection', async () => {
  const blocked = setup({ lock: 0 });
  await blocked.service.tick();
  assert.equal(blocked.calls.includes('release'), true);
  assert.equal(blocked.calls.some(value => value.sql?.includes('SELECT * FROM bulk_student')), false);
  const failed = setup({ queuedJob: job([student()]), createError: Object.assign(new Error('broken schema'), { code: 'ER_BAD_FIELD_ERROR' }) });
  await failed.service.tick();
  assert.ok(failed.calls.some(value => value.sql?.includes("status = 'failed'")));
  assert.ok(failed.calls.some(value => value.sql?.includes('RELEASE_LOCK')));
  assert.equal(failed.calls.at(-1), 'release');
});

test('chunk uploads enforce ownership, institution, sequence and total before changing data', async () => {
  const upload = { ...job([student()]), total: 2, received: 0, status: 'receiving' };
  const { service, calls } = setup({ execute: async sql => sql.startsWith('SELECT id, created_by') ? [[upload]] : [{ affectedRows: 1 }] });
  await assert.rejects(service.acceptChunk(actor, 'Another College', { total: 2, offset: 0, rows: [student()] }), /your institution/);
  await assert.rejects(service.acceptChunk(actor, actor.college_name, { jobId: upload.id, total: 2, offset: 1, rows: [student()] }), /in order/);
  await assert.rejects(service.acceptChunk({ ...actor, id: 2 }, actor.college_name, { jobId: upload.id, total: 2, offset: 0, rows: [student()] }), /cannot modify/);
  assert.equal(calls.some(value => value.sql?.startsWith('UPDATE bulk_student')), false);
  const result = await service.acceptChunk(actor, actor.college_name, { jobId: upload.id, total: 2, offset: 0, rows: [student()] });
  assert.equal(result.status, 'receiving');
  assert.equal(result.received, 1);
});

test('acknowledged batches are idempotent and job progress never exposes its row payload or OTP', async () => {
  const upload = { ...job([student()]), received: 1, status: 'queued' };
  const { service, calls } = setup({ execute: async sql => sql.startsWith('SELECT id, created_by') ? [[upload]] : [{ affectedRows: 1 }] });
  const result = await service.acceptChunk(actor, actor.college_name, { jobId: upload.id, total: 1, offset: 0, rows: [student()] });
  assert.equal(result.received, 1);
  assert.equal(calls.some(value => value.sql?.startsWith('UPDATE bulk_student')), false);
  const publicJob = await service.getJob(actor, upload.id);
  assert.equal('rows_json' in publicJob, false);
  assert.equal('pending_invite' in publicJob, false);
  await assert.rejects(service.getJob({ ...actor, id: 99 }, upload.id), /cannot view/);
});
