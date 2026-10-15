const pool = require('../config/db');
const fs = require('fs');
const path = require('path');

async function createPracticeSegmentTables() {
  try {
    console.log('Creating practice segment tables...');
    
    // Read the SQL file
    const schemaPath = path.join(__dirname, '../database/practice_segment_schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Split by semicolon and filter out empty statements
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`Executing: ${statement.substring(0, 50)}...`);
        await pool.execute(statement);
      }
    }
    
    console.log('Practice segment tables created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error creating practice segment tables:', error);
    process.exit(1);
  }
}

createPracticeSegmentTables();

