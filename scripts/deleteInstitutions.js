require('dotenv').config();
const pool = require('../config/db');

const INSTITUTIONS_TO_DELETE = ['SVCE', 'GITAM'];

async function deleteInstitutions() {
  let connection;
  try {
    connection = await pool.getConnection();
    console.log('Connected to database');

    // Start transaction
    await connection.beginTransaction();

    // Get user IDs for these institutions
    const [users] = await connection.execute(
      'SELECT id, name, email, college_name FROM users WHERE college_name IN (?, ?)',
      INSTITUTIONS_TO_DELETE
    );

    console.log(`\nFound ${users.length} users to delete:`);
    users.forEach(user => {
      console.log(`  - ${user.name} (${user.email}) - ${user.college_name}`);
    });

    // Get groups for these institutions
    const [groups] = await connection.execute(
      'SELECT id, name, college_name FROM `groups` WHERE college_name IN (?, ?)',
      INSTITUTIONS_TO_DELETE
    );

    console.log(`\nFound ${groups.length} groups to delete:`);
    groups.forEach(group => {
      console.log(`  - ${group.name} - ${group.college_name}`);
    });

    // Get institutions
    const [institutions] = await connection.execute(
      'SELECT id, name FROM institutions WHERE name IN (?, ?)',
      INSTITUTIONS_TO_DELETE
    );

    console.log(`\nFound ${institutions.length} institutions to delete:`);
    institutions.forEach(inst => {
      console.log(`  - ${inst.name} (ID: ${inst.id})`);
    });

    if (users.length === 0 && groups.length === 0 && institutions.length === 0) {
      console.log('\nNo data found for these institutions. Nothing to delete.');
      await connection.rollback();
      return;
    }

    // Confirm deletion
    console.log('\n⚠️  WARNING: This will permanently delete:');
    console.log(`  - ${users.length} users`);
    console.log(`  - ${groups.length} groups`);
    console.log(`  - ${institutions.length} institutions`);
    console.log('\nNote: Related data (enrollments, courses, etc.) will be cascade deleted.');
    
    // Delete users (this will cascade delete related enrollments, courses created by them, etc.)
    if (users.length > 0) {
      const userIds = users.map(u => u.id);
      const placeholders = userIds.map(() => '?').join(',');
      await connection.execute(
        `DELETE FROM users WHERE id IN (${placeholders})`,
        userIds
      );
      console.log(`\n✓ Deleted ${users.length} users`);
    }

    // Delete groups (group_members will be cascade deleted)
    if (groups.length > 0) {
      const groupIds = groups.map(g => g.id);
      const placeholders = groupIds.map(() => '?').join(',');
      await connection.execute(
        `DELETE FROM \`groups\` WHERE id IN (${placeholders})`,
        groupIds
      );
      console.log(`✓ Deleted ${groups.length} groups`);
    }

    // Delete institutions
    if (institutions.length > 0) {
      const instIds = institutions.map(i => i.id);
      const placeholders = instIds.map(() => '?').join(',');
      await connection.execute(
        `DELETE FROM institutions WHERE id IN (${placeholders})`,
        instIds
      );
      console.log(`✓ Deleted ${institutions.length} institutions`);
    }

    // Commit transaction
    await connection.commit();
    console.log('\n✅ Successfully deleted all data for institutions:', INSTITUTIONS_TO_DELETE.join(', '));

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Error deleting institutions:', error);
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
deleteInstitutions().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

