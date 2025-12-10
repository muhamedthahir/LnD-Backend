const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixMigration() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'lnd_db',
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
      multipleStatements: true
    });

    console.log('✓ Connected to database\n');

    // Check existing columns first
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'users' AND TABLE_SCHEMA = DATABASE()
      ORDER BY ORDINAL_POSITION
    `);
    
    const existingColumns = columns.map(c => c.COLUMN_NAME);
    console.log('Existing columns:', existingColumns.join(', '), '\n');

    // Add missing columns
    const migrations = [
      { name: 'roll_number', sql: "ALTER TABLE users ADD COLUMN roll_number VARCHAR(50) NULL" },
      { name: 'otp', sql: "ALTER TABLE users ADD COLUMN otp VARCHAR(10) NULL" },
      { name: 'password nullable', sql: "ALTER TABLE users MODIFY COLUMN password VARCHAR(255) NULL" }
    ];

    for (const migration of migrations) {
      try {
        if (migration.name === 'roll_number' && existingColumns.includes('roll_number')) {
          console.log(`⚠ roll_number column already exists, skipping`);
          continue;
        }
        if (migration.name === 'otp' && existingColumns.includes('otp')) {
          console.log(`⚠ otp column already exists, skipping`);
          continue;
        }
        
        await connection.execute(migration.sql);
        console.log(`✓ ${migration.name} - Success`);
      } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log(`⚠ ${migration.name} - Already exists (skipping)`);
        } else {
          console.error(`✗ ${migration.name} - Error:`, error.message);
        }
      }
    }

    // Create indexes
    console.log('\nCreating indexes...');
    const indexes = [
      { name: 'idx_roll_number', sql: "CREATE INDEX idx_roll_number ON users(roll_number)" },
      { name: 'idx_department', sql: "CREATE INDEX idx_department ON users(department)" },
      { name: 'idx_otp', sql: "CREATE INDEX idx_otp ON users(otp)" }
    ];

    for (const index of indexes) {
      try {
        await connection.execute(index.sql);
        console.log(`✓ ${index.name} - Created`);
      } catch (error) {
        if (error.code === 'ER_DUP_KEYNAME') {
          console.log(`⚠ ${index.name} - Already exists (skipping)`);
        } else if (error.code === 'ER_KEY_COLUMN_DOES_NOT_EXITS') {
          console.log(`⚠ ${index.name} - Column doesn't exist yet (skipping)`);
        } else {
          console.error(`✗ ${index.name} - Error:`, error.message);
        }
      }
    }

    // Verify final state
    console.log('\n=== Final Verification ===');
    const [finalColumns] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'users' AND TABLE_SCHEMA = DATABASE()
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('\nUsers table columns:');
    finalColumns.forEach(col => {
      console.log(`  - ${col.COLUMN_NAME} (${col.DATA_TYPE}, nullable: ${col.IS_NULLABLE}, default: ${col.COLUMN_DEFAULT || 'NULL'})`);
    });

    // Check for required columns
    const requiredColumns = ['roll_number', 'department', 'section', 'otp', 'otp_expires_at', 'password_set'];
    const finalColumnNames = finalColumns.map(c => c.COLUMN_NAME);
    const missing = requiredColumns.filter(col => !finalColumnNames.includes(col));
    
    if (missing.length > 0) {
      console.log('\n⚠ Missing columns:', missing.join(', '));
    } else {
      console.log('\n✓ All required columns exist!');
    }

    // Check password nullable
    const passwordCol = finalColumns.find(c => c.COLUMN_NAME === 'password');
    if (passwordCol && passwordCol.IS_NULLABLE === 'YES') {
      console.log('✓ Password column is nullable');
    } else {
      console.log('⚠ Password column is NOT nullable');
    }

  } catch (error) {
    console.error('✗ Migration error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✓ Database connection closed');
    }
  }
}

fixMigration();

