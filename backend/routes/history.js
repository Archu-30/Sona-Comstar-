const express = require('express');
const router = express.Router();
const { getPool, isAvailable } = require('../db/connection');

router.get('/', async (req, res) => {
  if (!isAvailable()) return res.json([]);
  try {
    const pool = getPool();
    const [rows] = await pool.execute(
      'SELECT * FROM report_history ORDER BY generated_date DESC LIMIT 200'
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  if (!isAvailable()) return res.json({ id: null });
  try {
    const pool = getPool();
    const { report_name, report_type, user_name, filters_json, export_format, row_count } = req.body;
    const [result] = await pool.execute(
      `INSERT INTO report_history (report_name, report_type, user_name, filters_json, export_format, row_count)
       VALUES (?,?,?,?,?,?)`,
      [report_name, report_type, user_name || 'admin',
       typeof filters_json === 'string' ? filters_json : JSON.stringify(filters_json || {}),
       export_format || 'view', row_count || 0]
    );
    res.json({ id: result.insertId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  if (!isAvailable()) return res.json({ success: false });
  try {
    const pool = getPool();
    await pool.execute('DELETE FROM report_history WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
