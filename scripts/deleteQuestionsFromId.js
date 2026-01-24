const pool = require('../config/db');
const Question = require('../models/Question');

async function deleteQuestionsFromId(startId) {
  try {
    console.log(`Starting to delete all questions from ID ${startId}...`);
    
    // Get all questions with ID >= startId
    const [questions] = await pool.execute(
      'SELECT id, code, name FROM questions WHERE id >= ? ORDER BY id ASC',
      [startId]
    );
    
    if (questions.length === 0) {
      console.log(`No questions found with ID >= ${startId}`);
      process.exit(0);
    }
    
    console.log(`Found ${questions.length} question(s) to delete:`);
    questions.forEach(q => {
      console.log(`  - ${q.code} (ID: ${q.id}): ${q.name}`);
    });
    
    let deletedCount = 0;
    let errorCount = 0;
    
    for (const question of questions) {
      try {
        // Delete the question (this will cascade delete related records)
        await Question.delete(question.id);
        console.log(`✓ Deleted question ${question.code} (ID: ${question.id})`);
        deletedCount++;
      } catch (error) {
        console.error(`✗ Error deleting question ${question.code} (ID: ${question.id}):`, error.message);
        errorCount++;
      }
    }
    
    console.log(`\nDelete complete!`);
    console.log(`- Deleted: ${deletedCount} questions`);
    console.log(`- Errors: ${errorCount} questions`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error deleting questions:', error);
    process.exit(1);
  }
}

// Get start ID from command line argument or default to 20
const startId = process.argv[2] ? parseInt(process.argv[2]) : 20;

if (isNaN(startId)) {
  console.error('Invalid start ID. Please provide a valid number.');
  process.exit(1);
}

// Run the script
deleteQuestionsFromId(startId);


