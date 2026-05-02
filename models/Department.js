const pool = require('../config/db');

function normalizeName(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().replace(/\s+/g, ' ');
  return s.length ? s : null;
}

class Department {
  static async getAll() {
    const [rows] = await pool.execute(
      'SELECT id, name FROM departments ORDER BY name ASC'
    );
    return rows;
  }

  static async findByNormalizedName(name) {
    const n = normalizeName(name);
    if (!n) return null;
    const [rows] = await pool.execute(
      'SELECT id, name FROM departments WHERE LOWER(name) = LOWER(?) LIMIT 1',
      [n]
    );
    return rows[0] || null;
  }

  /** Create row if no case-insensitive match; return canonical name stored in DB */
  static async ensureExists(raw) {
    const n = normalizeName(raw);
    if (!n) return null;
    const existing = await this.findByNormalizedName(n);
    if (existing) return existing.name;
    await pool.execute('INSERT INTO departments (name) VALUES (?)', [n]);
    return n;
  }

  static async validateExists(raw) {
    const row = await this.findByNormalizedName(raw);
    return !!row;
  }
}

module.exports = Department;
