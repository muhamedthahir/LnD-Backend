// db.js
const mysql = require('mysql2/promise');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

const poolOptions = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Connection timeout settings
  connectTimeout: 60000, // 60 seconds
  acquireTimeout: 60000, // 60 seconds
  timeout: 60000, // 60 seconds
  // Enable automatic reconnection
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  // Retry configuration
  reconnect: true,
  // Handle connection errors
  handleDisconnects: true
};
// Optional SSL configuration
if (process.env.USE_SSL === 'true') {
  // For RDS, we use rejectUnauthorized: false to handle self-signed certificates
  // For production with proper certificates, you can set SSL_CA_PATH and remove rejectUnauthorized: false
  // Note: For production, consider downloading RDS CA bundle from:
  // https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
  const sslCaPath = process.env.SSL_CA_PATH;
  if (sslCaPath && fs.existsSync(sslCaPath)) {
    try {
      // Even with CA file, we use rejectUnauthorized: false for RDS compatibility
      poolOptions.ssl = {
        ca: fs.readFileSync(sslCaPath),
        rejectUnauthorized: false
      };
      console.log(`Using SSL certificate from: ${sslCaPath} (with rejectUnauthorized: false)`);
    } catch (error) {
      console.warn(`Failed to read SSL certificate from ${sslCaPath}, using rejectUnauthorized: false`);
      poolOptions.ssl = { rejectUnauthorized: false };
    }
  } else {
    // Less strict SSL (works for RDS without CA bundle)
    poolOptions.ssl = { rejectUnauthorized: false };
    if (sslCaPath) {
      console.warn(`SSL_CA_PATH specified (${sslCaPath}) but file not found, using rejectUnauthorized: false`);
    }
  }
}

const pool = mysql.createPool(poolOptions);

// Handle pool errors
pool.on('connection', (connection) => {
  console.log('New MySQL connection established');
  
  connection.on('error', (err) => {
    console.error('MySQL connection error:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET') {
      console.log('Connection lost, will be reconnected automatically');
    } else {
      throw err;
    }
  });
});

pool.on('error', (err) => {
  console.error('MySQL pool error:', err);
  if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET') {
    console.log('Pool connection lost, attempting to reconnect...');
  }
});

// Database connection check with retry
async function checkConnection(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const conn = await pool.getConnection();
      console.log("MySQL Connected Successfully!");
      conn.release();
      return;
    } catch (err) {
      console.error(`MySQL Connection Failed (attempt ${i + 1}/${retries}):`, err.message);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
      } else {
        console.error("MySQL Connection Failed after all retries:", err);
      }
    }
  }
}

checkConnection();

// Helper function to execute queries with retry logic
async function executeWithRetry(query, params, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await pool.execute(query, params);
    } catch (error) {
      // Handle connection reset errors
      if ((error.code === 'ECONNRESET' || error.code === 'PROTOCOL_CONNECTION_LOST') && i < retries - 1) {
        console.log(`Connection reset, retrying query (attempt ${i + 1}/${retries})...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
        continue;
      }
      throw error;
    }
  }
}

module.exports = pool;
module.exports.executeWithRetry = executeWithRetry;
