const pool = require('../config/db');

class UserDetails {
  /**
   * Create or update user details
   * @param {number} userId - User ID
   * @param {Object} details - User details
   * @returns {Promise<Object>} - Created/updated details
   */
  static async upsert(userId, details) {
    const {
      mobile_number,
      alternate_mobile,
      gender,
      date_of_birth,
      address_line1,
      address_line2,
      city,
      state,
      country,
      postal_code,
      linkedin_url,
      github_url,
      portfolio_url,
      bio,
      profile_picture_url,
      emergency_contact_name,
      emergency_contact_phone
    } = details;

    // Check if details already exist
    const existing = await this.findByUserId(userId);

    if (existing) {
      // Update existing details
      await pool.execute(
        `UPDATE user_details SET 
          mobile_number = ?,
          alternate_mobile = ?,
          gender = ?,
          date_of_birth = ?,
          address_line1 = ?,
          address_line2 = ?,
          city = ?,
          state = ?,
          country = ?,
          postal_code = ?,
          linkedin_url = ?,
          github_url = ?,
          portfolio_url = ?,
          bio = ?,
          profile_picture_url = ?,
          emergency_contact_name = ?,
          emergency_contact_phone = ?
        WHERE user_id = ?`,
        [
          mobile_number || null,
          alternate_mobile || null,
          gender || null,
          date_of_birth || null,
          address_line1 || null,
          address_line2 || null,
          city || null,
          state || null,
          country || null,
          postal_code || null,
          linkedin_url || null,
          github_url || null,
          portfolio_url || null,
          bio || null,
          profile_picture_url || null,
          emergency_contact_name || null,
          emergency_contact_phone || null,
          userId
        ]
      );
      return await this.findByUserId(userId);
    } else {
      // Create new details
      const [result] = await pool.execute(
        `INSERT INTO user_details (
          user_id, mobile_number, alternate_mobile, gender, date_of_birth,
          address_line1, address_line2, city, state, country, postal_code,
          linkedin_url, github_url, portfolio_url, bio, profile_picture_url,
          emergency_contact_name, emergency_contact_phone
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          mobile_number || null,
          alternate_mobile || null,
          gender || null,
          date_of_birth || null,
          address_line1 || null,
          address_line2 || null,
          city || null,
          state || null,
          country || null,
          postal_code || null,
          linkedin_url || null,
          github_url || null,
          portfolio_url || null,
          bio || null,
          profile_picture_url || null,
          emergency_contact_name || null,
          emergency_contact_phone || null
        ]
      );
      return await this.findByUserId(userId);
    }
  }

  /**
   * Find user details by user ID
   * @param {number} userId - User ID
   * @returns {Promise<Object|null>} - User details or null
   */
  static async findByUserId(userId) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM user_details WHERE user_id = ?',
        [userId]
      );
      return rows[0] || null;
    } catch (error) {
      // If table doesn't exist, return null
      if (error.code === 'ER_NO_SUCH_TABLE') {
        console.warn('user_details table not found. Please run the migration.');
        return null;
      }
      throw error;
    }
  }

  /**
   * Check if user has completed their profile
   * Returns completion status and missing fields
   * @param {number} userId - User ID
   * @returns {Promise<Object>} - { isComplete, completionPercentage, missingFields }
   */
  static async checkProfileCompletion(userId) {
    const details = await this.findByUserId(userId);
    
    // Required fields for profile completion
    const requiredFields = [
      'mobile_number',
      'gender',
      'city',
      'state',
      'country'
    ];

    // Optional but recommended fields
    const optionalFields = [
      'date_of_birth',
      'address_line1',
      'postal_code',
      'bio'
    ];

    const allFields = [...requiredFields, ...optionalFields];
    const missingRequired = [];
    const missingOptional = [];
    let filledCount = 0;

    if (!details) {
      return {
        isComplete: false,
        completionPercentage: 0,
        missingRequired: requiredFields,
        missingOptional: optionalFields,
        hasDetails: false
      };
    }

    for (const field of requiredFields) {
      if (!details[field] || details[field] === '') {
        missingRequired.push(field);
      } else {
        filledCount++;
      }
    }

    for (const field of optionalFields) {
      if (!details[field] || details[field] === '') {
        missingOptional.push(field);
      } else {
        filledCount++;
      }
    }

    const completionPercentage = Math.round((filledCount / allFields.length) * 100);

    return {
      isComplete: missingRequired.length === 0,
      completionPercentage,
      missingRequired,
      missingOptional,
      hasDetails: true
    };
  }

  /**
   * Delete user details
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} - True if deleted
   */
  static async delete(userId) {
    const [result] = await pool.execute(
      'DELETE FROM user_details WHERE user_id = ?',
      [userId]
    );
    return result.affectedRows > 0;
  }

  /**
   * Create the user_details table if it doesn't exist
   */
  static async createTable() {
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS user_details (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL UNIQUE,
          mobile_number VARCHAR(20),
          alternate_mobile VARCHAR(20),
          gender ENUM('male', 'female', 'other', 'prefer_not_to_say'),
          date_of_birth DATE,
          address_line1 VARCHAR(255),
          address_line2 VARCHAR(255),
          city VARCHAR(100),
          state VARCHAR(100),
          country VARCHAR(100),
          postal_code VARCHAR(20),
          linkedin_url VARCHAR(255),
          github_url VARCHAR(255),
          portfolio_url VARCHAR(255),
          bio TEXT,
          profile_picture_url VARCHAR(500),
          emergency_contact_name VARCHAR(255),
          emergency_contact_phone VARCHAR(20),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_user_id (user_id),
          INDEX idx_city (city),
          INDEX idx_state (state),
          INDEX idx_country (country)
        )
      `);
      console.log('✓ user_details table created/verified');
    } catch (error) {
      if (error.code !== 'ER_TABLE_EXISTS_ERROR') {
        console.error('Error creating user_details table:', error);
      }
    }
  }
}

module.exports = UserDetails;

