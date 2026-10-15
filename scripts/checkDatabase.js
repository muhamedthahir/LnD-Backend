const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkDatabase() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'lnd_db',
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306
    });

    console.log('✓ Connected to database\n');

    // Check users table columns
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'users' 
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('Users table columns:');
    const columnNames = columns.map(c => c.COLUMN_NAME);
    columns.forEach(col => {
      console.log(`  - ${col.COLUMN_NAME} (${col.DATA_TYPE}, nullable: ${col.IS_NULLABLE})`);
    });

    // Check for required columns
    const requiredColumns = ['roll_number', 'department', 'section', 'otp', 'otp_expires_at', 'password_set'];
    const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));
    
    if (missingColumns.length > 0) {
      console.log('\n⚠ Missing columns:');
      missingColumns.forEach(col => console.log(`  - ${col}`));
      console.log('\nPlease run the migration: database/RUN_THIS_MIGRATION.sql');
    } else {
      console.log('\n✓ All required columns exist!');
    }

    // Check if password is nullable
    const passwordCol = columns.find(c => c.COLUMN_NAME === 'password');
    if (passwordCol) {
      if (passwordCol.IS_NULLABLE === 'YES') {
        console.log('✓ Password column is nullable');
      } else {
        console.log('⚠ Password column is NOT nullable - should be nullable for OTP flow');
      }
    }

  } catch (error) {
    console.error('✗ Database check failed:', error.message);
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('  Please check your database credentials in .env file');
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkDatabase();

