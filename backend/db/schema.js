const { getPool } = require('./connection');

const TABLES = [
  `CREATE TABLE IF NOT EXISTS uploads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    filename VARCHAR(500) NOT NULL,
    original_name VARCHAR(500),
    file_type ENUM('ageing','git','closing') NOT NULL,
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    status ENUM('processing','complete','error') DEFAULT 'processing',
    rows_imported INT DEFAULT 0,
    report_year SMALLINT,
    report_month TINYINT,
    report_date DATE,
    INDEX idx_period (report_year, report_month, report_date)
  )`,

  `CREATE TABLE IF NOT EXISTS inventory_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    biz_key VARCHAR(500) NOT NULL DEFAULT '',
    upload_id INT,
    report_year SMALLINT NOT NULL DEFAULT 0,
    report_month TINYINT NOT NULL DEFAULT 0,
    report_date DATE,
    plant VARCHAR(10),
    storage_location VARCHAR(20),
    material VARCHAR(50),
    material_desc VARCHAR(500),
    product_type VARCHAR(30),
    batch VARCHAR(50),
    quantity DECIMAL(18,3) DEFAULT 0,
    value_unrestricted DECIMAL(18,2) DEFAULT 0,
    value_transit DECIMAL(18,2) DEFAULT 0,
    value_qual_insp DECIMAL(18,2) DEFAULT 0,
    value_restricted DECIMAL(18,2) DEFAULT 0,
    value_blocked DECIMAL(18,2) DEFAULT 0,
    total_value DECIMAL(18,2) DEFAULT 0,
    aging_days INT DEFAULT 0,
    gr_date DATE,
    gr_year SMALLINT,
    gr_month TINYINT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX uq_inv_biz (biz_key),
    INDEX idx_product (product_type),
    INDEX idx_location (storage_location),
    INDEX idx_material (material),
    INDEX idx_aging (aging_days),
    INDEX idx_upload (upload_id),
    INDEX idx_yr_mo (gr_year, gr_month),
    INDEX idx_report_period (report_year, report_month, report_date)
  )`,

  `CREATE TABLE IF NOT EXISTS closing_inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    biz_key VARCHAR(500) NOT NULL DEFAULT '',
    upload_id INT,
    report_year SMALLINT NOT NULL DEFAULT 0,
    report_month TINYINT NOT NULL DEFAULT 0,
    report_date DATE,
    period_name VARCHAR(50),
    period_month TINYINT,
    period_year SMALLINT,
    material VARCHAR(50),
    material_desc VARCHAR(500),
    item_type VARCHAR(30),
    total_stock DECIMAL(18,3) DEFAULT 0,
    total_value DECIMAL(18,2) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX uq_cls_biz (biz_key),
    INDEX idx_period (period_year, period_month),
    INDEX idx_material (material),
    INDEX idx_report_period (report_year, report_month, report_date)
  )`,

  `CREATE TABLE IF NOT EXISTS git_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    biz_key VARCHAR(500) NOT NULL DEFAULT '',
    upload_id INT,
    report_year SMALLINT NOT NULL DEFAULT 0,
    report_month TINYINT NOT NULL DEFAULT 0,
    report_date DATE,
    invoice_no VARCHAR(100),
    invoice_date DATE,
    material VARCHAR(50),
    material_desc VARCHAR(500),
    vendor_code VARCHAR(50),
    product VARCHAR(30),
    quantity DECIMAL(18,3) DEFAULT 0,
    value_inr DECIMAL(18,2) DEFAULT 0,
    cy_value DECIMAL(18,2) DEFAULT 0,
    currency VARCHAR(10),
    aging_days INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX uq_git_biz (biz_key),
    INDEX idx_material (material),
    INDEX idx_vendor (vendor_code),
    INDEX idx_report_period (report_year, report_month, report_date)
  )`,

  `CREATE TABLE IF NOT EXISTS report_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    report_name VARCHAR(200),
    report_type VARCHAR(50),
    generated_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_name VARCHAR(100) DEFAULT 'admin',
    filters_json TEXT,
    export_format VARCHAR(10),
    row_count INT DEFAULT 0
  )`,

  `CREATE TABLE IF NOT EXISTS schema_migrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    migration_key VARCHAR(200) NOT NULL UNIQUE,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
];

const MIGRATIONS = [
  // ── inventory_items: add period + timestamp columns (safe — skipped if exists) ──
  { key: 'inv_add_report_year',  sql: "ALTER TABLE inventory_items ADD COLUMN report_year SMALLINT NOT NULL DEFAULT 0", skip: ['ER_DUP_FIELDNAME'] },
  { key: 'inv_add_report_month', sql: "ALTER TABLE inventory_items ADD COLUMN report_month TINYINT NOT NULL DEFAULT 0", skip: ['ER_DUP_FIELDNAME'] },
  { key: 'inv_add_report_date',  sql: "ALTER TABLE inventory_items ADD COLUMN report_date DATE", skip: ['ER_DUP_FIELDNAME'] },
  { key: 'inv_add_created_at',   sql: "ALTER TABLE inventory_items ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP", skip: ['ER_DUP_FIELDNAME'] },
  { key: 'inv_add_updated_at',   sql: "ALTER TABLE inventory_items ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP", skip: ['ER_DUP_FIELDNAME'] },
  { key: 'inv_add_idx_period',   sql: "ALTER TABLE inventory_items ADD INDEX idx_report_period (report_year, report_month, report_date)", skip: ['ER_DUP_KEYNAME'] },
  { key: 'inv_add_biz_key',     sql: "ALTER TABLE inventory_items ADD COLUMN biz_key VARCHAR(500) NOT NULL DEFAULT ''", skip: ['ER_DUP_FIELDNAME'] },

  // ONE-TIME: backfill period columns for pre-existing rows
  {
    key: 'inv_backfill_period_v1',
    sql: `UPDATE inventory_items
          SET report_year = YEAR(CURDATE()),
              report_month = MONTH(CURDATE()),
              report_date = CURDATE()
          WHERE report_year = 0 OR report_year IS NULL`,
    skip: [],
  },

  // ONE-TIME: backfill biz_key for pre-existing rows that have empty biz_key
  {
    key: 'inv_backfill_bizkey_v1',
    sql: `UPDATE inventory_items
          SET biz_key = CONCAT_WS('~~',
            COALESCE(CAST(report_year AS CHAR),''),
            COALESCE(CAST(report_month AS CHAR),''),
            COALESCE(DATE_FORMAT(report_date,'%Y-%m-%d'),''),
            COALESCE(plant,''),
            COALESCE(storage_location,''),
            COALESCE(material,''),
            COALESCE(batch,''),
            COALESCE(DATE_FORMAT(gr_date,'%Y-%m-%d'),'')
          )
          WHERE biz_key = '' OR biz_key IS NULL`,
    skip: [],
  },

  // ONE-TIME: rebuild unique index (drop duplicates first, then re-add)
  { key: 'inv_drop_uq_biz_v1', sql: 'ALTER TABLE inventory_items DROP INDEX uq_inv_biz', skip: ['ER_CANT_DROP_FIELD_OR_KEY'] },
  {
    key: 'inv_dedup_bizkey_v1',
    sql: `DELETE ii FROM inventory_items ii
          LEFT JOIN (
            SELECT MIN(id) AS keep_id FROM inventory_items GROUP BY biz_key
          ) k ON ii.id = k.keep_id
          WHERE k.keep_id IS NULL`,
    skip: [],
  },
  { key: 'inv_add_uq_biz_v1', sql: 'ALTER TABLE inventory_items ADD UNIQUE INDEX uq_inv_biz (biz_key)', skip: ['ER_DUP_KEYNAME'] },

  // ── closing_inventory ─────────────────────────────────────────────────────
  { key: 'cls_add_report_year',  sql: "ALTER TABLE closing_inventory ADD COLUMN report_year SMALLINT NOT NULL DEFAULT 0", skip: ['ER_DUP_FIELDNAME'] },
  { key: 'cls_add_report_month', sql: "ALTER TABLE closing_inventory ADD COLUMN report_month TINYINT NOT NULL DEFAULT 0", skip: ['ER_DUP_FIELDNAME'] },
  { key: 'cls_add_report_date',  sql: "ALTER TABLE closing_inventory ADD COLUMN report_date DATE", skip: ['ER_DUP_FIELDNAME'] },
  { key: 'cls_add_created_at',   sql: "ALTER TABLE closing_inventory ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP", skip: ['ER_DUP_FIELDNAME'] },
  { key: 'cls_add_updated_at',   sql: "ALTER TABLE closing_inventory ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP", skip: ['ER_DUP_FIELDNAME'] },
  { key: 'cls_add_idx_period',   sql: "ALTER TABLE closing_inventory ADD INDEX idx_report_period (report_year, report_month, report_date)", skip: ['ER_DUP_KEYNAME'] },
  { key: 'cls_add_biz_key',     sql: "ALTER TABLE closing_inventory ADD COLUMN biz_key VARCHAR(500) NOT NULL DEFAULT ''", skip: ['ER_DUP_FIELDNAME'] },

  {
    key: 'cls_backfill_period_v1',
    sql: `UPDATE closing_inventory
          SET report_year = COALESCE(period_year, YEAR(CURDATE())),
              report_month = COALESCE(period_month, MONTH(CURDATE())),
              report_date = CURDATE()
          WHERE report_year = 0 OR report_year IS NULL`,
    skip: [],
  },
  {
    key: 'cls_backfill_bizkey_v1',
    sql: `UPDATE closing_inventory
          SET biz_key = CONCAT_WS('~~',
            COALESCE(DATE_FORMAT(report_date,'%Y-%m-%d'),''),
            COALESCE(CAST(period_year AS CHAR),''),
            COALESCE(CAST(period_month AS CHAR),''),
            COALESCE(material,''),
            COALESCE(item_type,'')
          )
          WHERE biz_key = '' OR biz_key IS NULL`,
    skip: [],
  },
  { key: 'cls_drop_uq_biz_v1', sql: 'ALTER TABLE closing_inventory DROP INDEX uq_cls_biz', skip: ['ER_CANT_DROP_FIELD_OR_KEY'] },
  {
    key: 'cls_dedup_bizkey_v1',
    sql: `DELETE ci FROM closing_inventory ci
          LEFT JOIN (
            SELECT MIN(id) AS keep_id FROM closing_inventory GROUP BY biz_key
          ) k ON ci.id = k.keep_id
          WHERE k.keep_id IS NULL`,
    skip: [],
  },
  { key: 'cls_add_uq_biz_v1', sql: 'ALTER TABLE closing_inventory ADD UNIQUE INDEX uq_cls_biz (biz_key)', skip: ['ER_DUP_KEYNAME'] },

  // ── git_items ─────────────────────────────────────────────────────────────
  { key: 'git_add_report_year',  sql: "ALTER TABLE git_items ADD COLUMN report_year SMALLINT NOT NULL DEFAULT 0", skip: ['ER_DUP_FIELDNAME'] },
  { key: 'git_add_report_month', sql: "ALTER TABLE git_items ADD COLUMN report_month TINYINT NOT NULL DEFAULT 0", skip: ['ER_DUP_FIELDNAME'] },
  { key: 'git_add_report_date',  sql: "ALTER TABLE git_items ADD COLUMN report_date DATE", skip: ['ER_DUP_FIELDNAME'] },
  { key: 'git_add_created_at',   sql: "ALTER TABLE git_items ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP", skip: ['ER_DUP_FIELDNAME'] },
  { key: 'git_add_updated_at',   sql: "ALTER TABLE git_items ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP", skip: ['ER_DUP_FIELDNAME'] },
  { key: 'git_add_idx_period',   sql: "ALTER TABLE git_items ADD INDEX idx_report_period (report_year, report_month, report_date)", skip: ['ER_DUP_KEYNAME'] },
  { key: 'git_add_biz_key',     sql: "ALTER TABLE git_items ADD COLUMN biz_key VARCHAR(500) NOT NULL DEFAULT ''", skip: ['ER_DUP_FIELDNAME'] },

  {
    key: 'git_backfill_period_v1',
    sql: `UPDATE git_items
          SET report_year = YEAR(CURDATE()),
              report_month = MONTH(CURDATE()),
              report_date = CURDATE()
          WHERE report_year = 0 OR report_year IS NULL`,
    skip: [],
  },
  {
    key: 'git_backfill_bizkey_v1',
    sql: `UPDATE git_items
          SET biz_key = CONCAT_WS('~~',
            COALESCE(CAST(report_year AS CHAR),''),
            COALESCE(CAST(report_month AS CHAR),''),
            COALESCE(DATE_FORMAT(report_date,'%Y-%m-%d'),''),
            COALESCE(invoice_no,''),
            COALESCE(material,'')
          )
          WHERE biz_key = '' OR biz_key IS NULL`,
    skip: [],
  },
  { key: 'git_drop_uq_biz_v1', sql: 'ALTER TABLE git_items DROP INDEX uq_git_biz', skip: ['ER_CANT_DROP_FIELD_OR_KEY'] },
  {
    key: 'git_dedup_bizkey_v1',
    sql: `DELETE gi FROM git_items gi
          LEFT JOIN (
            SELECT MIN(id) AS keep_id FROM git_items GROUP BY biz_key
          ) k ON gi.id = k.keep_id
          WHERE k.keep_id IS NULL`,
    skip: [],
  },
  { key: 'git_add_uq_biz_v1', sql: 'ALTER TABLE git_items ADD UNIQUE INDEX uq_git_biz (biz_key)', skip: ['ER_DUP_KEYNAME'] },

  // ── uploads ───────────────────────────────────────────────────────────────
  { key: 'uploads_add_report_year',  sql: 'ALTER TABLE uploads ADD COLUMN report_year SMALLINT', skip: ['ER_DUP_FIELDNAME'] },
  { key: 'uploads_add_report_month', sql: 'ALTER TABLE uploads ADD COLUMN report_month TINYINT', skip: ['ER_DUP_FIELDNAME'] },
  { key: 'uploads_add_report_date',  sql: 'ALTER TABLE uploads ADD COLUMN report_date DATE', skip: ['ER_DUP_FIELDNAME'] },
  { key: 'uploads_add_idx_period',   sql: 'ALTER TABLE uploads ADD INDEX idx_period (report_year, report_month, report_date)', skip: ['ER_DUP_KEYNAME'] },
];

async function runMigrations(pool) {
  // Load already-applied migration keys
  let applied;
  try {
    const [rows] = await pool.execute('SELECT migration_key FROM schema_migrations');
    applied = new Set(rows.map(r => r.migration_key));
  } catch {
    applied = new Set();
  }

  let newApplied = 0;
  for (const { key, sql, skip } of MIGRATIONS) {
    if (applied.has(key)) continue;

    try {
      await pool.execute(sql);
      newApplied++;
    } catch (err) {
      if (skip.includes(err.code)) {
        // Already applied structurally — record it
      } else {
        console.error(`[MySQL] Migration "${key}" failed:`, err.message, '\nSQL:', sql.substring(0, 120));
        throw err;
      }
    }

    try {
      await pool.execute('INSERT IGNORE INTO schema_migrations (migration_key) VALUES (?)', [key]);
    } catch {
      // schema_migrations table might not exist on very first run — harmless
    }
  }

  if (newApplied) console.log(`[MySQL] Migrations: ${newApplied} new step(s) applied`);
  else console.log('[MySQL] Migrations: all up to date');
}

async function runSchema() {
  const pool = getPool();
  for (const sql of TABLES) {
    await pool.execute(sql);
  }
  console.log('[MySQL] Schema ready — all tables exist');
  await runMigrations(pool);
}

module.exports = { runSchema };
