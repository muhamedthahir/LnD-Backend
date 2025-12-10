// Script to run degree column migration for users table
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

async function runMigration() {
  let connection;
  
  try {
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
      multipleStatements: true
    });

    console.log('Connected to database:', process.env.DB_NAME);

    // Read migration file
    const migrationPath = path.join(__dirname, '../database/migration_add_degree_to_users.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('\nRunning migration: migration_add_degree_to_users.sql');
    console.log('Adding degree column to users table...\n');

    // Execute migration
    await connection.query(migrationSQL);

    console.log('✓ Migration completed successfully!');
    console.log('✓ Added `degree` column to users table\n');

    // Verify column exists
    const [columns] = await connection.query(
      "SHOW COLUMNS FROM users LIKE 'degree'"
    );
    
    if (columns.length > 0) {
      console.log('✓ Verified: `degree` column exists in users table\n');
    }

  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('✓ Column already exists. Migration may have been run before.');
    } else {
      console.error('✗ Migration failed:', error.message);
      process.exit(1);
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed.');
    }
  }
}

// Run migration
runMigration();

