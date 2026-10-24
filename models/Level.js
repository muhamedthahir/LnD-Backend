const pool = require('../config/db');

class Level {
  static async getAll() {
    const [rows] = await pool.execute(
      'SELECT * FROM levels ORDER BY `rank` ASC'
    );
    return rows;
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      'SELECT * FROM levels WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }

  static async create(data) {
    const { name, description, rank } = data;
    const [result] = await pool.execute(
      'INSERT INTO levels (name, description, `rank`) VALUES (?, ?, ?)',
      [name, description || null, rank]
    );
    return result.insertId;
  }

  static async update(id, data) {
    const { name, description, rank } = data;
    await pool.execute(
      'UPDATE levels SET name = ?, description = ?, `rank` = ? WHERE id = ?',
      [name, description || null, rank, id]
    );
    return true;
  }

  static async delete(id) {
    await pool.execute('DELETE FROM levels WHERE id = ?', [id]);
    return true;
  }
}

module.exports = Level;

