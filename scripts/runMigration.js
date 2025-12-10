// Script to run database migrations
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
      multipleStatements: true // Allow multiple SQL statements
    });

    console.log('Connected to database:', process.env.DB_NAME);

    // Read migration file
    const migrationPath = path.join(__dirname, '../database/migration_create_groups_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('\nRunning migration: migration_create_groups_table.sql');
    console.log('Creating groups and group_members tables...\n');

    // Execute migration
    await connection.query(migrationSQL);

    console.log('✓ Migration completed successfully!');
    console.log('✓ Created `groups` table');
    console.log('✓ Created `group_members` table\n');

    // Verify tables exist
    const [tables] = await connection.query(
      "SHOW TABLES LIKE 'groups'"
    );
    
    if (tables.length > 0) {
      console.log('✓ Verified: `groups` table exists');
    }

    const [memberTables] = await connection.query(
      "SHOW TABLES LIKE 'group_members'"
    );
    
    if (memberTables.length > 0) {
      console.log('✓ Verified: `group_members` table exists\n');
    }

  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    if (error.code === 'ER_TABLE_EXISTS_ERROR') {
      console.log('\nNote: Tables may already exist. This is okay if you\'re re-running the migration.');
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed.');
    }
  }
}

// Run migration
runMigration();
