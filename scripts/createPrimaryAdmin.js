const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');

dotenv.config();

async function createPrimaryAdmin() {
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

    console.log('Connected to database successfully!');

    // Get admin details from environment variables or use defaults
    const adminName = process.env.ADMIN_NAME || 'Primary Admin';
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@edtech.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';

    // Check if admin already exists
    const [existing] = await connection.execute(
      'SELECT id, email FROM users WHERE email = ? OR role = ?',
      [adminEmail, 'primary_admin']
    );

    if (existing.length > 0) {
      console.log('⚠️  Primary admin already exists!');
      console.log('Existing admin:', {
        id: existing[0].id,
        email: existing[0].email
      });
      console.log('\nIf you want to create a new admin, please:');
      console.log('1. Delete the existing primary admin, or');
      console.log('2. Use a different email address');
      process.exit(0);
    }

    // Hash password
    console.log('Hashing password...');
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // Insert primary admin
    console.log('Creating primary admin user...');
    const [result] = await connection.execute(
      `INSERT INTO users (name, email, password, role, password_set) 
       VALUES (?, ?, ?, 'primary_admin', TRUE)`,
      [adminName, adminEmail, hashedPassword]
    );

    console.log('\n✅ Primary admin created successfully!');
    console.log('Admin Details:');
    console.log('  ID:', result.insertId);
    console.log('  Name:', adminName);
    console.log('  Email:', adminEmail);
    console.log('  Password:', adminPassword);
    console.log('  Role: primary_admin');
    console.log('\n⚠️  IMPORTANT: Save these credentials securely!');
    console.log('You can change the password after logging in.');

  } catch (error) {
    console.error('\n❌ Error creating primary admin:', error.message);
    
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      console.error('\n⚠️  Database Connection Failed!');
      console.error('\nPlease check the following:');
      console.error('1. Ensure your .env file has the correct RDS database credentials:');
      console.error('   - DB_HOST=your-rds-endpoint.region.rds.amazonaws.com');
      console.error('   - DB_USER=your-database-username');
      console.error('   - DB_PASS=your-database-password');
      console.error('   - DB_NAME=your-database-name');
      console.error('   - DB_PORT=3306 (or your custom port)');
      console.error('\n2. Ensure your RDS security group allows inbound connections from your IP');
      console.error('3. Ensure the RDS database is running and accessible');
      console.error('4. If using SSL, set USE_SSL=true in .env');
    } else if (error.code === 'ER_DUP_ENTRY') {
      console.error('A user with this email already exists.');
    } else if (error.code === 'ER_BAD_FIELD_ERROR') {
      console.error('Database schema error. Please ensure all required columns exist.');
      console.error('Run the schema.sql file to create the necessary tables.');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('Database access denied. Please check your DB_USER and DB_PASS credentials.');
    } else {
      console.error('Error code:', error.code);
      console.error('Error details:', error.message);
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
createPrimaryAdmin();

