const pool = require('../config/db');

class Question {
  static async generateCode() {
    const [rows] = await pool.execute(
      'SELECT code FROM questions ORDER BY id DESC LIMIT 1'
    );
    
    if (rows.length === 0) {
      return 'Q0001';
    }
    
    const lastCode = rows[0].code;
    const num = parseInt(lastCode.replace('Q', '')) + 1;
    return `Q${num.toString().padStart(4, '0')}`;
  }

  static async getAllPaginated({ search, limit = 10, offset = 0, questionBankId, questionTypeId, levelId, statusId, categoryId }) {
    // Base WHERE conditions
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      whereClause += ' AND (q.name LIKE ? OR q.code LIKE ? OR q.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (questionBankId) {
      whereClause += ' AND q.question_bank_id = ?';
      params.push(questionBankId);
    }

    if (questionTypeId) {
      whereClause += ' AND q.question_type_id = ?';
      params.push(questionTypeId);
    }

    if (levelId) {
      whereClause += ' AND q.level_id = ?';
      params.push(levelId);
    }

    if (statusId) {
      whereClause += ' AND q.status_id = ?';
      params.push(statusId);
    }

    if (categoryId) {
      whereClause += ' AND q.category_id = ?';
      params.push(categoryId);
    }

    // Get total count with a simpler query structure
    const countQuery = `
      SELECT COUNT(*) as total
      FROM questions q
      LEFT JOIN question_types qt ON q.question_type_id = qt.id
      LEFT JOIN levels l ON q.level_id = l.id
      LEFT JOIN statuses s ON q.status_id = s.id
      LEFT JOIN categories c ON q.category_id = c.id
      LEFT JOIN question_banks qb ON q.question_bank_id = qb.id
      LEFT JOIN users u ON q.created_by = u.id
      ${whereClause}
    `;
    const [countRows] = await pool.execute(countQuery, params);
    const total = countRows[0].total;

    // Get paginated results
    const dataQuery = `
      SELECT q.*, 
             qt.name as question_type_name,
             l.name as level_name,
             s.name as status_name,
             c.name as category_name,
             qb.name as question_bank_name,
             u.name as created_by_name
      FROM questions q
      LEFT JOIN question_types qt ON q.question_type_id = qt.id
      LEFT JOIN levels l ON q.level_id = l.id
      LEFT JOIN statuses s ON q.status_id = s.id
      LEFT JOIN categories c ON q.category_id = c.id
      LEFT JOIN question_banks qb ON q.question_bank_id = qb.id
      LEFT JOIN users u ON q.created_by = u.id
      ${whereClause}
      ORDER BY q.created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;
    const [rows] = await pool.execute(dataQuery, params);

    // Get tags for each question
    for (const question of rows) {
      question.tags = await this.getTags(question.id);
    }

    return { questions: rows, total };
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT q.*, 
              qt.name as question_type_name,
              l.name as level_name,
              s.name as status_name,
              c.name as category_name,
              qb.name as question_bank_name,
              u.name as created_by_name
       FROM questions q
       LEFT JOIN question_types qt ON q.question_type_id = qt.id
       LEFT JOIN levels l ON q.level_id = l.id
       LEFT JOIN statuses s ON q.status_id = s.id
       LEFT JOIN categories c ON q.category_id = c.id
       LEFT JOIN question_banks qb ON q.question_bank_id = qb.id
       LEFT JOIN users u ON q.created_by = u.id
       WHERE q.id = ?`,
      [id]
    );
    
    if (rows[0]) {
      rows[0].tags = await this.getTags(id);
    }
    
    return rows[0] || null;
  }

  static async findByCode(code) {
    const [rows] = await pool.execute(
      'SELECT * FROM questions WHERE code = ?',
      [code]
    );
    return rows[0] || null;
  }

  static async create(data) {
    const {
      code,
      name,
      description,
      level_id,
      question_type_id,
      question_bank_id,
      category_id,
      status_id,
      active = true,
      points = 1,
      negative_marks = 0,
      time_to_solve,
      explanation,
      hint,
      created_by,
      tags
    } = data;

    // Generate code if not provided
    const questionCode = code || await this.generateCode();

    const [result] = await pool.execute(
      `INSERT INTO questions 
       (code, name, description, level_id, question_type_id, question_bank_id, category_id, status_id, 
        active, points, negative_marks, time_to_solve, explanation, hint, created_by, updated_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        questionCode, name, description || null, level_id || null, question_type_id,
        question_bank_id || null, category_id || null, status_id, active, points,
        negative_marks, time_to_solve || null, explanation || null, hint || null,
        created_by || null, created_by || null
      ]
    );

    const questionId = result.insertId;

    // Add tags if provided
    if (tags && tags.length > 0) {
      await this.setTags(questionId, tags);
    }

    return { id: questionId, code: questionCode };
  }

  static async update(id, data) {
    const {
      name,
      description,
      level_id,
      question_type_id,
      question_bank_id,
      category_id,
      status_id,
      active,
      points,
      negative_marks,
      time_to_solve,
      explanation,
      hint,
      updated_by,
      tags
    } = data;

    await pool.execute(
      `UPDATE questions 
       SET name = ?, description = ?, level_id = ?, question_type_id = ?, question_bank_id = ?,
           category_id = ?, status_id = ?, active = ?, points = ?, negative_marks = ?,
           time_to_solve = ?, explanation = ?, hint = ?, updated_by = ?
       WHERE id = ?`,
      [
        name, description || null, level_id || null, question_type_id,
        question_bank_id || null, category_id || null, status_id, active, points,
        negative_marks, time_to_solve || null, explanation || null, hint || null,
        updated_by || null, id
      ]
    );

    // Update tags if provided
    if (tags !== undefined) {
      await this.setTags(id, tags || []);
    }

    return true;
  }

  static async delete(id) {
    await pool.execute('DELETE FROM questions WHERE id = ?', [id]);
    return true;
  }

  static async getTags(questionId) {
    const [rows] = await pool.execute(
      `SELECT t.* FROM tags t
       INNER JOIN question_tags qt ON t.id = qt.tag_id
       WHERE qt.question_id = ?`,
      [questionId]
    );
    return rows;
  }

  static async setTags(questionId, tagIds) {
    // Remove existing tags
    await pool.execute('DELETE FROM question_tags WHERE question_id = ?', [questionId]);
    
    // Add new tags
    for (const tagId of tagIds) {
      await pool.execute(
        'INSERT INTO question_tags (question_id, tag_id) VALUES (?, ?)',
        [questionId, tagId]
      );
    }
    return true;
  }

  static async addToQuestionBank(questionId, questionBankId) {
    await pool.execute(
      'UPDATE questions SET question_bank_id = ? WHERE id = ?',
      [questionBankId, questionId]
    );
    return true;
  }

  static async removeFromQuestionBank(questionId) {
    await pool.execute(
      'UPDATE questions SET question_bank_id = NULL WHERE id = ?',
      [questionId]
    );
    return true;
  }
}

module.exports = Question;




