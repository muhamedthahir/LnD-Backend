// app.js
const express = require('express');
require('./config/db.js'); // Initialize database connection

// Initialize database tables
const CourseAdministration = require('./models/CourseAdministration');
CourseAdministration.createTable().catch(err => {
  console.error('Error creating course administrations table:', err);
});

const UserCourse = require('./models/UserCourse');
UserCourse.createTable().catch(err => {
  console.error('Error creating user courses table:', err);
});

const app = express();   

// CORS middleware - MUST be before other middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'https://dnv2vd007hcre.cloudfront.net',
    process.env.FRONTEND_URL
  ].filter(Boolean); // Remove undefined values
  
  // Determine if origin should be allowed
  let shouldAllowOrigin = false;
  if (origin) {
    if (allowedOrigins.includes(origin)) {
      shouldAllowOrigin = true;
    } else if (origin.includes('localhost:5173') || origin.includes('cloudfront.net')) {
      // Explicitly allow localhost:5173 and any cloudfront domains
      shouldAllowOrigin = true;
    }
  }
  
  // Always set CORS headers (browser requires them for preflight)
  if (shouldAllowOrigin && origin) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  
  // Handle preflight OPTIONS request - must return 200 with headers
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }
  
  next();
});

// Middleware
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

// Debug middleware to log request details for segment routes
app.use('/api/segments', (req, res, next) => {
  console.log(`[SEGMENT REQUEST] ${req.method} ${req.originalUrl}`);
  console.log(`[SEGMENT REQUEST] Content-Type: ${req.headers['content-type']}`);
  console.log(`[SEGMENT REQUEST] Auth header present: ${!!req.headers['authorization']}`);
  next();
});

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/courses', require('./routes/courseRoutes'));
app.use('/api/topics', require('./routes/topicRoutes'));
app.use('/api/segments', require('./routes/segmentRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/enrollments', require('./routes/enrollmentRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/groups', require('./routes/groupRoutes'));
app.use('/api/institutions', require('./routes/institutionRoutes'));
app.use('/api/administrations', require('./routes/administrationRoutes'));
app.use('/api/codeExecute', require('./routes/codeEditorRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));
app.use('/api/user-courses', require('./routes/userCourseRoutes'));

// Question Bank routes
app.use('/api/question-banks', require('./routes/questionBankRoutes'));
app.use('/api/questions', require('./routes/questionRoutes'));
app.use('/api/test-cases', require('./routes/testCaseRoutes'));
app.use('/api/master-data', require('./routes/masterDataRoutes'));

// Practice Segment routes
app.use('/api/practice-segments', require('./routes/practiceSegmentRoutes'));

// Submission routes
app.use('/api/submissions', require('./routes/submissionRoutes'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});
app.get('/', (req, res) => {
  res.send('Backend is running!');
});
app.get('/env-test', (req, res) => {
  res.json({
    DB_URL: process.env.DB_URL,
    FRONTEND_URL: process.env.FRONTEND_URL,
    DB_USER: process.env.DB_USER,
    USE_SSL: process.env.USE_SSL,
    SSL_CA_PATH: process.env.SSL_CA_PATH,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_REGION: process.env.AWS_REGION,
    S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
  });
});
// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  console.error('Error name:', err.name);
  console.error('Error code:', err.code);
  console.error('Error stack:', err.stack);
  
  // Handle Multer errors specifically
  if (err.name === 'MulterError') {
    console.error('Multer error detected:', err.message, err.code);
    return res.status(400).json({
      error: 'File upload error',
      message: err.message,
      code: err.code
    });
  }
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

