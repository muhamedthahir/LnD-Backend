const pool = require('../config/db');
const ProgrammingSubmission = require('../models/ProgrammingSubmission');
const { AssessmentSegmentProgress } = require('../models/AssessmentConfigs');
const { getPistonExecuteUrl, resolvePistonTimeouts } = require('../utils/pistonConfig');
const { outputsMatch } = require('../utils/outputCompare');
const { resolveSegmentQuestionWeight } = require('../utils/assessmentScoring');
const { getFilesForPiston } = require('../controllers/codeEditorController');

const LANGUAGE_VERSIONS = {
  node: '18.15.0',
  javascript: '18.15.0',
  python: '3.10.0',
  java: '15.0.2',
  c: '10.2.0',
  cpp: '10.2.0',
  'c++': '10.2.0'
};

async function resolveQuestionWeight(mappingId, questionId, segmentId) {
  let questionWeight = 1;
  const [assignRows] = await pool.execute(
    `SELECT weightage FROM user_question_assignments
     WHERE assessment_user_mapping_id = ? AND question_type = 'PROGRAMMING' AND question_id = ?
     LIMIT 1`,
    [mappingId, questionId]
  );
  if (assignRows[0]?.weightage) {
    questionWeight = parseFloat(assignRows[0].weightage) || 1;
  } else if (segmentId) {
    const [spqRows] = await pool.execute(
      `SELECT spq.positive_marks, spq.weightage_override, q.points as default_weightage
       FROM segment_programming_questions spq
       JOIN programming_questions pq ON spq.programming_question_id = pq.id
       JOIN questions q ON pq.question_id = q.id
       WHERE spq.assessment_segment_id = ? AND pq.id = ?`,
      [segmentId, questionId]
    );
    if (spqRows[0]) {
      questionWeight = resolveSegmentQuestionWeight(spqRows[0]);
    }
  }
  return questionWeight;
}

function perCaseWeight(questionWeight, scoringCases) {
  return scoringCases.length > 0 ? (questionWeight / scoringCases.length) : 0;
}

async function evaluateProgrammingCode({ questionId, code, language, questionWeight }) {
  const [allTestCases] = await pool.execute(
    `SELECT id, input, expected_result, is_hidden, weight
     FROM test_cases
     WHERE programming_question_id = ?
     ORDER BY \`order\` ASC, id ASC`,
    [questionId]
  );

  const pistonEndpoint = getPistonExecuteUrl();
  const pistonLanguage = String(language || 'javascript').toLowerCase();
  const files = getFilesForPiston(pistonLanguage, code);
  const hiddenCases = allTestCases.filter((tc) => tc.is_hidden);
  const scoringCases = hiddenCases.length > 0 ? hiddenCases : allTestCases;
  const caseWeight = perCaseWeight(questionWeight, scoringCases);

  let testCasesPassed = 0;
  let totalPoints = 0;
  let earnedPoints = 0;
  const testResults = [];

  for (const testCase of allTestCases) {
    const countsTowardScore = hiddenCases.length > 0 ? testCase.is_hidden : true;
    if (countsTowardScore) {
      totalPoints += caseWeight;
    }

    try {
      const pistonPayload = {
        language: pistonLanguage,
        version: LANGUAGE_VERSIONS[pistonLanguage] || '*',
        files,
        stdin: testCase.input || '',
        args: [],
        ...resolvePistonTimeouts()
      };

      const response = await fetch(pistonEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pistonPayload)
      });

      if (response.ok) {
        const result = await response.json();
        const actualOutput = result.run?.stdout || '';
        const passed = outputsMatch(actualOutput, testCase.expected_result || '');

        if (passed) {
          testCasesPassed += 1;
          if (countsTowardScore) {
            earnedPoints += caseWeight;
          }
        }

        testResults.push({
          test_case_id: testCase.id,
          is_hidden: testCase.is_hidden,
          passed,
          ...(testCase.is_hidden ? {} : {
            input: testCase.input,
            expected_result: testCase.expected_result,
            actual_output: actualOutput
          })
        });
      } else {
        testResults.push({
          test_case_id: testCase.id,
          is_hidden: testCase.is_hidden,
          passed: false,
          error: 'Execution failed'
        });
      }
    } catch (execError) {
      testResults.push({
        test_case_id: testCase.id,
        is_hidden: testCase.is_hidden,
        passed: false,
        error: execError.message
      });
    }
  }

  const totalTestCases = allTestCases.length;
  const normalizedRatio = totalPoints > 0 ? (earnedPoints / totalPoints) : 0;
  const absoluteScore = normalizedRatio * questionWeight;
  const hiddenPassed = testResults.filter((r) => r.is_hidden && r.passed).length;
  const hiddenTotal = testResults.filter((r) => r.is_hidden).length;
  const allPassed = totalTestCases > 0 && testCasesPassed === totalTestCases;
  const submissionStatus = allPassed
    ? 'completed'
    : (testCasesPassed > 0 ? 'attempted' : 'error');

  return {
    testCasesPassed,
    totalTestCases,
    absoluteScore,
    percentageScore: Math.round(normalizedRatio * 100),
    testResults,
    hiddenPassed,
    hiddenTotal,
    submissionStatus,
    questionWeight
  };
}

async function gradeProgrammingSubmissionForAssessment({
  mappingId,
  userId,
  programmingQuestionId,
  code,
  language,
  segmentId
}) {
  let safeSegmentId = segmentId;
  if (!safeSegmentId) {
    const [rows] = await pool.execute(
      `SELECT assessment_segment_id FROM user_question_assignments
       WHERE assessment_user_mapping_id = ? AND question_type = 'PROGRAMMING' AND question_id = ?
       LIMIT 1`,
      [mappingId, programmingQuestionId]
    );
    safeSegmentId = rows[0]?.assessment_segment_id || null;
  }

  const questionWeight = await resolveQuestionWeight(mappingId, programmingQuestionId, safeSegmentId);
  const evaluation = await evaluateProgrammingCode({
    questionId: programmingQuestionId,
    code,
    language,
    questionWeight
  });

  await ProgrammingSubmission.createOrUpdateForAssessment({
    user_id: userId,
    assessment_user_mapping_id: mappingId,
    assessment_segment_id: safeSegmentId,
    programming_question_id: programmingQuestionId,
    submitted_code: code,
    language_used: language,
    status: evaluation.submissionStatus,
    test_cases_passed: evaluation.testCasesPassed,
    test_cases_total: evaluation.totalTestCases,
    score: evaluation.absoluteScore,
    max_score: questionWeight,
    execution_result: evaluation.testResults,
    hidden_passed: evaluation.hiddenPassed,
    hidden_total: evaluation.hiddenTotal
  });

  if (safeSegmentId) {
    await AssessmentSegmentProgress.updateSegmentScore(mappingId, safeSegmentId);
  }

  return evaluation;
}

async function findUngradedDraftsForMapping(mappingId) {
  const [rows] = await pool.execute(
    `SELECT *
     FROM programming_submissions
     WHERE assessment_user_mapping_id = ?
       AND last_submitted_code IS NOT NULL
       AND TRIM(last_submitted_code) != ''
       AND COALESCE(submission_count, 0) = 0`,
    [mappingId]
  );
  return rows;
}

async function autoGradeSavedDraftsForMapping(mappingId, { userId } = {}) {
  const drafts = await findUngradedDraftsForMapping(mappingId);
  const graded = [];
  const errors = [];

  for (const draft of drafts) {
    try {
      const evaluation = await gradeProgrammingSubmissionForAssessment({
        mappingId,
        userId: userId || draft.user_id,
        programmingQuestionId: draft.programming_question_id,
        code: draft.last_submitted_code,
        language: draft.language_used || 'javascript',
        segmentId: draft.assessment_segment_id
      });
      graded.push({
        programming_question_id: draft.programming_question_id,
        test_cases_passed: evaluation.testCasesPassed,
        total_test_cases: evaluation.totalTestCases,
        score: evaluation.absoluteScore
      });
    } catch (error) {
      errors.push({
        programming_question_id: draft.programming_question_id,
        error: error.message
      });
    }
  }

  if (graded.length > 0) {
    await AssessmentSegmentProgress.updateMappingTotalScore(mappingId);
  }

  return { graded, errors, skipped: drafts.length - graded.length - errors.length };
}

async function recalculateCompletedMappingScores(mappingId) {
  const [segmentRows] = await pool.execute(
    `SELECT DISTINCT assessment_segment_id AS id
     FROM user_question_assignments
     WHERE assessment_user_mapping_id = ?`,
    [mappingId]
  );

  for (const row of segmentRows) {
    if (row.id) {
      await AssessmentSegmentProgress.updateSegmentScore(mappingId, row.id);
    }
  }

  const scoreResult = await AssessmentSegmentProgress.updateMappingTotalScore(mappingId);

  const [mappingRows] = await pool.execute(
    'SELECT assessment_administrator_id FROM assessment_user_mappings WHERE id = ?',
    [mappingId]
  );
  const adminId = mappingRows[0]?.assessment_administrator_id;
  let passed = false;
  if (adminId) {
    const [scoringConfig] = await pool.execute(
      'SELECT threshold_for_pass, threshold_type FROM scoring_configs WHERE assessment_administrator_id = ?',
      [adminId]
    );
    const threshold = scoringConfig[0]?.threshold_for_pass || 40;
    const thresholdType = scoringConfig[0]?.threshold_type || 'PERCENTAGE';
    if (thresholdType === 'PERCENTAGE') {
      passed = scoreResult.percentageScore >= threshold;
    } else {
      passed = scoreResult.totalScore >= threshold;
    }
  }

  await pool.execute(
    `UPDATE assessment_user_mappings
     SET total_score = ?, percentage_score = ?, max_possible_score = ?, passed = ?
     WHERE id = ?`,
    [
      scoreResult.totalScore,
      scoreResult.percentageScore,
      scoreResult.maxPossibleScore,
      passed,
      mappingId
    ]
  );

  return scoreResult;
}

async function regradeSavedDraftsForAdministrator(administratorId) {
  const [mappings] = await pool.execute(
    `SELECT id, user_id, status
     FROM assessment_user_mappings
     WHERE assessment_administrator_id = ?
       AND status IN ('IN_PROGRESS', 'COMPLETED', 'DISQUALIFIED')`,
    [administratorId]
  );

  const summary = {
    mappings_processed: 0,
    drafts_graded: 0,
    errors: []
  };

  for (const mapping of mappings) {
    const result = await autoGradeSavedDraftsForMapping(mapping.id, { userId: mapping.user_id });
    if (result.graded.length > 0 || mapping.status === 'COMPLETED') {
      await recalculateCompletedMappingScores(mapping.id);
    }
    summary.mappings_processed += 1;
    summary.drafts_graded += result.graded.length;
    if (result.errors.length > 0) {
      summary.errors.push({ mapping_id: mapping.id, errors: result.errors });
    }
  }

  return summary;
}

module.exports = {
  evaluateProgrammingCode,
  gradeProgrammingSubmissionForAssessment,
  autoGradeSavedDraftsForMapping,
  recalculateCompletedMappingScores,
  regradeSavedDraftsForAdministrator,
  findUngradedDraftsForMapping
};
