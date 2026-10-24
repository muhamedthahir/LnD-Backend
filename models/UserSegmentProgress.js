const pool = require('../config/db');

class UserSegmentProgress {
  /**
   * Create or update segment progress
   * @param {Object} data - progress data
   */
  static async createOrUpdate(data) {
    const {
      user_id,
      course_id,
      topic_id,
      segment_id = null,
      practice_segment_id = null,
      segment_type,
      status = 'not_started',
      progress_percentage = 0,
      score = 0,
      max_score = 0,
      items_completed = 0,
      items_total = 0,
      time_spent_seconds = 0
    } = data;
    
    // Find existing record
    let existing = null;
    if (segment_id) {
      existing = await this.findByUserAndSegment(user_id, segment_id);
    } else if (practice_segment_id) {
      existing = await this.findByUserAndPracticeSegment(user_id, practice_segment_id);
    }
    
    if (existing) {
      // Determine status based on progress
      let newStatus = status;
      let completed_at = existing.completed_at;
      let started_at = existing.started_at;
      
      // Use best progress logic
      const currentProgress = existing.progress_percentage || 0;
      const bestProgress = Math.max(currentProgress, progress_percentage);
      
      if (bestProgress >= 100 && existing.status !== 'completed') {
        newStatus = 'completed';
        completed_at = new Date();
      } else if (bestProgress > 0 && (existing.status === 'not_started' || !existing.status)) {
        newStatus = 'in_progress';
      } else {
        newStatus = existing.status || status;
      }
      
      if (!started_at && bestProgress > 0) {
        started_at = new Date();
      }
      
      await pool.execute(
        `UPDATE user_segment_progress SET
           status = ?,
           progress_percentage = ?,
           score = ?,
           max_score = ?,
           items_completed = ?,
           items_total = ?,
           time_spent_seconds = ?,
           started_at = ?,
           completed_at = ?,
           last_updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [newStatus, bestProgress, score, max_score, items_completed, items_total, 
         time_spent_seconds, started_at, completed_at, existing.id]
      );
      
      return existing.id;
    } else {
      // Create new record
      let newStatus = status;
      let started_at = null;
      let completed_at = null;
      
      if (progress_percentage >= 100) {
        newStatus = 'completed';
        started_at = new Date();
        completed_at = new Date();
      } else if (progress_percentage > 0) {
        newStatus = 'in_progress';
        started_at = new Date();
      }
      
      const [result] = await pool.execute(
        `INSERT INTO user_segment_progress 
         (user_id, course_id, topic_id, segment_id, practice_segment_id, segment_type,
          status, progress_percentage, score, max_score, items_completed, items_total,
          time_spent_seconds, started_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [user_id, course_id, topic_id, segment_id, practice_segment_id, segment_type,
         newStatus, progress_percentage, score, max_score, items_completed, items_total,
         time_spent_seconds, started_at, completed_at]
      );
      
      return result.insertId;
    }
  }

  /**
   * Update progress for a lesson segment
   */
  static async updateLessonProgress(user_id, segment_id, progress_percentage, time_spent_seconds = 0) {
    const existing = await this.findByUserAndSegment(user_id, segment_id);
    
    if (existing) {
      // Use the best progress (don't allow it to decrease)
      const currentProgress = existing.progress_percentage || 0;
      const cappedNewProgress = Math.min(progress_percentage, 100);
      const bestProgress = Math.max(currentProgress, cappedNewProgress);
      
      let status = existing.status;
      let completed_at = existing.completed_at;
      
      // Update status and completed_at if progress reaches 100% for the first time
      if (bestProgress >= 100 && existing.status !== 'completed') {
        status = 'completed';
        completed_at = new Date();
      } else if (bestProgress > 0 && status === 'not_started') {
        status = 'in_progress';
      }
      
      await pool.execute(
        `UPDATE user_segment_progress SET
           status = ?,
           progress_percentage = ?,
           items_completed = CASE WHEN ? >= 100 THEN 1 ELSE 0 END,
           items_total = 1,
           time_spent_seconds = time_spent_seconds + ?,
           started_at = COALESCE(started_at, CURRENT_TIMESTAMP),
           completed_at = ?,
           last_updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [status, bestProgress, bestProgress, time_spent_seconds, completed_at, existing.id]
      );
    }
  }

  /**
   * Update progress for a practice segment (programming + MCQ)
   */
  static async updatePracticeSegmentProgress(user_id, practice_segment_id, programmingProgress, mcqProgress) {
    let existing = await this.findByUserAndPracticeSegment(user_id, practice_segment_id);
    
    // Calculate combined progress
    const totalItems = (programmingProgress?.total || 0) + (mcqProgress?.total || 0);
    const completedItems = Math.min(
      (programmingProgress?.completed || 0) + (mcqProgress?.completed || 0),
      totalItems
    );
    const totalScore = (programmingProgress?.score || 0) + (mcqProgress?.score || 0);
    const maxScore = (programmingProgress?.maxScore || 0) + (mcqProgress?.maxScore || 0);
    
    const progress_percentage = totalItems > 0 ? Math.min(Math.round((completedItems / totalItems) * 100), 100) : 0;
    
    if (!existing) {
      // If no progress record exists, we need to find course_id and topic_id to create one
      const [segmentInfo] = await pool.execute(
        'SELECT topic_id FROM practice_segments WHERE id = ?',
        [practice_segment_id]
      );
      
      if (segmentInfo.length > 0) {
        const topic_id = segmentInfo[0].topic_id;
        const [topicInfo] = await pool.execute(
          'SELECT course_id FROM topics WHERE id = ?',
          [topic_id]
        );
        
        if (topicInfo.length > 0) {
          const course_id = topicInfo[0].course_id;
          await this.createOrUpdate({
            user_id,
            course_id,
            topic_id,
            practice_segment_id,
            segment_type: 'practice',
            status: progress_percentage >= 100 ? 'completed' : (progress_percentage > 0 ? 'in_progress' : 'not_started'),
            progress_percentage,
            score: totalScore,
            max_score: maxScore,
            items_completed: completedItems,
            items_total: totalItems
          });
          return;
        }
      }
      return; // Could not find info to create record
    }
    
    // Existing record found, update it
    let status = existing.status;
    let completed_at = existing.completed_at;
    
    // Use best progress logic
    const bestProgress = Math.max(existing.progress_percentage || 0, progress_percentage);
    
    if (bestProgress >= 100 && existing.status !== 'completed') {
      status = 'completed';
      completed_at = new Date();
    } else if (bestProgress > 0 && status === 'not_started') {
      status = 'in_progress';
    }
    
    await pool.execute(
      `UPDATE user_segment_progress SET
         status = ?,
         progress_percentage = ?,
         score = ?,
         max_score = ?,
         items_completed = ?,
         items_total = ?,
         started_at = COALESCE(started_at, CURRENT_TIMESTAMP),
         completed_at = ?,
         last_updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, bestProgress, totalScore, maxScore, completedItems, totalItems, completed_at, existing.id]
    );
  }

  /**
   * Find by user and segment
   */
  static async findByUserAndSegment(user_id, segment_id) {
    const [rows] = await pool.execute(
      'SELECT * FROM user_segment_progress WHERE user_id = ? AND segment_id = ?',
      [user_id, segment_id]
    );
    return rows[0] || null;
  }

  /**
   * Find by user and practice segment
   */
  static async findByUserAndPracticeSegment(user_id, practice_segment_id) {
    const [rows] = await pool.execute(
      'SELECT * FROM user_segment_progress WHERE user_id = ? AND practice_segment_id = ?',
      [user_id, practice_segment_id]
    );
    return rows[0] || null;
  }

  /**
   * Find all progress for a user's course
   */
  static async findByUserAndCourse(user_id, course_id) {
    const [rows] = await pool.execute(
      `SELECT usp.*, 
              s.name as segment_name, 
              ps.name as practice_segment_name,
              t.name as topic_name
       FROM user_segment_progress usp
       LEFT JOIN segments s ON usp.segment_id = s.id
       LEFT JOIN practice_segments ps ON usp.practice_segment_id = ps.id
       JOIN topics t ON usp.topic_id = t.id
       WHERE usp.user_id = ? AND usp.course_id = ?
       ORDER BY t.order_index, usp.segment_id, usp.practice_segment_id`,
      [user_id, course_id]
    );
    return rows;
  }

  /**
   * Find all progress for a user's topic
   */
  static async findByUserAndTopic(user_id, topic_id) {
    const [rows] = await pool.execute(
      `SELECT usp.*, 
              s.name as segment_name, 
              ps.name as practice_segment_name
       FROM user_segment_progress usp
       LEFT JOIN segments s ON usp.segment_id = s.id
       LEFT JOIN practice_segments ps ON usp.practice_segment_id = ps.id
       WHERE usp.user_id = ? AND usp.topic_id = ?`,
      [user_id, topic_id]
    );
    return rows;
  }

  /**
   * Get topic progress summary
   */
  static async getTopicProgressSummary(user_id, topic_id) {
    const [rows] = await pool.execute(
      `SELECT 
         COUNT(*) as total_segments,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_segments,
         SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_segments,
         AVG(progress_percentage) as avg_progress,
         SUM(score) as total_score,
         SUM(max_score) as total_max_score,
         SUM(time_spent_seconds) as total_time_spent
       FROM user_segment_progress
       WHERE user_id = ? AND topic_id = ?`,
      [user_id, topic_id]
    );
    return rows[0];
  }

  /**
   * Get course progress summary
   */
  static async getCourseProgressSummary(user_id, course_id) {
    const [rows] = await pool.execute(
      `SELECT 
         COUNT(*) as total_segments,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_segments,
         SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_segments,
         AVG(progress_percentage) as avg_progress,
         SUM(score) as total_score,
         SUM(max_score) as total_max_score,
         SUM(time_spent_seconds) as total_time_spent
       FROM user_segment_progress
       WHERE user_id = ? AND course_id = ?`,
      [user_id, course_id]
    );
    return rows[0];
  }
}

module.exports = UserSegmentProgress;

