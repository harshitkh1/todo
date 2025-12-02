const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// Create table if not exists
const initDb = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS entries (
      id SERIAL PRIMARY KEY,
      num1 INT NOT NULL,
      num2 INT NOT NULL
    );
  `);
};

initDb();

// Add entry
app.post("/add", async (req, res) => {
  const { num1, num2 } = req.body;

  const result = await pool.query(
    "INSERT INTO entries(num1, num2) VALUES ($1, $2) RETURNING *",
    [num1, num2]
  );

  res.json(result.rows[0]);
});

// Get all entries
app.get("/list", async (_, res) => {
  const result = await pool.query("SELECT * FROM entries ORDER BY id DESC");
  res.json(result.rows);
});

app.listen(5000, () => console.log("Backend running on port 5000"));
