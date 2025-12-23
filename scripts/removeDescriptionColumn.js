const mysql = require('mysql2/promise');
require('dotenv').config();

async function removeDescriptionColumn() {
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

    // Check if description column exists
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'courses' 
       AND COLUMN_NAME = 'description'`,
      [process.env.DB_NAME || 'lnd_db']
    );

    if (columns.length > 0) {
      console.log('Removing description column from courses table...');
      await connection.execute('ALTER TABLE courses DROP COLUMN description');
      console.log('✓ Successfully removed description column');
    } else {
      console.log('✓ Description column does not exist, skipping removal');
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

removeDescriptionColumn();

