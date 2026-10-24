const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

async function testConnection() {
  console.log('🔍 Testing database connection...\n');
  
  // Display configuration (without password)
  console.log('Configuration:');
  console.log('  DB_HOST:', process.env.DB_HOST || 'NOT SET');
  console.log('  DB_USER:', process.env.DB_USER || 'NOT SET');
  console.log('  DB_PASS:', process.env.DB_PASS ? '***SET***' : 'NOT SET');
  console.log('  DB_NAME:', process.env.DB_NAME || 'NOT SET');
  console.log('  DB_PORT:', process.env.DB_PORT || '3306 (default)');
  console.log('  USE_SSL:', process.env.USE_SSL || 'false (default)');
  console.log('');

  if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASS || !process.env.DB_NAME) {
    console.error('❌ Missing required environment variables!');
    console.error('Please set the following in your .env file:');
    console.error('  - DB_HOST');
    console.error('  - DB_USER');
    console.error('  - DB_PASS');
    console.error('  - DB_NAME');
    process.exit(1);
  }

  let connection;
  
  try {
    console.log('Attempting to connect...');
    
    const connectionConfig = {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
      connectTimeout: 10000, // 10 seconds
      ssl: process.env.USE_SSL === 'true' ? { 
        rejectUnauthorized: false 
      } : undefined
    };

    connection = await mysql.createConnection(connectionConfig);
    
    console.log('✅ Connection successful!\n');
    
    // Test a simple query
    console.log('Testing query...');
    const [rows] = await connection.execute('SELECT 1 as test');
    console.log('✅ Query test successful:', rows[0]);
    
    // Check if database has tables
    console.log('\nChecking database tables...');
    const [tables] = await connection.execute(
      `SELECT TABLE_NAME 
       FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = ?`,
      [process.env.DB_NAME]
    );
    
    if (tables.length > 0) {
      console.log(`✅ Found ${tables.length} table(s):`);
      tables.forEach(table => {
        console.log(`   - ${table.TABLE_NAME}`);
      });
    } else {
      console.log('⚠️  No tables found. Database is empty.');
      console.log('   Run setupDatabase.js to create tables.');
    }
    
    // Check if users table exists and has primary_admin
    if (tables.some(t => t.TABLE_NAME === 'users')) {
      console.log('\nChecking for existing primary admin...');
      const [users] = await connection.execute(
        "SELECT id, name, email, role FROM users WHERE role = 'primary_admin'"
      );
      
      if (users.length > 0) {
        console.log('⚠️  Primary admin already exists:');
        users.forEach(user => {
          console.log(`   ID: ${user.id}, Name: ${user.name}, Email: ${user.email}`);
        });
      } else {
        console.log('✅ No primary admin found. Ready to create one.');
      }
    }
    
    console.log('\n✅ Connection test completed successfully!');
    console.log('You can now run: node scripts/setupDatabase.js');
    
  } catch (error) {
    console.error('\n❌ Connection failed!\n');
    console.error('Error:', error.message);
    console.error('Code:', error.code);
    
    if (error.code === 'ETIMEDOUT') {
      console.error('\n⚠️  Connection timeout. Possible issues:');
      console.error('  1. RDS security group does not allow connections from your IP');
      console.error('  2. Database endpoint is incorrect');
      console.error('  3. Database is not running');
      console.error('  4. Network/firewall blocking the connection');
      console.error('\nSolutions:');
      console.error('  - Check AWS RDS Security Group inbound rules');
      console.error('  - Add your IP address to allowed sources');
      console.error('  - Verify DB_HOST is the correct RDS endpoint');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n⚠️  Access denied. Check:');
      console.error('  - DB_USER and DB_PASS are correct');
      console.error('  - User has proper permissions');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('\n⚠️  Database does not exist:');
      console.error('  - Check DB_NAME is correct');
      console.error('  - Create the database if it does not exist');
    } else if (error.code === 'ENOTFOUND') {
      console.error('\n⚠️  Host not found:');
      console.error('  - Check DB_HOST is correct');
      console.error('  - Verify DNS resolution');
    }
    
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\nConnection closed.');
    }
  }
}

testConnection();

