/**
 * Script to create Question Bank tables
 * Run: node scripts/createQuestionBankTables.js
 */

const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

async function createTables() {
  console.log('Creating Question Bank tables...\n');

  try {
    // Read the schema file
    const schemaPath = path.join(__dirname, '../database/questionbank-schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Split by semicolon to get individual statements, but handle comments properly
    const statements = schema
      .split(/;(?=\s*(?:--|CREATE|$))/i)
      .map(s => s.trim())
      .filter(s => {
        // Remove pure comment lines and empty statements
        const cleaned = s.split('\n').filter(line => !line.trim().startsWith('--')).join('\n').trim();
        return cleaned.length > 0 && cleaned.toUpperCase().startsWith('CREATE');
      });

    console.log(`Found ${statements.length} CREATE TABLE statements\n`);

    // Execute each statement
    let successCount = 0;
    for (const statement of statements) {
      // Clean up the statement - remove comments
      const cleanStatement = statement
        .split('\n')
        .filter(line => !line.trim().startsWith('--'))
        .join('\n')
        .trim();
      
      if (cleanStatement) {
        try {
          await pool.execute(cleanStatement);
          // Extract table name from CREATE TABLE statement
          const match = cleanStatement.match(/CREATE TABLE IF NOT EXISTS `?(\w+)`?/i);
          if (match) {
            console.log(`✓ Created table: ${match[1]}`);
            successCount++;
          }
        } catch (err) {
          // Check if it's a "table already exists" error, which is okay
          if (err.code === 'ER_TABLE_EXISTS_ERROR') {
            const match = cleanStatement.match(/CREATE TABLE IF NOT EXISTS `?(\w+)`?/i);
            if (match) {
              console.log(`⚠ Table already exists: ${match[1]}`);
              successCount++;
            }
          } else {
            const match = cleanStatement.match(/CREATE TABLE IF NOT EXISTS `?(\w+)`?/i);
            console.error(`✗ Error creating table ${match ? match[1] : 'unknown'}:`, err.message);
          }
        }
      }
    }

    console.log(`\n========================================`);
    console.log(`Created/verified ${successCount} tables`);
    console.log(`========================================`);
    console.log('\nNow run: node scripts/seedQuestionBankMasterData.js');
    console.log('to seed the master data.\n');

    process.exit(0);
  } catch (error) {
    console.error('Error creating tables:', error);
    process.exit(1);
  }
}

createTables();
