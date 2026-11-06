const pool = require('../config/db');

const parents = {
  assessment: 'assessments a',
  segment: 'assessment_segments r JOIN assessments a ON a.id = r.assessment_id',
  config: 'assessment_administrators r JOIN assessments a ON a.id = r.assessment_id',
  criteria: 'random_fetch_criteria r JOIN assessment_segments s ON s.id = r.assessment_segment_id JOIN assessments a ON a.id = s.assessment_id',
  mapping: 'assessment_user_mappings r JOIN assessment_administrators c ON c.id = r.assessment_administrator_id JOIN assessments a ON a.id = c.assessment_id JOIN users u ON u.id = r.user_id'
};

const scope = (kind, getId) => async (req, res, next) => {
  if (req.user.role !== 'college_admin') return next();
  const college = req.user.college_name;
  const denied = () => res.status(403).json({ error: 'Assessment access denied' });
  if (!college) return denied();

  try {
    const [[institution]] = await pool.execute('SELECT id FROM institutions WHERE name = ?', [college]);
    if (!institution) return denied();
    req.assessmentInstitutionId = institution.id;

    if (getId) {
      const id = getId(req);
      if (!/^\d+$/.test(String(id))) return res.status(400).json({ error: 'Invalid assessment reference' });
      const owner = kind === 'assessment' ? 'a' : 'r';
      const participant = kind === 'mapping' ? ' AND u.college_name = ?' : '';
      const params = participant ? [id, institution.id, college] : [id, institution.id];
      const [[row]] = await pool.execute(
        'SELECT a.id FROM ' + parents[kind] + ' WHERE ' + owner + '.id = ? AND a.institution_id = ?' + participant,
        params
      );
      if (!row) return denied();
      if (kind === 'config') {
        const [[foreign]] = await pool.execute(
          'SELECT m.id FROM assessment_user_mappings m JOIN users u ON u.id = m.user_id WHERE m.assessment_administrator_id = ? AND NOT (u.college_name <=> ?) LIMIT 1',
          [id, college]
        );
        if (foreign) return denied();
      }
    }
    if (req.body?.institution_id != null && Number(req.body.institution_id) !== Number(institution.id)) return denied();
    if (Array.isArray(req.body?.user_ids)) {
      const ids = [...new Set(req.body.user_ids.map(String))];
      if (ids.length > 1000 || ids.some(id => !/^\d+$/.test(id))) return res.status(400).json({ error: 'Invalid participant list' });
      if (ids.length) {
        const [rows] = await pool.execute(
          'SELECT id FROM users WHERE college_name = ? AND id IN (' + ids.map(() => '?').join(',') + ')',
          [college, ...ids]
        );
        if (rows.length !== ids.length) return denied();
      }
    }
    next();
  } catch (error) {
    next(error);
  }
};

scope.ownAttempt = async (req, res, next) => {
  try {
    const [[row]] = await pool.execute(
      'SELECT id FROM assessment_user_mappings WHERE id = ? AND user_id = ?',
      [req.params.mapping_id, req.user.id]
    );
    if (!row) return res.status(403).json({ error: 'Assessment access denied' });
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = scope;
