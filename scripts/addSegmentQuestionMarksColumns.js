const pool = require('../config/db');

async function addMarksColumns() {
  try {
    console.log('Adding marks columns to segment_programming_questions...');
    
    // Check if columns exist first
    const [columns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'segment_programming_questions' 
      AND COLUMN_NAME IN ('positive_marks', 'negative_marks', 'neutral_marks')
    `);
    
    const existingColumns = columns.map(c => c.COLUMN_NAME);
    const columnsToAdd = [];
    
    if (!existingColumns.includes('positive_marks')) {
      columnsToAdd.push('ADD COLUMN positive_marks DECIMAL(10,2) DEFAULT NULL');
    }
    if (!existingColumns.includes('negative_marks')) {
      columnsToAdd.push('ADD COLUMN negative_marks DECIMAL(10,2) DEFAULT NULL');
    }
    if (!existingColumns.includes('neutral_marks')) {
      columnsToAdd.push('ADD COLUMN neutral_marks DECIMAL(10,2) DEFAULT NULL');
    }
    
    if (columnsToAdd.length > 0) {
      await pool.execute(`
        ALTER TABLE segment_programming_questions
        ${columnsToAdd.join(',\n        ')}
      `);
      console.log('Added columns to segment_programming_questions');
    } else {
      console.log('Columns already exist in segment_programming_questions');
    }
    
    console.log('Adding marks columns to segment_mcq_questions...');
    
    // Check if columns exist first
    const [mcqColumns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'segment_mcq_questions' 
      AND COLUMN_NAME IN ('positive_marks', 'negative_marks', 'neutral_marks')
    `);
    
    const existingMcqColumns = mcqColumns.map(c => c.COLUMN_NAME);
    const mcqColumnsToAdd = [];
    
    if (!existingMcqColumns.includes('positive_marks')) {
      mcqColumnsToAdd.push('ADD COLUMN positive_marks DECIMAL(10,2) DEFAULT NULL');
    }
    if (!existingMcqColumns.includes('negative_marks')) {
      mcqColumnsToAdd.push('ADD COLUMN negative_marks DECIMAL(10,2) DEFAULT NULL');
    }
    if (!existingMcqColumns.includes('neutral_marks')) {
      mcqColumnsToAdd.push('ADD COLUMN neutral_marks DECIMAL(10,2) DEFAULT NULL');
    }
    
    if (mcqColumnsToAdd.length > 0) {
      await pool.execute(`
        ALTER TABLE segment_mcq_questions
        ${mcqColumnsToAdd.join(',\n        ')}
      `);
      console.log('Added columns to segment_mcq_questions');
    } else {
      console.log('Columns already exist in segment_mcq_questions');
    }
    
    console.log('Successfully completed migration!');
    process.exit(0);
  } catch (error) {
    console.error('Error adding columns:', error);
    process.exit(1);
  }
}

addMarksColumns();

