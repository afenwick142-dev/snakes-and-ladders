// server.js
// --- Snakes & Ladders Backend ---
// Complete backend for Anthony Fenwick
// - Auto-creates all required tables
// - Player register/login/state/roll
// - Admin login/password change
// - Admin roll granting + prize settings + undo
// - Player reset & delete
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
// DATABASE CONNECTION
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

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------
function normaliseEmail(email) {
  return (email || "").trim().toLowerCase();
}

function normaliseArea(area) {
  return (area || "").trim().toUpperCase();
}

// Board constants
const FINAL_SQUARE = 30;
const JUMPS = {
  3: 22,
  5: 8,
  11: 26,
  20: 29,
  17: 4,
  19: 7,
  21: 9, // NEW snake
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
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      PRIMARY KEY (email, area)
    );
  `);

  // admin_users table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  // prize_config table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS prize_config (
      area TEXT PRIMARY KEY,
      winners INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  // grant_history table (for undo last grant)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS grant_history (
      id SERIAL PRIMARY KEY,
      admin_username TEXT NOT NULL,
      area TEXT NOT NULL,
      emails TEXT[] NOT NULL,
      rolls_granted INTEGER NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  // ensure default admin user
  const adminRes = await pool.query(
    "SELECT * FROM admin_users WHERE username = $1",
    ["admin"]
  );
  if (adminRes.rows.length === 0) {
    const passwordHash = await bcrypt.hash("Admin123!", 10);
    await pool.query(
      "INSERT INTO admin_users (username, password_hash) VALUES ($1, $2)",
      ["admin", passwordHash]
    );
    console.log("Default admin user created with password Admin123!");
  }

  // ensure SW1–SW19 prize config rows exist
  for (let i = 1; i <= 19; i++) {
    const area = `SW${i}`;
    const configRes = await pool.query(
      "SELECT * FROM prize_config WHERE area = $1",
      [area]
    );
    if (configRes.rows.length === 0) {
      await pool.query(
        "INSERT INTO prize_config (area, winners) VALUES ($1, $2)",
        [area, 0]
      );
    }
  }
}

// Run DB init
initDatabase().catch((err) => {
  console.error("Error initialising database:", err);
  process.exit(1);
});

// -----------------------------------------------------------------------------
// PLAYER ROUTES
// -----------------------------------------------------------------------------

// Register a player (idempotent)
app.post("/player/register", async (req, res) => {
  try {
    let { email, area } = req.body;
    email = normaliseEmail(email);
    area = normaliseArea(area);

    if (!email || !area) {
      return res.status(400).json({ error: "Email and area are required." });
    }

    // Upsert style: if not exists, create with 6 rolls granted, 0 used.
    await pool.query(
      `
      INSERT INTO players (email, area, position, rolls_used, rolls_granted, completed, reward)
      VALUES ($1, $2, 0, 0, 6, false, NULL)
      ON CONFLICT (email, area)
      DO NOTHING
      `,
      [email, area]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("Player register error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// Player login check
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
    const availableRolls =
      (row.rolls_granted || 0) - (row.rolls_used || 0);

    return res.json({
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

    // Roll dice 1–6 with guaranteed finish on final roll
    const totalGranted = player.rolls_granted || 0;
    const usedSoFar = player.rolls_used || 0;
    const remainingRolls = totalGranted - usedSoFar;

    const fromPosition = player.position || 0;
    const squaresToFinish = FINAL_SQUARE - fromPosition;

    let dice;
    if (remainingRolls === 1 && squaresToFinish >= 1 && squaresToFinish <= 6) {
      // Last available roll and within reach: force exact number to finish
      dice = squaresToFinish;
    } else {
      dice = Math.floor(Math.random() * 6) + 1;
    }

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
      position: row.position,
      rollsUsed: row.rolls_used,
      rollsGranted: row.rolls_granted,
      remainingRolls: remaining,
      completed: row.completed,
      reward: row.reward,
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    client.release();
    console.error("Player roll error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// Reset a player's progress in a given area
app.post("/player/reset", async (req, res) => {
  try {
    let { email, area } = req.body;
    email = normaliseEmail(email);
    area = normaliseArea(area);

    if (!email || !area) {
      return res.status(400).json({ error: "Email and area are required." });
    }

    await pool.query(
      `
      UPDATE players
      SET position = 0,
          rolls_used = 0,
          completed = false,
          reward = NULL
      WHERE email = $1 AND area = $2
      `,
      [email, area]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("Player reset error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// Delete a player (for admin use mostly)
app.post("/player/delete", async (req, res) => {
  try {
    let { email, area } = req.body;
    email = normaliseEmail(email);
    area = normaliseArea(area);

    if (!email || !area) {
      return res.status(400).json({ error: "Email and area are required." });
    }

    await pool.query("DELETE FROM players WHERE email = $1 AND area = $2", [
      email,
      area,
    ]);

    return res.json({ success: true });
  } catch (err) {
    console.error("Player delete error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// -----------------------------------------------------------------------------
// ADMIN AUTH
// -----------------------------------------------------------------------------
app.post("/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const userRes = await pool.query(
      "SELECT * FROM admin_users WHERE username = $1",
      [username]
    );
    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    const admin = userRes.rows[0];
    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Admin login error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

app.post("/admin/change-password", async (req, res) => {
  try {
    const { username, oldPassword, newPassword } = req.body;
    const userRes = await pool.query(
      "SELECT * FROM admin_users WHERE username = $1",
      [username]
    );
    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    const admin = userRes.rows[0];
    const match = await bcrypt.compare(oldPassword, admin.password_hash);
    if (!match) {
      return res.status(401).json({ error: "Old password is incorrect." });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      "UPDATE admin_users SET password_hash = $1 WHERE id = $2",
      [newHash, admin.id]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("Admin change-password error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// -----------------------------------------------------------------------------
// ADMIN: PLAYERS & ROLLS
// -----------------------------------------------------------------------------

// List players by area
app.get("/admin/players", async (req, res) => {
  try {
    const area = normaliseArea(req.query.area);
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

    return res.json({ players: result.rows });
  } catch (err) {
    console.error("Admin get players error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// Grant rolls to all in area or selected list
app.post("/admin/grant-rolls", async (req, res) => {
  const client = await pool.connect();
  try {
    const { adminUsername, area, extraRolls, emails } = req.body;
    const normArea = normaliseArea(area);

    if (!normArea || !extraRolls || extraRolls <= 0) {
      client.release();
      return res
        .status(400)
        .json({ error: "Area and a positive number of extra rolls are required." });
    }

    await client.query("BEGIN");

    let updatedEmails = [];

    if (Array.isArray(emails) && emails.length > 0) {
      // Grant to selected players
      const normEmails = emails.map(normaliseEmail);
      const result = await client.query(
        `
        UPDATE players
        SET rolls_granted = rolls_granted + $1
        WHERE area = $2 AND email = ANY($3::text[])
        RETURNING email
        `,
        [extraRolls, normArea, normEmails]
      );
      updatedEmails = result.rows.map((r) => r.email);
    } else {
      // Grant to all players in area
      const result = await client.query(
        `
        UPDATE players
        SET rolls_granted = rolls_granted + $1
        WHERE area = $2
        RETURNING email
        `,
        [extraRolls, normArea]
      );
      updatedEmails = result.rows.map((r) => r.email);
    }

    if (updatedEmails.length > 0) {
      await client.query(
        `
        INSERT INTO grant_history (admin_username, area, emails, rolls_granted)
        VALUES ($1, $2, $3, $4)
        `,
        [adminUsername || "admin", normArea, updatedEmails, extraRolls]
      );
    }

    await client.query("COMMIT");
    client.release();

    return res.json({ success: true, updatedEmails });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    client.release();
    console.error("Admin grant-rolls error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// Undo last grant for area
app.post("/admin/undo-last-grant", async (req, res) => {
  const client = await pool.connect();
  try {
    const { area } = req.body;
    const normArea = normaliseArea(area);

    if (!normArea) {
      client.release();
      return res.status(400).json({ error: "Area is required." });
    }

    await client.query("BEGIN");

    const lastGrantRes = await client.query(
      `
      SELECT * FROM grant_history
      WHERE area = $1
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [normArea]
    );

    if (lastGrantRes.rows.length === 0) {
      await client.query("ROLLBACK");
      client.release();
      return res.status(404).json({ error: "No previous grant found for this area." });
    }

    const lastGrant = lastGrantRes.rows[0];

    await client.query(
      `
      UPDATE players
      SET rolls_granted = GREATEST(0, rolls_granted - $1)
      WHERE area = $2 AND email = ANY($3::text[])
      `,
      [lastGrant.rolls_granted, normArea, lastGrant.emails]
    );

    await client.query("DELETE FROM grant_history WHERE id = $1", [
      lastGrant.id,
    ]);

    await client.query("COMMIT");
    client.release();

    return res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    client.release();
    console.error("Admin undo-last-grant error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// -----------------------------------------------------------------------------
// ADMIN: PRIZE CONFIG
// -----------------------------------------------------------------------------

// Get prize config for an area
app.get("/admin/prize-config", async (req, res) => {
  try {
    const area = normaliseArea(req.query.area);
    if (!area) {
      return res.status(400).json({ error: "Area is required." });
    }

    const result = await pool.query(
      "SELECT area, winners FROM prize_config WHERE area = $1",
      [area]
    );
    if (result.rows.length === 0) {
      return res.json({ area, winners: 0 });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error("Admin get prize-config error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// Set prize config (max £25 winners) for an area
app.post("/admin/prize-config", async (req, res) => {
  try {
    const area = normaliseArea(req.body.area);
    const winners = parseInt(req.body.winners, 10);

    if (!area || isNaN(winners) || winners < 0) {
      return res
        .status(400)
        .json({ error: "Area and a non-negative winners value are required." });
    }

    await pool.query(
      `
      INSERT INTO prize_config (area, winners)
      VALUES ($1, $2)
      ON CONFLICT (area)
      DO UPDATE SET winners = EXCLUDED.winners
      `,
      [area, winners]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("Admin set prize-config error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// -----------------------------------------------------------------------------
// SERVER START
// -----------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Snakes & Ladders backend running on port ${PORT}`);
});

