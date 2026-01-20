const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');

dotenv.config();

/**
 * Script to reset database and create specific users
 * - Clears all data from all tables
 * - Creates one primary admin: muhammed.salman@sarkartech.in
 * - Creates 10 students: muhammed 1-10 with mbu1-10 registration numbers
 * - Creates one college admin: Avanija
 */

async function getConnection() {
  return await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    ssl: process.env.USE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    multipleStatements: true
  });
}

async function getAllTables(connection) {
  const [tables] = await connection.execute(
    `SELECT TABLE_NAME 
     FROM INFORMATION_SCHEMA.TABLES 
     WHERE TABLE_SCHEMA = ? 
     AND TABLE_TYPE = 'BASE TABLE'
     ORDER BY TABLE_NAME`,
    [process.env.DB_NAME]
  );
  return tables.map(row => row.TABLE_NAME);
}

async function clearAllTables(connection) {
  console.log('🗑️  Clearing all tables...\n');
  
  // Disable foreign key checks
  await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
  
  const tables = await getAllTables(connection);
  const tablesToSkip = []; // Tables to skip (if any)
  
  let clearedCount = 0;
  
  // Sort tables to handle foreign key dependencies
  // Delete in reverse order to avoid FK issues
  for (let i = tables.length - 1; i >= 0; i--) {
    const tableName = tables[i];
    
    if (tablesToSkip.includes(tableName.toLowerCase())) {
      console.log(`   ⏭️  Skipping: ${tableName}`);
      continue;
    }
    
    try {
      await connection.execute(`TRUNCATE TABLE \`${tableName}\``);
      console.log(`   ✅ Cleared: ${tableName}`);
      clearedCount++;
    } catch (error) {
      // If TRUNCATE fails, try DELETE
      if (error.code === 'ER_TRUNCATE_ILLEGAL_FK' || error.code === 'ER_CANNOT_TRUNCATE') {
        try {
          await connection.execute(`DELETE FROM \`${tableName}\``);
          console.log(`   ✅ Cleared: ${tableName} (using DELETE)`);
          clearedCount++;
        } catch (deleteError) {
          console.error(`   ❌ Error clearing ${tableName}: ${deleteError.message}`);
        }
      } else {
        console.error(`   ❌ Error clearing ${tableName}: ${error.message}`);
      }
    }
  }
  
  // Re-enable foreign key checks
  await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
  
  console.log(`\n✅ Cleared ${clearedCount} table(s)\n`);
  return clearedCount;
}

async function seedUserRoles(connection) {
  console.log('📋 Seeding user roles...');
  
  const roles = [
    { name: 'primary_admin', description: 'Primary Administrator', role_rank: 1 },
    { name: 'college_admin', description: 'College Administrator', role_rank: 2 },
    { name: 'student', description: 'Student', role_rank: 3 }
  ];
  
  for (const role of roles) {
    try {
      await connection.execute(
        `INSERT INTO user_roles (name, description, role_rank) 
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE description = VALUES(description), role_rank = VALUES(role_rank)`,
        [role.name, role.description, role.role_rank]
      );
    } catch (error) {
      // Ignore duplicate key errors
      if (error.code !== 'ER_DUP_ENTRY') {
        console.error(`   ⚠️  Error seeding role ${role.name}: ${error.message}`);
      }
    }
  }
  
  console.log('✅ User roles seeded\n');
}

async function createUsers(connection) {
  console.log('👥 Creating users...\n');
  
  const hashedPassword = await bcrypt.hash('Mbu@1234', 10);
  const primaryAdminPassword = await bcrypt.hash('786M@dfacesago786', 10);
  
  // 1. Primary Admin
  console.log('   1. Creating primary admin: muhammed.salman@sarkartech.in');
  try {
    await connection.execute(
      `INSERT INTO users (name, email, password, role, password_set) 
       VALUES (?, ?, ?, 'primary_admin', TRUE)`,
      ['Muhammed Salman', 'muhammed.salman@sarkartech.in', primaryAdminPassword]
    );
    console.log('   ✅ Primary admin created\n');
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      console.log('   ⚠️  Primary admin already exists, updating password...');
      await connection.execute(
        `UPDATE users SET password = ?, password_set = TRUE WHERE email = ?`,
        [primaryAdminPassword, 'muhammed.salman@sarkartech.in']
      );
      console.log('   ✅ Primary admin password updated\n');
    } else {
      throw error;
    }
  }
  
  // 2. College Admin
  console.log('   2. Creating college admin: avanija@mbu.asia');
  try {
    await connection.execute(
      `INSERT INTO users (name, email, password, role, password_set) 
       VALUES (?, ?, ?, 'college_admin', TRUE)`,
      ['Avanija', 'avanija@mbu.asia', hashedPassword]
    );
    console.log('   ✅ College admin created\n');
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      console.log('   ⚠️  College admin already exists, updating password...');
      await connection.execute(
        `UPDATE users SET password = ?, password_set = TRUE WHERE email = ?`,
        [hashedPassword, 'avanija@mbu.asia']
      );
      console.log('   ✅ College admin password updated\n');
    } else {
      throw error;
    }
  }
  
  // 3. Students (muhammed 1 to muhammed 10)
  console.log('   3. Creating students (muhammed 1 to muhammed 10)...');
  let studentCount = 0;
  
  for (let i = 1; i <= 10; i++) {
    const name = `muhammed ${i}`;
    const email = `mbu${i}@mbu.asia`;
    const regNumber = `mbu${i}`;
    
    try {
      await connection.execute(
        `INSERT INTO users (name, email, password, role, password_set, college_name) 
         VALUES (?, ?, ?, 'student', TRUE, ?)`,
        [name, email, hashedPassword, 'MBU']
      );
      
      // Get the user ID to update user_details if the table exists
      const [users] = await connection.execute(
        'SELECT id FROM users WHERE email = ?',
        [email]
      );
      
      if (users.length > 0) {
        const userId = users[0].id;
        
        // Check if user_details table exists and has registration_number column
        try {
          const [columns] = await connection.execute(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'user_details' AND COLUMN_NAME = 'registration_number'`,
            [process.env.DB_NAME]
          );
          
          if (columns.length > 0) {
            // Update or insert user_details
            await connection.execute(
              `INSERT INTO user_details (user_id, registration_number) 
               VALUES (?, ?)
               ON DUPLICATE KEY UPDATE registration_number = VALUES(registration_number)`,
              [userId, regNumber]
            );
          }
        } catch (detailsError) {
          // user_details table might not exist or have different structure, skip
        }
      }
      
      studentCount++;
      console.log(`   ✅ Created: ${name} (${email}) - ${regNumber}`);
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        console.log(`   ⚠️  Student ${name} already exists, updating...`);
        await connection.execute(
          `UPDATE users SET password = ?, password_set = TRUE, college_name = ? WHERE email = ?`,
          [hashedPassword, 'MBU', email]
        );
        studentCount++;
      } else {
        console.error(`   ❌ Error creating student ${name}: ${error.message}`);
      }
    }
  }
  
  console.log(`\n✅ Created ${studentCount} student(s)\n`);
}

async function seedMasterData(connection) {
  console.log('📋 Seeding master data...\n');
  
  // Seed Levels
  console.log('   Seeding levels...');
  const levels = [
    { name: 'Easy', description: 'Beginner level questions', rank: 1 },
    { name: 'Medium', description: 'Intermediate level questions', rank: 2 },
    { name: 'Hard', description: 'Advanced level questions', rank: 3 }
  ];
  
  for (const level of levels) {
    try {
      await connection.execute(
        `INSERT INTO levels (name, description, \`rank\`) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE description = VALUES(description), \`rank\` = VALUES(\`rank\`)`,
        [level.name, level.description, level.rank]
      );
    } catch (error) {
      // Ignore errors
    }
  }
  console.log('   ✅ Levels seeded');
  
  // Seed Statuses
  console.log('   Seeding statuses...');
  const statuses = [
    { name: 'DRAFT', description: 'Question is in draft state and not published' },
    { name: 'REVIEW', description: 'Question is under review' },
    { name: 'PUBLISHED', description: 'Question is published and available for use' }
  ];
  
  for (const status of statuses) {
    try {
      await connection.execute(
        `INSERT INTO statuses (name, description) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE description = VALUES(description)`,
        [status.name, status.description]
      );
    } catch (error) {
      // Ignore errors
    }
  }
  console.log('   ✅ Statuses seeded');
  
  // Seed Question Types
  console.log('   Seeding question types...');
  const questionTypes = [
    { name: 'MCQ', description: 'Multiple Choice Question with single correct answer' },
    { name: 'Multi Select', description: 'Multiple Choice Question with multiple correct answers' },
    { name: 'Programming', description: 'Programming/Coding question with test cases' }
  ];
  
  for (const qType of questionTypes) {
    try {
      await connection.execute(
        `INSERT INTO question_types (name, description) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE description = VALUES(description)`,
        [qType.name, qType.description]
      );
    } catch (error) {
      // Ignore errors
    }
  }
  console.log('   ✅ Question types seeded');
  
  // Seed Languages
  console.log('   Seeding languages...');
  const languages = [
    { name: 'Python', description: 'Python programming language', version: '3.11' },
    { name: 'Java', description: 'Java programming language', version: '17' },
    { name: 'JavaScript', description: 'JavaScript programming language', version: 'ES2022' },
    { name: 'C', description: 'C programming language', version: 'C17' },
    { name: 'C++', description: 'C++ programming language', version: 'C++20' },
    { name: 'C#', description: 'C# programming language', version: '11' },
    { name: 'Go', description: 'Go programming language', version: '1.21' },
    { name: 'Ruby', description: 'Ruby programming language', version: '3.2' },
    { name: 'PHP', description: 'PHP programming language', version: '8.2' },
    { name: 'TypeScript', description: 'TypeScript programming language', version: '5.0' }
  ];
  
  for (const lang of languages) {
    try {
      await connection.execute(
        `INSERT INTO languages (name, description, current_version, is_active) VALUES (?, ?, ?, TRUE)
         ON DUPLICATE KEY UPDATE description = VALUES(description), current_version = VALUES(current_version)`,
        [lang.name, lang.description, lang.version]
      );
    } catch (error) {
      // Ignore errors
    }
  }
  console.log('   ✅ Languages seeded\n');
}

async function resetDatabase() {
  console.log('🚀 Starting database reset and user setup...\n');
  
  if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASS || !process.env.DB_NAME) {
    console.error('❌ Missing required database environment variables!');
    process.exit(1);
  }
  
  let connection = null;
  
  try {
    connection = await getConnection();
    console.log(`✅ Connected to database: ${process.env.DB_NAME}\n`);
    
    // Step 1: Clear all tables
    await clearAllTables(connection);
    
    // Step 2: Seed user roles
    await seedUserRoles(connection);
    
    // Step 3: Seed master data
    await seedMasterData(connection);
    
    // Step 4: Create users
    await createUsers(connection);
    
    // Summary
    console.log('='.repeat(60));
    console.log('📊 Summary:');
    console.log('='.repeat(60));
    console.log('✅ Database cleared');
    console.log('✅ User roles seeded');
    console.log('✅ Master data seeded');
    console.log('✅ Users created:');
    console.log('   - 1 Primary Admin: muhammed.salman@sarkartech.in');
    console.log('   - 1 College Admin: avanija@mbu.asia');
    console.log('   - 10 Students: mbu1@mbu.asia to mbu10@mbu.asia');
    console.log('='.repeat(60));
    console.log('\n🎉 Database reset completed successfully!\n');
    console.log('📝 User Credentials:');
    console.log('   Primary Admin:');
    console.log('     Email: muhammed.salman@sarkartech.in');
    console.log('     Password: 786M@dfacesago786');
    console.log('\n   College Admin:');
    console.log('     Email: avanija@mbu.asia');
    console.log('     Password: Mbu@1234');
    console.log('\n   Students (all have same password):');
    console.log('     Emails: mbu1@mbu.asia to mbu10@mbu.asia');
    console.log('     Registration: mbu1 to mbu10');
    console.log('     Password: Mbu@1234\n');
    
  } catch (error) {
    console.error('\n❌ Error resetting database:', error.message);
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
resetDatabase().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

