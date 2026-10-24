/**
 * Seed script for Question Bank master data
 * Run: node scripts/seedQuestionBankMasterData.js
 */

const pool = require('../config/db');

async function seedMasterData() {
  console.log('Starting Question Bank master data seeding...\n');

  try {
    // 1. Seed Levels
    console.log('Seeding Levels...');
    const levels = [
      { name: 'Easy', description: 'Beginner level questions', rank: 1 },
      { name: 'Medium', description: 'Intermediate level questions', rank: 2 },
      { name: 'Hard', description: 'Advanced level questions', rank: 3 }
    ];

    for (const level of levels) {
      await pool.execute(
        `INSERT INTO levels (name, description, \`rank\`) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE description = VALUES(description), \`rank\` = VALUES(\`rank\`)`,
        [level.name, level.description, level.rank]
      );
    }
    console.log('✓ Levels seeded successfully\n');

    // 2. Seed Statuses
    console.log('Seeding Statuses...');
    const statuses = [
      { name: 'DRAFT', description: 'Question is in draft state and not published' },
      { name: 'REVIEW', description: 'Question is under review' },
      { name: 'PUBLISHED', description: 'Question is published and available for use' }
    ];

    for (const status of statuses) {
      await pool.execute(
        `INSERT INTO statuses (name, description) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE description = VALUES(description)`,
        [status.name, status.description]
      );
    }
    console.log('✓ Statuses seeded successfully\n');

    // 3. Seed Question Types
    console.log('Seeding Question Types...');
    const questionTypes = [
      { name: 'MCQ', description: 'Multiple Choice Question with single correct answer' },
      { name: 'Multi Select', description: 'Multiple Choice Question with multiple correct answers' },
      { name: 'Programming', description: 'Programming/Coding question with test cases' }
    ];

    for (const qt of questionTypes) {
      await pool.execute(
        `INSERT INTO question_types (name, description) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE description = VALUES(description)`,
        [qt.name, qt.description]
      );
    }
    console.log('✓ Question Types seeded successfully\n');

    // 4. Seed Languages
    console.log('Seeding Languages...');
    const languages = [
      { name: 'Python', description: 'Python programming language', current_version: '3.11' },
      { name: 'Java', description: 'Java programming language', current_version: '17' },
      { name: 'JavaScript', description: 'JavaScript programming language', current_version: 'ES2022' },
      { name: 'C', description: 'C programming language', current_version: 'C17' },
      { name: 'C++', description: 'C++ programming language', current_version: 'C++20' },
      { name: 'C#', description: 'C# programming language', current_version: '11' },
      { name: 'Go', description: 'Go programming language', current_version: '1.21' },
      { name: 'Ruby', description: 'Ruby programming language', current_version: '3.2' },
      { name: 'PHP', description: 'PHP programming language', current_version: '8.2' },
      { name: 'TypeScript', description: 'TypeScript programming language', current_version: '5.0' }
    ];

    for (const lang of languages) {
      await pool.execute(
        `INSERT INTO languages (name, description, current_version) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE description = VALUES(description), current_version = VALUES(current_version)`,
        [lang.name, lang.description, lang.current_version]
      );
    }
    console.log('✓ Languages seeded successfully\n');

    // 5. Seed default Categories
    console.log('Seeding Categories...');
    const categories = [
      { name: 'Data Structures', description: 'Questions related to data structures' },
      { name: 'Algorithms', description: 'Questions related to algorithms' },
      { name: 'Database', description: 'Questions related to databases and SQL' },
      { name: 'Web Development', description: 'Questions related to web development' },
      { name: 'Object Oriented Programming', description: 'Questions related to OOP concepts' },
      { name: 'General Programming', description: 'General programming questions' }
    ];

    for (const cat of categories) {
      await pool.execute(
        `INSERT INTO categories (name, description) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE description = VALUES(description)`,
        [cat.name, cat.description]
      );
    }
    console.log('✓ Categories seeded successfully\n');

    // 6. Seed default Tags
    console.log('Seeding Tags...');
    const tags = [
      { name: 'Easy', color: '#22c55e' },
      { name: 'Medium', color: '#f59e0b' },
      { name: 'Hard', color: '#ef4444' },
      { name: 'Interview', color: '#6366f1' },
      { name: 'Practice', color: '#8b5cf6' },
      { name: 'Assessment', color: '#ec4899' },
      { name: 'Beginner', color: '#14b8a6' },
      { name: 'Advanced', color: '#f97316' }
    ];

    for (const tag of tags) {
      await pool.execute(
        `INSERT INTO tags (name, color) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE color = VALUES(color)`,
        [tag.name, tag.color]
      );
    }
    console.log('✓ Tags seeded successfully\n');

    console.log('========================================');
    console.log('All master data seeded successfully!');
    console.log('========================================\n');

    // Display summary
    const [levelCount] = await pool.execute('SELECT COUNT(*) as count FROM levels');
    const [statusCount] = await pool.execute('SELECT COUNT(*) as count FROM statuses');
    const [qtCount] = await pool.execute('SELECT COUNT(*) as count FROM question_types');
    const [langCount] = await pool.execute('SELECT COUNT(*) as count FROM languages');
    const [catCount] = await pool.execute('SELECT COUNT(*) as count FROM categories');
    const [tagCount] = await pool.execute('SELECT COUNT(*) as count FROM tags');

    console.log('Summary:');
    console.log(`  Levels: ${levelCount[0].count}`);
    console.log(`  Statuses: ${statusCount[0].count}`);
    console.log(`  Question Types: ${qtCount[0].count}`);
    console.log(`  Languages: ${langCount[0].count}`);
    console.log(`  Categories: ${catCount[0].count}`);
    console.log(`  Tags: ${tagCount[0].count}`);

    process.exit(0);
  } catch (error) {
    console.error('Error seeding master data:', error);
    process.exit(1);
  }
}

seedMasterData();

