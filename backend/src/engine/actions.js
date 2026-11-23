require('dotenv').config();
const db = require('../db');
const { interpolate } = require('./variables');
const { evaluate } = require('./conditions');
const { queue } = require('./queue');

let evolution;
try { evolution = require('../evolution'); }
catch { evolution = require('./evolution-stub'); }

function randomDelay() {
  return Math.floor(Math.random() * 3000) + 2000;
}

function parseUtmFromUrl(url) {
  if (!url) return {};
  try {
    const params = {};
    for (const [k, v] of new URL(url).searchParams) params[k] = v;
    return params;
  } catch { return {}; }
}

function unitToMs(unit, value) {
  const map = { minutes: 60000, hours: 3600000, days: 86400000 };
  return value * (map[unit] || 60000);
}

function resolveMediaUrl(url) {
  if (!url) return url;
  if (url.startsWith('/media/')) return (process.env.PUBLIC_URL || '') + url;
  return url;
}

function mediaTypeFromContentType(ct) {
  if (!ct) return 'document';
  if (ct.startsWith('image/')) return 'image';
  if (ct.startsWith('video/')) return 'video';
  if (ct.startsWith('audio/')) return 'audio';
  return 'document';
}

async function logMessage(contactId, direction, actionType, content) {
  try {
    await db.query(
      'INSERT INTO message_logs (contact_id, direction, action_type, content) VALUES ($1,$2,$3,$4)',
      [contactId, direction, actionType, content]
    );
  } catch {}
}

async function executeAction(action, state, contact) {
  const cfg = action.config || {};
  const { instance_name } = state;
  const phone = contact.phone;

  switch (action.action_type) {
    case 'send_message': {
      const text = interpolate(cfg.message_text || cfg.message || '', contact);
      const d = randomDelay();
      await evolution.sendText(instance_name, phone, text, d);
      await logMessage(contact.id, 'out', 'send_message', text);
      try {
        const chatStore = require('./chat-store');
        const msg = await chatStore.saveMessage({ instance_name, phone, direction: 'out', body: text });
        if (msg) global._io?.to(`${phone}:${instance_name}`).emit('new_message', msg);
      } catch {}
      return {};
    }

    case 'send_multi_media': {
      const info = cfg.media_file_info || {};
      const url = resolveMediaUrl(info.url || info.direct_url || '');
      const d = randomDelay();
      if (cfg.media_type === 'audio') {
        await evolution.sendAudio(instance_name, phone, url, d);
      } else {
        const mediatype = mediaTypeFromContentType(info.content_type);
        await evolution.sendMedia(instance_name, phone, { mediatype, media: url, fileName: info.filename }, d);
      }
      await logMessage(contact.id, 'out', 'send_multi_media', url);
      try {
        const chatStore = require('./chat-store');
        const mt = cfg.media_type || mediaTypeFromContentType((info.content_type || ''));
        const msg = await chatStore.saveMessage({ instance_name, phone, direction: 'out', body: null, media_url: url, media_type: mt });
        if (msg) global._io?.to(`${phone}:${instance_name}`).emit('new_message', msg);
      } catch {}
      return {};
    }

    case 'send_file': {
      const info = cfg.media_file_info || {};
      const url = resolveMediaUrl(info.url || info.direct_url || cfg.file_url || '');
      const fileName = cfg.file_name || info.filename || '';
      const ct = info.content_type || '';
      const mediatype = ct.startsWith('image/') ? 'image' : ct.startsWith('video/') ? 'video' : 'document';
      const d = randomDelay();
      await evolution.sendMedia(instance_name, phone, { mediatype, media: url, fileName }, d);
      await logMessage(contact.id, 'out', 'send_file', fileName);
      try {
        const chatStore = require('./chat-store');
        const msg = await chatStore.saveMessage({ instance_name, phone, direction: 'out', body: fileName || null, media_url: url, media_type: mediatype });
        if (msg) global._io?.to(`${phone}:${instance_name}`).emit('new_message', msg);
      } catch {}
      return {};
    }

    case 'save_user_data': {
      const field = cfg.field_name || '';
      await db.query(
        'UPDATE contact_flow_states SET save_field=$1, updated_at=now() WHERE id=$2',
        [field, state.id]
      );
      state.save_field = field;
      return {};
    }

    case 'wait_for_response': {
      const ms = unitToMs(cfg.timeout_unit || 'hours', cfg.timeout_value || 1);
      const job = await queue.add('timeout', { stateId: state.id, kind: 'timeout' }, { delay: ms });
      await db.query(
        `UPDATE contact_flow_states SET status='waiting_response', timeout_job_id=$1, updated_at=now() WHERE id=$2`,
        [job.id, state.id]
      );
      return { blocked: true };
    }

    case 'smart_interval': {
      const ms = unitToMs(cfg.interval_unit || 'days', cfg.interval_value || 1);
      await queue.add('interval', { stateId: state.id, kind: 'interval' }, { delay: ms });
      await db.query(
        `UPDATE contact_flow_states SET status='waiting_interval', updated_at=now() WHERE id=$1`,
        [state.id]
      );
      return { blocked: true };
    }

    case 'evaluate_condition': {
      const result = evaluate(cfg, contact);
      return { conditionResult: result };
    }

    case 'add_tags': {
      const tags = cfg.tags || [];
      if (cfg.action === 'remove') {
        await db.query(
          `UPDATE contacts SET tags = array(SELECT unnest(tags) EXCEPT SELECT unnest($1::text[])) WHERE id=$2`,
          [tags, contact.id]
        );
      } else {
        await db.query(
          `UPDATE contacts SET tags = array(SELECT DISTINCT unnest(array_cat(tags, $1::text[]))) WHERE id=$2`,
          [tags, contact.id]
        );
      }
      return {};
    }

    case 'send_notification': {
      const msg = interpolate(cfg.message || '', contact);
      const toPhone = (cfg.country_code || '55') + (cfg.phone || '');
      const d = randomDelay();
      await evolution.sendText(instance_name, toPhone, msg, d);
      return {};
    }

    case 'register_approved_sale': {
      try {
        const amount = interpolate(cfg.amount_template || '', contact);
        const currency = interpolate(cfg.currency_template || 'BRL', contact);
        const parsedAmount = parseFloat(amount.replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
        // save sale record
        try {
          const chatStore = require('./chat-store');
          await chatStore.saveSale({
            contact_id: contact.id,
            flow_id: state.flow_id,
            instance_name: state.instance_name,
            amount: parsedAmount,
            currency,
            raw_amount_text: amount,
          });
        } catch (e2) {
          console.error('[saveSale] erro (ignorado):', e2.message);
        }
        if (process.env.MAP2_URL && process.env.MAP2_WORKSPACE_ID) {
          const utms = parseUtmFromUrl(contact.custom_fields?.source_url);
          await fetch(`${process.env.MAP2_URL}/api/whatsapp/sale`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': process.env.MAP2_WORKSPACE_ID,
            },
            body: JSON.stringify({
              workspace_id: process.env.MAP2_WORKSPACE_ID,
              external_id: `flow-${state.id}-${Date.now()}`,
              phone: contact.phone,
              name: contact.name || '',
              amount: parsedAmount,
              currency,
              product_name: cfg.product_name || 'Produto',
              tracking_ref: contact.custom_fields?.stl_session || null,
              fbclid: utms.fbclid || null,
              utm_source: utms.utm_source || null,
              utm_medium: utms.utm_medium || null,
              utm_campaign: utms.utm_campaign || null,
              utm_content: utms.utm_content || null,
              utm_term: utms.utm_term || null,
            }),
          });
        } else {
          console.log(`[register_approved_sale] amount=${amount} contact=${contact.phone} stl=${contact.custom_fields?.stl_session || 'sem sessão'}`);
        }
      } catch (e) {
        console.error('[register_approved_sale] erro (ignorado):', e.message);
      }
      return {};
    }

    default:
      console.log(`[actions] action_type desconhecido: ${action.action_type}`);
      return {};
  }
}

module.exports = { executeAction };
