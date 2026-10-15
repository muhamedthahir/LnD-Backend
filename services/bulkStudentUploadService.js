const { randomUUID } = require('node:crypto');
const { validateStudent } = require('../utils/bulkStudentRows');
const parse = value => typeof value === 'string' ? JSON.parse(value) : value;

// The accepted workbook and progress are durable. An advisory lock prevents two
// application instances from processing the same job; disconnect releases it.
function createBulkStudentUploadService({ db, createUser, ensureDepartment, ensureDegree, generateOTP, getOTPExpiration, sendInvite, log = console.error }) {
  let schema;
  let running = false;
  let timer;
  let lastCleanup = 0;
  const ensureSchema = () => {
    if (!schema) schema = db.execute(`CREATE TABLE IF NOT EXISTS bulk_student_uploads (
      id CHAR(36) PRIMARY KEY, created_by INT NOT NULL, college_name VARCHAR(255) NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'queued', total INT NOT NULL, processed INT NOT NULL DEFAULT 0,
      created INT NOT NULL DEFAULT 0, email_warnings INT NOT NULL DEFAULT 0, received INT NOT NULL DEFAULT 0,
      rows_json JSON NULL, errors_json JSON NOT NULL, pending_invite JSON NULL, failure_message VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_bulk_upload_status_created (status, created_at)
    )`).catch(error => { schema = null; throw error; });
    return schema;
  };
  const publicJob = job => ({ jobId: job.id, status: job.status, total: job.total, processed: job.processed,
    created: job.created, emailWarnings: job.email_warnings, errors: parse(job.errors_json) || [], error: job.failure_message || undefined });

  async function finishInvite(connection, job) {
    const invite = parse(job.pending_invite);
    if (!invite) return;
    try {
      const result = await sendInvite(invite.email, invite.name, invite.otp, job.created_by);
      if (!result?.success) job.email_warnings += 1;
    } catch (_) { job.email_warnings += 1; }
    await connection.execute('UPDATE bulk_student_uploads SET pending_invite = NULL, email_warnings = ? WHERE id = ?', [job.email_warnings, job.id]);
    job.pending_invite = null;
  }

  async function processJob(connection, job) {
    const rows = parse(job.rows_json);
    const errors = parse(job.errors_json) || [];
    const departments = new Map();
    const degrees = new Map();
    await connection.execute("UPDATE bulk_student_uploads SET status = 'running' WHERE id = ?", [job.id]);
    await finishInvite(connection, job);
    for (let index = job.processed; index < rows.length; index++) {
      const row = rows[index];
      let rowError = validateStudent(row);
      let invite = null;
      let created = job.created;
      if (!rowError) {
        const [[existing]] = await connection.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [row.email]);
        if (existing) rowError = 'A user with this email already exists';
      }
      // Resolve repeated catalog values once per workbook, outside the student transaction.
      let department;
      let degree = null;
      if (!rowError) {
        const departmentKey = row.department.toLowerCase().replace(/\s+/g, ' ');
        if (!departments.has(departmentKey)) departments.set(departmentKey, await ensureDepartment(row.department));
        department = departments.get(departmentKey);
        if (row.degree) {
          const degreeKey = row.degree.toLowerCase().replace(/\s+/g, ' ');
          if (!degrees.has(degreeKey)) degrees.set(degreeKey, await ensureDegree(row.degree));
          degree = degrees.get(degreeKey);
        }
      }
      await connection.beginTransaction();
      try {
        if (!rowError) {
          const otp = generateOTP();
          try {
            await createUser({ ...row, department, degree, password: null, role: 'student',
              college_name: job.college_name, otp, otp_expires_at: getOTPExpiration() }, connection);
            created += 1;
            invite = { email: row.email, name: row.name, otp };
          } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') rowError = 'A user with this email already exists';
            else if (['ER_DATA_TOO_LONG', 'ER_TRUNCATED_WRONG_VALUE', 'ER_BAD_NULL_ERROR'].includes(error.code)) rowError = 'A student field is invalid or too long';
            else throw error;
          }
        }
        if (rowError) errors.push(`Row ${row.rowNumber}: ${rowError}`);
        // Commit the student and its checkpoint together. A restart cannot insert
        // the same row again or lose its invitation between these two writes.
        await connection.execute(`UPDATE bulk_student_uploads SET processed = ?, created = ?, errors_json = ?, pending_invite = ? WHERE id = ?`,
          [index + 1, created, JSON.stringify(errors), invite ? JSON.stringify(invite) : null, job.id]);
        await connection.commit();
      } catch (error) { await connection.rollback(); throw error; }
      job.processed = index + 1;
      job.created = created;
      job.pending_invite = invite;
      await finishInvite(connection, job);
    }
    await connection.execute("UPDATE bulk_student_uploads SET status = 'completed', rows_json = NULL, pending_invite = NULL WHERE id = ?", [job.id]);
  }

  async function tick() {
    if (running) return;
    running = true;
    let connection;
    let locked = false;
    try {
      await ensureSchema();
      connection = await db.getConnection();
      const [[lock]] = await connection.execute("SELECT GET_LOCK('campuszen_bulk_student_uploads', 0) AS acquired");
      locked = Number(lock.acquired) === 1;
      if (!locked) return;
      if (Date.now() - lastCleanup > 3600000) {
        await connection.execute("UPDATE bulk_student_uploads SET status = 'failed', rows_json = NULL, failure_message = 'This incomplete file transfer expired. Upload the file again.' WHERE status = 'receiving' AND updated_at < DATE_SUB(NOW(), INTERVAL 1 DAY)");
        lastCleanup = Date.now();
      }
      const [[job]] = await connection.execute("SELECT * FROM bulk_student_uploads WHERE status IN ('queued', 'running') ORDER BY created_at, id LIMIT 1");
      if (!job) return;
      try { await processJob(connection, job); }
      catch (error) {
        log('Bulk student upload worker failed:', error.code || 'unexpected_error', 'job:', job.id);
        // A lost connection leaves the last committed checkpoint resumable. Other
        // failures are reported explicitly instead of leaving the UI spinning.
        if (!['ECONNRESET', 'PROTOCOL_CONNECTION_LOST', 'ETIMEDOUT'].includes(error.code)) {
          await connection.execute("UPDATE bulk_student_uploads SET status = 'failed', failure_message = ?, rows_json = NULL, pending_invite = NULL WHERE id = ?",
            ['Student import stopped because of a server error. Already-created students are retained; contact an administrator before retrying.', job.id]);
        }
      }
    } catch (error) { log('Bulk student upload queue error:', error.code || 'unexpected_error'); }
    finally {
      if (connection) {
        if (locked) { try { await connection.execute("SELECT RELEASE_LOCK('campuszen_bulk_student_uploads')"); } catch (_) {} }
        connection.release();
      }
      running = false;
    }
  }

  return {
    async acceptChunk(actor, college, { jobId, total, offset, rows }) {
      if (!actor?.id || !['primary_admin', 'campuszen_admin', 'college_admin'].includes(actor.role)) throw Object.assign(new Error('Administrator access required'), { status: 403 });
      if (actor.role === 'college_admin' && (!actor.college_name || college !== actor.college_name)) throw Object.assign(new Error('You can only upload students to your institution'), { status: 403 });
      if (!Number.isInteger(total) || total < 1 || total > 5000 || !Number.isInteger(offset) || offset < 0 || !Array.isArray(rows) || !rows.length || offset + rows.length > total) throw Object.assign(new Error('Invalid student upload batch'), { status: 400 });
      if (jobId && !/^[a-f0-9-]{36}$/.test(jobId)) throw Object.assign(new Error('Invalid upload ID'), { status: 400 });
      if (!jobId && offset !== 0) throw Object.assign(new Error('Start the upload with its first batch'), { status: 400 });
      await ensureSchema();
      const id = jobId || randomUUID();
      const connection = await db.getConnection();
      let accepted;
      try {
        await connection.beginTransaction();
        if (!jobId) await connection.execute("INSERT INTO bulk_student_uploads (id, created_by, college_name, status, total, rows_json, errors_json) VALUES (?, ?, ?, 'receiving', ?, '[]', '[]')", [id, actor.id, college, total]);
        const [[job]] = await connection.execute('SELECT id, created_by, college_name, status, total, received FROM bulk_student_uploads WHERE id = ? FOR UPDATE', [id]);
        if (!job) throw Object.assign(new Error('Upload not found'), { status: 404 });
        if (Number(job.created_by) !== Number(actor.id) || job.college_name !== college) throw Object.assign(new Error('You cannot modify this upload'), { status: 403 });
        if (job.total !== total) throw Object.assign(new Error('The upload total changed. Start a new upload.'), { status: 409 });
        // Retrying an already-acknowledged batch never duplicates its rows.
        if (offset < job.received && offset + rows.length <= job.received) {
          accepted = { jobId: id, status: job.status, total, received: job.received, processed: 0, created: 0 };
        } else {
          if (job.status !== 'receiving' || offset !== job.received) throw Object.assign(new Error('Upload batches must arrive in order'), { status: 409 });
          const received = offset + rows.length;
          const status = received === total ? 'queued' : 'receiving';
          await connection.execute('UPDATE bulk_student_uploads SET rows_json = JSON_MERGE_PRESERVE(rows_json, CAST(? AS JSON)), received = ?, status = ? WHERE id = ?', [JSON.stringify(rows), received, status, id]);
          accepted = { jobId: id, status, total, received, processed: 0, created: 0 };
        }
        await connection.commit();
      } catch (error) { await connection.rollback(); throw error; }
      finally { connection.release(); }
      if (accepted.status === 'queued') setImmediate(tick);
      return accepted;
    },
    async enqueue(actor, college, rows) {
      if (!actor?.id || !['primary_admin', 'campuszen_admin', 'college_admin'].includes(actor.role)) throw Object.assign(new Error('Administrator access required'), { status: 403 });
      if (actor.role === 'college_admin' && (!actor.college_name || college !== actor.college_name)) throw Object.assign(new Error('You can only upload students to your institution'), { status: 403 });
      await ensureSchema();
      const id = randomUUID();
      await db.execute('INSERT INTO bulk_student_uploads (id, created_by, college_name, total, rows_json, errors_json) VALUES (?, ?, ?, ?, ?, ?)',
        [id, actor.id, college, rows.length, JSON.stringify(rows), '[]']);
      setImmediate(tick);
      return { jobId: id, status: 'queued', total: rows.length, processed: 0, created: 0, errors: [] };
    },
    async getJob(actor, id) {
      if (!actor?.id || !['primary_admin', 'campuszen_admin', 'college_admin'].includes(actor.role)) throw Object.assign(new Error('Administrator access required'), { status: 403 });
      if (!/^[a-f0-9-]{36}$/.test(id)) throw Object.assign(new Error('Upload not found'), { status: 404 });
      await ensureSchema();
      const [[job]] = await db.execute('SELECT id, created_by, college_name, status, total, processed, created, email_warnings, errors_json, failure_message FROM bulk_student_uploads WHERE id = ?', [id]);
      if (!job) throw Object.assign(new Error('Upload not found'), { status: 404 });
      if (Number(actor.id) !== Number(job.created_by) || (actor.role === 'college_admin' && actor.college_name !== job.college_name)) throw Object.assign(new Error('You cannot view this upload'), { status: 403 });
      return publicJob(job);
    },
    start() { if (!timer) { timer = setInterval(tick, 5000); timer.unref(); setImmediate(tick); } },
    stop() { clearInterval(timer); timer = null; },
    tick, processJob, ensureSchema
  };
}

module.exports = { createBulkStudentUploadService };
