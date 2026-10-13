const spreadsheetImport = require('../services/spreadsheetImport');
exports.prepare = async (req, res) => {
  try { res.json(await spreadsheetImport.prepare(req.user.id, req.body)); }
  catch (error) { res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Unable to prepare the workbook upload.' }); }
};
