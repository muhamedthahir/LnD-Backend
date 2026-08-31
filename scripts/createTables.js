const pool = require('../config/db');
const fs = require('fs');
const path = require('path');

async function createTables() {
  try {
    console.log('Creating database tables...\n');
    
    // Read the schema file
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Remove comments and split by semicolons
    const lines = schema.split('\n');
    let currentStatement = '';
    const statements = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      // Skip empty lines and comments
      if (trimmedLine === '' || trimmedLine.startsWith('--')) {
        continue;
      }
      
      currentStatement += ' ' + trimmedLine;
      
      // If line ends with semicolon, we have a complete statement
      if (trimmedLine.endsWith(';')) {
        const statement = currentStatement.trim();
        if (statement.length > 0) {
          statements.push(statement);
        }
        currentStatement = '';
      }
    }
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      try {
        await pool.execute(statement);
        // Extract table name from CREATE TABLE statement
        const tableMatch = statement.match(/CREATE TABLE (?:IF NOT EXISTS )?`?(\w+)`?/i);
        const tableName = tableMatch ? tableMatch[1] : `Statement ${i + 1}`;
        console.log(`✓ Created table: ${tableName}`);
      } catch (error) {
        // Ignore "table already exists" errors
        if (error.code === 'ER_TABLE_EXISTS_ERROR' || error.code === 'ER_DUP_TABLE') {
          const tableMatch = statement.match(/CREATE TABLE (?:IF NOT EXISTS )?`?(\w+)`?/i);
          const tableName = tableMatch ? tableMatch[1] : `Statement ${i + 1}`;
          console.log(`⚠ Table already exists: ${tableName}`);
        } else if (error.code === 'ER_DUP_KEYNAME') {
          console.log(`⚠ Index already exists (skipping)`);
        } else {
          console.error(`✗ Error executing statement ${i + 1}:`, error.message);
          console.error(`  Code: ${error.code}`);
          // Show first 150 chars of the statement
          const preview = statement.substring(0, 150).replace(/\s+/g, ' ');
          console.error(`  Statement: ${preview}...`);
          throw error;
        }
      }
    }
    
    console.log('\n✓ Database tables created successfully!');
    console.log('You can now run: npm run seed\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Error creating tables:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

createTables();

