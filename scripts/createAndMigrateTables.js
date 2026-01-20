const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

/**
 * Script to create all necessary tables and migrate data from DEV to LOCAL
 * 
 * Environment Variables Required:
 * 
 * For DEV (Source) Database:
 *   DEV_DB_HOST, DEV_DB_USER, DEV_DB_PASS, DEV_DB_NAME, DEV_DB_PORT, DEV_USE_SSL
 * 
 * For LOCAL (Destination) Database:
 *   DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_PORT, USE_SSL
 */

async function getConnectionConfig(prefix = '') {
  const dbHost = process.env[`${prefix}DB_HOST`];
  const dbUser = process.env[`${prefix}DB_USER`];
  const dbPass = process.env[`${prefix}DB_PASS`];
  const dbName = process.env[`${prefix}DB_NAME`];
  const dbPort = process.env[`${prefix}DB_PORT`] ? Number(process.env[`${prefix}DB_PORT`]) : 3306;
  const useSSL = process.env[`${prefix}USE_SSL`] === 'true';

  return {
    host: dbHost,
    user: dbUser,
    password: dbPass,
    database: dbName,
    port: dbPort,
    ssl: useSSL ? { rejectUnauthorized: false } : undefined,
    multipleStatements: true
  };
}

async function getAllTables(connection) {
  const [tables] = await connection.execute(
    `SELECT TABLE_NAME 
     FROM INFORMATION_SCHEMA.TABLES 
     WHERE TABLE_SCHEMA = ? 
     AND TABLE_TYPE = 'BASE TABLE'
     ORDER BY TABLE_NAME`,
    [connection.config.database]
  );
  return tables.map(row => row.TABLE_NAME);
}

async function getTableSchema(connection, tableName) {
  const [result] = await connection.execute(`SHOW CREATE TABLE \`${tableName}\``);
  return result[0]['Create Table'];
}

async function getTableData(connection, tableName) {
  const [rows] = await connection.execute(`SELECT * FROM \`${tableName}\``);
  return rows;
}

async function insertTableData(destConnection, tableName, data) {
  if (data.length === 0) {
    return;
  }

  const columns = Object.keys(data[0]);
  const columnNames = columns.map(col => `\`${col}\``).join(', ');
  
  // Insert in batches of 1000 rows
  const batchSize = 1000;
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const batchValues = batch.map(row => {
      const rowValues = columns.map(col => {
        const value = row[col];
        if (value === null || value === undefined) {
          return 'NULL';
        } else if (typeof value === 'string') {
          const escaped = value.replace(/'/g, "''").replace(/\\/g, '\\\\');
          return `'${escaped}'`;
        } else if (value instanceof Date) {
          return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`;
        } else if (Buffer.isBuffer(value)) {
          return `0x${value.toString('hex')}`;
        } else {
          return String(value);
        }
      });
      return `(${rowValues.join(', ')})`;
    }).join(', ');

    const query = `INSERT INTO \`${tableName}\` (${columnNames}) VALUES ${batchValues}`;
    await destConnection.execute(query);
  }
}

async function executeSQLFile(connection, filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  
  // Split by semicolon but handle comments and multi-line statements
  const statements = sql
    .split(/;(?=\s*(?:--|CREATE|INSERT|UPDATE|DELETE|ALTER|DROP|$))/i)
    .map(s => s.trim())
    .filter(s => {
      const cleaned = s.split('\n').filter(line => !line.trim().startsWith('--')).join('\n').trim();
      return cleaned.length > 0;
    });

  for (const statement of statements) {
    const cleanStatement = statement
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n')
      .trim();
    
    if (cleanStatement) {
      try {
        await connection.execute(cleanStatement);
      } catch (err) {
        // Ignore "table already exists" errors
        if (err.code !== 'ER_TABLE_EXISTS_ERROR' && err.code !== 'ER_DUP_ENTRY') {
          console.warn(`Warning executing SQL: ${err.message}`);
        }
      }
    }
  }
}

async function createAndMigrateTables() {
  console.log('🚀 Starting table creation and data migration from DEV to LOCAL...\n');

  // Validate environment variables
  if (!process.env.DEV_DB_HOST || !process.env.DEV_DB_USER || !process.env.DEV_DB_PASS || !process.env.DEV_DB_NAME) {
    console.error('❌ Missing required DEV database environment variables!');
    process.exit(1);
  }

  if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASS || !process.env.DB_NAME) {
    console.error('❌ Missing required LOCAL database environment variables!');
    process.exit(1);
  }

  let devConnection = null;
  let localConnection = null;

  try {
    // Connect to DEV database
    console.log('🔌 Connecting to DEV database...');
    const devConfig = await getConnectionConfig('DEV_');
    devConnection = await mysql.createConnection(devConfig);
    console.log(`✅ Connected to DEV database: ${process.env.DEV_DB_NAME}\n`);

    // Connect to LOCAL database
    console.log('🔌 Connecting to LOCAL database...');
    const localConfig = await getConnectionConfig('');
    
    // Ensure local database exists
    let tempConnection = await mysql.createConnection({
      ...localConfig,
      database: undefined
    });
    
    const [databases] = await tempConnection.execute(
      `SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?`,
      [process.env.DB_NAME]
    );

    if (databases.length === 0) {
      console.log(`📋 Creating LOCAL database: ${process.env.DB_NAME}...`);
      await tempConnection.execute(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``);
      console.log(`✅ Database created!\n`);
    }
    await tempConnection.end();

    localConnection = await mysql.createConnection(localConfig);
    console.log(`✅ Connected to LOCAL database: ${process.env.DB_NAME}\n`);

    // Step 1: Create tables from schema files
    console.log('📋 Step 1: Creating tables from schema files...\n');
    
    const schemaFiles = [
      '../database/questionbank-schema.sql',
      '../database/schema.sql',
      '../database/assessment_schema.sql',
      '../database/practice_segment_schema.sql',
      '../database/submission_schema.sql',
      '../database/user_details.sql'
    ];

    for (const schemaFile of schemaFiles) {
      const schemaPath = path.join(__dirname, schemaFile);
      if (fs.existsSync(schemaPath)) {
        console.log(`   Processing: ${schemaFile}`);
        try {
          await executeSQLFile(localConnection, schemaPath);
          console.log(`   ✅ Completed: ${schemaFile}\n`);
        } catch (error) {
          console.error(`   ⚠️  Error processing ${schemaFile}: ${error.message}\n`);
        }
      }
    }

    // Step 2: Get all tables from DEV
    console.log('📋 Step 2: Fetching table list from DEV database...');
    const devTables = await getAllTables(devConnection);
    console.log(`✅ Found ${devTables.length} table(s) in DEV database\n`);

    // Step 3: Migrate data from DEV to LOCAL
    console.log('📋 Step 3: Migrating data from DEV to LOCAL...\n');
    
    // Disable foreign key checks
    await localConnection.execute('SET FOREIGN_KEY_CHECKS = 0');

    let successCount = 0;
    let errorCount = 0;
    const skippedTables = ['refresh_tokens']; // Skip tables that might cause issues

    for (let i = 0; i < devTables.length; i++) {
      const tableName = devTables[i];
      
      if (skippedTables.includes(tableName.toLowerCase())) {
        console.log(`[${i + 1}/${devTables.length}] ⏭️  Skipping table: ${tableName}`);
        continue;
      }

      try {
        console.log(`[${i + 1}/${devTables.length}] Processing table: ${tableName}`);

        // Check if table exists in LOCAL, if not, create it from DEV schema
        const [localTables] = await localConnection.execute(
          `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
          [process.env.DB_NAME, tableName]
        );

        if (localTables.length === 0) {
          console.log(`   📋 Creating table structure...`);
          const createTableSQL = await getTableSchema(devConnection, tableName);
          await localConnection.execute(createTableSQL);
          console.log(`   ✅ Table structure created`);
        }

        // Get data from DEV
        console.log(`   📥 Fetching data from DEV...`);
        const data = await getTableData(devConnection, tableName);
        console.log(`   ✅ Fetched ${data.length} row(s)`);

        // Clear existing data in LOCAL (if any)
        if (data.length > 0) {
          try {
            await localConnection.execute(`TRUNCATE TABLE \`${tableName}\``);
          } catch (err) {
            // If TRUNCATE fails, try DELETE
            if (err.code === 'ER_TRUNCATE_ILLEGAL_FK') {
              await localConnection.execute(`DELETE FROM \`${tableName}\``);
            }
          }
        }

        // Insert data into LOCAL
        if (data.length > 0) {
          console.log(`   📤 Inserting data into LOCAL...`);
          await insertTableData(localConnection, tableName, data);
          console.log(`   ✅ Inserted ${data.length} row(s)`);
        } else {
          console.log(`   ℹ️  No data to insert`);
        }

        successCount++;
        console.log(`   ✅ Table ${tableName} migrated successfully!\n`);

      } catch (error) {
        errorCount++;
        console.error(`   ❌ Error migrating table ${tableName}:`, error.message);
        console.error(`   Code: ${error.code}\n`);
        continue;
      }
    }

    // Enable foreign key checks
    await localConnection.execute('SET FOREIGN_KEY_CHECKS = 1');

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log('='.repeat(60));
    console.log(`✅ Successfully migrated: ${successCount} table(s)`);
    if (errorCount > 0) {
      console.log(`❌ Failed: ${errorCount} table(s)`);
    }
    console.log(`📋 Total processed: ${devTables.length} table(s)`);
    console.log('='.repeat(60));

    if (successCount === devTables.length - skippedTables.length) {
      console.log('\n🎉 Table creation and data migration completed successfully!');
    } else {
      console.log('\n⚠️  Migration completed with some errors. Please review the output above.');
    }

  } catch (error) {
    console.error('\n❌ Migration failed!');
    console.error('Error:', error.message);
    console.error('Code:', error.code);
    process.exit(1);
  } finally {
    if (devConnection) {
      await devConnection.end();
      console.log('\n✅ DEV database connection closed');
    }
    if (localConnection) {
      await localConnection.end();
      console.log('✅ LOCAL database connection closed');
    }
  }
}

// Run the migration
createAndMigrateTables().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

