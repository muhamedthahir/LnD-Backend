const pool = require('../config/db');

class MailerTemplate {
  /**
   * Create mailer_templates table if it doesn't exist
   */
  static async createTable() {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS mailer_templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        unique_id VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        type ENUM('promotional', 'transactional', 'notification', 'reminder') NOT NULL,
        category VARCHAR(100),
        subject VARCHAR(500) NOT NULL,
        preview_text VARCHAR(255),
        html_template LONGTEXT,
        text_template TEXT,
        template_format ENUM('html', 'text', 'both') DEFAULT 'html',
        has_dynamic_variables BOOLEAN DEFAULT FALSE,
        variables JSON,
        default_sender_name VARCHAR(255),
        default_sender_email VARCHAR(255),
        default_reply_to VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE,
        priority INT DEFAULT 0,
        tags JSON,
        version INT DEFAULT 1,
        usage_count INT DEFAULT 0,
        last_used_at TIMESTAMP NULL,
        created_by INT,
        updated_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_type (type),
        INDEX idx_category (category),
        INDEX idx_active (is_active),
        INDEX idx_unique_id (unique_id)
      )
    `;
    
    try {
      await pool.execute(createTableSQL);
      console.log('MailerTemplate table created or already exists');
    } catch (error) {
      console.error('Error creating mailer_templates table:', error);
      throw error;
    }
  }

  /**
   * Create a new mailer template
   */
  static async create(templateData) {
    const {
      unique_id,
      name,
      description,
      type,
      category,
      subject,
      preview_text,
      html_template,
      text_template,
      template_format = 'html',
      has_dynamic_variables = false,
      variables,
      default_sender_name,
      default_sender_email,
      default_reply_to,
      is_active = true,
      priority = 0,
      tags,
      created_by
    } = templateData;

    try {
      const [result] = await pool.execute(
        `INSERT INTO mailer_templates 
         (unique_id, name, description, type, category, subject, preview_text, 
          html_template, text_template, template_format, has_dynamic_variables, 
          variables, default_sender_name, default_sender_email, default_reply_to,
          is_active, priority, tags, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          unique_id,
          name,
          description,
          type,
          category,
          subject,
          preview_text,
          html_template,
          text_template,
          template_format,
          has_dynamic_variables,
          variables ? JSON.stringify(variables) : null,
          default_sender_name,
          default_sender_email,
          default_reply_to,
          is_active,
          priority,
          tags ? JSON.stringify(tags) : null,
          created_by
        ]
      );
      return result.insertId;
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new Error('Template with this unique ID already exists');
      }
      throw error;
    }
  }

  /**
   * Safely parse JSON, returning default value on error
   */
  static safeJsonParse(value, defaultValue = []) {
    if (!value || value === '' || value === 'null') return defaultValue;
    try {
      return JSON.parse(value);
    } catch (e) {
      return defaultValue;
    }
  }

  /**
   * Find template by ID
   */
  static async findById(id) {
    const [rows] = await pool.execute(
      'SELECT * FROM mailer_templates WHERE id = ?',
      [id]
    );
    if (rows[0]) {
      rows[0].variables = this.safeJsonParse(rows[0].variables, []);
      rows[0].tags = this.safeJsonParse(rows[0].tags, []);
    }
    return rows[0] || null;
  }

  /**
   * Find template by unique_id
   */
  static async findByUniqueId(unique_id) {
    const [rows] = await pool.execute(
      'SELECT * FROM mailer_templates WHERE unique_id = ?',
      [unique_id]
    );
    if (rows[0]) {
      rows[0].variables = this.safeJsonParse(rows[0].variables, []);
      rows[0].tags = this.safeJsonParse(rows[0].tags, []);
    }
    return rows[0] || null;
  }

  /**
   * Get all templates with pagination and filters
   */
  static async getAllPaginated({ search, type, category, is_active, limit, offset }) {
    let query = 'SELECT * FROM mailer_templates WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (name LIKE ? OR unique_id LIKE ? OR description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    if (is_active !== undefined && is_active !== null && is_active !== '') {
      query += ' AND is_active = ?';
      params.push(is_active === 'true' || is_active === true ? 1 : 0);
    }

    query += ' ORDER BY priority DESC, name ASC';

    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
    const [countRows] = await pool.execute(countQuery, params);
    const total = countRows[0].total;

    // Get paginated results
    query += ` LIMIT ${limit} OFFSET ${offset}`;
    const [rows] = await pool.execute(query, params);

    // Parse JSON fields
    const templates = rows.map(row => ({
      ...row,
      variables: this.safeJsonParse(row.variables, []),
      tags: this.safeJsonParse(row.tags, [])
    }));

    return {
      templates,
      total
    };
  }

  /**
   * Get all active templates (for dropdowns)
   */
  static async getAllActive() {
    const [rows] = await pool.execute(
      'SELECT id, unique_id, name, type, category, subject FROM mailer_templates WHERE is_active = TRUE ORDER BY priority DESC, name ASC'
    );
    return rows;
  }

  /**
   * Get templates by type
   */
  static async getByType(type) {
    const [rows] = await pool.execute(
      'SELECT * FROM mailer_templates WHERE type = ? AND is_active = TRUE ORDER BY priority DESC, name ASC',
      [type]
    );
    return rows.map(row => ({
      ...row,
      variables: this.safeJsonParse(row.variables, []),
      tags: this.safeJsonParse(row.tags, [])
    }));
  }

  /**
   * Update a template
   */
  static async update(id, templateData) {
    const {
      unique_id,
      name,
      description,
      type,
      category,
      subject,
      preview_text,
      html_template,
      text_template,
      template_format,
      has_dynamic_variables,
      variables,
      default_sender_name,
      default_sender_email,
      default_reply_to,
      is_active,
      priority,
      tags,
      updated_by
    } = templateData;

    try {
      // Increment version on update
      await pool.execute(
        `UPDATE mailer_templates SET
           unique_id = COALESCE(?, unique_id),
           name = COALESCE(?, name),
           description = COALESCE(?, description),
           type = COALESCE(?, type),
           category = COALESCE(?, category),
           subject = COALESCE(?, subject),
           preview_text = COALESCE(?, preview_text),
           html_template = COALESCE(?, html_template),
           text_template = COALESCE(?, text_template),
           template_format = COALESCE(?, template_format),
           has_dynamic_variables = COALESCE(?, has_dynamic_variables),
           variables = COALESCE(?, variables),
           default_sender_name = COALESCE(?, default_sender_name),
           default_sender_email = COALESCE(?, default_sender_email),
           default_reply_to = COALESCE(?, default_reply_to),
           is_active = COALESCE(?, is_active),
           priority = COALESCE(?, priority),
           tags = COALESCE(?, tags),
           updated_by = ?,
           version = version + 1
         WHERE id = ?`,
        [
          unique_id,
          name,
          description,
          type,
          category,
          subject,
          preview_text,
          html_template,
          text_template,
          template_format,
          has_dynamic_variables,
          variables ? JSON.stringify(variables) : null,
          default_sender_name,
          default_sender_email,
          default_reply_to,
          is_active,
          priority,
          tags ? JSON.stringify(tags) : null,
          updated_by,
          id
        ]
      );
      return true;
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new Error('Template with this unique ID already exists');
      }
      throw error;
    }
  }

  /**
   * Delete a template
   */
  static async delete(id) {
    await pool.execute(
      'DELETE FROM mailer_templates WHERE id = ?',
      [id]
    );
    return true;
  }

  /**
   * Toggle active status
   */
  static async toggleActive(id, is_active, updated_by) {
    await pool.execute(
      'UPDATE mailer_templates SET is_active = ?, updated_by = ? WHERE id = ?',
      [is_active, updated_by, id]
    );
    return true;
  }

  /**
   * Increment usage count and update last_used_at
   */
  static async incrementUsage(id) {
    await pool.execute(
      'UPDATE mailer_templates SET usage_count = usage_count + 1, last_used_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );
    return true;
  }

  /**
   * Get template with variables replaced
   * @param {number} id - Template ID
   * @param {object} data - Object with variable values
   */
  static async getRenderedTemplate(id, data = {}) {
    const template = await this.findById(id);
    if (!template) return null;

    let htmlContent = template.html_template || '';
    let textContent = template.text_template || '';
    let subject = template.subject || '';

    // Replace variables in the format {{variableName}}
    const variables = template.variables || [];
    for (const variable of variables) {
      const regex = new RegExp(`{{\\s*${variable}\\s*}}`, 'g');
      const value = data[variable] || '';
      htmlContent = htmlContent.replace(regex, value);
      textContent = textContent.replace(regex, value);
      subject = subject.replace(regex, value);
    }

    // Also replace any data keys not in variables list
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      htmlContent = htmlContent.replace(regex, value);
      textContent = textContent.replace(regex, value);
      subject = subject.replace(regex, value);
    }

    // Increment usage
    await this.incrementUsage(id);

    return {
      ...template,
      rendered_subject: subject,
      rendered_html: htmlContent,
      rendered_text: textContent
    };
  }

  /**
   * Get distinct categories
   */
  static async getCategories() {
    const [rows] = await pool.execute(
      'SELECT DISTINCT category FROM mailer_templates WHERE category IS NOT NULL ORDER BY category'
    );
    return rows.map(row => row.category);
  }

  /**
   * Duplicate a template
   */
  static async duplicate(id, new_unique_id, created_by) {
    const template = await this.findById(id);
    if (!template) return null;

    const newTemplate = {
      ...template,
      unique_id: new_unique_id,
      name: `${template.name} (Copy)`,
      version: 1,
      usage_count: 0,
      last_used_at: null,
      created_by
    };

    delete newTemplate.id;
    delete newTemplate.created_at;
    delete newTemplate.updated_at;
    delete newTemplate.updated_by;

    return await this.create(newTemplate);
  }
}

module.exports = MailerTemplate;

