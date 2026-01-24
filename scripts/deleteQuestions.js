const pool = require('../config/db');
const Question = require('../models/Question');

async function deleteQuestions() {
  try {
    console.log('Starting to delete questions...');
    
    // Question codes to delete
    const questionCodes = ['Q0020', 'Q0021'];
    
    let deletedCount = 0;
    let notFoundCount = 0;
    
    for (const code of questionCodes) {
      const question = await Question.findByCode(code);
      
      if (!question) {
        console.log(`Question ${code} not found`);
        notFoundCount++;
        continue;
      }
      
      // Delete the question (this will cascade delete related records)
      await Question.delete(question.id);
      
      console.log(`Deleted question ${code} (ID: ${question.id})`);
      deletedCount++;
    }
    
    console.log(`\nDelete complete!`);
    console.log(`- Deleted: ${deletedCount} questions`);
    console.log(`- Not found: ${notFoundCount} questions`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error deleting questions:', error);
    process.exit(1);
  }
}

// Run the script
deleteQuestions();


