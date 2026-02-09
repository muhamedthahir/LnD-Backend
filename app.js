// app.js
const express = require('express');
const http = require('http');
require('./config/db.js'); // Initialize database connection
 
// Import WebSocket server for interactive code execution
const WebSocketServer = require('./services/WebSocketServer');

// Initialize database tables
const CourseAdministration = require('./models/CourseAdministration');
CourseAdministration.createTable().catch(err => {
  console.error('Error creating course administrations table:', err);
}); 

const UserCourse = require('./models/UserCourse');
UserCourse.createTable().catch(err => {
  console.error('Error creating user courses table:', err);
});

const MailerTemplate = require('./models/MailerTemplate');
MailerTemplate.createTable().catch(err => {
  console.error('Error creating mailer templates table:', err);
});

const UserDetails = require('./models/UserDetails');
UserDetails.createTable().catch(err => {
  console.error('Error creating user details table:', err);
});

const app = express();

// Shared allowed origins for CORS (used by main middleware, timeout, error, and 404 handlers)
const getAllowedOrigins = () => [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'https://dnv2vd007hcre.cloudfront.net',
  'https://practice.skillvantix.com',
  process.env.FRONTEND_URL
].filter(Boolean);

const isOriginAllowed = (origin) => {
  if (!origin) return null;
  const allowed = getAllowedOrigins();
  if (allowed.includes(origin)) return origin;
  if (origin.includes('localhost:5173') || origin.includes('cloudfront.net') || origin.includes('skillvantix.com')) return origin;
  return null;
};

const setCorsHeadersFromReq = (req, res) => {
  const origin = req.headers.origin;
  const allowedOrigin = isOriginAllowed(origin);
  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
};

// CORS middleware - MUST be before other middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigin = isOriginAllowed(origin);

  const setCorsHeaders = () => {
    if (allowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  };

  setCorsHeaders();

  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  const originalJson = res.json.bind(res);
  const originalStatus = res.status.bind(res);
  res.json = function (data) {
    setCorsHeaders();
    return originalJson(data);
  };
  res.status = function (code) {
    setCorsHeaders();
    return originalStatus(code);
  };

  next();
});

// Request timeout middleware - ensures requests don't hang indefinitely (25s to stay under CloudFront 30s)
app.use((req, res, next) => {
  req.setTimeout(25000, () => {
    if (!res.headersSent) {
      setCorsHeadersFromReq(req, res);
      res.status(504).json({
        error: 'Gateway Timeout',
        message: 'Request timed out. Please try again.'
      });
    }
  });
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

// Mailer Template routes
app.use('/api/mailer-templates', require('./routes/mailerTemplateRoutes'));

// User Details routes
app.use('/api/user-details', require('./routes/userDetailsRoutes'));

// Assessment routes
app.use('/api/assessment', require('./routes/assessmentRoutes'));

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

  setCorsHeadersFromReq(req, res);

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
  setCorsHeadersFromReq(req, res);
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 3000;

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket server for interactive code execution
WebSocketServer.initialize(server);
WebSocketServer.startHeartbeat();

// Add WebSocket status endpoint
app.get('/ws/status', (req, res) => {
  res.json(WebSocketServer.getStatus());
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`WebSocket: ws://localhost:${PORT}/ws/code-execute`);
});

