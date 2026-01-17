const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

async function verifyAdminMigration() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
      ssl: process.env.USE_SSL === 'true' ? { rejectUnauthorized: false } : undefined
    });

    console.log('Connected to database successfully!\n');

    // Check old admin
    const [oldAdmin] = await connection.execute(
      'SELECT id, email, role, college_name FROM users WHERE email = ?',
      ['admin@edtech.com']
    );

    if (oldAdmin.length > 0) {
      console.log('❌ Old admin still exists:');
      console.log(oldAdmin[0]);
    } else {
      console.log('✅ Old admin (admin@edtech.com) has been deleted');
    }

    console.log('\n');

    // Check new admins
    const newAdminEmails = [
      'muhammed.thahir@sarkartech.in',
      'muhammed.salman@sarkartech.in'
    ];

    console.log('Checking new primary admins:');
    for (const email of newAdminEmails) {
      const [rows] = await connection.execute(
        'SELECT id, name, email, role, role_id, college_name FROM users WHERE email = ?',
        [email]
      );

      if (rows.length > 0) {
        const user = rows[0];
        const status = user.role === 'primary_admin' && !user.college_name ? '✅' : '❌';
        console.log(`${status} ${email}:`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Name: ${user.name}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Role ID: ${user.role_id}`);
        console.log(`   College Name: ${user.college_name || 'NULL (correct)'}`);
        
        if (user.role !== 'primary_admin') {
          console.log(`   ⚠️  WARNING: Role should be 'primary_admin' but is '${user.role}'`);
        }
        if (user.college_name) {
          console.log(`   ⚠️  WARNING: College name should be NULL but is '${user.college_name}'`);
        }
      } else {
        console.log(`❌ ${email}: User not found`);
      }
      console.log('');
    }

    // Check for any remaining references to old admin
    console.log('Checking for remaining references to old admin (ID: 1)...');
    
    const tablesToCheck = [
      { name: 'courses', field: 'created_by' },
      { name: 'course_administrations', field: 'created_by' },
      { name: '`groups`', field: 'created_by' },
      { name: 'practice_segments', field: 'created_by' },
      { name: 'question_banks', field: 'created_by' },
      { name: 'mailer_templates', field: 'created_by' }
    ];

    for (const table of tablesToCheck) {
      try {
        const [rows] = await connection.execute(
          `SELECT COUNT(*) as count FROM ${table.name} WHERE ${table.field} = 1`
        );
        if (rows[0].count > 0) {
          console.log(`  ⚠️  ${table.name}: ${rows[0].count} records still reference old admin`);
        }
      } catch (error) {
        if (error.code !== 'ER_NO_SUCH_TABLE' && error.code !== 'ER_BAD_FIELD_ERROR') {
          console.log(`  ⚠️  Error checking ${table.name}: ${error.message}`);
        }
      }
    }

    console.log('\n✅ Verification complete!');

  } catch (error) {
    console.error('❌ Error during verification:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

verifyAdminMigration();

