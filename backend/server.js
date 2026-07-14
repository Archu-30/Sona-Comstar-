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
const { seedFromExcel }  = require('./db/seed');

const app  = express();
const PORT = 5000;

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
