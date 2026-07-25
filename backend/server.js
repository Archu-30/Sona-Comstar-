require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');

const dataRouter    = require('./routes/data');
const summaryRouter = require('./routes/summary');
const exportRouter  = require('./routes/export');
const uploadRouter  = require('./routes/upload');
const filtersRouter = require('./routes/filters');
const reportsDbRouter = require('./routes/reportsDb');
const historyRouter = require('./routes/history');

const { testConnection } = require('./db/connection');
const { runSchema }      = require('./db/schema');
const { seedFromExcel, replaceClosing, derivePeriod, defaultPeriod } = require('./db/seed');
const { getClosingInventory, getOriginalAgeingPath } = require('../database/index');

const app  = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// Existing routes
app.use('/api/data/summary', summaryRouter);
app.use('/api/data',         dataRouter);
app.use('/api/export',       exportRouter);
app.use('/api/upload',       uploadRouter);

// New MySQL-backed routes
app.use('/api/filters',  filtersRouter);
app.use('/api/db',       reportsDbRouter);
app.use('/api/history',  historyRouter);

// Admin: fix invalid aging_days in DB (Excel date serials stored as day counts)
app.post('/api/admin/fix-aging-days', async (req, res) => {
  try {
    const { getPool } = require('./db/connection');
    const pool = getPool();
    const [result] = await pool.execute(
      'UPDATE inventory_items SET aging_days = -1 WHERE aging_days > 9999 OR aging_days < -1'
    );
    res.json({ ok: true, rowsFixed: result.affectedRows });
  } catch (err) {
    console.error('[admin/fix-aging-days]', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin: force-replace closing inventory from Excel (fixes stale DB data)
app.post('/api/admin/refresh-closing', async (req, res) => {
  try {
    const closingPeriods = getClosingInventory();
    const filename = require('path').basename(getOriginalAgeingPath());
    const period = derivePeriod('ageing', filename, [], null);
    const result = await replaceClosing(closingPeriods, null, period);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[admin/refresh-closing]', err);
    res.status(500).json({ error: err.message });
  }
});

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, async () => {
  console.log(`Sona backend server running on http://localhost:${PORT}`);

  const ok = await testConnection();
  if (ok) {
    try {
      await runSchema();
      await seedFromExcel();
    } catch (err) {
      console.error('[MySQL] Init error:', err.message);
    }
  } else {
    console.warn('[MySQL] Running without MySQL — /api/db/* routes will return 503.');
    console.warn('[MySQL] Copy .env.example → .env, set credentials, and restart.');
  }
});
