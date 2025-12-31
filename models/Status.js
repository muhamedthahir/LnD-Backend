const pool = require('../config/db');

class Status {
  static async getAll() {
    const [rows] = await pool.execute(
      'SELECT * FROM statuses ORDER BY name ASC'
    );
    return rows;
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      'SELECT * FROM statuses WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }

  static async findByName(name) {
    const [rows] = await pool.execute(
      'SELECT * FROM statuses WHERE name = ?',
      [name]
    );
    return rows[0] || null;
  }

  static async create(data) {
    const { name, description } = data;
    const [result] = await pool.execute(
      'INSERT INTO statuses (name, description) VALUES (?, ?)',
      [name, description || null]
    );
    return result.insertId;
  }

  static async update(id, data) {
    const { name, description } = data;
    await pool.execute(
      'UPDATE statuses SET name = ?, description = ? WHERE id = ?',
      [name, description || null, id]
    );
    return true;
  }

  static async delete(id) {
    await pool.execute('DELETE FROM statuses WHERE id = ?', [id]);
    return true;
  }
}

module.exports = Status;

