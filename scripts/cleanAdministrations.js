// Script to clean all course administrations and related enrollments
const pool = require('../config/db');

async function cleanAdministrations() {
  try {
    // First, get count of administrations
    const [countRows] = await pool.execute(
      'SELECT COUNT(*) as count FROM course_administrations'
    );
    const adminCount = countRows[0].count;
    
    console.log(`Found ${adminCount} administration(s) in the database`);
    
    if (adminCount === 0) {
      console.log('No administrations to clean.');
      process.exit(0);
    }
    
    // Get count of related enrollments
    const [enrollmentRows] = await pool.execute(
      'SELECT COUNT(*) as count FROM enrollments WHERE administration_id IS NOT NULL'
    );
    const enrollmentCount = enrollmentRows[0].count;
    
    console.log(`Found ${enrollmentCount} enrollment(s) related to administrations`);
    
    // Delete enrollments first (due to foreign key constraint)
    if (enrollmentCount > 0) {
      const [enrollmentResult] = await pool.execute(
        'DELETE FROM enrollments WHERE administration_id IS NOT NULL'
      );
      console.log(`✓ Deleted ${enrollmentResult.affectedRows} enrollment(s)`);
    }
    
    // Delete all administrations
    const [result] = await pool.execute(
      'DELETE FROM course_administrations'
    );
    
    console.log(`✓ Deleted ${result.affectedRows} administration(s)`);
    console.log('\n✓ Course administrations table cleaned successfully!');
    
    process.exit(0);
  } catch (error) {
    console.error('Error cleaning administrations:', error);
    process.exit(1);
  }
}

cleanAdministrations();

