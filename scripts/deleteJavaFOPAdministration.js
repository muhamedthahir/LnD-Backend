require('dotenv').config();
const pool = require('../config/db');

async function deleteJavaFOPAdministration() {
  let connection;
  try {
    connection = await pool.getConnection();
    console.log('Connected to database\n');

    // First, find the administration(s) matching "java FOP svce" or similar
    const searchPattern = '%java%fop%svce%';
    
    const [administrations] = await connection.execute(
      `SELECT ca.id, ca.display_id, ca.administration_name, ca.status, ca.course_id, 
              c.name as course_name
       FROM course_administrations ca
       LEFT JOIN courses c ON ca.course_id = c.id
       WHERE LOWER(ca.administration_name) LIKE ? 
          OR (LOWER(c.name) LIKE '%java%fop%' AND LOWER(ca.administration_name) LIKE '%svce%')
       ORDER BY ca.id`,
      [searchPattern]
    );

    if (administrations.length === 0) {
      console.log('No administrations found matching "java FOP svce".');
      console.log('\nSearching for all administrations containing "java" or "fop"...\n');
      
      const [allJava] = await connection.execute(
        `SELECT ca.id, ca.display_id, ca.administration_name, ca.status, ca.course_id, 
                c.name as course_name
         FROM course_administrations ca
         LEFT JOIN courses c ON ca.course_id = c.id
         WHERE LOWER(ca.administration_name) LIKE '%java%'
            OR LOWER(ca.administration_name) LIKE '%fop%'
            OR LOWER(c.name) LIKE '%java%fop%'
         ORDER BY ca.id`
      );

      if (allJava.length > 0) {
        console.log('Found administrations with "java" or "fop":');
        allJava.forEach(admin => {
          console.log(`  ID: ${admin.id}, Name: ${admin.administration_name}, Course: ${admin.course_name}, Status: ${admin.status}`);
        });
      } else {
        console.log('No administrations found.');
      }
      
      await connection.release();
      await pool.end();
      return;
    }

    console.log(`Found ${administrations.length} administration(s) to delete:\n`);
    administrations.forEach(admin => {
      console.log(`  ID: ${admin.id}`);
      console.log(`  Display ID: ${admin.display_id}`);
      console.log(`  Name: ${admin.administration_name}`);
      console.log(`  Course: ${admin.course_name || 'N/A'}`);
      console.log(`  Status: ${admin.status}`);
      console.log('');
    });

    // Get enrollments for these administrations
    const adminIds = administrations.map(a => a.id);
    const placeholders = adminIds.map(() => '?').join(',');
    
    const [enrollments] = await connection.execute(
      `SELECT COUNT(*) as count FROM enrollments WHERE administration_id IN (${placeholders})`,
      adminIds
    );

    console.log(`Found ${enrollments[0].count} enrollment(s) for these administrations.`);
    console.log('\n⚠️  WARNING: This will permanently delete:');
    console.log(`  - ${administrations.length} administration(s)`);
    console.log(`  - ${enrollments[0].count} enrollment(s)`);
    console.log('\nNote: Enrollments will be cascade deleted when administrations are deleted.\n');

    // Start transaction
    await connection.beginTransaction();

    // Delete enrollments first (though they should cascade, doing it explicitly for clarity)
    if (enrollments[0].count > 0) {
      await connection.execute(
        `DELETE FROM enrollments WHERE administration_id IN (${placeholders})`,
        adminIds
      );
      console.log(`✓ Deleted ${enrollments[0].count} enrollment(s)`);
    }

    // Delete administrations
    await connection.execute(
      `DELETE FROM course_administrations WHERE id IN (${placeholders})`,
      adminIds
    );
    console.log(`✓ Deleted ${administrations.length} administration(s)`);

    // Commit transaction
    await connection.commit();
    console.log('\n✅ Successfully deleted Java FOP SVCE administration(s) and related data.');

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('\n✗ Error deleting administration:', error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
    await pool.end();
    process.exit(0);
  }
}

// Run the script
deleteJavaFOPAdministration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

