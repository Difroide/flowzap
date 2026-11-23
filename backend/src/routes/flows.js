const router = require('express').Router();
const db = require('../db');

async function getFullFlow(id) {
  const { rows: [flow] } = await db.query('SELECT * FROM flows WHERE id=$1', [id]);
  if (!flow) return null;
  const { rows: nodes } = await db.query(
    `SELECT n.*, COALESCE(json_agg(a ORDER BY a.sort_order) FILTER (WHERE a.id IS NOT NULL), '[]') AS actions
     FROM flow_nodes n
     LEFT JOIN flow_node_actions a ON a.node_id = n.id
     WHERE n.flow_id=$1
     GROUP BY n.id
     ORDER BY n.id`,
    [id]
  );
  const { rows: connections } = await db.query(
    'SELECT * FROM flow_connections WHERE flow_id=$1 ORDER BY id',
    [id]
  );
  return { flow, nodes, connections };
}

// GET /api/flows — lista com contagem de nós
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT f.*, COUNT(n.id)::int AS node_count
       FROM flows f LEFT JOIN flow_nodes n ON n.flow_id = f.id
       GROUP BY f.id ORDER BY f.created_at DESC`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/flows
router.post('/', async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const { rows: [flow] } = await db.query(
      'INSERT INTO flows (name, description) VALUES ($1, $2) RETURNING *',
      [name, description || null]
    );
    await db.query(
      'INSERT INTO flow_nodes (flow_id, node_type, name, position_x, position_y) VALUES ($1, $2, $3, $4, $5)',
      [flow.id, 'start', 'Início', 100, 200]
    );
    res.status(201).json(flow);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/flows/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows: [flow] } = await db.query('SELECT * FROM flows WHERE id=$1', [req.params.id]);
    if (!flow) return res.status(404).json({ error: 'not found' });
    res.json(flow);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/flows/:id
router.put('/:id', async (req, res) => {
  const { name, description, status, instance_name, trigger_type, trigger_keywords } = req.body;
  try {
    const fields = [];
    const vals = [];
    let i = 1;
    if (name !== undefined) { fields.push(`name=$${i++}`); vals.push(name); }
    if (description !== undefined) { fields.push(`description=$${i++}`); vals.push(description); }
    if (status !== undefined) { fields.push(`status=$${i++}`); vals.push(status); }
    if (instance_name !== undefined) { fields.push(`instance_name=$${i++}`); vals.push(instance_name); }
    if (trigger_type !== undefined) { fields.push(`trigger_type=$${i++}`); vals.push(trigger_type); }
    if (trigger_keywords !== undefined) { fields.push(`trigger_keywords=$${i++}`); vals.push(trigger_keywords); }
    fields.push(`updated_at=now()`);
    vals.push(req.params.id);
    const { rows: [flow] } = await db.query(
      `UPDATE flows SET ${fields.join(', ')} WHERE id=$${i} RETURNING *`,
      vals
    );
    if (!flow) return res.status(404).json({ error: 'not found' });
    res.json(flow);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/flows/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM flows WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/flows/:id/duplicate
router.post('/:id/duplicate', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [orig] } = await client.query('SELECT * FROM flows WHERE id=$1', [req.params.id]);
    if (!orig) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not found' }); }
    const { rows: [newFlow] } = await client.query(
      'INSERT INTO flows (name, description, status, instance_name, trigger_type, trigger_keywords) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [`${orig.name} (cópia)`, orig.description, 'draft', orig.instance_name, orig.trigger_type, orig.trigger_keywords]
    );
    const { rows: nodes } = await client.query('SELECT * FROM flow_nodes WHERE flow_id=$1', [orig.id]);
    const idMap = {};
    for (const n of nodes) {
      const { rows: [nn] } = await client.query(
        'INSERT INTO flow_nodes (flow_id, node_type, name, position_x, position_y) VALUES ($1,$2,$3,$4,$5) RETURNING id',
        [newFlow.id, n.node_type, n.name, n.position_x, n.position_y]
      );
      idMap[n.id] = nn.id;
      const { rows: actions } = await client.query('SELECT * FROM flow_node_actions WHERE node_id=$1 ORDER BY sort_order', [n.id]);
      for (const a of actions) {
        await client.query(
          'INSERT INTO flow_node_actions (node_id, action_type, config, sort_order) VALUES ($1,$2,$3,$4)',
          [nn.id, a.action_type, a.config, a.sort_order]
        );
      }
    }
    const { rows: conns } = await client.query('SELECT * FROM flow_connections WHERE flow_id=$1', [orig.id]);
    for (const c of conns) {
      await client.query(
        'INSERT INTO flow_connections (flow_id, from_node_id, to_node_id, condition_config) VALUES ($1,$2,$3,$4)',
        [newFlow.id, idMap[c.from_node_id], idMap[c.to_node_id], c.condition_config]
      );
    }
    await client.query('COMMIT');
    res.status(201).json(newFlow);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// GET /api/flows/:id/full
router.get('/:id/full', async (req, res) => {
  try {
    const full = await getFullFlow(req.params.id);
    if (!full) return res.status(404).json({ error: 'not found' });
    res.json(full);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/flows/:id/graph — recebe {nodes, connections}, substitui tudo em transação
router.put('/:id/graph', async (req, res) => {
  const flowId = parseInt(req.params.id);
  const { nodes = [], connections = [] } = req.body;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Busca nós existentes
    const { rows: existingNodes } = await client.query('SELECT id FROM flow_nodes WHERE flow_id=$1', [flowId]);
    const existingIds = new Set(existingNodes.map(n => n.id));

    const tmpMap = {}; // tmp_xxx → real id

    // Upsert nós
    const incomingIds = new Set();
    for (const n of nodes) {
      const isTmp = typeof n.id === 'string' && n.id.startsWith('tmp_');
      if (isTmp) {
        const { rows: [ins] } = await client.query(
          'INSERT INTO flow_nodes (flow_id, node_type, name, position_x, position_y) VALUES ($1,$2,$3,$4,$5) RETURNING id',
          [flowId, n.node_type, n.name || null, n.position_x || 0, n.position_y || 0]
        );
        tmpMap[n.id] = ins.id;
        incomingIds.add(ins.id);
      } else {
        await client.query(
          'UPDATE flow_nodes SET node_type=$1, name=$2, position_x=$3, position_y=$4 WHERE id=$5 AND flow_id=$6',
          [n.node_type, n.name || null, n.position_x || 0, n.position_y || 0, n.id, flowId]
        );
        incomingIds.add(n.id);
      }
    }

    // Deleta nós que sumiram
    for (const eid of existingIds) {
      if (!incomingIds.has(eid)) {
        await client.query('DELETE FROM flow_nodes WHERE id=$1', [eid]);
      }
    }

    // Recria ações de cada nó (DELETE + INSERT)
    for (const n of nodes) {
      const realId = typeof n.id === 'string' && n.id.startsWith('tmp_') ? tmpMap[n.id] : n.id;
      await client.query('DELETE FROM flow_node_actions WHERE node_id=$1', [realId]);
      for (const a of (n.actions || [])) {
        await client.query(
          'INSERT INTO flow_node_actions (node_id, action_type, config, sort_order) VALUES ($1,$2,$3,$4)',
          [realId, a.action_type, a.config || {}, a.sort_order || 0]
        );
      }
    }

    // Recria conexões remapeando tmp_*
    await client.query('DELETE FROM flow_connections WHERE flow_id=$1', [flowId]);
    for (const c of connections) {
      const from = tmpMap[c.from_node_id] ?? c.from_node_id;
      const to = tmpMap[c.to_node_id] ?? c.to_node_id;
      await client.query(
        'INSERT INTO flow_connections (flow_id, from_node_id, to_node_id, condition_config) VALUES ($1,$2,$3,$4)',
        [flowId, from, to, c.condition_config || { type: 'always' }]
      );
    }

    await client.query('UPDATE flows SET updated_at=now() WHERE id=$1', [flowId]);
    await client.query('COMMIT');

    const full = await getFullFlow(flowId);
    res.json(full);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

module.exports = router;
