const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

async function runMigration() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'lnd_db',
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
      multipleStatements: true
    });

    console.log('Connected to database. Running course migration...');

    // Check and add columns one by one
    const columns = [
      { name: 'category', type: 'VARCHAR(255) NULL' },
      { name: 'competency_level', type: 'VARCHAR(50) NULL' },
      { name: 'short_description', type: 'TEXT NULL' },
      { name: 'course_outcomes', type: 'TEXT NULL' },
      { name: 'status', type: "VARCHAR(20) DEFAULT 'draft'" },
      { name: 'thumbnail', type: 'VARCHAR(500) NULL' }
    ];

    for (const column of columns) {
      try {
        // Check if column exists
        const [rows] = await connection.execute(
          `SELECT COUNT(*) as count 
           FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = ? 
           AND TABLE_NAME = 'courses' 
           AND COLUMN_NAME = ?`,
          [process.env.DB_NAME || 'lnd_db', column.name]
        );

        if (rows[0].count === 0) {
          // Column doesn't exist, add it
          let alterQuery = `ALTER TABLE courses ADD COLUMN ${column.name} ${column.type}`;
          
          // Add after appropriate column
          if (column.name === 'category') {
            alterQuery += ' AFTER description';
          } else if (column.name === 'competency_level') {
            alterQuery += ' AFTER category';
          } else if (column.name === 'short_description') {
            alterQuery += ' AFTER competency_level';
          } else if (column.name === 'course_outcomes') {
            alterQuery += ' AFTER short_description';
          } else if (column.name === 'status') {
            alterQuery += ' AFTER course_outcomes';
          } else if (column.name === 'thumbnail') {
            alterQuery += ' AFTER status';
          }

          await connection.execute(alterQuery);
          console.log(`✓ Added column: ${column.name}`);
        } else {
          console.log(`- Column ${column.name} already exists`);
        }
      } catch (error) {
        console.error(`Error adding column ${column.name}:`, error.message);
      }
    }

    // Update existing courses to have default status
    try {
      await connection.execute(
        "UPDATE courses SET status = 'draft' WHERE status IS NULL"
      );
      console.log('✓ Updated existing courses with default status');
    } catch (error) {
      console.log('- Status update skipped (may not be needed)');
    }

    console.log('\nMigration completed successfully!');
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runMigration();

