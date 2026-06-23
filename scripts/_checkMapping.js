const pool = require('../config/db');

(async () => {
  try {
    const [m] = await pool.execute('SELECT * FROM assessment_user_mappings WHERE id = ?', [204]);
    console.log('=== MAPPING 204 ===');
    if (m[0]) {
      const r = m[0];
      console.log(JSON.stringify({
        id: r.id, assessment_id: r.assessment_id, user_id: r.user_id, status: r.status,
        started_at: r.started_at, completed_at: r.completed_at, last_activity_at: r.last_activity_at,
        resume_count: r.resume_count, score: r.score, current_segment_index: r.current_segment_index
      }, null, 2));
    } else {
      console.log('No mapping 204');
    }

    const [logs] = await pool.execute(
      'SELECT id, event_type, event_timestamp, segment_id, details FROM proctoring_logs WHERE assessment_user_mapping_id = ? ORDER BY event_timestamp', [204]
    );
    console.log('\n=== PROCTORING LOGS (' + logs.length + ') ===');
    logs.forEach(l => console.log(l.event_type, '|', l.event_timestamp, '|', l.details));

    const [ans] = await pool.execute(
      'SELECT * FROM assessment_user_answers WHERE assessment_user_mapping_id = ?', [204]
    ).catch(() => [[]]);
    console.log('\n=== ANSWERS (' + ans.length + ') ===');
    ans.forEach(a => console.log(JSON.stringify(a)));
  } catch (e) {
    console.error('ERR:', e.code, e.message);
  }
  process.exit(0);
})();
