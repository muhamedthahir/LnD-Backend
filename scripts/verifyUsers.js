const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

async function verifyUsers() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    ssl: process.env.USE_SSL === 'true' ? { rejectUnauthorized: false } : undefined
  });
  
  const [users] = await conn.execute('SELECT id, name, email, role FROM users ORDER BY role, name');
  console.log('\n📋 Users in database:\n');
  console.log('Role'.padEnd(20) + 'Name'.padEnd(25) + 'Email');
  console.log('-'.repeat(70));
  users.forEach(u => {
    console.log(u.role.padEnd(20) + u.name.padEnd(25) + u.email);
  });
  
  // Check registration numbers
  try {
    const [details] = await conn.execute(
      `SELECT u.name, u.email, ud.registration_number 
       FROM users u 
       LEFT JOIN user_details ud ON u.id = ud.user_id 
       WHERE u.role = 'student' 
       ORDER BY u.name`
    );
    
    if (details.length > 0) {
      console.log('\n📋 Student Registration Numbers:\n');
      details.forEach(d => {
        console.log(`${d.name.padEnd(20)} - ${d.email.padEnd(25)} - ${d.registration_number || 'N/A'}`);
      });
    }
  } catch (error) {
    // user_details might not have registration_number column
  }
  
  await conn.end();
}

verifyUsers().catch(console.error);

