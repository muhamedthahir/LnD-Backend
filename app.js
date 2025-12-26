// app.js
const express = require('express');
require('./config/db.js'); // Initialize database connection

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
  
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else if (origin && (origin.includes('localhost:5173') || origin.includes('cloudfront.net'))) {
    // Explicitly allow localhost:5173 and cloudfront domains
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
  });
});
// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  console.error('Error stack:', err.stack);
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

