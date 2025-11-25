// --- Snakes & Ladders Backend ---
// COMPLETE VERSION — Admin login fixed, change-password now fully functional
// Compatible with your current DB schema and frontend

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

// Helper for lowercase emails
function normaliseEmail(email) {
  return email.trim().toLowerCase();
}

// ----------------------------------------------------------------------------------
// ADMIN CREDENTIALS INITIALISATION (NEW)
// ----------------------------------------------------------------------------------

async function ensureAdminRow() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_credentials (
        id INTEGER PRIMARY KEY,
        username TEXT NOT NULL,
        password_hash TEXT NOT NULL
      );
    `);

    const row = await pool.query(`SELECT * FROM admin_credentials WHERE id=1`);

    if (row.rows.length === 0) {
      const defaultUser = "admin";
      const defaultPass = process.env.ADMIN_PASSWORD || "ChangeMe123!";
      const hash = await bcrypt.hash(defaultPass, 10);

      await pool.query(
        `INSERT INTO admin_credentials (id, username, password_hash)
         VALUES (1, $1, $2)`,
        [defaultUser, hash]
      );

      console.log("Admin default credentials created. Username: admin");
    }
  } catch (err) {
    console.error("Failed to ensure admin row:", err);
  }
}

ensureAdminRow();

// ----------------------------------------------------------------------------------
// ADMIN LOGIN — NOW SECURE + MATCHES YOUR NEW FRONTEND
// ----------------------------------------------------------------------------------

app.post("/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const row = await pool.query(
      `SELECT username, password_hash FROM admin_credentials WHERE id=1`
    );

    if (row.rows.length === 0) {
      return res.status(500).json({ error: "Admin credentials not found." });
    }

    const admin = row.rows[0];

    // Username check
    if (username !== admin.username) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    // Password check
    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Admin login error:", err);
    return res.status(500).json({ error: "Server error during admin login." });
  }
});

// ----------------------------------------------------------------------------------
// ADMIN CHANGE PASSWORD — NOW WORKING (no Render limitations)
// ----------------------------------------------------------------------------------

app.post("/admin/change-password", async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const row = await pool.query(
      `SELECT password_hash FROM admin_credentials WHERE id=1`
    );

    if (row.rows.length === 0) {
      return res.status(500).json({
        error: "Admin credentials missing.",
      });
    }

    const match = await bcrypt.compare(currentPassword, row.rows[0].password_hash);
    if (!match) {
      return res.status(401).json({ error: "Current password incorrect." });
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    await pool.query(
      `UPDATE admin_credentials SET password_hash=$1 WHERE id=1`,
      [newHash]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("Change password error:", err);
    return res.status(500).json({ error: "Server error changing password." });
  }
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
      return res.json({ success: true });
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
// PLAYER LOGIN
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
// PLAYER ROLL — SAME AS YOUR VERSION
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

    if (player.rolls_used >= player.rolls_granted + 6) {
      return res.status(400).json({ error: "No rolls left." });
    }

    let newPos = player.position + roll;

    const snakes = { 17: 4, 19: 7, 27: 1 };
    const ladders = { 3: 22, 5: 8, 11: 26, 20: 29 };

    if (snakes[newPos]) newPos = snakes[newPos];
    if (ladders[newPos]) newPos = ladders[newPos];

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
// LOAD USERS FOR AREA
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
// GRANT ROLLS
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
// UNDO GRANTS
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
// PRIZE CONFIG
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
