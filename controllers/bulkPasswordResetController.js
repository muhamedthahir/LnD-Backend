const { createBulkPasswordResetService } = require('../services/bulkPasswordResetService');
const db = require('../config/db');
const bcrypt = require('bcrypt');
const User = require('../models/User');

const service = createBulkPasswordResetService({
  db, hashPassword: (password, rounds) => bcrypt.hash(password, rounds),
  ensureResetColumns: () => User.ensureResetColumns()
});

function respondError(res, error) {
  // Driver errors can contain SQL parameters: never log a password or its hash.
  if (!error.status) console.error('Bulk password reset failed:', error.code || 'unexpected error');
  return res.status(error.status || 500).json({
    error: error.status ? error.message : 'Unable to reset passwords. Please try again.'
  });
}

exports.listGroups = async (req, res) => {
  try { res.json(await service.listGroups(req.user, req.query)); }
  catch (error) { respondError(res, error); }
};

exports.reset = async (req, res) => {
  try {
    const result = await service.reset(req.user, req.body || {});
    res.json({ ...result, message: `Passwords reset for ${result.updatedCount} users.` });
  } catch (error) { respondError(res, error); }
};
