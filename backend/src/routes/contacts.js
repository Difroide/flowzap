const router = require('express').Router();
const db = require('../db');

// GET /api/contacts
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT c.*,
        COALESCE(json_agg(cfs) FILTER (WHERE cfs.id IS NOT NULL), '[]') AS flow_states
       FROM contacts c
       LEFT JOIN contact_flow_states cfs ON cfs.contact_id = c.id
       GROUP BY c.id
       ORDER BY c.created_at DESC`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/contacts/:id/reset
router.post('/:id/reset', async (req, res) => {
  try {
    await db.query('DELETE FROM contact_flow_states WHERE contact_id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/contacts/:id/messages
router.get('/:id/messages', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM message_logs WHERE contact_id=$1 ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
