// adminAuth.js
// Admin authentication routes: login + change password.
// Uses a Postgres table "admin_credentials" with a single row (id = 1).

const express = require('express');
const bcrypt = require('bcryptjs');

/**
 * Creates an admin router that you can mount under /api/admin
 * e.g. app.use('/api/admin', adminAuth(pool));
 *
 * @param {Pool} pool - pg Pool instance
 */
module.exports = function createAdminRouter(pool) {
  const router = express.Router();

  // Ensure table and default admin user exist
  initialiseAdminTable(pool).catch((err) => {
    console.error('Error initialising admin_credentials table:', err);
  });

  /**
   * POST /api/admin/login
   * Body: { username, password }
   * Returns 200 on success: { success: true }
   * Returns 401 on invalid credentials: { success: false, message: '...' }
   */
  router.post('/login', async (req, res) => {
    try {
      const { username, password } = req.body || {};

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: 'Username and password are required.',
        });
      }

      const result = await pool.query(
        'SELECT username, password_hash FROM admin_credentials WHERE id = 1'
      );

      if (!result.rows.length) {
        console.error('No admin_credentials row with id=1 found.');
        return res.status(500).json({
          success: false,
          message: 'Admin credentials are not initialised.',
        });
      }

      const admin = result.rows[0];

      if (username !== admin.username) {
        return res.status(401).json({
          success: false,
          message: 'Invalid username or password.',
        });
      }

      const passwordOk = await bcrypt.compare(password, admin.password_hash);
      if (!passwordOk) {
        return res.status(401).json({
          success: false,
          message: 'Invalid username or password.',
        });
      }

      // If you want, you could issue a JWT here – but for now,
      // the frontend can just treat a 200 success as "logged in"
      return res.json({ success: true });
    } catch (err) {
      console.error('Error in /api/admin/login:', err);
      return res.status(500).json({
        success: false,
        message: 'Server error while logging in.',
      });
    }
  });

  /**
   * POST /api/admin/change-password
   * Body: { currentPassword, newPassword }
   * Requires current password to match before updating.
   */
  router.post('/change-password', async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body || {};

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password and new password are required.',
        });
      }

      const result = await pool.query(
        'SELECT password_hash FROM admin_credentials WHERE id = 1'
      );

      if (!result.rows.length) {
        console.error('No admin_credentials row with id=1 found.');
        return res.status(500).json({
          success: false,
          message: 'Admin credentials are not initialised.',
        });
      }

      const admin = result.rows[0];
      const passwordOk = await bcrypt.compare(
        currentPassword,
        admin.password_hash
      );

      if (!passwordOk) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect.',
        });
      }

      const newHash = await bcrypt.hash(newPassword, 10);
      await pool.query(
        'UPDATE admin_credentials SET password_hash = $1 WHERE id = 1',
        [newHash]
      );

      return res.json({ success: true, message: 'Password updated.' });
    } catch (err) {
      console.error('Error in /api/admin/change-password:', err);
      return res.status(500).json({
        success: false,
        message: 'Server error while changing password.',
      });
    }
  });

  return router;
};

/**
 * Ensure the admin_credentials table exists and at least one row (id = 1)
 * is present, with a default username/password if required.
 */
async function initialiseAdminTable(pool) {
  // 1) Create table if not exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_credentials (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL,
      password_hash TEXT NOT NULL
    );
  `);

  // 2) Check if id = 1 exists
  const res = await pool.query(
    'SELECT id FROM admin_credentials WHERE id = 1'
  );

  if (!res.rows.length) {
    const defaultUsername = process.env.ADMIN_USERNAME || 'admin';
    const defaultPassword = process.env.ADMIN_PASSWORD || 'ChangeMe123!';

    const hash = await bcrypt.hash(defaultPassword, 10);

    await pool.query(
      'INSERT INTO admin_credentials (id, username, password_hash) VALUES (1, $1, $2)',
      [defaultUsername, hash]
    );

    console.log(
      `admin_credentials initialised with default admin user "${defaultUsername}".` +
        ' Remember to change the password using the admin portal.'
    );
  }
}
