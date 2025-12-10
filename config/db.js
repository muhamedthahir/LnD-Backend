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
  poolOptions.ssl = {
    ca: fs.readFileSync(process.env.SSL_CA_PATH)
  };
  // Less strict (not recommended):
  // poolOptions.ssl = { rejectUnauthorized: false };
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
