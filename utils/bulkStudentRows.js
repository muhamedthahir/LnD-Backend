const REQUIRED = ['name', 'email', 'rollnumber', 'department'];
const keyOf = key => String(key).trim().toLowerCase().replace(/[\s_]+/g, '');
const text = value => value == null ? '' : String(value).trim();

function normalizeRows(rows) {
  if (!rows.length) throw Object.assign(new Error('The spreadsheet has no student rows.'), { status: 400 });
  if (rows.length > 5000) throw Object.assign(new Error('Upload at most 5,000 students per file.'), { status: 400 });
  const keys = new Set(Object.keys(rows[0]).map(keyOf));
  if (REQUIRED.some(key => !keys.has(key))) {
    throw Object.assign(new Error('Use the template columns: Name, Email, Roll Number, Department, Section, Degree.'), { status: 400 });
  }
  return rows.map((row, index) => {
    const fields = Object.fromEntries(Object.entries(row).map(([key, value]) => [keyOf(key), text(value)]));
    return {
      rowNumber: Number.isInteger(row.__rowNum__) ? row.__rowNum__ + 1 : index + 2,
      name: fields.name || '', email: (fields.email || '').toLowerCase(), roll_number: fields.rollnumber || '',
      department: fields.department, section: fields.section || '1', degree: fields.degree || null
    };
  });
}

function validateStudent(row) {
  if (!row.name || !row.email) return 'Name and email are required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) return 'Enter a valid email address';
  if (!row.roll_number) return 'Roll number is required';
  if (!row.department) return 'Department is required';
  for (const key of ['name', 'email', 'roll_number', 'department', 'section', 'degree']) {
    if (row[key] && row[key].length > 255) return `${key.replace('_', ' ')} is too long`;
  }
  return null;
}

module.exports = { normalizeRows, validateStudent };
