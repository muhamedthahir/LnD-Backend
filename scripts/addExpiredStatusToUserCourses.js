const pool = require('../config/db');

async function addExpiredStatusToUserCourses() {
  try {
    console.log('Adding "expired" status to user_courses table...');

    // Check current ENUM values
    const [currentEnum] = await pool.execute(
      `SELECT COLUMN_TYPE 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'user_courses' 
       AND COLUMN_NAME = 'status'`
    );

    console.log('Current status ENUM:', currentEnum[0]?.COLUMN_TYPE);

    // Modify the ENUM to include 'expired'
    await pool.execute(
      `ALTER TABLE user_courses 
       MODIFY COLUMN status ENUM('in_progress', 'completed', 'paused', 'not_started', 'expired') 
       NOT NULL DEFAULT 'not_started'`
    );

    console.log('✓ Successfully added "expired" status to user_courses table');

    // Verify the change
    const [newEnum] = await pool.execute(
      `SELECT COLUMN_TYPE 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'user_courses' 
       AND COLUMN_NAME = 'status'`
    );

    console.log('New status ENUM:', newEnum[0]?.COLUMN_TYPE);
    console.log('\nMigration completed successfully!');

    process.exit(0);
  } catch (error) {
    console.error('Error adding expired status:', error);
    process.exit(1);
  }
}

addExpiredStatusToUserCourses();

