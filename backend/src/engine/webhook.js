const express = require('express');
const db = require('../db');
const { executeFrom } = require('./runner');
const { queue } = require('./queue');
const chatStore = require('./chat-store');

const router = express.Router();

const fs = require('fs');
router.post('/evolution', async (req, res) => {
  res.sendStatus(200);

  const body = req.body;
  const event = (body.event || body.type || '').toUpperCase().replace('.', '_');

  if (event === 'CONNECTION_UPDATE') {
    const instanceName = body.instance;
    const state = body.data?.state || '';
    const status = state === 'open' ? 'connected' : 'disconnected';
    try {
      await db.query(`UPDATE instances SET status=$1 WHERE name=$2`, [status, instanceName]);
    } catch {}
    return;
  }

  if (event !== 'MESSAGES_UPSERT') return;

  const data = body.data || {};
  const key = data.key || {};
  if (key.fromMe) return;

  // suporte ao novo formato LID (@lid) — usa remoteJidAlt como jid real
  let remoteJid = key.remoteJid || '';
  if (remoteJid.endsWith('@lid') && key.remoteJidAlt) {
    remoteJid = key.remoteJidAlt;
  }
  if (!remoteJid.endsWith('@s.whatsapp.net')) return;

  const instanceName = body.instance;
  const phone = remoteJid.replace('@s.whatsapp.net', '').replace(/\D/g, '');
  const pushName = data.pushName || '';
  const text = (data.message?.conversation || data.message?.extendedTextMessage?.text || '').trim();

  // token de sessão MAP 2.0 que vem na primeira mensagem (stl_<uuid>)
  const stlMatch = text.match(/\bstl_([0-9a-f-]{36})\b/);
  const stlSession = stlMatch ? 'stl_' + stlMatch[1] : null;

  // source_url de anúncios Click-to-WhatsApp (Meta envia referral na primeira mensagem)
  const referral = data.message?.extendedTextMessage?.contextInfo?.externalAdReply
                || data.referral
                || {};
  const sourceUrl = referral.sourceUrl || referral.source_url || null;

  // save to chat_messages + push via socket.io
  chatStore.saveMessage({
    instance_name: instanceName,
    phone,
    contact_name: pushName || null,
    direction: 'in',
    body: text || null,
    media_url: null,
    media_type: null,
    whatsapp_id: data?.key?.id || null,
  }).then(msg => { if (msg) global._io?.to(`${phone}:${instanceName}`).emit('new_message', msg); })
    .catch(() => {});

  try {
    // upsert contact
    const { rows: [contact] } = await db.query(
      `INSERT INTO contacts (phone, instance_name, name) VALUES ($1,$2,$3)
       ON CONFLICT (phone, instance_name) DO UPDATE SET name = CASE WHEN contacts.name IS NULL OR contacts.name = '' THEN $3 ELSE contacts.name END
       RETURNING *`,
      [phone, instanceName, pushName || null]
    );

    // log inbound message
    await db.query(
      'INSERT INTO message_logs (contact_id, direction, action_type, content) VALUES ($1,$2,$3,$4)',
      [contact.id, 'in', null, text]
    );

    // salva source_url apenas na primeira mensagem (não sobrescreve se já existe)
    if (sourceUrl && !contact.custom_fields?.source_url) {
      const fields = { ...(contact.custom_fields || {}), source_url: sourceUrl };
      await db.query('UPDATE contacts SET custom_fields=$1 WHERE id=$2', [JSON.stringify(fields), contact.id]);
      contact.custom_fields = fields;
    }

    // salva stl_session MAP 2.0 apenas na primeira mensagem
    if (stlSession && !contact.custom_fields?.stl_session) {
      const fields = { ...(contact.custom_fields || {}), stl_session: stlSession };
      await db.query('UPDATE contacts SET custom_fields=$1 WHERE id=$2', [JSON.stringify(fields), contact.id]);
      contact.custom_fields = fields;
    }

    // check for active state
    const { rows: [state] } = await db.query(
      `SELECT cfs.*, f.instance_name as inst FROM contact_flow_states cfs
       JOIN flows f ON f.id = cfs.flow_id
       WHERE cfs.contact_id=$1 AND cfs.status IN ('waiting_response','running','waiting_interval')
       ORDER BY cfs.updated_at DESC LIMIT 1`,
      [contact.id]
    );

    if (state && state.status === 'waiting_response') {
      // cancel timeout job
      if (state.timeout_job_id) {
        try {
          const job = await queue.getJob(state.timeout_job_id);
          if (job) await job.remove();
        } catch {}
      }

      // save field if set
      if (state.save_field) {
        const fields = contact.custom_fields || {};
        fields[state.save_field] = text;
        await db.query(
          `UPDATE contacts SET custom_fields=$1 WHERE id=$2`,
          [JSON.stringify(fields), contact.id]
        );
        await db.query(
          `UPDATE contact_flow_states SET save_field=NULL, updated_at=now() WHERE id=$1`,
          [state.id]
        );
      }

      // find client-response connection from current node
      const { rows: connections } = await db.query(
        `SELECT * FROM flow_connections WHERE from_node_id=$1`,
        [state.current_node_id]
      );
      const nextConn = connections.find(c => c.condition_config?.source_handle === 'client-response');

      if (nextConn) {
        await db.query(
          `UPDATE contact_flow_states SET current_node_id=$1, status='running', updated_at=now() WHERE id=$2`,
          [nextConn.to_node_id, state.id]
        );
        state.instance_name = instanceName;
        await executeFrom(state.id);
      }
      return;
    }

    if (state && (state.status === 'running' || state.status === 'waiting_interval')) {
      // funil já ativo — ignorar
      return;
    }

    // no active state: find matching flow for this instance
    const { rows: flows } = await db.query(
      `SELECT * FROM flows WHERE status='active' AND instance_name=$1`,
      [instanceName]
    );

    let chosenFlow = null;
    // keyword match first
    for (const flow of flows) {
      if (flow.trigger_type === 'keyword') {
        const kws = flow.trigger_keywords || [];
        if (kws.some(k => { const kw = k.trim().toLowerCase(); const t = text.toLowerCase(); return t === kw || t.startsWith(kw + ' stl_'); })) {
          chosenFlow = flow;
          break;
        }
      }
    }
    // fallback to 'all'
    if (!chosenFlow) {
      chosenFlow = flows.find(f => f.trigger_type === 'all');
    }

    if (!chosenFlow) return;

    // find start node
    const { rows: [startNode] } = await db.query(
      `SELECT * FROM flow_nodes WHERE flow_id=$1 AND node_type='start' LIMIT 1`,
      [chosenFlow.id]
    );
    if (!startNode) return;

    // create or replace state
    const { rows: [newState] } = await db.query(
      `INSERT INTO contact_flow_states (contact_id, flow_id, current_node_id, status)
       VALUES ($1,$2,$3,'running')
       ON CONFLICT (contact_id, flow_id) DO UPDATE SET current_node_id=$3, status='running', save_field=NULL, timeout_job_id=NULL, updated_at=now()
       RETURNING *`,
      [contact.id, chosenFlow.id, startNode.id]
    );

    newState.instance_name = instanceName;
    await executeFrom(newState.id);

  } catch (e) {
    console.error('[webhook] erro:', e.message);
  }
});

module.exports = router;
