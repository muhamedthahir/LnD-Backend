const pool = require('../config/db');

class TestCase {
  static async findById(id) {
    const [rows] = await pool.execute(
      'SELECT * FROM test_cases WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }

  static async findByProgrammingQuestionId(programmingQuestionId) {
    const [rows] = await pool.execute(
      'SELECT * FROM test_cases WHERE programming_question_id = ? ORDER BY `order` ASC',
      [programmingQuestionId]
    );
    return rows;
  }

  static async create(data) {
    const {
      programming_question_id,
      name,
      description,
      input,
      expected_result,
      is_active = true,
      is_hidden = false,
      should_match_exactly = true,
      percentage_of_match = 100,
      order = 0,
      weight = 1
    } = data;

    const [result] = await pool.execute(
      `INSERT INTO test_cases 
       (programming_question_id, name, description, input, expected_result, is_active, 
        is_hidden, should_match_exactly, percentage_of_match, \`order\`, weight) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        programming_question_id, name, description || null, input, expected_result,
        is_active, is_hidden, should_match_exactly, percentage_of_match, order, weight
      ]
    );

    return result.insertId;
  }

  static async update(id, data) {
    const {
      name,
      description,
      input,
      expected_result,
      is_active,
      is_hidden,
      should_match_exactly,
      percentage_of_match,
      order,
      weight
    } = data;

    await pool.execute(
      `UPDATE test_cases 
       SET name = ?, description = ?, input = ?, expected_result = ?, is_active = ?,
           is_hidden = ?, should_match_exactly = ?, percentage_of_match = ?, \`order\` = ?, weight = ?
       WHERE id = ?`,
      [
        name, description || null, input, expected_result, is_active,
        is_hidden, should_match_exactly, percentage_of_match, order, weight, id
      ]
    );

    return true;
  }

  static async delete(id) {
    await pool.execute('DELETE FROM test_cases WHERE id = ?', [id]);
    return true;
  }

  static async deleteByProgrammingQuestionId(programmingQuestionId) {
    await pool.execute(
      'DELETE FROM test_cases WHERE programming_question_id = ?',
      [programmingQuestionId]
    );
    return true;
  }

  static async reorder(programmingQuestionId, orderedIds) {
    for (let i = 0; i < orderedIds.length; i++) {
      await pool.execute(
        'UPDATE test_cases SET `order` = ? WHERE id = ? AND programming_question_id = ?',
        [i, orderedIds[i], programmingQuestionId]
      );
    }
    return true;
  }

  static async toggleActive(id) {
    await pool.execute(
      'UPDATE test_cases SET is_active = NOT is_active WHERE id = ?',
      [id]
    );
    return true;
  }

  static async toggleHidden(id) {
    await pool.execute(
      'UPDATE test_cases SET is_hidden = NOT is_hidden WHERE id = ?',
      [id]
    );
    return true;
  }
}

module.exports = TestCase;




