const db = require('../db');

async function saveMessage({ instance_name, phone, contact_name, direction, body,
                              media_url, media_type, whatsapp_id }) {
  if (whatsapp_id) {
    const dup = await db.query(
      'SELECT id FROM chat_messages WHERE whatsapp_id=$1', [whatsapp_id]);
    if (dup.rows.length) return null;
  }
  const r = await db.query(
    `INSERT INTO chat_messages
       (instance_name, phone, contact_name, direction, body, media_url, media_type, whatsapp_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [instance_name, phone, contact_name || null, direction,
     body || null, media_url || null, media_type || null, whatsapp_id || null]
  );
  return r.rows[0];
}

async function saveSale({ contact_id, flow_id, instance_name, amount, currency, raw_amount_text }) {
  const r = await db.query(
    `INSERT INTO sales (contact_id, flow_id, instance_name, amount, currency, raw_amount_text)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [contact_id || null, flow_id || null, instance_name,
     amount || 0, currency || 'BRL', raw_amount_text || null]
  );
  return r.rows[0];
}

module.exports = { saveMessage, saveSale };
