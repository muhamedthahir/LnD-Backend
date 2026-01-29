const fs = require('fs');

const content = fs.readFileSync('./controllers/assessmentController.js', 'utf8');

const newFunctions = `
/**
 * Save answer (auto-save individual answer)
 */
const saveAnswer = async (req, res) => {
  try {
    const { mapping_id } = req.params;
    const { question_id, question_type, answer } = req.body;

    const mapping = await AssessmentUserMapping.findById(mapping_id);
    if (!mapping) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    if (mapping.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (mapping.status !== 'IN_PROGRESS') {
      return res.status(400).json({ error: 'Assessment is not in progress' });
    }

    await UserQuestionAssignment.saveAnswer({
      assessment_user_mapping_id: mapping_id,
      question_id,
      question_type,
      answer
    });

    await AssessmentUserMapping.updateActivity(mapping_id, {});

    res.json({ message: 'Answer saved' });
  } catch (error) {
    console.error('Error saving answer:', error);
    res.status(500).json({ error: 'Failed to save answer' });
  }
};

/**
 * Save progress (periodic auto-save of timer and position)
 */
const saveProgress = async (req, res) => {
  try {
    const { mapping_id } = req.params;
    const { current_segment_index, total_time_worked } = req.body;

    const mapping = await AssessmentUserMapping.findById(mapping_id);
    if (!mapping) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    if (mapping.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (mapping.status !== 'IN_PROGRESS') {
      return res.status(400).json({ error: 'Assessment is not in progress' });
    }

    await AssessmentUserMapping.updateActivity(mapping_id, {
      current_segment_index,
      total_time_worked
    });

    res.json({ message: 'Progress saved' });
  } catch (error) {
    console.error('Error saving progress:', error);
    res.status(500).json({ error: 'Failed to save progress' });
  }
};

/**
 * Submit code (programming question submission)
 */
const submitCode = async (req, res) => {
  try {
    const { mapping_id } = req.params;
    const { question_id, code, language } = req.body;

    const mapping = await AssessmentUserMapping.findById(mapping_id);
    if (!mapping) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    if (mapping.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (mapping.status !== 'IN_PROGRESS') {
      return res.status(400).json({ error: 'Assessment is not in progress' });
    }

    const result = await UserQuestionAssignment.submitCode({
      assessment_user_mapping_id: mapping_id,
      question_id,
      code,
      language
    });

    await AssessmentUserMapping.updateActivity(mapping_id, {});

    res.json({ message: 'Code submitted', ...result });
  } catch (error) {
    console.error('Error submitting code:', error);
    res.status(500).json({ error: 'Failed to submit code' });
  }
};

/**
 * Move to next segment
 */
const nextSegment = async (req, res) => {
  try {
    const { mapping_id } = req.params;

    const mapping = await AssessmentUserMapping.findById(mapping_id);
    if (!mapping) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    if (mapping.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (mapping.status !== 'IN_PROGRESS') {
      return res.status(400).json({ error: 'Assessment is not in progress' });
    }

    const newSegmentIndex = (mapping.current_segment_index || 0) + 1;

    await AssessmentUserMapping.updateActivity(mapping_id, {
      current_segment_index: newSegmentIndex
    });

    res.json({ 
      message: 'Moved to next segment',
      current_segment_index: newSegmentIndex
    });
  } catch (error) {
    console.error('Error moving to next segment:', error);
    res.status(500).json({ error: 'Failed to move to next segment' });
  }
};

/**
 * Switch to a specific segment
 */
const switchSegment = async (req, res) => {
  try {
    const { mapping_id } = req.params;
    const { segment_index } = req.body;

    const mapping = await AssessmentUserMapping.findById(mapping_id);
    if (!mapping) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    if (mapping.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (mapping.status !== 'IN_PROGRESS') {
      return res.status(400).json({ error: 'Assessment is not in progress' });
    }

    await AssessmentUserMapping.updateActivity(mapping_id, {
      current_segment_index: segment_index
    });

    res.json({ 
      message: 'Switched segment',
      current_segment_index: segment_index
    });
  } catch (error) {
    console.error('Error switching segment:', error);
    res.status(500).json({ error: 'Failed to switch segment' });
  }
};
`;

// Find module.exports and insert before it
const exportIndex = content.indexOf('module.exports');
if (exportIndex === -1) {
  console.log('ERROR: module.exports not found');
  process.exit(1);
}

let newContent = content.slice(0, exportIndex) + newFunctions + '\n' + content.slice(exportIndex);

// Update exports to include new functions
newContent = newContent.replace(
  /getAssessmentResult,(\s*)(\/\/ Random Fetch Criteria)/,
  'getAssessmentResult,\n  saveAnswer,\n  saveProgress,\n  submitCode,\n  nextSegment,\n  switchSegment,\n  $1$2'
);

fs.writeFileSync('./controllers/assessmentController.js', newContent);
console.log('File updated successfully!');
console.log('Line count:', newContent.split('\n').length);

