const pool = require('../config/db');
const UserSegmentProgress = require('./UserSegmentProgress');

class UserTopicProgress {
  /**
   * Create or update topic progress
   * @param {Object} data - progress data
   */
  static async createOrUpdate(data) {
    const {
      user_id,
      course_id,
      topic_id,
      status = 'not_started',
      progress_percentage = 0,
      segments_completed = 0,
      segments_total = 0,
      score = 0,
      max_score = 0,
      time_spent_seconds = 0
    } = data;
    
    const existing = await this.findByUserAndTopic(user_id, topic_id);
    
    if (existing) {
      let newStatus = status;
      let completed_at = existing.completed_at;
      let started_at = existing.started_at;
      
      if (progress_percentage >= 100) {
        newStatus = 'completed';
        completed_at = completed_at || new Date();
      } else if (progress_percentage > 0) {
        newStatus = 'in_progress';
      }
      
      if (!started_at && progress_percentage > 0) {
        started_at = new Date();
      }
      
      await pool.execute(
        `UPDATE user_topic_progress SET
           status = ?,
           progress_percentage = ?,
           segments_completed = ?,
           segments_total = ?,
           score = ?,
           max_score = ?,
           time_spent_seconds = ?,
           started_at = ?,
           completed_at = ?,
           last_updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [newStatus, progress_percentage, segments_completed, segments_total, 
         score, max_score, time_spent_seconds, started_at, completed_at, existing.id]
      );
      
      return existing.id;
    } else {
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
        `INSERT INTO user_topic_progress 
         (user_id, course_id, topic_id, status, progress_percentage, 
          segments_completed, segments_total, score, max_score, 
          time_spent_seconds, started_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [user_id, course_id, topic_id, newStatus, progress_percentage,
         segments_completed, segments_total, score, max_score,
         time_spent_seconds, started_at, completed_at]
      );
      
      return result.insertId;
    }
  }

  /**
   * Recalculate topic progress from segment progress
   * Uses average progress percentage across all segments for more accurate tracking
   */
  static async recalculateFromSegments(user_id, topic_id, course_id) {
    // Get segment progress summary
    const summary = await UserSegmentProgress.getTopicProgressSummary(user_id, topic_id);
    
    // Get total segments in topic (lessons + practice segments)
    const [totalSegments] = await pool.execute(
      `SELECT 
         (SELECT COUNT(*) FROM segments WHERE topic_id = ?) +
         (SELECT COUNT(*) FROM practice_segments WHERE topic_id = ?) as total`,
      [topic_id, topic_id]
    );
    
    const total = totalSegments[0]?.total || 0;
    const completed = summary?.completed_segments || 0;
    const trackedSegments = summary?.total_segments || 0;
    
    // Calculate progress based on average progress of tracked segments
    // Also factor in segments that haven't been started yet (count as 0%)
    let progress_percentage = 0;
    if (total > 0) {
      // Sum of all progress: tracked segments' total progress + untracked segments (0%)
      const totalProgress = (summary?.avg_progress || 0) * trackedSegments;
      progress_percentage = Math.min(Math.round(totalProgress / total), 100); // Cap at 100%
    }
    
    await this.createOrUpdate({
      user_id,
      course_id,
      topic_id,
      progress_percentage,
      segments_completed: completed,
      segments_total: total,
      score: summary?.total_score || 0,
      max_score: summary?.total_max_score || 0,
      time_spent_seconds: summary?.total_time_spent || 0
    });
    
    return progress_percentage;
  }

  /**
   * Find by user and topic
   */
  static async findByUserAndTopic(user_id, topic_id) {
    const [rows] = await pool.execute(
      'SELECT * FROM user_topic_progress WHERE user_id = ? AND topic_id = ?',
      [user_id, topic_id]
    );
    return rows[0] || null;
  }

  /**
   * Find all topic progress for a user's course
   */
  static async findByUserAndCourse(user_id, course_id) {
    const [rows] = await pool.execute(
      `SELECT utp.*, t.name as topic_name, t.order_index
       FROM user_topic_progress utp
       JOIN topics t ON utp.topic_id = t.id
       WHERE utp.user_id = ? AND utp.course_id = ?
       ORDER BY t.order_index`,
      [user_id, course_id]
    );
    return rows;
  }

  /**
   * Get course progress summary from topic progress
   */
  static async getCourseProgressSummary(user_id, course_id) {
    const [rows] = await pool.execute(
      `SELECT 
         COUNT(*) as total_topics,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_topics,
         SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_topics,
         AVG(progress_percentage) as avg_progress,
         SUM(segments_completed) as total_segments_completed,
         SUM(segments_total) as total_segments,
         SUM(score) as total_score,
         SUM(max_score) as total_max_score,
         SUM(time_spent_seconds) as total_time_spent
       FROM user_topic_progress
       WHERE user_id = ? AND course_id = ?`,
      [user_id, course_id]
    );
    return rows[0];
  }

  /**
   * Recalculate and update course progress
   * Uses average progress across all topics for accurate course progress tracking
   */
  static async updateCourseProgress(user_id, course_id) {
    const summary = await this.getCourseProgressSummary(user_id, course_id);
    
    // Get total topics in course
    const [totalTopics] = await pool.execute(
      'SELECT COUNT(*) as total FROM topics WHERE course_id = ?',
      [course_id]
    );
    
    const total = totalTopics[0]?.total || 0;
    const completed = summary?.completed_topics || 0;
    const trackedTopics = summary?.total_topics || 0;
    
    // Calculate progress based on average progress of tracked topics
    // Factor in topics that haven't been started yet (count as 0%)
    let progress_percentage = 0;
    if (total > 0) {
      // Sum of all progress: tracked topics' total progress + untracked topics (0%)
      const totalProgress = (summary?.avg_progress || 0) * trackedTopics;
      progress_percentage = Math.min(Math.round(totalProgress / total), 100); // Cap at 100%
    }
    
    // Determine status
    let status = 'not_started';
    if (progress_percentage >= 100 || (completed === total && total > 0)) {
      status = 'completed';
      progress_percentage = 100;
    } else if (progress_percentage > 0 || summary?.in_progress_topics > 0) {
      status = 'in_progress';
    }
    
    // Check if user_courses record exists
    const [existingRecord] = await pool.execute(
      'SELECT id FROM user_courses WHERE user_id = ? AND course_id = ?',
      [user_id, course_id]
    );
    
    if (existingRecord.length > 0) {
      // Update existing record
      await pool.execute(
        `UPDATE user_courses SET
           status = ?,
           progress_percentage = ?,
           last_accessed_at = CURRENT_TIMESTAMP,
           started_at = CASE WHEN started_at IS NULL AND ? > 0 THEN CURRENT_TIMESTAMP ELSE started_at END,
           completed_at = CASE WHEN ? = 'completed' AND completed_at IS NULL THEN CURRENT_TIMESTAMP ELSE completed_at END,
           updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND course_id = ?`,
        [status, progress_percentage, progress_percentage, status, user_id, course_id]
      );
    } else {
      // Create new record
      await pool.execute(
        `INSERT INTO user_courses (user_id, course_id, status, progress_percentage, started_at, last_accessed_at)
         VALUES (?, ?, ?, ?, CASE WHEN ? > 0 THEN CURRENT_TIMESTAMP ELSE NULL END, CURRENT_TIMESTAMP)`,
        [user_id, course_id, status, progress_percentage, progress_percentage]
      );
    }
    
    return { status, progress_percentage };
  }
}

module.exports = UserTopicProgress;

