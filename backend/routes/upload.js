const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const { setSourceFile, clearCache, getSourceFiles,
        getInventoryAgeing, getClosingInventory, getImportGIT } = require('../../database/index');
const { ensureAvailable, getPool } = require('../db/connection');
const { upsertInventory, upsertClosing, upsertGit, derivePeriod } = require('../db/seed');

const router = express.Router();

const DATA_DIR = path.join(__dirname, '..', '..', 'database', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, DATA_DIR),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^\w.\-'\s]/g, '_');
    cb(null, `upload_${Date.now()}_${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx','.xlsm','.xlsb','.xls'].includes(ext)) cb(null, true);
    else cb(new Error('Only Excel files (.xlsx/.xlsm/.xlsb/.xls) are allowed'));
  },
});

router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const kind = String(req.body.kind || '').toLowerCase();
    if (!['ageing','git'].includes(kind)) {
      return res.status(400).json({ error: 'kind must be "ageing" or "git"' });
    }

    const filename = path.basename(req.file.path);
    console.log(`\n[UPLOAD] ═══════════════════════════════════════════`);
    console.log(`[UPLOAD] File: ${filename}`);
    console.log(`[UPLOAD] Kind: ${kind}`);
    console.log(`[UPLOAD] Path: ${req.file.path}`);

    setSourceFile(kind, req.file.path);
    clearCache();

    const syncResults = [];

    // Re-check MySQL availability (may have become available since startup)
    const mysqlOk = await ensureAvailable();
    console.log(`[UPLOAD] MySQL available: ${mysqlOk}`);

    if (!mysqlOk) {
      console.error('[UPLOAD] *** MySQL NOT AVAILABLE — data will NOT be persisted to database ***');
      return res.json({
        success: false,
        error: 'MySQL is not available — file was saved but data was NOT persisted to the database. Check MySQL connection.',
        kind,
        file: filename,
        sources: getSourceFiles(),
      });
    }

    // Verify database connection before proceeding
    const pool = getPool();
    const [[{ db }]] = await pool.execute('SELECT DATABASE() AS db');
    console.log(`[UPLOAD] Connected to database: ${db}`);

    try {
      if (kind === 'ageing') {
        const items = getInventoryAgeing();
        const closing = getClosingInventory();

        console.log(`[UPLOAD] Parsed from Excel: ${items.length} ageing items, ${closing.length} closing periods`);

        if (items.length === 0) {
          console.error('[UPLOAD] *** Excel parser returned 0 ageing items — aborting MySQL sync ***');
          return res.status(400).json({
            success: false,
            error: 'Excel file parsed to 0 rows. The file may be empty, corrupted, or in an unexpected format.',
            kind,
            file: filename,
          });
        }

        const period = derivePeriod('ageing', filename, items, null);
        console.log(`[UPLOAD] Derived period: year=${period.year} month=${period.month} date=${period.date}`);

        const [invMetrics, clsMetrics] = await Promise.all([
          upsertInventory(items, null, period),
          upsertClosing(closing, null, period),
        ]);

        syncResults.push({ ...invMetrics, status: invMetrics.error ? 'error' : 'success' });
        syncResults.push({ ...clsMetrics, status: clsMetrics.error ? 'error' : 'success' });

        console.log(
          `[UPLOAD] Ageing sync (${period.date}) — ` +
          `inv: +${invMetrics.inserted} new, ~${invMetrics.updated} updated, =${invMetrics.unchanged} unchanged, total=${invMetrics.totalInDb} ` +
          `| cls: +${clsMetrics.inserted} new, ~${clsMetrics.updated} updated, =${clsMetrics.unchanged} unchanged, total=${clsMetrics.totalInDb}`
        );

      } else if (kind === 'git') {
        const items = getImportGIT();

        console.log(`[UPLOAD] Parsed from Excel: ${items.length} GIT items`);

        if (items.length === 0) {
          console.error('[UPLOAD] *** Excel parser returned 0 GIT items — aborting MySQL sync ***');
          return res.status(400).json({
            success: false,
            error: 'Excel file parsed to 0 rows. The file may be empty, corrupted, or in an unexpected format.',
            kind,
            file: filename,
          });
        }

        const period = derivePeriod('git', filename, null, items);
        console.log(`[UPLOAD] Derived period: year=${period.year} month=${period.month} date=${period.date}`);

        const metrics = await upsertGit(items, null, period);

        syncResults.push({ ...metrics, status: metrics.error ? 'error' : 'success' });

        console.log(
          `[UPLOAD] GIT sync (${period.date}) — ` +
          `+${metrics.inserted} new, ~${metrics.updated} updated, ` +
          `=${metrics.unchanged} unchanged (${metrics.totalInDb} total)`
        );
      }
    } catch (err) {
      console.error('[UPLOAD] *** MySQL sync FAILED ***:', err.message);
      console.error('[UPLOAD] Stack:', err.stack);
      syncResults.push({ error: err.message, status: 'error' });

      return res.status(500).json({
        success: false,
        error: `MySQL sync failed: ${err.message}`,
        kind,
        file: filename,
        sources: getSourceFiles(),
        sync: syncResults,
      });
    }

    // Post-upload verification
    const [[{ invCount }]] = await pool.execute('SELECT COUNT(*) AS invCount FROM inventory_items');
    const [[{ clsCount }]] = await pool.execute('SELECT COUNT(*) AS clsCount FROM closing_inventory');
    const [[{ gitCount }]] = await pool.execute('SELECT COUNT(*) AS gitCount FROM git_items');

    console.log(`[UPLOAD] ═══ POST-UPLOAD VERIFICATION ═══`);
    console.log(`[UPLOAD] inventory_items: ${invCount}`);
    console.log(`[UPLOAD] closing_inventory: ${clsCount}`);
    console.log(`[UPLOAD] git_items: ${gitCount}`);
    console.log(`[UPLOAD] ═════════════════════════════════`);

    const hasErrors = syncResults.some(r => r.status === 'error' || r.error);

    res.json({
      success: !hasErrors,
      kind,
      file: filename,
      sources: getSourceFiles(),
      sync: syncResults,
      verification: { inventoryItems: invCount, closingInventory: clsCount, gitItems: gitCount },
    });
  } catch (err) {
    console.error('[UPLOAD] Fatal error:', err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

router.get('/sources', (_req, res) => {
  const sources = getSourceFiles();
  const out = {};
  for (const [k, v] of Object.entries(sources)) out[k] = path.basename(v);
  res.json(out);
});

module.exports = router;
