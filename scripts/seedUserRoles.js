const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

// Define the user roles with their hierarchy
// Lower role_rank = higher authority
const USER_ROLES = [
  {
    name: 'primary_admin',
    description: 'Primary administrator with full system access',
    role_rank: 1
  },
  {
    name: 'campuszen_admin',
    description: 'CampusZen administrator with the same access as primary admin',
    role_rank: 1
  },
  {
    name: 'college_admin',
    description: 'College administrator with institution-level access',
    role_rank: 2
  },
  {
    name: 'student',
    description: 'Student user with course access',
    role_rank: 3
  }
];

async function seedUserRoles() {
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

    // Create user_roles table if not exists
    console.log('Creating user_roles table if not exists...\n');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS user_roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE,
        description VARCHAR(255),
        role_rank INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_name (name),
        INDEX idx_role_rank (role_rank)
      )
    `);
    console.log('✅ user_roles table ready\n');

    // Add role_id column to users table if not exists
    console.log('Adding role_id column to users table if not exists...\n');
    try {
      await connection.execute(`
        ALTER TABLE users 
        ADD COLUMN role_id INT NULL AFTER role,
        ADD INDEX idx_role_id (role_id)
      `);
      console.log('✅ role_id column added to users table\n');
    } catch (alterError) {
      if (alterError.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️  role_id column already exists in users table\n');
      } else if (alterError.code === 'ER_DUP_KEYNAME') {
        console.log('ℹ️  role_id column/index already exists in users table\n');
      } else {
        throw alterError;
      }
    }

    console.log('Seeding user roles...\n');

    for (const role of USER_ROLES) {
      try {
        // Check if role already exists
        const [existing] = await connection.execute(
          'SELECT id, name FROM user_roles WHERE name = ?',
          [role.name]
        );

        if (existing.length > 0) {
          // Update existing role
          await connection.execute(
            'UPDATE user_roles SET description = ?, role_rank = ? WHERE name = ?',
            [role.description, role.role_rank, role.name]
          );
          console.log(`⚠️  Role "${role.name}" already exists (ID: ${existing[0].id}) - Updated`);
        } else {
          // Insert new role
          const [result] = await connection.execute(
            'INSERT INTO user_roles (name, description, role_rank) VALUES (?, ?, ?)',
            [role.name, role.description, role.role_rank]
          );
          console.log(`✅ Created role "${role.name}" (ID: ${result.insertId})`);
        }
      } catch (roleError) {
        console.error(`❌ Error processing role "${role.name}":`, roleError.message);
      }
    }

    // Update existing users to link to user_roles table
    console.log('\n--- Updating existing users to use role_id ---\n');

    for (const role of USER_ROLES) {
      try {
        // Get the role ID
        const [roleRows] = await connection.execute(
          'SELECT id FROM user_roles WHERE name = ?',
          [role.name]
        );

        if (roleRows.length > 0) {
          const roleId = roleRows[0].id;

          // Update users with this role to have the role_id
          const [updateResult] = await connection.execute(
            'UPDATE users SET role_id = ? WHERE role = ? AND (role_id IS NULL OR role_id != ?)',
            [roleId, role.name, roleId]
          );

          if (updateResult.affectedRows > 0) {
            console.log(`✅ Updated ${updateResult.affectedRows} user(s) with role "${role.name}" to role_id: ${roleId}`);
          } else {
            console.log(`ℹ️  No users to update for role "${role.name}"`);
          }
        }
      } catch (updateError) {
        // Ignore if role_id column doesn't exist yet
        if (updateError.code === 'ER_BAD_FIELD_ERROR') {
          console.log(`⚠️  role_id column not found. Please run the migration first.`);
          break;
        }
        console.error(`❌ Error updating users for role "${role.name}":`, updateError.message);
      }
    }

    console.log('\n✅ User roles seeded successfully!');
    console.log('\nRoles created:');
    
    // Display all roles
    const [allRoles] = await connection.execute(
      'SELECT * FROM user_roles ORDER BY role_rank ASC'
    );
    console.table(allRoles.map(r => ({
      ID: r.id,
      Name: r.name,
      Description: r.description,
      Rank: r.role_rank
    })));

  } catch (error) {
    console.error('\n❌ Error seeding user roles:', error.message);

    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      console.error('\n⚠️  Database Connection Failed!');
      console.error('Please check your database connection settings in .env file.');
    } else if (error.code === 'ER_NO_SUCH_TABLE') {
      console.error('\n⚠️  Table "user_roles" does not exist!');
      console.error('Please run the migration first:');
      console.error('  node scripts/runMigration.js database/migrations/create_user_roles.sql');
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
seedUserRoles();

