const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const headers = require('../utils/reportQuestionHeaders');
const ensureSchema = require('../utils/ensureProgrammingSchema');
function model(file, db) {
  const sandbox = { module: { exports: {} }, console, require: name => {
    if (name === '../config/db') return db;
    if (name === '../utils/ensureColumns') return require('../utils/ensureColumns');
    if (name === 'uuid') return { v4: () => 'test' };
    if (name === './AssessmentSegment') return db.segmentModel;
    if (name === '../utils/assessmentConfigUtils') return {};
    throw new Error(name);
  } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'models', file), 'utf8'), sandbox);
  return sandbox.module.exports;
}
const plain = value => JSON.parse(JSON.stringify(value));
for (const size of [0, 1, 100]) test(`question bank page with ${size} banks uses at most three reads`, async () => {
  const calls = [];
  const rows = Array.from({ length: size }, (_, id) => ({ id: id + 1 }));
  const Bank = model('QuestionBank.js', { execute: async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('COUNT(*) as total')) return [[{ total: size }]];
    if (sql.includes('FROM question_bank_tags qbt')) return [[{ question_bank_id: String(size), id: 5, name: 'Arrays' }]];
    return [rows];
  } });
  const result = plain(await Bank.getAllPaginated({ institutionId: 3, limit: 100 }));
  assert.equal(calls.length, size ? 3 : 2);
  assert.equal(result.total, size);
  if (size) assert.deepEqual(result.questionBanks.at(-1).tags, [{ id: 5, name: 'Arrays' }]);
  assert.match(calls[0].sql, /created_at DESC, qb.id DESC/);
  assert.ok(!calls[1].sql.includes('JOIN'));
});
for (const file of ['Assessment.js', 'AssessmentAdministrator.js', 'MailerTemplate.js', 'MailStatus.js']) test(`${file} starts page and count together and bounds pagination`, async () => {
  const calls = [];
  let release;
  const ready = new Promise(resolve => { release = resolve; });
  const Model = model(file, { execute: async (sql, params) => {
    calls.push({ sql, params });
    if (calls.length === 2) release();
    await ready;
    return sql.includes('COUNT(*) as total') ? [[{ total: 4 }]] : [[]];
  } });
  const result = await Model.getAllPaginated({ page: -1, pageSize: 100000, limit: 'invalid', offset: -5, search: 'Example' });
  assert.equal(result.total, 4);
  assert.equal(calls.length, 2);
  assert.ok(!/LIMIT (NaN|-)|OFFSET (NaN|-)/.test(calls[0].sql));
  assert.ok(!calls[1].sql.includes('ORDER BY'));
  assert.ok(!calls[1].sql.includes('LEFT JOIN'));
  assert.deepEqual(plain(calls[0].params), plain(calls[1].params));
});
test('report keeps segment order and programming-before-MCQ order with two reads', async () => {
  const calls = [];
  const db = { execute: async (sql, params) => {
    calls.push({ sql, params });
    return sql.includes('programming_questions')
      ? [[{ practice_segment_id: 1, id: 10, name: 'Code' }, { practice_segment_id: 2, id: 20, name: 'Code 2' }]]
      : [[{ practice_segment_id: '1', id: 11, name: 'MCQ' }]];
  } };
  assert.deepEqual(await headers(db, [{ id: 2, name: 'Second' }, { id: 1, name: 'First' }]), [
    { questionId: 20, questionName: 'Code 2', segmentId: 2, segmentName: 'Second' },
    { questionId: 10, questionName: 'Code', segmentId: 1, segmentName: 'First' },
    { questionId: 11, questionName: 'MCQ', segmentId: 1, segmentName: 'First' }
  ]);
  assert.equal(calls.length, 2);
  assert.deepEqual(await headers(db, []), []);
  assert.equal(calls.length, 2);
});
for (const table of ['programming_submissions', 'mcq_submissions']) test(`${table} schema checks share work and ready schemas trigger zero ALTERs`, async () => {
  const calls = [];
  const db = { execute: async sql => {
    calls.push(sql);
    return sql.startsWith('SHOW COLUMNS') ? [[
      { Field: 'assessment_user_mapping_id' }, { Field: 'assessment_segment_id' }, { Field: 'execution_result' },
      { Field: 'status', Type: "enum('attempted')" }, { Field: 'submission_id', Null: 'YES' }
    ]] : [[]];
  } };
  await Promise.all(Array.from({ length: 20 }, () => ensureSchema(db, table)));
  await ensureSchema(db, table);
  assert.equal(calls.length, 3);
  assert.ok(!calls.some(sql => sql.startsWith('ALTER')));
});
test('failed submission compatibility check retries and only changes missing properties', async () => {
  let failed = false;
  const calls = [];
  const db = { execute: async sql => {
    calls.push(sql);
    if (!failed) { failed = true; throw Object.assign(new Error('Unavailable'), { code: 'ECONNRESET' }); }
    if (sql.startsWith('SHOW COLUMNS')) return [[
      { Field: 'assessment_user_mapping_id' }, { Field: 'assessment_segment_id' }, { Field: 'execution_result' },
      { Field: 'status', Type: "enum('pending')" }, { Field: 'submission_id', Null: 'YES' }
    ]];
    return [[]];
  } };
  await assert.rejects(ensureSchema(db), /Unavailable/);
  await ensureSchema(db);
  assert.equal(calls.filter(sql => sql.startsWith('ALTER')).length, 1);
});

test('practice MCQ options use one bulk read and preserve flags and ordering', async () => {
  const calls = [];
  const Model = model('PracticeSegment.js', { execute: async (sql, params) => {
    calls.push({ sql, params });
    return sql.includes('FROM options') ? [[
      { mcq_multiselect_question_id: 10, id: 1, text: 'One', is_correct: 0, order: 1, explanation: 'First' },
      { mcq_multiselect_question_id: '10', id: 2, text: 'Two', is_correct: 1, order: 2, explanation: 'Second' }
    ]] : [[{ id: 1, mcq_question_id: 10 }, { id: 2, mcq_question_id: 20 }, { id: 3, mcq_question_id: null }]];
  } });
  const rows = plain(await Model.getMcqQuestions(3));
  assert.equal(calls.length, 2);
  assert.deepEqual(plain(calls[1].params), [10, 20]);
  assert.equal(rows[0].options[1].is_correct, 1);
  assert.deepEqual(rows[1].options, []);
  assert.deepEqual(rows[2].options, []);
});

test('institution schema is shared and its count read has no sorting', async () => {
  const calls = [];
  const Model = model('Institution.js', { execute: async sql => {
    calls.push(sql);
    if (sql.startsWith('SHOW COLUMNS')) return [['address', 'spoc_contact_number', 'alternate_contact', 'alternate_email', 'status'].map(Field => ({ Field }))];
    return sql.includes('COUNT(*)') ? [[{ total: 2 }]] : [[]];
  } });
  await Promise.all([Model.ensureDetailColumns(), Model.ensureDetailColumns()]);
  const result = await Model.getAllPaginated({ search: 'College', limit: 10, offset: 0 });
  assert.equal(result.total, 2);
  assert.equal(calls.filter(sql => sql.startsWith('SHOW')).length, 1);
  assert.ok(!calls.some(sql => sql.startsWith('ALTER')));
  assert.ok(!calls.find(sql => sql.includes('COUNT(*)')).includes('ORDER BY'));
});

test('assessment segment questions bulk-load all segments with preserved scoring fields', async () => {
  const calls = [];
  const Segment = model('AssessmentSegment.js', { execute: async (sql, params) => {
    calls.push({ sql, params });
    return [[{ assessment_segment_id: 2, positive_marks: 5, negative_marks: 1, neutral_marks: 0 }]];
  } });
  const result = plain(await Segment.getQuestionsBySegmentIds([2, 7, 12]));
  assert.equal(calls.length, 2);
  assert.deepEqual(plain(calls[0].params), [2, 7, 12]);
  assert.match(calls[0].sql, /IN \(\?,\?,\?\)/);
  assert.equal(result.programmingQuestions[0].positive_marks, 5);
  assert.equal(result.mcqQuestions[0].negative_marks, 1);
  assert.deepEqual(plain(await Segment.getQuestionsBySegmentIds([])), { programmingQuestions: [], mcqQuestions: [] });
  assert.equal(calls.length, 2);
});

test('assessment detail groups question payloads without fetching each segment again', async () => {
  const db = { execute: async () => [[{ id: 9 }]], segmentModel: {
    getByAssessmentId: async () => [{ id: 2 }, { id: 7 }],
    getQuestionsBySegmentIds: async ids => {
      assert.deepEqual(plain(ids), [2, 7]);
      return { programmingQuestions: [{ assessment_segment_id: '2', question_id: 5 }], mcqQuestions: [{ assessment_segment_id: 7, question_id: 8 }] };
    }
  } };
  const Assessment = model('Assessment.js', db);
  const result = plain(await Assessment.getWithSegments(9));
  assert.equal(result.segments[0].programming_questions[0].question_id, 5);
  assert.deepEqual(result.segments[0].mcq_questions, []);
  assert.equal(result.segments[1].mcq_questions[0].question_id, 8);
});
