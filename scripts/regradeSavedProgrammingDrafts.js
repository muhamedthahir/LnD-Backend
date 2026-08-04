/**
 * Grade saved-but-unsubmitted programming code and recalculate scores.
 *
 * Usage:
 *   node scripts/regradeSavedProgrammingDrafts.js <administrator_id>
 *   node scripts/regradeSavedProgrammingDrafts.js --all-recent
 */
const dotenv = require('dotenv');
const pool = require('../config/db');
const { regradeSavedDraftsForAdministrator } = require('../services/programmingEvaluationService');

dotenv.config({ override: true });

async function regradeRecentConfigurations(days = 7) {
  const [rows] = await pool.execute(
    `SELECT DISTINCT aa.id, aa.display_name
     FROM assessment_administrators aa
     JOIN assessment_user_mappings aum ON aum.assessment_administrator_id = aa.id
     WHERE aum.submitted_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        OR aum.assessment_ended_time >= DATE_SUB(NOW(), INTERVAL ? DAY)
     ORDER BY aa.id ASC`,
    [days, days]
  );

  if (rows.length === 0) {
    console.log('No recent configurations found.');
    return;
  }

  for (const row of rows) {
    console.log(`\nRegrading configuration ${row.id} (${row.display_name})...`);
    const summary = await regradeSavedDraftsForAdministrator(row.id);
    console.log(JSON.stringify(summary, null, 2));
  }
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node scripts/regradeSavedProgrammingDrafts.js <administrator_id>');
    console.error('       node scripts/regradeSavedProgrammingDrafts.js --all-recent');
    process.exit(1);
  }

  try {
    if (arg === '--all-recent') {
      await regradeRecentConfigurations(14);
      return;
    }

    const administratorId = Number(arg);
    if (!Number.isFinite(administratorId)) {
      throw new Error('administrator_id must be a number');
    }

    console.log(`Regrading saved code for configuration ${administratorId}...`);
    const summary = await regradeSavedDraftsForAdministrator(administratorId);
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Regrade failed:', error.message);
  process.exit(1);
});
