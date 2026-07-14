const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const { setSourceFile, clearCache, getSourceFiles,
        getInventoryAgeing, getClosingInventory, getImportGIT } = require('../../database/index');
const { isAvailable } = require('../db/connection');
const { clearAndInsertInventory, clearAndInsertClosing, clearAndInsertGit } = require('../db/seed');

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

    setSourceFile(kind, req.file.path);
    clearCache();

    // Re-sync MySQL if available
    if (isAvailable()) {
      try {
        if (kind === 'ageing') {
          const items = getInventoryAgeing();
          const closing = getClosingInventory();
          await clearAndInsertInventory(items, null);
          await clearAndInsertClosing(closing, null);
          console.log(`[MySQL] Re-seeded ${items.length} ageing rows after upload`);
        } else if (kind === 'git') {
          const items = getImportGIT();
          await clearAndInsertGit(items, null);
          console.log(`[MySQL] Re-seeded ${items.length} GIT rows after upload`);
        }
      } catch (err) {
        console.error('[MySQL] Re-seed after upload failed:', err.message);
      }
    }

    res.json({
      success: true,
      kind,
      file: path.basename(req.file.path),
      sources: getSourceFiles(),
    });
  } catch (err) {
    console.error('Upload error:', err);
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
