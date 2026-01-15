// MailStatus.js - Model for tracking email sending status

const pool = require('../config/db');

class MailStatus {
  /**
   * Create the mail_status table if it doesn't exist
   */
  static async createTable() {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS mail_status (
        id INT AUTO_INCREMENT PRIMARY KEY,
        mailer_template_id INT NULL,
        status ENUM('pending', 'success', 'failure', 'skipped', 'bounced', 'complained') NOT NULL DEFAULT 'pending',
        message TEXT,
        to_address VARCHAR(500) NOT NULL,
        from_address VARCHAR(255),
        cc_address VARCHAR(500),
        bcc_address VARCHAR(500),
        reply_to VARCHAR(255),
        subject VARCHAR(500),
        message_id VARCHAR(255),
        error_code VARCHAR(100),
        error_details TEXT,
        retry_count INT DEFAULT 0,
        last_retry_at TIMESTAMP NULL,
        queued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sent_at TIMESTAMP NULL,
        delivered_at TIMESTAMP NULL,
        opened_at TIMESTAMP NULL,
        clicked_at TIMESTAMP NULL,
        sent_by INT NULL,
        recipient_user_id INT NULL,
        metadata JSON,
        INDEX idx_status (status),
        INDEX idx_to_address (to_address(100)),
        INDEX idx_queued_at (queued_at),
        INDEX idx_sent_at (sent_at),
        INDEX idx_template_id (mailer_template_id),
        INDEX idx_message_id (message_id)
      )
    `;
    
    try {
      await pool.execute(createTableSQL);
      console.log('mail_status table created or already exists');
      return true;
    } catch (error) {
      console.error('Error creating mail_status table:', error);
      throw error;
    }
  }

  /**
   * Create a new mail status record
   * @param {object} data - Mail status data
   * @returns {Promise<number>} - Created record ID
   */
  static async create(data) {
    const {
      mailer_template_id,
      status = 'pending',
      message,
      to_address,
      from_address,
      cc_address,
      bcc_address,
      reply_to,
      subject,
      message_id,
      error_code,
      error_details,
      sent_by,
      recipient_user_id,
      metadata
    } = data;

    try {
      const [result] = await pool.execute(
        `INSERT INTO mail_status 
         (mailer_template_id, status, message, to_address, from_address, cc_address, 
          bcc_address, reply_to, subject, message_id, error_code, error_details, 
          sent_by, recipient_user_id, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          mailer_template_id || null,
          status,
          message || null,
          to_address,
          from_address || null,
          cc_address || null,
          bcc_address || null,
          reply_to || null,
          subject || null,
          message_id || null,
          error_code || null,
          error_details || null,
          sent_by || null,
          recipient_user_id || null,
          metadata ? JSON.stringify(metadata) : null
        ]
      );
      return result.insertId;
    } catch (error) {
      // If table doesn't exist, create it and retry
      if (error.code === 'ER_NO_SUCH_TABLE') {
        await this.createTable();
        return this.create(data);
      }
      console.error('Error creating mail status:', error);
      throw error;
    }
  }

  /**
   * Update a mail status record
   * @param {number} id - Record ID
   * @param {object} data - Updated data
   * @returns {Promise<boolean>}
   */
  static async update(id, data) {
    const allowedFields = [
      'status', 'message', 'message_id', 'error_code', 'error_details',
      'retry_count', 'last_retry_at', 'sent_at', 'delivered_at',
      'opened_at', 'clicked_at', 'metadata'
    ];

    const updates = [];
    const values = [];

    Object.keys(data).forEach(key => {
      if (allowedFields.includes(key) && data[key] !== undefined) {
        updates.push(`${key} = ?`);
        if (key === 'metadata') {
          values.push(JSON.stringify(data[key]));
        } else {
          values.push(data[key]);
        }
      }
    });

    if (updates.length === 0) return false;

    values.push(id);

    try {
      const [result] = await pool.execute(
        `UPDATE mail_status SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating mail status:', error);
      throw error;
    }
  }

  /**
   * Find mail status by ID
   * @param {number} id - Record ID
   * @returns {Promise<object|null>}
   */
  static async findById(id) {
    const [rows] = await pool.execute(
      'SELECT * FROM mail_status WHERE id = ?',
      [id]
    );
    if (rows[0] && rows[0].metadata) {
      try {
        rows[0].metadata = JSON.parse(rows[0].metadata);
      } catch (e) {
        rows[0].metadata = null;
      }
    }
    return rows[0] || null;
  }

  /**
   * Find mail status by message ID (SES MessageId)
   * @param {string} messageId - SES Message ID
   * @returns {Promise<object|null>}
   */
  static async findByMessageId(messageId) {
    const [rows] = await pool.execute(
      'SELECT * FROM mail_status WHERE message_id = ?',
      [messageId]
    );
    return rows[0] || null;
  }

  /**
   * Get paginated mail status records with filters
   * @param {object} options - Query options
   * @returns {Promise<object>}
   */
  static async getAllPaginated(options = {}) {
    const {
      status,
      to_address,
      mailer_template_id,
      from_date,
      to_date,
      limit = 50,
      offset = 0
    } = options;

    let query = 'SELECT ms.*, mt.name as template_name, mt.unique_id as template_unique_id FROM mail_status ms LEFT JOIN mailer_templates mt ON ms.mailer_template_id = mt.id WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM mail_status ms WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND ms.status = ?';
      countQuery += ' AND ms.status = ?';
      params.push(status);
    }

    if (to_address) {
      query += ' AND ms.to_address LIKE ?';
      countQuery += ' AND ms.to_address LIKE ?';
      params.push(`%${to_address}%`);
    }

    if (mailer_template_id) {
      query += ' AND ms.mailer_template_id = ?';
      countQuery += ' AND ms.mailer_template_id = ?';
      params.push(mailer_template_id);
    }

    if (from_date) {
      query += ' AND ms.queued_at >= ?';
      countQuery += ' AND ms.queued_at >= ?';
      params.push(from_date);
    }

    if (to_date) {
      query += ' AND ms.queued_at <= ?';
      countQuery += ' AND ms.queued_at <= ?';
      params.push(to_date);
    }

    // Get total count
    const [countRows] = await pool.execute(countQuery, params);
    const total = countRows[0].total;

    // Get paginated results
    query += ' ORDER BY ms.queued_at DESC LIMIT ? OFFSET ?';
    const [rows] = await pool.execute(query, [...params, limit, offset]);

    return {
      records: rows,
      total,
      limit,
      offset
    };
  }

  /**
   * Get email statistics
   * @param {object} options - Query options
   * @returns {Promise<object>}
   */
  static async getStatistics(options = {}) {
    const { from_date, to_date, mailer_template_id } = options;

    let query = `
      SELECT 
        status,
        COUNT(*) as count,
        DATE(queued_at) as date
      FROM mail_status
      WHERE 1=1
    `;
    const params = [];

    if (from_date) {
      query += ' AND queued_at >= ?';
      params.push(from_date);
    }

    if (to_date) {
      query += ' AND queued_at <= ?';
      params.push(to_date);
    }

    if (mailer_template_id) {
      query += ' AND mailer_template_id = ?';
      params.push(mailer_template_id);
    }

    query += ' GROUP BY status, DATE(queued_at) ORDER BY date DESC, status';

    const [rows] = await pool.execute(query, params);

    // Also get summary totals
    let summaryQuery = `
      SELECT 
        status,
        COUNT(*) as count
      FROM mail_status
      WHERE 1=1
    `;
    
    if (from_date) {
      summaryQuery += ' AND queued_at >= ?';
    }
    if (to_date) {
      summaryQuery += ' AND queued_at <= ?';
    }
    if (mailer_template_id) {
      summaryQuery += ' AND mailer_template_id = ?';
    }
    
    summaryQuery += ' GROUP BY status';

    const [summaryRows] = await pool.execute(summaryQuery, params);

    const summary = {
      total: 0,
      pending: 0,
      success: 0,
      failure: 0,
      skipped: 0,
      bounced: 0,
      complained: 0
    };

    summaryRows.forEach(row => {
      summary[row.status] = row.count;
      summary.total += row.count;
    });

    return {
      daily: rows,
      summary
    };
  }

  /**
   * Get recent emails for a specific recipient
   * @param {string} email - Recipient email
   * @param {number} limit - Number of records
   * @returns {Promise<Array>}
   */
  static async getByRecipient(email, limit = 10) {
    const [rows] = await pool.execute(
      `SELECT ms.*, mt.name as template_name 
       FROM mail_status ms 
       LEFT JOIN mailer_templates mt ON ms.mailer_template_id = mt.id 
       WHERE ms.to_address LIKE ? 
       ORDER BY ms.queued_at DESC 
       LIMIT ?`,
      [`%${email}%`, limit]
    );
    return rows;
  }

  /**
   * Delete old records (cleanup job)
   * @param {number} daysOld - Delete records older than this many days
   * @returns {Promise<number>} - Number of deleted records
   */
  static async deleteOldRecords(daysOld = 90) {
    const [result] = await pool.execute(
      'DELETE FROM mail_status WHERE queued_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
      [daysOld]
    );
    return result.affectedRows;
  }

  /**
   * Mark as delivered (for SES webhook/notification handling)
   * @param {string} messageId - SES Message ID
   * @returns {Promise<boolean>}
   */
  static async markDelivered(messageId) {
    const [result] = await pool.execute(
      'UPDATE mail_status SET delivered_at = NOW() WHERE message_id = ?',
      [messageId]
    );
    return result.affectedRows > 0;
  }

  /**
   * Mark as bounced (for SES webhook/notification handling)
   * @param {string} messageId - SES Message ID
   * @param {string} bounceDetails - Bounce details JSON
   * @returns {Promise<boolean>}
   */
  static async markBounced(messageId, bounceDetails) {
    const [result] = await pool.execute(
      `UPDATE mail_status 
       SET status = 'bounced', 
           error_details = ?, 
           message = 'Email bounced'
       WHERE message_id = ?`,
      [bounceDetails, messageId]
    );
    return result.affectedRows > 0;
  }

  /**
   * Mark as complained (for SES webhook/notification handling)
   * @param {string} messageId - SES Message ID
   * @returns {Promise<boolean>}
   */
  static async markComplained(messageId) {
    const [result] = await pool.execute(
      `UPDATE mail_status 
       SET status = 'complained', 
           message = 'Recipient marked email as spam'
       WHERE message_id = ?`,
      [messageId]
    );
    return result.affectedRows > 0;
  }
}

module.exports = MailStatus;

