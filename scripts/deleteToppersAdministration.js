// Script to delete "toppers" administration from the database
const { pool, executeWithRetry } = require('../config/db');
const dotenv = require('dotenv');
dotenv.config();

async function deleteToppersAdministration() {
  const administrationNameToDelete = "toppers"; // Case-insensitive search

  try {
    // Find the administration by name (case-insensitive)
    const [administrations] = await executeWithRetry(
      'SELECT id, display_id, administration_name, status FROM course_administrations WHERE LOWER(administration_name) LIKE ?',
      [`%${administrationNameToDelete.toLowerCase()}%`]
    );

    if (administrations.length === 0) {
      console.log(`No administration found with name containing: "${administrationNameToDelete}"`);
      // Try exact match
      const [exactAdministrations] = await executeWithRetry(
        'SELECT id, display_id, administration_name, status FROM course_administrations WHERE LOWER(administration_name) = ?',
        [administrationNameToDelete.toLowerCase()]
      );
      
      if (exactAdministrations.length === 0) {
        console.log('No administrations found. Listing all administrations:');
        const [allAdministrations] = await executeWithRetry(
          'SELECT id, display_id, administration_name, status FROM course_administrations ORDER BY id'
        );
        allAdministrations.forEach(admin => {
          console.log(`- ID: ${admin.id}, Display ID: ${admin.display_id}, Name: "${admin.administration_name}", Status: ${admin.status}`);
        });
        return;
      }
      
      administrations.push(...exactAdministrations);
    }

    console.log('Found administrations:');
    administrations.forEach(admin => {
      console.log(`- ID: ${admin.id}, Display ID: ${admin.display_id}, Name: "${admin.administration_name}", Status: ${admin.status}`);
    });

    // Delete related enrollments first (due to foreign key constraint)
    for (const admin of administrations) {
      console.log(`\nDeleting enrollments for administration ID ${admin.id}...`);
      const [enrollmentResult] = await executeWithRetry(
        'DELETE FROM enrollments WHERE administration_id = ?',
        [admin.id]
      );
      console.log(`  Deleted ${enrollmentResult.affectedRows} enrollment(s)`);
    }

    // Delete the administrations
    const adminIds = administrations.map(admin => admin.id);
    console.log(`\nDeleting administrations...`);
    const [result] = await executeWithRetry(
      `DELETE FROM course_administrations WHERE id IN (${adminIds.map(() => '?').join(',')})`,
      adminIds
    );

    if (result.affectedRows > 0) {
      console.log(`\n✓ Deleted ${result.affectedRows} administration(s) successfully`);
      console.log(`✓ Deleted all related enrollments`);
    } else {
      console.log('No administrations were deleted.');
    }
  } catch (error) {
    console.error('Error deleting administration:', error);
  } finally {
    pool.end();
  }
}

deleteToppersAdministration();

