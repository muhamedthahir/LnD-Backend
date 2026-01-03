const pool = require('../config/db');

class Tag {
  static async getAll() {
    const [rows] = await pool.execute(
      'SELECT * FROM tags ORDER BY name ASC'
    );
    return rows;
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      'SELECT * FROM tags WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }

  static async findByName(name) {
    const [rows] = await pool.execute(
      'SELECT * FROM tags WHERE name = ?',
      [name]
    );
    return rows[0] || null;
  }

  static async create(data) {
    const { name, color } = data;
    const [result] = await pool.execute(
      'INSERT INTO tags (name, color) VALUES (?, ?)',
      [name, color || null]
    );
    return result.insertId;
  }

  static async update(id, data) {
    const { name, color } = data;
    await pool.execute(
      'UPDATE tags SET name = ?, color = ? WHERE id = ?',
      [name, color || null, id]
    );
    return true;
  }

  static async delete(id) {
    await pool.execute('DELETE FROM tags WHERE id = ?', [id]);
    return true;
  }
}

module.exports = Tag;




