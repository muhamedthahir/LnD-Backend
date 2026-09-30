const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Load services without opening a database connection or changing real records.
function load(file, dependencies) {
  const sandbox = { module: { exports: {} }, require: name => {
    if (name in dependencies) return dependencies[name];
    throw new Error(`Unexpected dependency: ${name}`);
  }};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), sandbox);
  return sandbox.module.exports;
}
const plain = value => JSON.parse(JSON.stringify(value));

for (const count of [0, 1, 25]) {
  test(`course progress stays at five reads for ${count} topics and preserves grouping`, async () => {
    const calls = [];
    const topics = Array.from({ length: count }, (_, i) => ({ id: i + 1, name: `Topic ${i + 1}` }));
    const lessons = count ? [{ id: 20, topic_id: count, progress_percentage: 50 }, { id: 21, topic_id: 1, progress_percentage: 0 }] : [];
    const practices = count ? [{ id: 30, topic_id: count, items_completed: 2 }] : [];
    const pool = { execute: async (sql, params) => {
      calls.push({ sql, params });
      assert.deepEqual(plain(params), [7, 9]);
      if (sql.includes('FROM topics t')) return [topics];
      if (sql.includes('FROM segments s')) return [lessons];
      if (sql.includes('FROM practice_segments ps')) return [practices];
      if (sql.includes('FROM user_courses')) return [count ? [{ progress_percentage: 42, status: 'in_progress' }] : []];
      throw new Error('Unexpected SQL');
    }};
    let summaries = 0;
    const service = load('services/ProgressService.js', {
      '../config/db': pool,
      '../models/UserSegmentProgress': {},
      '../models/UserTopicProgress': { getCourseProgressSummary: async (user, course) => {
        assert.equal(user, 7); assert.equal(course, 9); summaries++;
        return { completed_topics: 0, total_time_spent: 80 };
      }},
      '../models/LessonSubmission': {},
      '../models/ProgrammingSubmission': {},
      '../models/MCQSubmission': {}
    });
    const result = plain(await service.getCourseProgress(7, 9));
    assert.equal(calls.length + summaries, 5);
    assert.equal(result.topics_total, count);
    assert.equal(result.progress_percentage, count ? 42 : 0);
    assert.equal(result.overall_progress, result.progress_percentage);
    assert.equal(result.status, count ? 'in_progress' : 'not_started');
    for (const topic of result.topics) {
      assert.deepEqual(topic.lessons, lessons.filter(row => row.topic_id === topic.id));
      assert.deepEqual(topic.practice_segments, practices.filter(row => row.topic_id === topic.id));
    }
    assert.equal(result.total_time_spent, 80);
  });
}

test('segment detail tolerates optional missing tables and retains JSON content', async () => {
  const calls = [];
  const Segment = load('models/Segment.js', { '../config/db': { execute: async sql => {
    calls.push(sql);
    if (sql.includes('FROM segments')) return [[{ id: 1, content: '{"text":"hello"}' }]];
    if (sql.includes('FROM concepts')) return [[{ id: 2 }]];
    if (sql.includes('FROM inclass_practice')) throw Object.assign(new Error('missing'), { code: 'ER_NO_SUCH_TABLE' });
    return [[]];
  }}});
  assert.deepEqual(plain(await Segment.getWithRelatedData(1)), {
    id: 1, content: { text: 'hello' }, concepts: [{ id: 2 }], inclass_practice: [], postclass_practice: []
  });
  assert.equal(calls.length, 4);
});

test('segment detail propagates real database failures', async () => {
  const Segment = load('models/Segment.js', { '../config/db': { execute: async sql => {
    if (sql.includes('FROM segments')) return [[{ id: 1 }]];
    throw Object.assign(new Error('connection lost'), { code: 'ECONNRESET' });
  }}});
  await assert.rejects(Segment.getWithRelatedData(1), { code: 'ECONNRESET' });
});

test('missing segment does not issue related queries', async () => {
  let calls = 0;
  const Segment = load('models/Segment.js', { '../config/db': { execute: async () => { calls++; return [[]]; } }});
  assert.equal(await Segment.getWithRelatedData(1), null);
  assert.equal(calls, 1);
});
