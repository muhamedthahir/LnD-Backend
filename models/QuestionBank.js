const pool = require('../config/db');

class QuestionBank {
  static async getAllPaginated({ search, limit = 10, offset = 0, institutionId, statusId }) {
    let query = `
      SELECT qb.*, 
             s.name as status_name,
             i.name as institution_name,
             u.name as created_by_name,
             (SELECT COUNT(*) FROM questions q WHERE q.question_bank_id = qb.id) as question_count
      FROM question_banks qb
      LEFT JOIN statuses s ON qb.status_id = s.id
      LEFT JOIN institutions i ON qb.institution_id = i.id
      LEFT JOIN users u ON qb.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ' AND (qb.name LIKE ? OR qb.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (institutionId) {
      query += ' AND qb.institution_id = ?';
      params.push(institutionId);
    }

    if (statusId) {
      query += ' AND qb.status_id = ?';
      params.push(statusId);
    }

    // Get total count
    const countQuery = query.replace(/SELECT qb\.\*.*FROM/, 'SELECT COUNT(*) as total FROM');
    const [countRows] = await pool.execute(countQuery, params);
    const total = countRows[0].total;

    // Get paginated results
    query += ' ORDER BY qb.created_at DESC';
    query += ` LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;
    const [rows] = await pool.execute(query, params);

    // Get tags for each question bank
    for (const bank of rows) {
      bank.tags = await this.getTags(bank.id);
    }

    return { questionBanks: rows, total };
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT qb.*, 
              s.name as status_name,
              i.name as institution_name,
              u.name as created_by_name
       FROM question_banks qb
       LEFT JOIN statuses s ON qb.status_id = s.id
       LEFT JOIN institutions i ON qb.institution_id = i.id
       LEFT JOIN users u ON qb.created_by = u.id
       WHERE qb.id = ?`,
      [id]
    );
    
    if (rows[0]) {
      rows[0].tags = await this.getTags(id);
    }
    
    return rows[0] || null;
  }

  static async create(data) {
    const { name, description, institution_id, status_id, active = true, created_by, tags } = data;
    
    const [result] = await pool.execute(
      `INSERT INTO question_banks (name, description, institution_id, status_id, active, created_by, updated_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, description || null, institution_id || null, status_id, active, created_by || null, created_by || null]
    );

    const bankId = result.insertId;

    // Add tags if provided
    if (tags && tags.length > 0) {
      await this.setTags(bankId, tags);
    }

    return bankId;
  }

  static async update(id, data) {
    const { name, description, institution_id, status_id, active, updated_by, tags } = data;
    
    await pool.execute(
      `UPDATE question_banks 
       SET name = ?, description = ?, institution_id = ?, status_id = ?, active = ?, updated_by = ?
       WHERE id = ?`,
      [name, description || null, institution_id || null, status_id, active, updated_by || null, id]
    );

    // Update tags if provided
    if (tags !== undefined) {
      await this.setTags(id, tags || []);
    }

    return true;
  }

  static async delete(id) {
    await pool.execute('DELETE FROM question_banks WHERE id = ?', [id]);
    return true;
  }

  static async getTags(questionBankId) {
    const [rows] = await pool.execute(
      `SELECT t.* FROM tags t
       INNER JOIN question_bank_tags qbt ON t.id = qbt.tag_id
       WHERE qbt.question_bank_id = ?`,
      [questionBankId]
    );
    return rows;
  }

  static async setTags(questionBankId, tagIds) {
    // Remove existing tags
    await pool.execute('DELETE FROM question_bank_tags WHERE question_bank_id = ?', [questionBankId]);
    
    // Add new tags
    for (const tagId of tagIds) {
      await pool.execute(
        'INSERT INTO question_bank_tags (question_bank_id, tag_id) VALUES (?, ?)',
        [questionBankId, tagId]
      );
    }
    return true;
  }

  static async getQuestions(questionBankId) {
    const [rows] = await pool.execute(
      `SELECT q.*, qt.name as question_type_name, l.name as level_name, s.name as status_name
       FROM questions q
       LEFT JOIN question_types qt ON q.question_type_id = qt.id
       LEFT JOIN levels l ON q.level_id = l.id
       LEFT JOIN statuses s ON q.status_id = s.id
       WHERE q.question_bank_id = ?
       ORDER BY q.created_at DESC`,
      [questionBankId]
    );
    return rows;
  }
}

module.exports = QuestionBank;

