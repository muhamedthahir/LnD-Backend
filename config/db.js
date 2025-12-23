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
  queueLimit: 0
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

// Database connection check
pool.getConnection()
  .then(conn => {
    console.log("MySQL Connected Successfully!");
    conn.release();
  })
  .catch(err => {
    console.error("MySQL Connection Failed:", err);
  });

module.exports = pool;
