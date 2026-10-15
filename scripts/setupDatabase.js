const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

async function setupDatabase() {
  let connection;
  
  try {
    console.log('🚀 Starting database setup...\n');
    
    // First, connect without database to create it if needed
    let tempConnection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
      ssl: process.env.USE_SSL === 'true' ? { rejectUnauthorized: false } : undefined
    });

    console.log('✅ Connected to MySQL server successfully!\n');

    // Check if database exists, create if not
    console.log(`📋 Checking if database '${process.env.DB_NAME}' exists...`);
    const [databases] = await tempConnection.execute(
      `SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?`,
      [process.env.DB_NAME]
    );

    if (databases.length === 0) {
      console.log(`📋 Creating database '${process.env.DB_NAME}'...`);
      await tempConnection.execute(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``);
      console.log(`✅ Database '${process.env.DB_NAME}' created successfully!\n`);
    } else {
      console.log(`✅ Database '${process.env.DB_NAME}' already exists.\n`);
    }

    await tempConnection.end();

    // Now connect to the specific database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
      multipleStatements: true,
      ssl: process.env.USE_SSL === 'true' ? { rejectUnauthorized: false } : undefined
    });

    console.log(`✅ Connected to database '${process.env.DB_NAME}' successfully!\n`);

    // Step 1: Create all base tables from schema.sql
    console.log('📋 Step 1: Creating base tables from schema.sql...');
    try {
      const schemaPath = path.join(__dirname, '../database/schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      
      // Remove comments and split by semicolons
      const lines = schema.split('\n');
      let currentStatement = '';
      const statements = [];
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine === '' || trimmedLine.startsWith('--')) {
          continue;
        }
        
        currentStatement += ' ' + trimmedLine;
        
        if (trimmedLine.endsWith(';')) {
          const statement = currentStatement.trim();
          if (statement.length > 0) {
            statements.push(statement);
          }
          currentStatement = '';
        }
      }
      
      for (const statement of statements) {
        try {
          await connection.execute(statement);
          const tableMatch = statement.match(/CREATE TABLE (?:IF NOT EXISTS )?`?(\w+)`?/i);
          if (tableMatch) {
            console.log(`  ✓ Table: ${tableMatch[1]}`);
          }
        } catch (error) {
          if (error.code !== 'ER_TABLE_EXISTS_ERROR' && error.code !== 'ER_DUP_TABLE' && error.code !== 'ER_DUP_KEYNAME') {
            console.log(`  ⚠ ${error.message}`);
          }
        }
      }
      console.log('  ✅ Base tables created/verified\n');
    } catch (error) {
      console.error('  ❌ Error creating tables:', error.message);
      throw error;
    }

    // Step 2: Add course fields migration
    console.log('📋 Step 2: Adding course fields (category, competency_level, etc.)...');
    try {
      const columns = [
        { name: 'category', type: 'VARCHAR(255) NULL', after: 'description' },
        { name: 'competency_level', type: 'VARCHAR(50) NULL', after: 'category' },
        { name: 'short_description', type: 'TEXT NULL', after: 'competency_level' },
        { name: 'course_outcomes', type: 'TEXT NULL', after: 'short_description' },
        { name: 'status', type: "VARCHAR(20) DEFAULT 'draft'", after: 'course_outcomes' },
        { name: 'thumbnail', type: 'VARCHAR(500) NULL', after: 'status' },
        { name: 'tags', type: 'JSON NULL', after: 'thumbnail' }
      ];

      for (const column of columns) {
        try {
          const [rows] = await connection.execute(
            `SELECT COUNT(*) as count 
             FROM INFORMATION_SCHEMA.COLUMNS 
             WHERE TABLE_SCHEMA = ? 
             AND TABLE_NAME = 'courses' 
             AND COLUMN_NAME = ?`,
            [process.env.DB_NAME, column.name]
          );

          if (rows[0].count === 0) {
            await connection.execute(
              `ALTER TABLE courses ADD COLUMN ${column.name} ${column.type} AFTER ${column.after}`
            );
            console.log(`  ✓ Added column: ${column.name}`);
          } else {
            console.log(`  - Column ${column.name} already exists`);
          }
        } catch (error) {
          if (error.code !== 'ER_DUP_FIELDNAME') {
            console.log(`  ⚠ ${column.name}: ${error.message}`);
          }
        }
      }

      // Update existing courses to have default status
      try {
        await connection.execute("UPDATE courses SET status = 'draft' WHERE status IS NULL");
      } catch (error) {
        // Ignore if no courses exist
      }
      console.log('  ✅ Course fields migration completed\n');
    } catch (error) {
      console.error('  ❌ Error in course migration:', error.message);
      throw error;
    }

    // Step 3: Update segment types ENUM
    console.log('📋 Step 3: Updating segment_type ENUM...');
    try {
      const [columns] = await connection.execute(
        `SELECT COLUMN_TYPE 
         FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = ? 
         AND TABLE_NAME = 'segments' 
         AND COLUMN_NAME = 'segment_type'`,
        [process.env.DB_NAME]
      );

      if (columns.length > 0) {
        await connection.execute(
          `ALTER TABLE segments 
           MODIFY COLUMN segment_type ENUM(
             'coding', 
             'mcq', 
             'reference_videos', 
             'articles', 
             'assessment',
             'lesson_text',
             'lesson_video',
             'lesson_audio',
             'lesson_document'
           ) NOT NULL`
        );
        console.log('  ✓ Updated segment_type ENUM');
      } else {
        console.log('  - segment_type column not found (may not exist yet)');
      }
      console.log('  ✅ Segment types updated\n');
    } catch (error) {
      console.log(`  ⚠ Segment types update: ${error.message}`);
    }

    // Step 4: Create primary admin user
    console.log('📋 Step 4: Creating primary admin user...');
    try {
      const adminName = process.env.ADMIN_NAME || 'Primary Admin';
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@edtech.com';
      const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';

      // Check if admin already exists
      const [existing] = await connection.execute(
        'SELECT id, email FROM users WHERE email = ? OR role = ?',
        [adminEmail, 'primary_admin']
      );

      if (existing.length > 0) {
        console.log('  ⚠ Primary admin already exists!');
        console.log(`  Email: ${existing[0].email}`);
        console.log('  Skipping admin creation...\n');
      } else {
        // Hash password
        const hashedPassword = await bcrypt.hash(adminPassword, 10);

        // Insert primary admin
        const [result] = await connection.execute(
          `INSERT INTO users (name, email, password, role, password_set) 
           VALUES (?, ?, ?, 'primary_admin', TRUE)`,
          [adminName, adminEmail, hashedPassword]
        );

        console.log('  ✅ Primary admin created successfully!');
        console.log('\n  📝 Admin Credentials:');
        console.log(`     ID: ${result.insertId}`);
        console.log(`     Name: ${adminName}`);
        console.log(`     Email: ${adminEmail}`);
        console.log(`     Password: ${adminPassword}`);
        console.log(`     Role: primary_admin`);
        console.log('\n  ⚠️  IMPORTANT: Save these credentials securely!');
      }
      console.log('  ✅ Admin setup completed\n');
    } catch (error) {
      console.error('  ❌ Error creating admin:', error.message);
      if (error.code === 'ER_DUP_ENTRY') {
        console.log('  A user with this email already exists.');
      }
    }

    console.log('🎉 Database setup completed successfully!');
    console.log('\nYou can now start your application.\n');

  } catch (error) {
    console.error('\n❌ Database setup failed:', error.message);
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      console.error('\n⚠️  Database Connection Failed!');
      console.error('Please check your .env file configuration:');
      console.error('  - DB_HOST');
      console.error('  - DB_USER');
      console.error('  - DB_PASS');
      console.error('  - DB_NAME');
      console.error('  - DB_PORT (optional, defaults to 3306)');
      console.error('\nAlso ensure:');
      console.error('  - RDS security group allows connections from your IP');
      console.error('  - Database is running and accessible');
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed.');
    }
  }
}

// Run the setup
setupDatabase();

