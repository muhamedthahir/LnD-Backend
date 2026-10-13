const crypto = require('node:crypto');
const s3 = require('./s3Service');
const MAX_BYTES = 10 * 1024 * 1024;
const PURPOSES = new Set(['mcq', 'programming', 'testcases']);
function fail(message, statusCode = 400) { return Object.assign(new Error(message), { statusCode }); }
function secret() { if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required'); return process.env.JWT_SECRET; }
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return body + '.' + crypto.createHmac('sha256', secret()).update('spreadsheet-import:' + body).digest('base64url');
}
function verify(ticket, userId, purpose) {
  if (typeof ticket !== 'string' || ticket.length > 2048) throw fail('Select an Excel file before importing.');
  const [body, signature, extra] = ticket.split('.');
  const expected = crypto.createHmac('sha256', secret()).update('spreadsheet-import:' + body).digest();
  const actual = Buffer.from(signature || '', 'base64url');
  if (extra || actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) throw fail('Invalid upload ticket.', 403);
  let payload;
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString()); } catch { throw fail('Invalid upload ticket.', 403); }
  if (String(payload.userId) !== String(userId) || payload.purpose !== purpose || !PURPOSES.has(purpose)) throw fail('This upload belongs to another account or import type.', 403);
  if (!Number.isFinite(payload.expiresAt) || payload.expiresAt <= Date.now()) throw fail('The upload expired. Select the file and upload it again.');
  if (!Number.isInteger(payload.bytes) || payload.bytes < 1 || payload.bytes > MAX_BYTES || !payload.key?.startsWith(`imports/spreadsheets/${userId}/`)) throw fail('Invalid upload ticket.', 403);
  return payload;
}
async function prepare(userId, { fileName, fileSize, purpose } = {}) {
  const extension = typeof fileName === 'string' && fileName.length <= 200 ? fileName.toLowerCase().match(/\.(xlsx|xls)$/)?.[1] : null;
  if (!extension || !PURPOSES.has(purpose)) throw fail('Choose an Excel workbook (.xlsx or .xls) and a valid import type.');
  if (!Number.isInteger(fileSize) || fileSize < 1 || fileSize > MAX_BYTES) throw fail('The workbook must be between 1 byte and 10 MB.');
  const key = `imports/spreadsheets/${userId}/${crypto.randomUUID()}.${extension}`;
  const contentType = extension === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/vnd.ms-excel';
  const upload = await s3.generatePresignedUploadUrl(key, contentType, 600);
  const importTicket = sign({ userId, purpose, key, bytes: fileSize, expiresAt: Date.now() + 15 * 60 * 1000 });
  return { presignedUrl: upload.presignedUrl, contentType, importTicket };
}
async function readWorkbook(req, purpose) {
  if (req.file?.buffer) {
    if (!req.file.buffer.length || req.file.buffer.length > MAX_BYTES) throw fail('The workbook must be between 1 byte and 10 MB.');
    return req.file.buffer;
  }
  const payload = verify(req.body?.importTicket, req.user?.id, purpose);
  try {
    const file = await s3.getFile(payload.key);
    if (file.contentLength !== payload.bytes || file.contentLength > MAX_BYTES) { file.body?.destroy?.(); throw fail('The uploaded file size does not match. Upload the workbook again.'); }
    const chunks = []; let bytes = 0;
    for await (const chunk of file.body) {
      bytes += chunk.length;
      if (bytes > payload.bytes || bytes > MAX_BYTES) { file.body?.destroy?.(); throw fail('The workbook is too large.'); }
      chunks.push(Buffer.from(chunk));
    }
    if (bytes !== payload.bytes) throw fail('The upload is incomplete. Upload the workbook again.');
    return Buffer.concat(chunks);
  } catch (error) {
    if (error.name === 'NoSuchKey') throw fail('The upload expired or was already imported. Upload the workbook again.');
    throw error;
  } finally {
    await s3.deleteFile(payload.key).catch(() => console.warn('Temporary spreadsheet cleanup failed.'));
  }
}
module.exports = { prepare, readWorkbook, sign, verify, MAX_BYTES };
