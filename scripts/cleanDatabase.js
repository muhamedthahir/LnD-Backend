require('dotenv').config()
const mysql = require('mysql2/promise')

async function cleanDatabase() {
  let connection

  try {
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'demo',
      ssl: process.env.USE_SSL === 'true' ? {
        rejectUnauthorized: false
      } : false
    })

    console.log('✓ Connected to database')
    console.log('')

    // Get count of users before deletion
    const [userCountBefore] = await connection.execute(
      'SELECT COUNT(*) as count FROM users WHERE role != ?',
      ['primary_admin']
    )
    console.log(`Found ${userCountBefore[0].count} non-primary-admin users to delete`)

    // Get count of primary admin users
    const [primaryAdminCount] = await connection.execute(
      'SELECT COUNT(*) as count, GROUP_CONCAT(name) as names FROM users WHERE role = ?',
      ['primary_admin']
    )
    console.log(`Found ${primaryAdminCount[0].count} primary admin user(s): ${primaryAdminCount[0].names || 'None'}`)
    console.log('')

    // Get count of institutions before deletion
    const [institutionCount] = await connection.execute(
      'SELECT COUNT(*) as count FROM institutions'
    )
    console.log(`Found ${institutionCount[0].count} institutions to delete`)
    console.log('')

    // Delete all users except primary admin
    console.log('Deleting all users except primary admin...')
    const [deleteUsersResult] = await connection.execute(
      'DELETE FROM users WHERE role != ?',
      ['primary_admin']
    )
    console.log(`✓ Deleted ${deleteUsersResult.affectedRows} user(s)`)
    console.log('')

    // Delete all institutions
    console.log('Deleting all institutions...')
    const [deleteInstitutionsResult] = await connection.execute(
      'DELETE FROM institutions'
    )
    console.log(`✓ Deleted ${deleteInstitutionsResult.affectedRows} institution(s)`)
    console.log('')

    // Verify final state
    const [finalUserCount] = await connection.execute(
      'SELECT COUNT(*) as count FROM users'
    )
    const [finalInstitutionCount] = await connection.execute(
      'SELECT COUNT(*) as count FROM institutions'
    )

    console.log('=== Final State ===')
    console.log(`Remaining users: ${finalUserCount[0].count}`)
    console.log(`Remaining institutions: ${finalInstitutionCount[0].count}`)
    console.log('')

    if (finalUserCount[0].count > 0) {
      const [remainingUsers] = await connection.execute(
        'SELECT id, name, email, role FROM users'
      )
      console.log('Remaining users:')
      remainingUsers.forEach(user => {
        console.log(`  - ${user.name} (${user.email}) - ${user.role}`)
      })
    }

    console.log('')
    console.log('✓ Database cleanup completed successfully!')

  } catch (error) {
    console.error('✗ Error cleaning database:')
    console.error(error.message)
    if (error.code) {
      console.error(`Error code: ${error.code}`)
    }
    process.exit(1)
  } finally {
    if (connection) {
      await connection.end()
      console.log('')
      console.log('✓ Database connection closed')
    }
  }
}

// Run the cleanup
cleanDatabase()

