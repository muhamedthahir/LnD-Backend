const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');

dotenv.config();

/**
 * Script to reset a user's password in the local database
 * 
 * Usage: node scripts/resetUserPassword.js
 * 
 * Environment Variables:
 * - DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_PORT, USE_SSL
 */

async function resetUserPassword() {
  let connection;
  
  try {
    // Get email and password from command line arguments or environment
    const email = process.argv[2] || process.env.USER_EMAIL || 'muhammed.salman@sarkartech.in';
    const newPassword = process.argv[3] || process.env.USER_PASSWORD || '786M@dfacesago786';
    const createIfNotExists = process.argv[4] === '--create' || process.env.CREATE_USER === 'true';

    console.log('🔐 User Password Reset Script\n');
    console.log(`Email: ${email}`);
    console.log(`Password: ${'*'.repeat(newPassword.length)}`);
    console.log(`Create if not exists: ${createIfNotExists}\n`);

    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
      ssl: process.env.USE_SSL === 'true' ? { rejectUnauthorized: false } : undefined
    });

    console.log('✅ Connected to database successfully!\n');

    // Check if user exists
    console.log(`📋 Looking for user with email: ${email}...`);
    const [users] = await connection.execute(
      'SELECT id, name, email, role FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      console.error(`❌ User with email ${email} not found!`);
      console.error('\n📋 Searching for similar users...');
      
      // Try to find user with similar email
      const emailParts = email.split('@');
      const searchPattern = `%${emailParts[0].split('.')[0]}%`;
      const [similarUsers] = await connection.execute(
        'SELECT id, name, email, role FROM users WHERE email LIKE ? OR name LIKE ? LIMIT 10',
        [searchPattern, searchPattern]
      );
      
      if (similarUsers.length > 0) {
        console.log('   Similar users found:');
        similarUsers.forEach(user => {
          console.log(`   - ${user.email} (${user.name}, ${user.role})`);
        });
      } else {
        console.log('   No similar users found.');
      }
      
      // If create flag is set, create the user
      if (createIfNotExists) {
        console.log('\n📝 Creating new user...');
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Get name from email or use default
        const name = email.split('@')[0].replace(/\./g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        const [result] = await connection.execute(
          `INSERT INTO users (name, email, password, role, password_set) 
           VALUES (?, ?, ?, 'student', TRUE)`,
          [name, email, hashedPassword]
        );
        
        console.log(`✅ User created successfully with ID: ${result.insertId}`);
        console.log(`✅ Password set: ${'*'.repeat(newPassword.length)}`);
        console.log('\n✅ You can now login with these credentials!');
        process.exit(0);
      } else {
        console.log('\n💡 Tip: To create a new user with this email, run:');
        console.log(`   npm run reset-password ${email} "${newPassword}" --create`);
        console.error('\n❌ Cannot proceed without user. Please check the email address.');
        process.exit(1);
      }
    }

    const user = users[0];
    console.log(`✅ Found user:`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}\n`);

    // Hash the new password
    console.log('🔐 Hashing password...');
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    console.log('✅ Password hashed successfully\n');

    // Update password in database
    console.log('📝 Updating password in database...');
    await connection.execute(
      'UPDATE users SET password = ?, password_set = TRUE, otp = NULL, otp_expires_at = NULL WHERE id = ?',
      [hashedPassword, user.id]
    );
    console.log('✅ Password updated successfully!\n');

    // Verify the password works by comparing
    console.log('🔍 Verifying password hash...');
    const [verifyUser] = await connection.execute(
      'SELECT password FROM users WHERE id = ?',
      [user.id]
    );

    const isValid = await bcrypt.compare(newPassword, verifyUser[0].password);
    if (isValid) {
      console.log('✅ Password verification successful!\n');
    } else {
      console.error('⚠️  Warning: Password verification failed. There may be an issue with the hash.\n');
    }

    console.log('='.repeat(60));
    console.log('📊 Summary:');
    console.log('='.repeat(60));
    console.log(`✅ User: ${user.name} (${user.email})`);
    console.log(`✅ Password reset completed successfully!`);
    console.log(`✅ You can now login with the new password.`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Error resetting password:', error.message);
    console.error('Code:', error.code);
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n⚠️  Access denied. Check:');
      console.error('  - DB_USER and DB_PASS are correct');
      console.error('  - User has proper permissions');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('\n⚠️  Database does not exist:');
      console.error('  - Check DB_NAME is correct');
    } else if (error.code === 'ENOTFOUND') {
      console.error('\n⚠️  Host not found:');
      console.error('  - Check DB_HOST is correct');
    }
    
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✅ Database connection closed');
    }
  }
}

// Run the script
resetUserPassword().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

