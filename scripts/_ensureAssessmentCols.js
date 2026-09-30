/**
 * One-off idempotent migration to add columns/enum values introduced by the
 * assessment configuration + anomaly-flagging work. Safe to re-run.
 */
const pool = require('../config/db');

const run = async (label, sql) => {
  try {
    await pool.execute(sql);
    console.log(`OK: ${label}`);
  } catch (e) {
    console.log(`SKIP (${e.code || e.message}): ${label}`);
  }
};

(async () => {
  await run(
    'assessment_segments.question_source',
    `ALTER TABLE assessment_segments ADD COLUMN question_source ENUM('POOL','BANK') DEFAULT NULL`
  );
  await run(
    'assessment_segments.question_bank_id',
    `ALTER TABLE assessment_segments ADD COLUMN question_bank_id INT DEFAULT NULL`
  );
  await run(
    'assessment_user_mappings.last_answer_saved_at',
    `ALTER TABLE assessment_user_mappings ADD COLUMN last_answer_saved_at DATETIME DEFAULT NULL`
  );
  await run(
    'proctoring_logs.event_type enum widen (RAPID_ANSWER)',
    `ALTER TABLE proctoring_logs MODIFY COLUMN event_type ENUM('TAB_SWITCH','FULLSCREEN_EXIT','WINDOW_BLUR','COPY_PASTE','RIGHT_CLICK','FACE_NOT_DETECTED','MULTIPLE_FACES','SCREEN_SHARE_STOPPED','RAPID_ANSWER') NOT NULL`
  );
  // Millisecond-precision per-question time tracking for assessment reports.
  await run(
    'mcq_submissions.time_taken_ms',
    `ALTER TABLE mcq_submissions ADD COLUMN time_taken_ms BIGINT DEFAULT 0`
  );
  await run(
    'programming_submissions.time_taken_ms',
    `ALTER TABLE programming_submissions ADD COLUMN time_taken_ms BIGINT DEFAULT 0`
  );
  console.log('DONE');
  process.exit(0);
})();
