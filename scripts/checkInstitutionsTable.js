const pool = require('../config/db');

async function checkInstitutionsTable() {
  try {
    // Check if table exists
    const [tables] = await pool.execute("SHOW TABLES LIKE 'institutions'");
    
    if (tables.length === 0) {
      console.log('❌ Institutions table does not exist');
      console.log('Run: node scripts/runInstitutionMigration.js');
      process.exit(1);
    }
    
    console.log('✅ Institutions table exists');
    
    // Check table structure
    const [columns] = await pool.execute('DESCRIBE institutions');
    console.log('\nTable structure:');
    columns.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'YES' ? '(nullable)' : '(not null)'}`);
    });
    
    // Check data
    const [institutions] = await pool.execute('SELECT * FROM institutions ORDER BY name');
    console.log(`\n✅ Found ${institutions.length} institution(s):`);
    institutions.forEach(inst => {
      console.log(`  - ID: ${inst.id}, Name: ${inst.name}`);
    });
    
    if (institutions.length === 0) {
      console.log('\n⚠️  No institutions found. Create institutions in the Institutions management page.');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkInstitutionsTable();

