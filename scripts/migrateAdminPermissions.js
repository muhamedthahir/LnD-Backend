const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const OLD_ADMIN_EMAIL = 'admin@edtech.com';
const NEW_ADMIN_EMAILS = [
  'muhammed.thahir@sarkartech.in',
  'muhammed.salman@sarkartech.in'
];

async function migrateAdminPermissions() {
  let connection;
  
  try {
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
      ssl: process.env.USE_SSL === 'true' ? { rejectUnauthorized: false } : undefined
    });

    console.log('Connected to database successfully!\n');

    // Start transaction
    await connection.beginTransaction();
    console.log('Transaction started.\n');

    // Step 1: Find the old admin user
    console.log('Step 1: Finding old admin user...');
    const [oldAdminRows] = await connection.execute(
      'SELECT id, name, email, role, role_id, college_name FROM users WHERE email = ?',
      [OLD_ADMIN_EMAIL]
    );

    if (oldAdminRows.length === 0) {
      console.log(`⚠️  Old admin user (${OLD_ADMIN_EMAIL}) not found. Nothing to migrate.`);
      await connection.rollback();
      process.exit(0);
    }

    const oldAdmin = oldAdminRows[0];
    console.log(`✅ Found old admin: ID=${oldAdmin.id}, Email=${oldAdmin.email}, Role=${oldAdmin.role}\n`);

    // Step 2: Get primary_admin role_id
    console.log('Step 2: Getting primary_admin role_id...');
    const [roleRows] = await connection.execute(
      'SELECT id FROM user_roles WHERE name = ?',
      ['primary_admin']
    );

    if (roleRows.length === 0) {
      throw new Error('primary_admin role not found in user_roles table. Please run seedUserRoles.js first.');
    }

    const primaryAdminRoleId = roleRows[0].id;
    console.log(`✅ Found primary_admin role_id: ${primaryAdminRoleId}\n`);

    // Step 3: Check/create new admin users
    console.log('Step 3: Checking/creating new admin users...');
    const newAdminIds = [];

    for (const email of NEW_ADMIN_EMAILS) {
      const [existingRows] = await connection.execute(
        'SELECT id, name, email, role, role_id, college_name FROM users WHERE email = ?',
        [email]
      );

      if (existingRows.length > 0) {
        const user = existingRows[0];
        console.log(`  Found existing user: ${email} (ID: ${user.id})`);
        
        // Update to primary_admin and remove college_name
        await connection.execute(
          `UPDATE users 
           SET role = 'primary_admin', 
               role_id = ?, 
               college_name = NULL 
           WHERE id = ?`,
          [primaryAdminRoleId, user.id]
        );
        console.log(`  ✅ Updated ${email} to primary_admin and removed college_name`);
        newAdminIds.push(user.id);
      } else {
        // Create new admin user
        const name = email.split('@')[0].replace(/\./g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const [result] = await connection.execute(
          `INSERT INTO users (name, email, role, role_id, college_name, password_set) 
           VALUES (?, ?, 'primary_admin', ?, NULL, FALSE)`,
          [name, email, primaryAdminRoleId]
        );
        console.log(`  ✅ Created new admin user: ${email} (ID: ${result.insertId})`);
        newAdminIds.push(result.insertId);
      }
    }
    console.log(`\n✅ All new admin users ready. IDs: ${newAdminIds.join(', ')}\n`);

    // Step 4: Migrate references from old admin to first new admin
    const primaryNewAdminId = newAdminIds[0];
    console.log(`Step 4: Migrating references from old admin (ID: ${oldAdmin.id}) to new admin (ID: ${primaryNewAdminId})...\n`);

    // Migrate courses.created_by (important - must be done first to avoid cascade issues)
    try {
      const [coursesResult] = await connection.execute(
        'UPDATE courses SET created_by = ? WHERE created_by = ?',
        [primaryNewAdminId, oldAdmin.id]
      );
      if (coursesResult.affectedRows > 0) {
        console.log(`  ✅ Migrated ${coursesResult.affectedRows} courses`);
      }
    } catch (error) {
      if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_FIELD_ERROR') {
        console.log('  ℹ️  courses table/column not found, skipping...');
      } else {
        throw error;
      }
    }

    // Migrate course_administrations.created_by
    try {
      const [caResult] = await connection.execute(
        'UPDATE course_administrations SET created_by = ? WHERE created_by = ?',
        [primaryNewAdminId, oldAdmin.id]
      );
      if (caResult.affectedRows > 0) {
        console.log(`  ✅ Migrated ${caResult.affectedRows} course_administrations`);
      }
    } catch (error) {
      if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_FIELD_ERROR') {
        console.log('  ℹ️  course_administrations table/column not found, skipping...');
      } else {
        throw error;
      }
    }

    // Migrate groups.created_by
    try {
      const [groupsResult] = await connection.execute(
        'UPDATE `groups` SET created_by = ? WHERE created_by = ?',
        [primaryNewAdminId, oldAdmin.id]
      );
      if (groupsResult.affectedRows > 0) {
        console.log(`  ✅ Migrated ${groupsResult.affectedRows} groups`);
      }
    } catch (error) {
      if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_FIELD_ERROR') {
        console.log('  ℹ️  groups table/column not found, skipping...');
      } else {
        throw error;
      }
    }

    // Migrate practice_segments.created_by
    try {
      const [psResult] = await connection.execute(
        'UPDATE practice_segments SET created_by = ? WHERE created_by = ?',
        [primaryNewAdminId, oldAdmin.id]
      );
      if (psResult.affectedRows > 0) {
        console.log(`  ✅ Migrated ${psResult.affectedRows} practice_segments`);
      }
    } catch (error) {
      if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_FIELD_ERROR') {
        console.log('  ℹ️  practice_segments table/column not found, skipping...');
      } else {
        throw error;
      }
    }

    // Migrate question_banks.created_by
    try {
      const [qbResult] = await connection.execute(
        'UPDATE question_banks SET created_by = ? WHERE created_by = ?',
        [primaryNewAdminId, oldAdmin.id]
      );
      if (qbResult.affectedRows > 0) {
        console.log(`  ✅ Migrated ${qbResult.affectedRows} question_banks`);
      }
    } catch (error) {
      if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_FIELD_ERROR') {
        console.log('  ℹ️  question_banks table/column not found, skipping...');
      } else {
        throw error;
      }
    }

    // Migrate programming_questions.created_by
    try {
      const [pqResult] = await connection.execute(
        'UPDATE programming_questions SET created_by = ? WHERE created_by = ?',
        [primaryNewAdminId, oldAdmin.id]
      );
      if (pqResult.affectedRows > 0) {
        console.log(`  ✅ Migrated ${pqResult.affectedRows} programming_questions`);
      }
    } catch (error) {
      if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_FIELD_ERROR') {
        console.log('  ℹ️  programming_questions table/column not found, skipping...');
      } else {
        throw error;
      }
    }

    // Migrate mailer_templates.created_by
    try {
      const [mtResult] = await connection.execute(
        'UPDATE mailer_templates SET created_by = ? WHERE created_by = ?',
        [primaryNewAdminId, oldAdmin.id]
      );
      if (mtResult.affectedRows > 0) {
        console.log(`  ✅ Migrated ${mtResult.affectedRows} mailer_templates`);
      }
    } catch (error) {
      if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_FIELD_ERROR') {
        console.log('  ℹ️  mailer_templates table/column not found, skipping...');
      } else {
        throw error;
      }
    }

    console.log('\n✅ All references migrated.\n');

    // Step 5: Clean up any other references to old admin (enrollments, group_members, etc.)
    console.log('Step 5: Cleaning up other references to old admin...');
    
    // Remove from enrollments (if old admin was enrolled as a student)
    try {
      const [enrollResult] = await connection.execute(
        'DELETE FROM enrollments WHERE student_id = ?',
        [oldAdmin.id]
      );
      if (enrollResult.affectedRows > 0) {
        console.log(`  ✅ Removed ${enrollResult.affectedRows} enrollments`);
      }
    } catch (error) {
      if (error.code !== 'ER_NO_SUCH_TABLE') {
        console.log(`  ⚠️  Error cleaning enrollments: ${error.message}`);
      }
    }

    // Remove from group_members
    try {
      const [gmResult] = await connection.execute(
        'DELETE FROM group_members WHERE user_id = ?',
        [oldAdmin.id]
      );
      if (gmResult.affectedRows > 0) {
        console.log(`  ✅ Removed ${gmResult.affectedRows} group_members`);
      }
    } catch (error) {
      if (error.code !== 'ER_NO_SUCH_TABLE') {
        console.log(`  ⚠️  Error cleaning group_members: ${error.message}`);
      }
    }

    // Remove from user_courses
    try {
      const [ucResult] = await connection.execute(
        'DELETE FROM user_courses WHERE user_id = ?',
        [oldAdmin.id]
      );
      if (ucResult.affectedRows > 0) {
        console.log(`  ✅ Removed ${ucResult.affectedRows} user_courses`);
      }
    } catch (error) {
      if (error.code !== 'ER_NO_SUCH_TABLE') {
        console.log(`  ⚠️  Error cleaning user_courses: ${error.message}`);
      }
    }

    // Remove from user_details
    try {
      const [udResult] = await connection.execute(
        'DELETE FROM user_details WHERE user_id = ?',
        [oldAdmin.id]
      );
      if (udResult.affectedRows > 0) {
        console.log(`  ✅ Removed ${udResult.affectedRows} user_details`);
      }
    } catch (error) {
      if (error.code !== 'ER_NO_SUCH_TABLE') {
        console.log(`  ⚠️  Error cleaning user_details: ${error.message}`);
      }
    }

    // Remove from submissions (if any)
    try {
      const [subResult] = await connection.execute(
        'DELETE FROM submissions WHERE user_id = ?',
        [oldAdmin.id]
      );
      if (subResult.affectedRows > 0) {
        console.log(`  ✅ Removed ${subResult.affectedRows} submissions`);
      }
    } catch (error) {
      if (error.code !== 'ER_NO_SUCH_TABLE') {
        console.log(`  ⚠️  Error cleaning submissions: ${error.message}`);
      }
    }

    console.log('✅ All other references cleaned up.\n');

    // Step 6: Remove college_name from new admin users (in case it was set)
    console.log('Step 6: Ensuring college_name is NULL for new admin users...');
    for (const adminId of newAdminIds) {
      await connection.execute(
        'UPDATE users SET college_name = NULL WHERE id = ?',
        [adminId]
      );
    }
    console.log('✅ All new admin users have college_name = NULL\n');

    // Step 7: Delete old admin user
    console.log('Step 7: Deleting old admin user...');
    await connection.execute(
      'DELETE FROM users WHERE id = ?',
      [oldAdmin.id]
    );
    console.log(`✅ Deleted old admin user: ${OLD_ADMIN_EMAIL} (ID: ${oldAdmin.id})\n`);

    // Commit transaction
    await connection.commit();
    console.log('✅ Transaction committed successfully!\n');

    // Summary
    console.log('='.repeat(60));
    console.log('MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Old Admin: ${OLD_ADMIN_EMAIL} (DELETED)`);
    console.log(`New Primary Admins:`);
    NEW_ADMIN_EMAILS.forEach((email, index) => {
      console.log(`  ${index + 1}. ${email} (ID: ${newAdminIds[index]})`);
    });
    console.log('\n✅ Migration completed successfully!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Error during migration:', error.message);
    console.error('Error code:', error.code);
    
    if (connection) {
      await connection.rollback();
      console.log('\n⚠️  Transaction rolled back. No changes were made.');
    }
    
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      console.error('\n⚠️  Database Connection Failed!');
      console.error('Please check your database connection settings in .env');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('Database access denied. Please check your DB_USER and DB_PASS credentials.');
    } else {
      console.error('Error details:', error);
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\nDatabase connection closed.');
    }
  }
}

// Run the script
migrateAdminPermissions();

