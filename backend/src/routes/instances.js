const router = require('express').Router();
const db = require('../db');
const evo = require('../evolution');

// GET /api/instances — lista e sincroniza status com a Evolution
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM instances ORDER BY created_at DESC');

    // pega todos os estados da Evolution em batch
    let evoMap = {};
    try {
      const list = await evo.fetchInstances();
      const arr = Array.isArray(list) ? list : (list ? [list] : []);
      for (const i of arr) {
        const s = i.connectionStatus || i.state || 'disconnected';
        evoMap[i.name] = s === 'open' ? 'connected' : (s === 'connecting' ? 'connecting' : 'disconnected');
      }
    } catch (_) {}

    const updated = await Promise.all(rows.map(async (inst) => {
      const status = evoMap[inst.name] ?? 'disconnected';
      if (status !== inst.status) {
        await db.query('UPDATE instances SET status=$1 WHERE name=$2', [status, inst.name]);
        inst.status = status;
      }
      return inst;
    }));
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/instances — cria na Evolution + webhook + banco
router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    await evo.createInstance(name);
    await evo.setWebhook(name);
    const { rows } = await db.query(
      'INSERT INTO instances (name, status) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET status=$2 RETURNING *',
      [name, 'disconnected']
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/instances/:name/qr
router.get('/:name/qr', async (req, res) => {
  try {
    const data = await evo.connect(req.params.name);
    res.json({ qrcode: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/instances/:name/status
router.get('/:name/status', async (req, res) => {
  try {
    const data = await evo.connectionState(req.params.name);
    const state = data?.instance?.state || 'disconnected';
    res.json({ status: state === 'open' ? 'connected' : 'disconnected' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/instances/:name
router.delete('/:name', async (req, res) => {
  const { name } = req.params;
  try {
    await evo.logout(name).catch(() => {});
    await evo.deleteInstance(name).catch(() => {});
    await db.query('DELETE FROM instances WHERE name=$1', [name]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
