const { getPool } = require('./connection');

const TABLES = [
  `CREATE TABLE IF NOT EXISTS uploads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    filename VARCHAR(500) NOT NULL,
    original_name VARCHAR(500),
    file_type ENUM('ageing','git','closing') NOT NULL,
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    status ENUM('processing','complete','error') DEFAULT 'processing',
    rows_imported INT DEFAULT 0
  )`,

  `CREATE TABLE IF NOT EXISTS inventory_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    upload_id INT,
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
    INDEX idx_product (product_type),
    INDEX idx_location (storage_location),
    INDEX idx_material (material),
    INDEX idx_aging (aging_days),
    INDEX idx_upload (upload_id),
    INDEX idx_yr_mo (gr_year, gr_month)
  )`,

  `CREATE TABLE IF NOT EXISTS closing_inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    upload_id INT,
    period_name VARCHAR(50),
    period_month TINYINT,
    period_year SMALLINT,
    material VARCHAR(50),
    material_desc VARCHAR(500),
    item_type VARCHAR(30),
    total_stock DECIMAL(18,3) DEFAULT 0,
    total_value DECIMAL(18,2) DEFAULT 0,
    INDEX idx_period (period_year, period_month),
    INDEX idx_material (material)
  )`,

  `CREATE TABLE IF NOT EXISTS git_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    upload_id INT,
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
    INDEX idx_material (material),
    INDEX idx_vendor (vendor_code)
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
];

async function runSchema() {
  const pool = getPool();
  for (const sql of TABLES) {
    await pool.execute(sql);
  }
  console.log('[MySQL] Schema ready — all tables exist');
}

module.exports = { runSchema };
