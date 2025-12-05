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
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DB_SSL === "false"
      ? false
      : {
          rejectUnauthorized: false,
        },
});

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

function normaliseEmail(email) {
  if (!email) return "";
  return String(email).trim().toLowerCase();
}

function normaliseArea(area) {
  if (!area) return "";
  return String(area).trim().toUpperCase();
}

const FINAL_SQUARE = 30;

// -----------------------------------------------------------------------------
// DB INITIALISATION
// -----------------------------------------------------------------------------

async function initDb() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS players (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL,
        area TEXT NOT NULL,
        position INTEGER NOT NULL DEFAULT 0,
        rolls_used INTEGER NOT NULL DEFAULT 0,
        rolls_granted INTEGER NOT NULL DEFAULT 0,
        completed BOOLEAN NOT NULL DEFAULT FALSE,
        reward INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_players_email_area
      ON players (email, area);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS grant_history (
        id SERIAL PRIMARY KEY,
        admin_username TEXT NOT NULL,
        area TEXT NOT NULL,
        emails TEXT[] NOT NULL,
        rolls_granted INTEGER NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS prize_config (
        id SERIAL PRIMARY KEY,
        area TEXT UNIQUE NOT NULL,
        winners INTEGER NOT NULL DEFAULT 0
      );
    `);

    // Default admin
    const adminRes = await client.query(
      "SELECT * FROM admin_users WHERE username = $1",
      ["admin"]
    );
    if (adminRes.rows.length === 0) {
      const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || "Snakes2025";
      const hash = await bcrypt.hash(defaultPassword, 10);
      await client.query(
        "INSERT INTO admin_users (username, password_hash) VALUES ($1, $2)",
        ["admin", hash]
      );
      console.log("Created default admin user with username 'admin'.");
    }

    // Default prize config for SW1–SW19
    for (let i = 1; i <= 19; i++) {
      const area = `SW${i}`;
      const configRes = await client.query(
        "SELECT * FROM prize_config WHERE area = $1",
        [area]
      );
      if (configRes.rows.length === 0) {
        await client.query(
          "INSERT INTO prize_config (area, winners) VALUES ($1, $2)",
          [area, 0]
        );
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("DB init error:", err);
  } finally {
    client.release();
  }
}

initDb().catch((err) => console.error("initDb failed:", err));

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

// Change password – always for the single 'admin' user
app.post("/admin/change-password", async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userRes = await pool.query(
      "SELECT * FROM admin_users WHERE username = $1",
      ["admin"]
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
// PLAYER ENDPOINTS
// -----------------------------------------------------------------------------

app.post("/player/register", async (req, res) => {
  const client = await pool.connect();
  try {
    let { email, area } = req.body;
    email = normaliseEmail(email);
    area = normaliseArea(area);

    if (!email || !area) {
      client.release();
      return res.status(400).json({ error: "Email and area are required." });
    }

    const existing = await client.query(
      "SELECT * FROM players WHERE email = $1 AND area = $2",
      [email, area]
    );

    if (existing.rows.length > 0) {
      client.release();
      return res.json({ success: true, player: existing.rows[0] });
    }

    const inserted = await client.query(
      `
      INSERT INTO players (email, area, position, rolls_used, rolls_granted, completed)
      VALUES ($1, $2, 0, 0, 6, FALSE)
      RETURNING *
      `,
      [email, area]
    );

    client.release();
    return res.json({ success: true, player: inserted.rows[0] });
  } catch (err) {
    client.release();
    console.error("Player register error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// Snakes and ladders layout
function applyBoardJump(pos) {
  const snakes = {
    17: 4,
    19: 7,
    21: 9, // extra snake you mentioned
    27: 1,
  };

  const ladders = {
    3: 22,
    5: 8,
    11: 26,
    20: 29,
  };

  if (ladders[pos]) return ladders[pos];
  if (snakes[pos]) return snakes[pos];
  return pos;
}

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
      return res.status(404).json({ error: "Player not found." });
    }

    const player = result.rows[0];

    const totalRollsAllowed = player.rolls_granted;
    const rollsUsed = player.rolls_used;

    if (player.completed) {
      await client.query("ROLLBACK");
      client.release();
      return res.status(400).json({ error: "Game already completed." });
    }

    const remainingRolls = totalRollsAllowed - rollsUsed;
    if (remainingRolls <= 0) {
      await client.query("ROLLBACK");
      client.release();
      return res.status(400).json({ error: "No rolls remaining." });
    }

    const fromPosition = player.position || 0;
    const squaresToFinish = FINAL_SQUARE - fromPosition;

    let dice;
    if (
      remainingRolls === 1 &&
      squaresToFinish >= 1 &&
      squaresToFinish <= 6
    ) {
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
      // Default = 10, but use random allocation for 25s while stock remains
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
          const remaining25 = max25 - usedCount;
          if (remaining25 > 0) {
            const chance = 0.5; // 50% chance per completion while prizes remain
            if (Math.random() < chance) {
              finalReward = 25;
            }
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
      WHERE id = $4
      RETURNING *
      `,
      [newPosition, completed, reward, player.id]
    );

    await client.query("COMMIT");
    client.release();

    const row = updated.rows[0];

    const remaining = row.rolls_granted - row.rolls_used;

    return res.json({
      success: true,
      dice,
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

// Simple reset for a player (from player-side if needed)
app.post("/player/reset", async (req, res) => {
  try {
    let { email, area } = req.body;
    email = normaliseEmail(email);
    area = normaliseArea(area);

    await pool.query(
      `
      UPDATE players
      SET position = 0,
          rolls_used = 0,
          completed = FALSE,
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

// -----------------------------------------------------------------------------
// ADMIN: PLAYERS & ROLLS
// -----------------------------------------------------------------------------

// List players in an area for the admin
app.get("/admin/players", async (req, res) => {
  try {
    const area = normaliseArea(req.query.area);
    if (!area) {
      return res.status(400).json({ error: "Area is required." });
    }

    const result = await pool.query(
      `
      SELECT
        email,
        area,
        position,
        rolls_used AS "rollsUsed",
        rolls_granted AS "rollsGranted",
        completed,
        reward
      FROM players
      WHERE area = $1
      ORDER BY email ASC
      `,
      [area]
    );

    return res.json({ success: true, players: result.rows });
  } catch (err) {
    console.error("Admin list players error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// Reset a single player (admin-side)
app.post("/admin/reset-player", async (req, res) => {
  try {
    let { email, area } = req.body;
    email = normaliseEmail(email);
    area = normaliseArea(area);

    await pool.query(
      `
      UPDATE players
      SET position = 0,
          rolls_used = 0,
          completed = FALSE,
          reward = NULL
      WHERE email = $1 AND area = $2
      `,
      [email, area]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("Admin reset-player error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// Delete a player
app.post("/admin/delete-player", async (req, res) => {
  try {
    let { email, area } = req.body;
    email = normaliseEmail(email);
    area = normaliseArea(area);

    await pool.query("DELETE FROM players WHERE email = $1 AND area = $2", [
      email,
      area,
    ]);

    return res.json({ success: true });
  } catch (err) {
    console.error("Admin delete-player error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// Grant rolls (area or selected players)
app.post("/admin/grant-rolls", async (req, res) => {
  const client = await pool.connect();
  try {
    let { adminUsername, area, extraRolls, emails } = req.body;
    const normArea = normaliseArea(area);
    const rolls = parseInt(extraRolls, 10);

    if (!normArea || !Number.isInteger(rolls) || rolls <= 0) {
      client.release();
      return res
        .status(400)
        .json({
          error: "Area and a positive number of extra rolls are required.",
        });
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
        [rolls, normArea, normEmails]
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
        [rolls, normArea]
      );
      updatedEmails = result.rows.map((r) => r.email);
    }

    if (updatedEmails.length > 0) {
      await client.query(
        `
        INSERT INTO grant_history (admin_username, area, emails, rolls_granted)
        VALUES ($1, $2, $3, $4)
        `,
        [adminUsername || "admin", normArea, updatedEmails, rolls]
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

    const lastGrant = await client.query(
      `
      SELECT *
      FROM grant_history
      WHERE area = $1
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [normArea]
    );

    if (lastGrant.rows.length === 0) {
      await client.query("ROLLBACK");
      client.release();
      return res
        .status(400)
        .json({ error: "No grant history found for this area." });
    }

    const record = lastGrant.rows[0];
    const emails = record.emails;
    const rolls = record.rolls_granted;

    await client.query(
      `
      UPDATE players
      SET rolls_granted = GREATEST(rolls_granted - $1, 0)
      WHERE area = $2 AND email = ANY($3::text[])
      `,
      [rolls, normArea, emails]
    );

    await client.query("DELETE FROM grant_history WHERE id = $1", [
      record.id,
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
// PRIZE CONFIG
// -----------------------------------------------------------------------------

// Get prize config for area
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
        .json({
          error:
            "Area and a non-negative winners value are required.",
        });
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

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Snakes & Ladders backend listening on port ${PORT}`);
});
