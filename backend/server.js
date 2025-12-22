const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const client = require("prom-client");


const app = express();

// CORS setup
app.use(
  cors({
    origin: "http://todo.local",
    methods: ["GET", "POST", "OPTIONS"],
  })
);

app.use((req, res, next) => {
  res.on("finish", () => {
    httpRequestsTotal.inc({
      method: req.method,
      route: req.route?.path || req.path,
      status: res.statusCode,
    });
  });
  next();
});


app.use(express.json());

// Postgres connection
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Database initialization with retry
const initDb = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS entries (
        id SERIAL PRIMARY KEY,
        num1 INT NOT NULL,
        num2 INT NOT NULL
      );
    `);
    console.log("Database initialized");
  } catch (err) {
    console.error("Database not ready, retrying in 5s...", err.message);
    setTimeout(initDb, 5000);
  }
};
initDb();

// Prometheus metrics

const register = new client.Registry();

// collect default metrics
client.collectDefaultMetrics({ register });

// HTTP request counter
const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status"],
  registers: [register],
});

// Metrics endpoint
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

// Health check endpoint
app.get("/healthz", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).send("OK");
  } catch {
    res.status(500).send("DB not ready");
  }
});

// Add entry
app.post(["/api/add", "/add"], async (req, res) => {
  const { num1, num2 } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO entries(num1, num2) VALUES ($1, $2) RETURNING *",
      [num1, num2]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all entries
app.get(["/api/list", "/list"], async (_, res) => {
  try {
    const result = await pool.query("SELECT * FROM entries ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
