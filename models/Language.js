const pool = require('../config/db');

class Language {
  static async getAll() {
    const [rows] = await pool.execute(
      'SELECT * FROM languages WHERE is_active = TRUE ORDER BY name ASC'
    );
    return rows;
  }

  static async getAllIncludingInactive() {
    const [rows] = await pool.execute(
      'SELECT * FROM languages ORDER BY name ASC'
    );
    return rows;
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      'SELECT * FROM languages WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }

  static async findByName(name) {
    const [rows] = await pool.execute(
      'SELECT * FROM languages WHERE name = ?',
      [name]
    );
    return rows[0] || null;
  }

  static async create(data) {
    const { name, description, is_active = true, current_version } = data;
    const [result] = await pool.execute(
      'INSERT INTO languages (name, description, is_active, current_version) VALUES (?, ?, ?, ?)',
      [name, description || null, is_active, current_version || null]
    );
    return result.insertId;
  }

  static async update(id, data) {
    const { name, description, is_active, current_version } = data;
    await pool.execute(
      'UPDATE languages SET name = ?, description = ?, is_active = ?, current_version = ? WHERE id = ?',
      [name, description || null, is_active, current_version || null, id]
    );
    return true;
  }

  static async delete(id) {
    await pool.execute('DELETE FROM languages WHERE id = ?', [id]);
    return true;
  }

  static async toggleActive(id) {
    await pool.execute(
      'UPDATE languages SET is_active = NOT is_active WHERE id = ?',
      [id]
    );
    return true;
  }
}

module.exports = Language;

