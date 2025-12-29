// Script to update FOP Java course status to published
const { pool, executeWithRetry } = require('../config/db');
const dotenv = require('dotenv');
dotenv.config();

async function updateFOPJavaCourseStatus() {
  const courseNameToUpdate = "FOP java"; // The course name provided by the user
  const newStatus = "published";

  try {
    // Find the course by name (case-insensitive)
    const [courses] = await executeWithRetry(
      'SELECT id, name, status FROM courses WHERE LOWER(name) LIKE ?',
      [`%${courseNameToUpdate.toLowerCase()}%`]
    );

    if (courses.length === 0) {
      console.log(`No course found with name containing: "${courseNameToUpdate}"`);
      // Try exact match
      const [exactCourses] = await executeWithRetry(
        'SELECT id, name, status FROM courses WHERE name = ?',
        [courseNameToUpdate]
      );
      
      if (exactCourses.length === 0) {
        console.log('No courses found. Listing all courses:');
        const [allCourses] = await executeWithRetry('SELECT id, name, status FROM courses');
        allCourses.forEach(course => {
          console.log(`- ID: ${course.id}, Name: "${course.name}", Status: ${course.status}`);
        });
        return;
      }
      
      courses.push(...exactCourses);
    }

    console.log('Found courses:');
    courses.forEach(course => {
      console.log(`- ID: ${course.id}, Name: "${course.name}", Current Status: ${course.status}`);
    });

    const courseIdsToUpdate = courses.map(course => course.id);

    // Update the status
    const [result] = await executeWithRetry(
      `UPDATE courses SET status = ? WHERE id IN (${courseIdsToUpdate.map(() => '?').join(',')})`,
      [newStatus, ...courseIdsToUpdate]
    );

    if (result.affectedRows > 0) {
      console.log(`\n✓ Updated ${result.affectedRows} course(s) to "${newStatus}" status`);
      // Verify the update
      const [updatedCourses] = await executeWithRetry(
        `SELECT id, name, status FROM courses WHERE id IN (${courseIdsToUpdate.map(() => '?').join(',')})`,
        courseIdsToUpdate
      );
      console.log('\nUpdated courses:');
      updatedCourses.forEach(course => {
        console.log(`- ID: ${course.id}, Name: "${course.name}", Status: ${course.status}`);
      });
    } else {
      console.log('No courses were updated.');
    }
  } catch (error) {
    console.error('Error updating course status:', error);
  } finally {
    pool.end();
  }
}

updateFOPJavaCourseStatus();
