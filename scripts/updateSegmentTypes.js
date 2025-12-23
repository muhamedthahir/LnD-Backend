const mysql = require('mysql2/promise');
require('dotenv').config();

async function updateSegmentTypes() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'lnd_db',
      multipleStatements: true
    });

    console.log('Connected to database');

    // Check current ENUM values
    const [columns] = await connection.execute(
      `SELECT COLUMN_TYPE 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'segments' 
       AND COLUMN_NAME = 'segment_type'`,
      [process.env.DB_NAME || 'lnd_db']
    );

    if (columns.length > 0) {
      console.log('Current segment_type ENUM:', columns[0].COLUMN_TYPE);
      
      // Update the ENUM to include new lesson types
      console.log('Updating segment_type ENUM to include lesson types...');
      await connection.execute(
        `ALTER TABLE segments 
         MODIFY COLUMN segment_type ENUM(
           'coding', 
           'mcq', 
           'reference_videos', 
           'articles', 
           'assessment',
           'lesson_text',
           'lesson_video',
           'lesson_audio',
           'lesson_document'
         ) NOT NULL`
      );
      console.log('✓ Successfully updated segment_type ENUM');
    } else {
      console.log('✗ segment_type column not found');
    }

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

updateSegmentTypes();

