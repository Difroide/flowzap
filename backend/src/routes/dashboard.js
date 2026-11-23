const router = require('express').Router();
const db = require('../db');

let _adSpend = 0;

router.get('/config', (req, res) => res.json({ ad_spend: _adSpend }));
router.put('/config', (req, res) => {
  const v = parseFloat(req.body.ad_spend);
  if (!isNaN(v)) _adSpend = v;
  res.json({ ad_spend: _adSpend });
});

function parsePeriod(query) {
  const now = new Date();
  const to   = query.to   ? new Date(query.to   + 'T23:59:59Z') : now;
  const from = query.from ? new Date(query.from + 'T00:00:00Z') : new Date(now - 30 * 86400000);
  return { from, to };
}

router.get('/stats', async (req, res) => {
  try {
    const { from, to } = parsePeriod(req.query);
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const [leads, leadsToday, salesData, activeFlows, activeInstances] = await Promise.all([
      db.query('SELECT COUNT(*) FROM contacts WHERE created_at >= $1 AND created_at <= $2', [from, to]),
      db.query('SELECT COUNT(*) FROM contacts WHERE created_at >= $1', [today]),
      db.query('SELECT COUNT(*), SUM(amount) FROM sales WHERE created_at >= $1 AND created_at <= $2', [from, to]),
      db.query("SELECT COUNT(*) FROM flows WHERE status='active'"),
      db.query("SELECT COUNT(*) FROM instances WHERE status='connected'"),
    ]);

    const leads_total    = parseInt(leads.rows[0].count);
    const leads_new_today = parseInt(leadsToday.rows[0].count);
    const sales_total    = parseInt(salesData.rows[0].count);
    const revenue_total  = parseFloat(salesData.rows[0].sum) || 0;
    const avg_ticket     = sales_total > 0 ? revenue_total / sales_total : 0;
    const conversion_rate = leads_total > 0 ? (sales_total / leads_total) * 100 : 0;

    const lucro = revenue_total - _adSpend;
    const roas  = _adSpend > 0 ? revenue_total / _adSpend : null;

    res.json({
      leads_total,
      leads_new_today,
      sales_total,
      revenue_total:    parseFloat(revenue_total.toFixed(2)),
      avg_ticket:       parseFloat(avg_ticket.toFixed(2)),
      conversion_rate:  parseFloat(conversion_rate.toFixed(2)),
      active_flows:     parseInt(activeFlows.rows[0].count),
      active_instances: parseInt(activeInstances.rows[0].count),
      lucro:            parseFloat(lucro.toFixed(2)),
      roas:             roas !== null ? parseFloat(roas.toFixed(2)) : null,
      ad_spend:         _adSpend,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/sales', async (req, res) => {
  try {
    const { from, to } = parsePeriod(req.query);
    const { rows } = await db.query(
      `SELECT date_trunc('day', created_at)::date AS day,
              COUNT(*)::int AS count,
              COALESCE(SUM(amount), 0)::float AS revenue
       FROM sales WHERE created_at >= $1 AND created_at <= $2
       GROUP BY 1 ORDER BY 1`,
      [from, to]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/leads', async (req, res) => {
  try {
    const { from, to } = parsePeriod(req.query);
    const { rows } = await db.query(
      `SELECT date_trunc('day', created_at)::date AS day, COUNT(*)::int AS count
       FROM contacts WHERE created_at >= $1 AND created_at <= $2
       GROUP BY 1 ORDER BY 1`,
      [from, to]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
