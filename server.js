// server.js — LeaseFlow OS Production Server
require('dotenv').config();
const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const compression= require('compression');
const rateLimit  = require('express-rate-limit');
const path       = require('path');
const { pool }   = require('./db/pool');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── SECURITY & MIDDLEWARE ──────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || '*' }));
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', 1);

// Rate limiting
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Too many login attempts' } });
const apiLimiter  = rateLimit({ windowMs: 60 * 1000, max: 300, message: { error: 'Rate limit exceeded' } });
app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);

// ── ROUTES ────────────────────────────────────────────
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/tenants',    require('./routes/tenants'));
app.use('/api/contracts',  require('./routes/contracts'));
app.use('/api/invoices',   require('./routes/invoices'));
app.use('/api/payments',   require('./routes/payments'));
app.use('/api/dashboard',  require('./routes/dashboard'));
app.use('/api/reports',    require('./routes/reports'));

// ── INLINE SIMPLE ROUTES ──────────────────────────────
const { auth } = require('./middleware/auth');

// Units
app.get('/api/units', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT u.*, b.name AS building_name, p.name AS property_name
      FROM units u
      JOIN buildings b ON b.id = u.building_id
      JOIN properties p ON p.id = b.property_id
      WHERE u.org_id=$1 ORDER BY u.floor, u.unit_number`,
      [req.user.org_id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Notifications
app.get('/api/notifications', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM notifications WHERE org_id=$1 ORDER BY created_at DESC LIMIT 50`,
      [req.user.org_id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/notifications/read-all', auth, async (req, res) => {
  try {
    await pool.query(`UPDATE notifications SET is_read=true WHERE org_id=$1`, [req.user.org_id]);
    res.json({ message: 'All notifications marked read' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Audit log
app.get('/api/audit', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM audit_log WHERE org_id=$1 ORDER BY created_at DESC LIMIT 100`,
      [req.user.org_id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── HEALTH CHECK ──────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', ts: new Date().toISOString() });
  } catch (e) {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

// ── SERVE SPA ─────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── ERROR HANDLER ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// ── START ─────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅  LeaseFlow OS on port ${PORT}`);
  console.log(`    NODE_ENV : ${process.env.NODE_ENV || 'development'}`);
  console.log(`    DATABASE : ${process.env.DATABASE_URL ? '✓ connected' : '✗ DATABASE_URL missing'}`);
  console.log(`    JWT      : ${process.env.JWT_SECRET ? '✓ set' : '✗ JWT_SECRET missing'}`);
});

module.exports = app;
