const pool = require('../config/db');
const Question = require('../models/Question');
const QuestionBank = require('../models/QuestionBank');

async function updateQuestionsToAptitude() {
  try {
    console.log('Starting to update questions to Aptitude question bank...');
    
    // Find the Aptitude question bank
    const questionBanks = await pool.execute(
      'SELECT id, name FROM question_banks WHERE LOWER(name) = ?',
      ['aptitude']
    );
    
    if (questionBanks[0].length === 0) {
      console.error('Error: Aptitude question bank not found');
      process.exit(1);
    }
    
    const aptitudeBankId = questionBanks[0][0].id;
    console.log(`Found Aptitude question bank with ID: ${aptitudeBankId}`);
    
    // Question codes to update
    const questionCodes = ['Q0008', 'Q0010', 'Q0011', 'Q0012', 'Q0013', 'Q0014', 'Q0015', 'Q0016'];
    
    let updatedCount = 0;
    let notFoundCount = 0;
    
    for (const code of questionCodes) {
      const question = await Question.findByCode(code);
      
      if (!question) {
        console.log(`Question ${code} not found`);
        notFoundCount++;
        continue;
      }
      
      // Update the question bank
      await pool.execute(
        'UPDATE questions SET question_bank_id = ? WHERE id = ?',
        [aptitudeBankId, question.id]
      );
      
      console.log(`Updated question ${code} (ID: ${question.id}) to Aptitude question bank`);
      updatedCount++;
    }
    
    console.log(`\nUpdate complete!`);
    console.log(`- Updated: ${updatedCount} questions`);
    console.log(`- Not found: ${notFoundCount} questions`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error updating questions:', error);
    process.exit(1);
  }
}

// Run the script
updateQuestionsToAptitude();


