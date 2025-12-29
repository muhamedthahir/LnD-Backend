// Script to update administration status to published
const pool = require('../config/db');

async function updateStatus() {
  try {
    const administrationName = 'PSTJ MBU';
    
    // First, find the administration
    const [rows] = await pool.execute(
      'SELECT id, administration_name, status FROM course_administrations WHERE administration_name LIKE ?',
      [`%${administrationName}%`]
    );
    
    if (rows.length === 0) {
      console.log(`No administration found with name containing "${administrationName}"`);
      return;
    }
    
    console.log('Found administrations:');
    rows.forEach(row => {
      console.log(`- ID: ${row.id}, Name: ${row.administration_name}, Current Status: ${row.status}`);
    });
    
    // Update status to published
    const [result] = await pool.execute(
      'UPDATE course_administrations SET status = ?, updated_at = NOW() WHERE administration_name LIKE ?',
      ['published', `%${administrationName}%`]
    );
    
    console.log(`\n✓ Updated ${result.affectedRows} administration(s) to "published" status`);
    
    // Verify the update
    const [updatedRows] = await pool.execute(
      'SELECT id, administration_name, status FROM course_administrations WHERE administration_name LIKE ?',
      [`%${administrationName}%`]
    );
    
    console.log('\nUpdated administrations:');
    updatedRows.forEach(row => {
      console.log(`- ID: ${row.id}, Name: ${row.administration_name}, Status: ${row.status}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error updating administration status:', error);
    process.exit(1);
  }
}

updateStatus();

