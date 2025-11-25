// --- Snakes & Ladders Backend ---
// Complete backend for Anthony Fenwick
// - Auto-creates all required tables
// - Player register/login/state/roll
// - Admin login/password change
// - Admin roll granting + prize settings
// - Designed to work with EdgeOne frontend calling this backend.

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

// -----------------------------------------------------------------------------
// APP SETUP
// -----------------------------------------------------------------------------
const app = express();
app.use(cors());
app.use(express.json());

// -----------------------------------------------------------------------------
// DATABASE SETUP
// -----------------------------------------------------------------------------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_SSL === "false"
      ? false
      : {
          rejectUnauthorized: false,
        },
});

// Helper: normalise email + area
function normaliseEmail(email) {
  return (email || "").trim().toLowerCase();
}

function normaliseArea(area) {
  return (area || "").trim().toUpperCase();
}

// Board mapping: 1–30 with snakes & ladders.
// Ladders: 3->22, 5->8, 11->26, 20->29
// Snakes: 17->4, 19->7, 27->1
const FINAL_SQUARE = 30;
const JUMPS = {
  3: 22,
  5: 8,
  11: 26,
  20: 29,
  17: 4,
  19: 7,
  27: 1,
};

function applyBoardJump(position) {
  return JUMPS[position] || position;
}

// Initialise DB: create tables & default admin user if needed
async function initDatabase() {
  // players table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS players (
      email TEXT NOT NULL,
      area TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      rolls_used INTEGER NOT NULL DEFAULT 0,
      rolls_granted INTEGER NOT NULL DEFAULT 0,
      completed BOOLEAN NOT NULL DEFAULT false,
      reward INTEGER,
      PRIMARY KEY (email, area)
    );
  `);

  // prize_config table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS prize_config (
      area TEXT PRIMARY KEY,
      winners INTEGER NOT NULL
    );
  `);

  // admin_credentials table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_credentials (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    );
  `);

  // Ensure a default admin user exists
  const defaultUsername = "admin";
  const defaultPassword = process.env.ADMIN_PASSWORD || "Admin123!";
  const existing = await pool.query(
    "SELECT id FROM admin_credentials WHERE username = $1",
    [defaultUsername]
  );
  if (existing.rows.length === 0) {
    const hash = await bcrypt.hash(defaultPassword, 10);
    await pool.query(
      "INSERT INTO admin_credentials (username, password_hash) VALUES ($1, $2)",
      [defaultUsername, hash]
    );
    console.log(
      `Initial admin user created with username "${defaultUsername}".`
    );
  }
}

initDatabase().catch((err) => {
  console.error("FATAL: Failed to initialise database", err);
  process.exit(1);
});

// -----------------------------------------------------------------------------
// PLAYER ROUTES
// -----------------------------------------------------------------------------

// Register new player (or ensure exists)
app.post("/player/register", async (req, res) => {
  try {
    let { email, area } = req.body;
    email = normaliseEmail(email);
    area = normaliseArea(area);

    if (!email || !area) {
      return res.status(400).json({ error: "Email and area are required." });
    }

    const existing = await pool.query(
      "SELECT email, area FROM players WHERE email = $1 AND area = $2",
      [email, area]
    );

    if (existing.rows.length === 0) {
      await pool.query(
        `
        INSERT INTO players (email, area, position, rolls_used, rolls_granted, completed, reward)
        VALUES ($1, $2, 0, 0, 0, false, NULL)
        `,
        [email, area]
      );
      console.log(`Registered new player ${email} (${area})`);
    } else {
      console.log(`Player ${email} (${area}) already registered.`);
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Player register error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// Player login
app.post("/player/login", async (req, res) => {
  try {
    let { email, area } = req.body;
    email = normaliseEmail(email);
    area = normaliseArea(area);

    if (!email || !area) {
      return res.status(400).json({ error: "Email and area are required." });
    }

    const result = await pool.query(
      "SELECT * FROM players WHERE email = $1 AND area = $2",
      [email, area]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Player not found. You may need to register first." });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Player login error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// Get player state
app.get("/player/state", async (req, res) => {
  try {
    let email = normaliseEmail(req.query.email);
    let area = normaliseArea(req.query.area);

    if (!email || !area) {
      return res.status(400).json({ error: "Email and area are required." });
    }

    const result = await pool.query(
      "SELECT * FROM players WHERE email = $1 AND area = $2",
      [email, area]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Player not found. You may need to register first." });
    }

    const row = result.rows[0];
    const availableRolls = Math.max(
      0,
      (row.rolls_granted || 0) - (row.rolls_used || 0)
    );

    return res.json({
      email: row.email,
      area: row.area,
      position: row.position,
      rollsUsed: row.rolls_used,
      rollsGranted: row.rolls_granted,
      availableRolls,
      completed: row.completed,
      reward: row.reward,
    });
  } catch (err) {
    console.error("Get player state error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// Player rolls dice + move
app.post("/player/roll", async (req, res) => {
  const client = await pool.connect();
  try {
    let { email, area } = req.body;
    email = normaliseEmail(email);
    area = normaliseArea(area);

    if (!email || !area) {
      client.release();
      return res.status(400).json({ error: "Email and area are required." });
    }

    await client.query("BEGIN");

    const result = await client.query(
      "SELECT * FROM players WHERE email = $1 AND area = $2 FOR UPDATE",
      [email, area]
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      client.release();
      return res
        .status(404)
        .json({ error: "Player not found. You may need to register first." });
    }

    const player = result.rows[0];

    if (player.completed) {
      await client.query("ROLLBACK");
      client.release();
      return res.status(400).json({ error: "Game already completed." });
    }

    const availableRolls =
      (player.rolls_granted || 0) - (player.rolls_used || 0);
    if (availableRolls <= 0) {
      await client.query("ROLLBACK");
      client.release();
      return res.status(400).json({ error: "No rolls remaining." });
    }

    // Roll dice 1–6
    const dice = Math.floor(Math.random() * 6) + 1;
    const fromPosition = player.position || 0;
    let newPosition = fromPosition + dice;
    if (newPosition > FINAL_SQUARE) {
      newPosition = FINAL_SQUARE;
    }
    newPosition = applyBoardJump(newPosition);

    let completed = player.completed;
    let reward = player.reward;

    if (!completed && newPosition >= FINAL_SQUARE) {
      completed = true;

      // Determine reward 10 or 25 based on prize_config
      // Default = 10
      let finalReward = 10;
      const areaConfig = await client.query(
        "SELECT winners FROM prize_config WHERE area = $1",
        [area]
      );
      if (areaConfig.rows.length > 0) {
        const max25 = areaConfig.rows[0].winners || 0;
        if (max25 > 0) {
          const used25 = await client.query(
            "SELECT COUNT(*) FROM players WHERE area = $1 AND reward = 25",
            [area]
          );
          const usedCount = parseInt(used25.rows[0].count, 10) || 0;
          if (usedCount < max25) {
            finalReward = 25;
          }
        }
      }
      reward = finalReward;
    }

    const updated = await client.query(
      `
      UPDATE players
      SET position = $1,
          rolls_used = rolls_used + 1,
          completed = $2,
          reward = $3
      WHERE email = $4 AND area = $5
      RETURNING position, rolls_used, rolls_granted, completed, reward
      `,
      [newPosition, completed, reward, email, area]
    );

    await client.query("COMMIT");
    client.release();

    const row = updated.rows[0];
    const remaining = Math.max(
      0,
      (row.rolls_granted || 0) - (row.rolls_used || 0)
    );

    return res.json({
      success: true,
      dice,
      fromPosition,
      toPosition: newPosition,
      position: row.position,
      rollsUsed: row.rolls_used,
      rollsGranted: row.rolls_granted,
      availableRolls: remaining,
      completed: row.completed,
      reward: row.reward,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    client.release();
    console.error("Player roll error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// -----------------------------------------------------------------------------
// ADMIN ROUTES
// -----------------------------------------------------------------------------

// List players for an area
app.get("/players", async (req, res) => {
  try {
    let area = normaliseArea(req.query.area);
    if (!area) {
      return res.status(400).json({ error: "Area is required." });
    }

    const result = await pool.query(
      `
      SELECT email, area, position, rolls_used, rolls_granted, completed, reward
      FROM players
      WHERE area = $1
      ORDER BY email ASC
      `,
      [area]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error("List players error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// Grant rolls to area or specific emails
app.post("/grant-rolls", async (req, res) => {
  try {
    let { area, emails, count } = req.body;
    area = normaliseArea(area);
    count = parseInt(count, 10);

    if (!area || !Number.isInteger(count) || count === 0) {
      return res
        .status(400)
        .json({ error: "Area and non-zero integer count are required." });
    }

    let query;
    let params;

    if (Array.isArray(emails) && emails.length > 0) {
      const normEmails = emails.map(normaliseEmail);
      query = `
        UPDATE players
        SET rolls_granted = GREATEST(0, rolls_granted + $1)
        WHERE area = $2 AND email = ANY($3::text[])
      `;
      params = [count, area, normEmails];
    } else {
      query = `
        UPDATE players
        SET rolls_granted = GREATEST(0, rolls_granted + $1)
        WHERE area = $2
      `;
      params = [count, area];
    }

    const result = await pool.query(query, params);
    return res.json({ success: true, affected: result.rowCount });
  } catch (err) {
    console.error("Grant rolls error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// Save prize settings for an area
app.post("/area/prize", async (req, res) => {
  try {
    let { area, count } = req.body;
    area = normaliseArea(area);
    count = parseInt(count, 10);

    if (!area || !Number.isInteger(count) || count < 0) {
      return res.status(400).json({
        error: "Area and a non-negative whole number of winners are required.",
      });
    }

    await pool.query(
      `
      INSERT INTO prize_config (area, winners)
      VALUES ($1, $2)
      ON CONFLICT (area)
      DO UPDATE SET winners = EXCLUDED.winners
      `,
      [area, count]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("Save prize config error:", err);
    return res.status(500).json({ error: "Failed to save prize config." });
  }
});

// Admin login
app.post("/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = (username || "admin").trim();

    if (!password) {
      return res.status(400).json({ error: "Password is required." });
    }

    const result = await pool.query(
      "SELECT * FROM admin_credentials WHERE username = $1",
      [user]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    const row = result.rows[0];
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Admin login error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// Change admin password
app.post("/admin/change-password", async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const username = "admin";

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: "Current and new passwords are required." });
    }

    const result = await pool.query(
      "SELECT * FROM admin_credentials WHERE username = $1",
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(500).json({ error: "Admin user not initialised." });
    }

    const row = result.rows[0];
    const ok = await bcrypt.compare(currentPassword, row.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Current password is incorrect." });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      "UPDATE admin_credentials SET password_hash = $1 WHERE username = $2",
      [newHash, username]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("Change admin password error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// -----------------------------------------------------------------------------
// HEALTH CHECK
// -----------------------------------------------------------------------------
app.get("/", (req, res) => {
  res.send("Snakes & Ladders backend running.");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
