const pool = require('../config/db');
const AssessmentSegment = require('../models/AssessmentSegment');

function groupByKey(rows, key) {
  const map = {};
  for (const row of rows) {
    const id = row[key];
    if (!map[id]) map[id] = [];
    map[id].push(row);
  }
  return map;
}

async function batchLoadLanguages(programmingQuestionIds) {
  if (!programmingQuestionIds.length) return {};
  const placeholders = programmingQuestionIds.map(() => '?').join(',');
  const [rows] = await pool.execute(
    `SELECT pql.programming_question_id, l.*
     FROM languages l
     INNER JOIN programming_question_languages pql ON l.id = pql.language_id
     WHERE pql.programming_question_id IN (${placeholders})`,
    programmingQuestionIds
  );
  return groupByKey(rows, 'programming_question_id');
}

async function batchLoadCodeTemplates(programmingQuestionIds) {
  if (!programmingQuestionIds.length) return {};
  const placeholders = programmingQuestionIds.map(() => '?').join(',');
  const [rows] = await pool.execute(
    `SELECT ct.*, l.name as language_name
     FROM code_templates ct
     LEFT JOIN languages l ON ct.language_id = l.id
     WHERE ct.programming_question_id IN (${placeholders})`,
    programmingQuestionIds
  );
  return groupByKey(rows, 'programming_question_id');
}

function buildProgrammingQuestionPayload(pqRow, assignment, segment, testCaseRows, languagesByQ, templatesByQ) {
  let allowedLanguages = (languagesByQ[pqRow.id] || []).map(({ programming_question_id, ...lang }) => lang);
  let codeTemplates = templatesByQ[pqRow.id] || [];

  const segmentRestriction = AssessmentSegment.parseAllowedLanguageIds(segment?.allowed_language_ids);
  if (segmentRestriction) {
    const allowedSet = new Set(segmentRestriction);
    allowedLanguages = allowedLanguages.filter((lang) => allowedSet.has(lang.id));
    codeTemplates = codeTemplates.filter((template) => allowedSet.has(template.language_id));
  }

  return {
    ...pqRow,
    question_type: 'PROGRAMMING',
    programming_question_id: pqRow.id,
    problem_statement: pqRow.name || pqRow.description,
    sequence_order: assignment.sequence_order,
    weightage: assignment.weightage,
    positive_marks: pqRow.positive_marks || pqRow.points || 0,
    negative_marks: pqRow.negative_marks || 0,
    neutral_marks: pqRow.neutral_marks || 0,
    allowed_languages: allowedLanguages,
    code_templates: codeTemplates.map((template) => ({
      language_id: template.language_id,
      language_name: template.language_name,
      template_code: template.template_code,
      solution_code: template.solution_code
    })),
    test_cases: (testCaseRows || []).map((tc) => ({
      id: tc.id,
      input: tc.input,
      expected_output: tc.expected_result,
      description: tc.description,
      is_hidden: tc.is_hidden,
      points: tc.weight
    }))
  };
}

/**
 * Batch-load MCQ + programming questions for a segment take view.
 */
async function loadQuestionsForSegmentTake({
  segmentId,
  mappingId,
  questionAssignments,
  shuffleOptionsInMcq,
  seededShuffleFn
}) {
  if (!questionAssignments?.length) return [];

  const progIds = questionAssignments
    .filter((a) => a.question_type === 'PROGRAMMING')
    .map((a) => a.question_id);
  const mcqIds = questionAssignments
    .filter((a) => a.question_type === 'MCQ')
    .map((a) => a.question_id);

  const segment = await AssessmentSegment.findById(segmentId);

  const progMap = {};
  if (progIds.length) {
    const ph = progIds.map(() => '?').join(',');
    const [rows] = await pool.execute(
      `SELECT pq.*, q.name, q.description, q.points,
              COALESCE(spq.positive_marks, q.points) as positive_marks,
              COALESCE(spq.negative_marks, 0) as negative_marks,
              COALESCE(spq.neutral_marks, 0) as neutral_marks
       FROM programming_questions pq
       JOIN questions q ON pq.question_id = q.id
       LEFT JOIN segment_programming_questions spq
         ON spq.programming_question_id = pq.id AND spq.assessment_segment_id = ?
       WHERE pq.id IN (${ph})`,
      [segmentId, ...progIds]
    );
    for (const row of rows) progMap[row.id] = row;
  }

  const mcqMap = {};
  if (mcqIds.length) {
    const ph = mcqIds.map(() => '?').join(',');
    const [rows] = await pool.execute(
      `SELECT mq.*, q.name, q.description, q.points,
              COALESCE(smq.positive_marks, q.points) as positive_marks,
              COALESCE(smq.negative_marks, 0) as negative_marks,
              COALESCE(smq.neutral_marks, 0) as neutral_marks
       FROM mcq_multiselect_questions mq
       JOIN questions q ON mq.question_id = q.id
       LEFT JOIN segment_mcq_questions smq
         ON smq.mcq_question_id = mq.id AND smq.assessment_segment_id = ?
       WHERE mq.id IN (${ph})`,
      [segmentId, ...mcqIds]
    );
    for (const row of rows) mcqMap[row.id] = row;
  }

  let testCasesByProg = {};
  if (progIds.length) {
    const ph = progIds.map(() => '?').join(',');
    const [rows] = await pool.execute(
      `SELECT id, programming_question_id, input, expected_result, description, is_hidden, weight
       FROM test_cases
       WHERE programming_question_id IN (${ph}) AND is_hidden = 0
       ORDER BY programming_question_id, \`order\` ASC, id ASC`,
      progIds
    );
    testCasesByProg = groupByKey(rows, 'programming_question_id');
  }

  let optionsByMcq = {};
  if (mcqIds.length) {
    const ph = mcqIds.map(() => '?').join(',');
    const [rows] = await pool.execute(
      `SELECT id, mcq_multiselect_question_id, text as option_text, \`order\`
       FROM options
       WHERE mcq_multiselect_question_id IN (${ph})
       ORDER BY mcq_multiselect_question_id, \`order\` ASC`,
      mcqIds
    );
    optionsByMcq = groupByKey(rows, 'mcq_multiselect_question_id');
  }

  const [languagesByQ, templatesByQ] = await Promise.all([
    batchLoadLanguages(progIds),
    batchLoadCodeTemplates(progIds)
  ]);

  const questions = [];
  for (const assignment of questionAssignments) {
    if (assignment.question_type === 'PROGRAMMING') {
      const pqRow = progMap[assignment.question_id];
      if (!pqRow) continue;
      questions.push(buildProgrammingQuestionPayload(
        pqRow,
        assignment,
        segment,
        testCasesByProg[pqRow.id] || [],
        languagesByQ,
        templatesByQ
      ));
    } else if (assignment.question_type === 'MCQ') {
      const mqRow = mcqMap[assignment.question_id];
      if (!mqRow) continue;
      let mcqOptions = (optionsByMcq[mqRow.id] || []).map((opt) => ({
        id: opt.id,
        value: opt.id,
        text: opt.option_text
      }));
      if (shuffleOptionsInMcq && seededShuffleFn) {
        mcqOptions = seededShuffleFn(mcqOptions, `${mappingId}-${mqRow.id}`);
      }
      questions.push({
        ...mqRow,
        question_type: 'MCQ',
        mcq_question_id: mqRow.id,
        question_text: mqRow.name || mqRow.description,
        sequence_order: assignment.sequence_order,
        weightage: assignment.weightage,
        positive_marks: mqRow.positive_marks || mqRow.points || 0,
        negative_marks: mqRow.negative_marks || 0,
        neutral_marks: mqRow.neutral_marks || 0,
        options: mcqOptions
      });
    }
  }

  return questions;
}

module.exports = {
  loadQuestionsForSegmentTake,
  buildProgrammingQuestionPayload
};
