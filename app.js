// app.js
const express = require('express');
const pool = require('./config/db.js');

const app = express();
app.use(express.json());

pool.getConnection()
  .then(conn => {
    console.log("✅ MySQL Connected Successfully!");
    conn.release();
  })
  .catch(err => {
    console.error("❌ MySQL Connection Failed:", err);
  });

app.get('/users', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute('SELECT id, name, email FROM users LIMIT 50');
    res.json(rows);
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: 'Database error' });
  } finally {
    if (connection) connection.release();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
