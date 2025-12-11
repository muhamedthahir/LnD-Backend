const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  let connection;
  
  try {
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'demo',
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
      multipleStatements: true
    });

    console.log('Connected to database');

    // Read migration file
    const migrationPath = path.join(__dirname, '../database/migration_create_institutions_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running migration...');
    
    // Execute migration
    await connection.query(migrationSQL);
    
    console.log('Migration completed successfully!');
    console.log('Institutions table created and existing colleges migrated.');
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

runMigration();

