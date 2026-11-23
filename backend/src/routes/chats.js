const router = require('express').Router();
const db = require('../db');
const chatStore = require('../engine/chat-store');

let evolution;
try { evolution = require('../evolution'); }
catch { evolution = require('../engine/evolution-stub'); }

// List conversations (phone+instance) with last message + unread count
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(`
      WITH latest AS (
        SELECT DISTINCT ON (phone, instance_name)
          phone, instance_name, contact_name, body, media_type, created_at
        FROM chat_messages
        ORDER BY phone, instance_name, created_at DESC
      ),
      unread_counts AS (
        SELECT phone, instance_name, COUNT(*)::int AS unread
        FROM chat_messages
        WHERE direction = 'in' AND read_at IS NULL
        GROUP BY phone, instance_name
      )
      SELECT l.*, COALESCE(u.unread, 0) AS unread
      FROM latest l
      LEFT JOIN unread_counts u USING (phone, instance_name)
      ORDER BY l.created_at DESC
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get messages for a conversation (paginated)
router.get('/:phone/:instance', async (req, res) => {
  try {
    const { phone, instance } = req.params;
    const limit  = parseInt(req.query.limit) || 50;
    const before = req.query.before ? parseInt(req.query.before) : null;

    const params = [phone, instance];
    let q = 'SELECT * FROM chat_messages WHERE phone=$1 AND instance_name=$2';
    if (before) { q += ` AND id < $${params.push(before)}`; }
    q += ` ORDER BY created_at ASC LIMIT $${params.push(limit)}`;

    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Send a message from the UI
router.post('/:phone/:instance/send', async (req, res) => {
  try {
    const { phone, instance } = req.params;
    const { body: text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'body required' });

    await evolution.sendText(instance, phone, text, 500);
    const msg = await chatStore.saveMessage({
      instance_name: instance,
      phone,
      direction: 'out',
      body: text,
    });
    global._io?.to(`${phone}:${instance}`).emit('new_message', msg);
    res.json(msg);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Mark all inbound messages as read
router.post('/:phone/:instance/mark-read', async (req, res) => {
  try {
    const { phone, instance } = req.params;
    await db.query(
      `UPDATE chat_messages SET read_at = now()
       WHERE phone=$1 AND instance_name=$2 AND direction='in' AND read_at IS NULL`,
      [phone, instance]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
