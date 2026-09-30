const pool = require('../config/db');

class Category {
  static async getAll() {
    const [rows] = await pool.execute(
      'SELECT * FROM categories WHERE active = TRUE ORDER BY name ASC'
    );
    return rows;
  }

  static async getAllWithHierarchy() {
    const [rows] = await pool.execute(
      `SELECT c.*, p.name as parent_name 
       FROM categories c 
       LEFT JOIN categories p ON c.parent_id = p.id 
       WHERE c.active = TRUE 
       ORDER BY c.name ASC`
    );
    return rows;
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      'SELECT * FROM categories WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }

  static async create(data) {
    const { name, description, parent_id, active = true } = data;
    const [result] = await pool.execute(
      'INSERT INTO categories (name, description, parent_id, active) VALUES (?, ?, ?, ?)',
      [name, description || null, parent_id || null, active]
    );
    return result.insertId;
  }

  static async update(id, data) {
    const { name, description, parent_id, active } = data;
    await pool.execute(
      'UPDATE categories SET name = ?, description = ?, parent_id = ?, active = ? WHERE id = ?',
      [name, description || null, parent_id || null, active, id]
    );
    return true;
  }

  static async delete(id) {
    // Set children's parent_id to null before deleting
    await pool.execute('UPDATE categories SET parent_id = NULL WHERE parent_id = ?', [id]);
    await pool.execute('DELETE FROM categories WHERE id = ?', [id]);
    return true;
  }

  static async getChildren(parentId) {
    const [rows] = await pool.execute(
      'SELECT * FROM categories WHERE parent_id = ? AND active = TRUE ORDER BY name ASC',
      [parentId]
    );
    return rows;
  }
}

module.exports = Category;




