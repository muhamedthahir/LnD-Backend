// Two reads per report, regardless of the number of practice segments.
async function reportQuestionHeaders(db, segments) {
  if (!segments.length) return [];
  const ids = segments.map(segment => segment.id);
  const placeholders = ids.map(() => '?').join(',');
  const [[programming], [mcq]] = await Promise.all([
    db.execute(`SELECT pspq.practice_segment_id, q.id, q.name FROM practice_segment_programming_questions pspq
      JOIN questions q ON q.id = pspq.question_id WHERE pspq.practice_segment_id IN (${placeholders})
      ORDER BY pspq.practice_segment_id, pspq.order_index`, ids),
    db.execute(`SELECT psmq.practice_segment_id, q.id, q.name FROM practice_segment_mcq_questions psmq
      JOIN questions q ON q.id = psmq.question_id WHERE psmq.practice_segment_id IN (${placeholders})
      ORDER BY psmq.practice_segment_id, psmq.order_index`, ids)
  ]);
  const grouped = new Map();
  for (const question of [...programming, ...mcq]) {
    const key = String(question.practice_segment_id);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(question);
  }
  return segments.flatMap(segment => (grouped.get(String(segment.id)) || []).map(question => ({
    questionId: question.id, questionName: question.name, segmentId: segment.id, segmentName: segment.name
  })));
}
module.exports = reportQuestionHeaders;
