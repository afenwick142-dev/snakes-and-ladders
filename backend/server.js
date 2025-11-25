// --- Snakes & Ladders Backend ---
// Final fully-working version for Anthony Fenwick
// Fixes: Admin login, roll granting, prize saving, lowercase emails, all routes matched to frontend.

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");

const app = express();
app.use(express.json());
app.use(cors());

// ----------------------------------------------------------------------------------
// DATABASE
// ----------------------------------------------------------------------------------

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Lowercase helper
function normaliseEmail(email) {
  return email.trim().toLowerCase();
}

// ----------------------------------------------------------------------------------
// ADMIN LOGIN  (FIXED – now uses plain-text admin password from Render env)
// ----------------------------------------------------------------------------------

app.post("/admin/login", (req, res) => {
  try {
    const submitted = req.body.password;
    const actual = process.env.ADMIN_PASSWORD;

    if (!actual) {
      return res.status(500).json({ error: "Admin password not set on server." });
    }

    if (submitted === actual) {
      return res.json({ success: true });
    }

    return res.status(401).json({ error: "Failed to verify admin password." });
  } catch (err) {
    console.error("Admin login error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// ----------------------------------------------------------------------------------
// CHANGE ADMIN PASSWORD (does NOT work on free Render – message only)
// ----------------------------------------------------------------------------------

app.post("/admin/change-password", (req, res) => {
  return res.json({
    error:
      "Admin password must be changed in Render → Environment Variables. Cannot modify from the admin portal.",
  });
});

// ----------------------------------------------------------------------------------
// PLAYER REGISTER
// ----------------------------------------------------------------------------------

app.post("/player/register", async (req, res) => {
  try {
    let { email, area } = req.body;
    email = normaliseEmail(email);

    const existing = await pool.query("SELECT * FROM players WHERE email=$1", [
      email,
    ]);

    if (existing.rows.length > 0) {
      return res.json({ success: true }); // Already exists, allowed
    }

    await pool.query(
      `INSERT INTO players (email, area, position, rolls_used, rolls_granted, completed, reward)
       VALUES ($1, $2, 0, 0, 0, false, null)`,
      [email, area]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// ----------------------------------------------------------------------------------
// PLAYER LOGIN (case-insensitive email fixed)
// ----------------------------------------------------------------------------------

app.post("/player/login", async (req, res) => {
  try {
    let { email, area } = req.body;
    email = normaliseEmail(email);

    const result = await pool.query(
      "SELECT * FROM players WHERE email=$1 AND area=$2",
      [email, area]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Player not found." });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Player login error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// ----------------------------------------------------------------------------------
// GET PLAYER STATE
// ----------------------------------------------------------------------------------

app.get("/player/state", async (req, res) => {
  try {
    let email = normaliseEmail(req.query.email);
    const area = req.query.area;

    const result = await pool.query(
      "SELECT * FROM players WHERE email=$1 AND area=$2",
      [email, area]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Player not found." });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error("State error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// ----------------------------------------------------------------------------------
// PLAYER ROLL (game logic unchanged – using your current logic)
// ----------------------------------------------------------------------------------

app.post("/player/roll", async (req, res) => {
  try {
    let email = normaliseEmail(req.body.email);
    const area = req.body.area;
    const roll = req.body.roll;

    const playerRes = await pool.query(
      "SELECT * FROM players WHERE email=$1 AND area=$2",
      [email, area]
    );

    if (playerRes.rows.length === 0) {
      return res.status(404).json({ error: "Player not found." });
    }

    const player = playerRes.rows[0];

    // Rolls remaining
    if (player.rolls_used >= player.rolls_granted + 6) {
      return res.status(400).json({ error: "No rolls left." });
    }

    let newPos = player.position + roll;

    // Snakes & Ladders
    const snakes = { 17: 4, 19: 7, 27: 1 };
    const ladders = { 3: 22, 5: 8, 11: 26, 20: 29 };

    if (snakes[newPos]) newPos = snakes[newPos];
    if (ladders[newPos]) newPos = ladders[newPos];

    // Clamp at 30
    if (newPos >= 30) newPos = 30;

    const completed = newPos === 30;

    await pool.query(
      `UPDATE players
       SET position=$1,
           rolls_used=rolls_used+1,
           completed=$2
       WHERE email=$3 AND area=$4`,
      [newPos, completed, email, area]
    );

    return res.json({ position: newPos, completed });
  } catch (err) {
    console.error("Roll error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// ----------------------------------------------------------------------------------
// LOAD USERS FOR AN AREA
// ----------------------------------------------------------------------------------

app.get("/players", async (req, res) => {
  try {
    const area = req.query.area;
    const result = await pool.query(
      "SELECT * FROM players WHERE area=$1 ORDER BY email ASC",
      [area]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error("Load users error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// ----------------------------------------------------------------------------------
// GRANT ROLLS TO SELECTED / AREA
// ----------------------------------------------------------------------------------

app.post("/grant-rolls", async (req, res) => {
  try {
    const { emails, area, count } = req.body;

    if (emails && emails.length > 0) {
      for (let raw of emails) {
        let email = normaliseEmail(raw);
        await pool.query(
          `UPDATE players
           SET rolls_granted = rolls_granted + $1
           WHERE email=$2 AND area=$3`,
          [count, email, area]
        );
      }
    } else {
      await pool.query(
        `UPDATE players
         SET rolls_granted = rolls_granted + $1
         WHERE area=$2`,
        [count, area]
      );
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Grant rolls error:", err);
    return res.status(500).json({ error: "Error granting rolls." });
  }
});

// ----------------------------------------------------------------------------------
// UNDO LAST GRANT
// ----------------------------------------------------------------------------------

app.post("/undo-rolls", async (req, res) => {
  try {
    const { area, count } = req.body;

    await pool.query(
      `UPDATE players
       SET rolls_granted = GREATEST(rolls_granted - $1, 0)
       WHERE area=$2`,
      [count, area]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("Undo roll error:", err);
    return res.status(500).json({ error: "Error undoing roll grant." });
  }
});

// ----------------------------------------------------------------------------------
// PRIZE CONFIG (FIXED)
// ----------------------------------------------------------------------------------

app.post("/area/prize", async (req, res) => {
  try {
    const { area, count } = req.body;

    await pool.query(
      `INSERT INTO prize_config (area, winners)
       VALUES ($1, $2)
       ON CONFLICT (area)
       DO UPDATE SET winners = EXCLUDED.winners`,
      [area, count]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("Prize save error:", err);
    return res.status(500).json({ error: "Failed to save prize config." });
  }
});

// ----------------------------------------------------------------------------------

app.get("/", (req, res) => {
  res.send("Snakes & Ladders backend running.");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`Backend running on port ${PORT}`)
);
