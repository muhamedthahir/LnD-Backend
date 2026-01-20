const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

/**
 * Script to create all missing tables from schema files
 * This will create tables that are missing in the local database
 */

async function executeSQLFile(connection, filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`   ⚠️  File not found: ${filePath}`);
    return;
  }

  const sql = fs.readFileSync(filePath, 'utf8');
  
  // Split by semicolon but handle comments and multi-line statements
  const statements = sql
    .split(/;(?=\s*(?:--|CREATE|INSERT|UPDATE|DELETE|ALTER|DROP|$))/i)
    .map(s => s.trim())
    .filter(s => {
      const cleaned = s.split('\n').filter(line => !line.trim().startsWith('--')).join('\n').trim();
      return cleaned.length > 0 && (cleaned.toUpperCase().startsWith('CREATE') || cleaned.toUpperCase().startsWith('INSERT'));
    });

  let createdCount = 0;
  let skippedCount = 0;

  for (const statement of statements) {
    const cleanStatement = statement
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n')
      .trim();
    
    if (cleanStatement) {
      try {
        await connection.execute(cleanStatement);
        
        // Extract table name from CREATE TABLE statement
        const match = cleanStatement.match(/CREATE TABLE (?:IF NOT EXISTS )?`?(\w+)`?/i);
        if (match) {
          console.log(`   ✅ Created table: ${match[1]}`);
          createdCount++;
        }
      } catch (err) {
        // Ignore "table already exists" errors
        if (err.code === 'ER_TABLE_EXISTS_ERROR') {
          const match = cleanStatement.match(/CREATE TABLE (?:IF NOT EXISTS )?`?(\w+)`?/i);
          if (match) {
            console.log(`   ⏭️  Table already exists: ${match[1]}`);
            skippedCount++;
          }
        } else {
          console.warn(`   ⚠️  Warning: ${err.message}`);
        }
      }
    }
  }

  return { createdCount, skippedCount };
}

async function createMissingTables() {
  console.log('🚀 Creating missing tables from schema files...\n');

  // Validate environment variables
  if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASS || !process.env.DB_NAME) {
    console.error('❌ Missing required LOCAL database environment variables!');
    console.error('Please set: DB_HOST, DB_USER, DB_PASS, DB_NAME');
    process.exit(1);
  }

  let connection = null;

  try {
    // Connect to LOCAL database
    console.log('🔌 Connecting to LOCAL database...');
    const connectionConfig = {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
      ssl: process.env.USE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
      multipleStatements: true
    };

    connection = await mysql.createConnection(connectionConfig);
    console.log(`✅ Connected to LOCAL database: ${process.env.DB_NAME}\n`);

    // List of schema files to process (in order of dependencies)
    const schemaFiles = [
      { path: '../database/questionbank-schema.sql', name: 'Question Bank Schema' },
      { path: '../database/schema.sql', name: 'Main Schema' },
      { path: '../database/assessment_schema.sql', name: 'Assessment Schema' },
      { path: '../database/practice_segment_schema.sql', name: 'Practice Segment Schema' },
      { path: '../database/submission_schema.sql', name: 'Submission Schema' },
      { path: '../database/user_details.sql', name: 'User Details Schema' }
    ];

    let totalCreated = 0;
    let totalSkipped = 0;

    console.log('📋 Processing schema files...\n');

    for (const schemaFile of schemaFiles) {
      const schemaPath = path.join(__dirname, schemaFile.path);
      console.log(`📄 Processing: ${schemaFile.name}`);
      console.log(`   File: ${schemaFile.path}`);
      
      const result = await executeSQLFile(connection, schemaPath);
      if (result) {
        totalCreated += result.createdCount;
        totalSkipped += result.skippedCount;
      }
      console.log('');
    }

    // Summary
    console.log('='.repeat(60));
    console.log('📊 Summary:');
    console.log('='.repeat(60));
    console.log(`✅ Created: ${totalCreated} table(s)`);
    console.log(`⏭️  Already existed: ${totalSkipped} table(s)`);
    console.log('='.repeat(60));

    console.log('\n✅ Table creation completed!');
    console.log('\n💡 Next steps:');
    console.log('   1. Run: npm run seed-roles (to seed user roles)');
    console.log('   2. Run: node scripts/seedQuestionBankMasterData.js (to seed master data)');
    console.log('   3. If you need to migrate data from dev, ensure DEV_* env vars are set and run: npm run create-and-migrate\n');

  } catch (error) {
    console.error('\n❌ Error creating tables!');
    console.error('Error:', error.message);
    console.error('Code:', error.code);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('✅ Database connection closed');
    }
  }
}

// Run the script
createMissingTables().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

