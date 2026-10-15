# LnD Backend - EdTech Platform

A RESTful backend API for an EdTech platform built with Node.js, Express, and MySQL, organized in MVC architecture.

## Features

- **User Management**: Support for multiple user roles (student, college_admin, primary_admin)
- **Course Management**: Create and manage courses with topics and segments
- **Content Structure**: 
  - Courses → Topics → Segments
  - Segments contain: Concepts, InClass Practice, PostClass Practice
- **Segment Types**: coding, mcq, reference_videos, articles, assessment
- **Student Enrollment**: Students can enroll in multiple courses
- **Authentication**: JWT-based authentication
- **Authorization**: Role-based access control

## Project Structure

```
LnD-Backend/
├── app.js                 # Main application entry point
├── config/
│   └── db.js             # Database configuration
├── models/               # Data models
│   ├── User.js
│   ├── Course.js
│   ├── Topic.js
│   ├── Segment.js
│   ├── Concept.js
│   ├── InClassPractice.js
│   ├── PostClassPractice.js
│   └── Enrollment.js
├── controllers/          # Business logic
│   ├── authController.js
│   ├── courseController.js
│   ├── topicController.js
│   ├── segmentController.js
│   └── dashboardController.js
├── routes/              # API routes
│   ├── authRoutes.js
│   ├── courseRoutes.js
│   ├── topicRoutes.js
│   ├── segmentRoutes.js
│   └── dashboardRoutes.js
├── middleware/          # Custom middleware
│   └── auth.js
└── database/
    └── schema.sql       # Database schema
```

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment Variables**
   Create a `.env` file in the root directory:
   ```env
   DB_HOST=localhost
   DB_USER=your_db_user
   DB_PASS=your_db_password
   DB_NAME=your_database_name
   DB_PORT=3306
   JWT_SECRET=your-secret-key-change-in-production
   PORT=3000
   ```

3. **Create Database**
   Run the SQL schema file to create all necessary tables:
   ```bash
   mysql -u your_user -p your_database < database/schema.sql
   ```

4. **Start Server**
   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm start
   ```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get current user profile (requires auth)

### Courses
- `GET /api/courses` - Get all courses (requires auth)
- `GET /api/courses/:id` - Get course by ID (requires auth)
- `GET /api/courses/my-courses` - Get enrolled courses (student only)
- `POST /api/courses` - Create course (admin only)
- `PUT /api/courses/:id` - Update course (admin only)
- `DELETE /api/courses/:id` - Delete course (admin only)
- `POST /api/courses/enroll` - Enroll in a course (student only)

### Topics
- `GET /api/topics/course/:course_id` - Get topics by course (requires auth)
- `GET /api/topics/:id` - Get topic by ID (requires auth)
- `POST /api/topics` - Create topic (admin only)
- `PUT /api/topics/:id` - Update topic (admin only)
- `DELETE /api/topics/:id` - Delete topic (admin only)

### Segments
- `GET /api/segments/topic/:topic_id` - Get segments by topic (requires auth)
- `GET /api/segments/:id` - Get segment by ID with related data (requires auth)
- `POST /api/segments` - Create segment (admin only)
- `PUT /api/segments/:id` - Update segment (admin only)
- `DELETE /api/segments/:id` - Delete segment (admin only)
- `POST /api/segments/:segment_id/concepts` - Add concept to segment (admin only)
- `POST /api/segments/:segment_id/inclass-practice` - Add in-class practice (admin only)
- `POST /api/segments/:segment_id/postclass-practice` - Add post-class practice (admin only)

### Dashboard
- `GET /api/dashboard/student` - Get student dashboard (student only)
- `GET /api/dashboard/admin` - Get admin dashboard (admin only)

## User Roles

- **student**: Can view courses, enroll, access course content
- **college_admin**: Can create and manage courses, topics, segments
- **primary_admin**: Full administrative access
- **campuszen_admin**: Same access as primary_admin

## Authentication

All protected routes require a JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Segment Types

When creating a segment, you must specify one of these types:
- `coding` - Coding exercises
- `mcq` - Multiple choice questions
- `reference_videos` - Reference video content
- `articles` - Article content
- `assessment` - Assessment/quiz

## Example Request

### Register a User
```bash
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "role": "student"
}
```

### Create a Course (Admin)
```bash
POST /api/courses
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "name": "Introduction to JavaScript",
  "description": "Learn the basics of JavaScript programming"
}
```

### Create a Segment (Admin)
```bash
POST /api/segments
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "topic_id": 1,
  "name": "Variables and Data Types",
  "description": "Understanding JavaScript variables",
  "segment_type": "coding",
  "order_index": 1,
  "content": {}
}
```

## License

ISC

