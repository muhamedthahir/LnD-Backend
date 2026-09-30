const pool = require('../config/db');
const MCQSubmission = require('../models/MCQSubmission');

/**
 * Resolve per-question max marks from segment override rows.
 * weightage_override is a flag (1 = use positive_marks); not the mark value itself.
 */
function resolveSegmentQuestionWeight(row) {
  if (!row) return 1;
  const defaultMarks = Number(row.default_weightage ?? row.points ?? row.weightage) || 1;
  const positiveMarks = Number(row.positive_marks);
  const hasOverride = row.weightage_override != null
    && row.weightage_override !== ''
    && Number(row.weightage_override) !== 0;

  if (hasOverride && Number.isFinite(positiveMarks) && positiveMarks > 0) {
    return positiveMarks;
  }
  if (hasOverride) {
    return defaultMarks;
  }
  if (Number.isFinite(positiveMarks) && positiveMarks > 0) {
    return positiveMarks;
  }
  return defaultMarks;
}

/**
 * Normalize programming obtained marks when legacy rows stored 0–1 ratios.
 */
function resolveProgrammingObtainedScore(bestScore, assignmentWeight, submissionMaxScore) {
  const best = Number(bestScore) || 0;
  const weight = Number(assignmentWeight) || 1;
  const max = Number(submissionMaxScore);

  if (best <= 1 && weight > 1) {
    return best * weight;
  }
  if (Number.isFinite(max) && max > 1 && best <= max && weight > max) {
    return (best / max) * weight;
  }
  return best;
}

function parseSelectedOptions(raw) {
  let sel = raw;
  if (typeof sel === 'string') {
    try { sel = JSON.parse(sel); } catch (e) { sel = []; }
  }
  return Array.isArray(sel) ? sel.map(Number).filter((n) => !Number.isNaN(n)) : [];
}

/**
 * Build mcq_multiselect_questions.id -> best submission using option ownership.
 */
async function buildMcqScoreByOwner(mapping_id) {
  const [allMcqSubs] = await pool.execute(
    'SELECT mcq_question_id, best_score, last_selected_options FROM mcq_submissions WHERE assessment_user_mapping_id = ?',
    [mapping_id]
  );

  const allOptionIds = new Set();
  const parsedMcqSubs = allMcqSubs.map((s) => {
    const sel = parseSelectedOptions(s.last_selected_options);
    sel.forEach((id) => allOptionIds.add(id));
    return { ...s, sel };
  });

  const ownerByOpt = {};
  if (allOptionIds.size > 0) {
    const ids = Array.from(allOptionIds);
    const [orows] = await pool.execute(
      `SELECT id, mcq_multiselect_question_id FROM options WHERE id IN (${ids.map(() => '?').join(',')})`,
      ids
    );
    orows.forEach((o) => { ownerByOpt[o.id] = o.mcq_multiselect_question_id; });
  }

  const mcqByOwner = {};
  parsedMcqSubs.forEach((s) => {
    let owner = null;
    for (const oid of s.sel) {
      if (ownerByOpt[oid] !== undefined) { owner = ownerByOpt[oid]; break; }
    }
    if (owner === null) return;
    const prev = mcqByOwner[owner];
    if (!prev || (Number(s.best_score) || 0) >= (Number(prev.best_score) || 0)) {
      mcqByOwner[owner] = s;
    }
  });

  return mcqByOwner;
}

async function resolveMcqAssignmentScore(mapping_id, assignmentQuestionId, mcqByOwner) {
  const owned = mcqByOwner[assignmentQuestionId];
  if (owned) {
    return Number(owned.best_score) || 0;
  }

  const resolvedQuestionId = await MCQSubmission.resolveQuestionId(assignmentQuestionId);
  const [subRows] = await pool.execute(
    `SELECT best_score FROM mcq_submissions
     WHERE assessment_user_mapping_id = ? AND mcq_question_id IN (?, ?)
     ORDER BY best_score DESC, last_answered_at DESC, id DESC
     LIMIT 1`,
    [mapping_id, resolvedQuestionId, assignmentQuestionId]
  );
  return Number(subRows[0]?.best_score) || 0;
}

async function resolveProgrammingAssignmentScore(mapping_id, questionId, weight, progByQuestion) {
  if (progByQuestion) {
    const sub = progByQuestion[questionId];
    if (!sub) return 0;
    return resolveProgrammingObtainedScore(sub.best_score, weight, sub.max_score);
  }
  const [subRows] = await pool.execute(
    `SELECT best_score, max_score FROM programming_submissions
     WHERE assessment_user_mapping_id = ? AND programming_question_id = ?
     ORDER BY best_score DESC, id DESC
     LIMIT 1`,
    [mapping_id, questionId]
  );
  if (!subRows[0]) return 0;
  return resolveProgrammingObtainedScore(subRows[0].best_score, weight, subRows[0].max_score);
}

async function buildProgrammingScoreByQuestion(mapping_id) {
  const [rows] = await pool.execute(
    `SELECT programming_question_id, best_score, max_score
     FROM programming_submissions
     WHERE assessment_user_mapping_id = ?
     ORDER BY best_score DESC, id DESC`,
    [mapping_id]
  );
  const map = {};
  for (const row of rows) {
    if (!map[row.programming_question_id]) {
      map[row.programming_question_id] = row;
    }
  }
  return map;
}

async function buildMcqScoreLookup(mapping_id, mcqByOwner) {
  const [rows] = await pool.execute(
    `SELECT mcq_question_id, best_score FROM mcq_submissions
     WHERE assessment_user_mapping_id = ?`,
    [mapping_id]
  );
  const byQuestionId = {};
  for (const row of rows) {
    const score = Number(row.best_score) || 0;
    if (!byQuestionId[row.mcq_question_id] || score > byQuestionId[row.mcq_question_id]) {
      byQuestionId[row.mcq_question_id] = score;
    }
  }
  return { mcqByOwner, byQuestionId };
}

async function resolveMcqAssignmentScoreFast(assignmentQuestionId, mcqByOwner, mcqByQuestionId) {
  const owned = mcqByOwner[assignmentQuestionId];
  if (owned) {
    return Number(owned.best_score) || 0;
  }
  if (mcqByQuestionId[assignmentQuestionId] !== undefined) {
    return mcqByQuestionId[assignmentQuestionId];
  }
  return 0;
}

/**
 * Compute total score from assigned questions (matches individual result report).
 */
async function computeMappingTotalScore(mapping_id) {
  const [assignments] = await pool.execute(
    `SELECT question_type, question_id, weightage
     FROM user_question_assignments
     WHERE assessment_user_mapping_id = ?`,
    [mapping_id]
  );

  const mcqByOwner = await buildMcqScoreByOwner(mapping_id);
  const progByQuestion = await buildProgrammingScoreByQuestion(mapping_id);
  const { byQuestionId: mcqByQuestionId } = await buildMcqScoreLookup(mapping_id, mcqByOwner);

  let totalObtained = 0;
  let maxPossible = 0;

  for (const a of assignments) {
    const weight = parseFloat(a.weightage) || 1;
    maxPossible += weight;

    if (a.question_type === 'PROGRAMMING') {
      totalObtained += await resolveProgrammingAssignmentScore(mapping_id, a.question_id, weight, progByQuestion);
    } else {
      totalObtained += await resolveMcqAssignmentScoreFast(a.question_id, mcqByOwner, mcqByQuestionId);
    }
  }

  const percentageScore = maxPossible > 0 ? (totalObtained / maxPossible * 100) : 0;

  return {
    totalScore: totalObtained,
    percentageScore: parseFloat(percentageScore.toFixed(2)),
    maxPossibleScore: maxPossible
  };
}

module.exports = {
  resolveSegmentQuestionWeight,
  resolveProgrammingObtainedScore,
  parseSelectedOptions,
  buildMcqScoreByOwner,
  resolveMcqAssignmentScore,
  resolveProgrammingAssignmentScore,
  computeMappingTotalScore
};
