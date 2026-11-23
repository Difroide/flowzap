#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const db = require('../src/db');

const NODES_FILE = path.join(__dirname, '..', '..', '..', 'flow_nodes.json');
const CONNS_FILE = path.join(__dirname, '..', '..', '..', 'flow_connections.json');
const MEDIA_DIR = path.join(__dirname, '..', 'media');

if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    proto.get(url, res => {
      if (res.statusCode !== 200) {
        file.close();
        fs.unlink(dest, () => {});
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', err => {
      file.close();
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function downloadMedia(cdnUrl, originalFilename) {
  try {
    const u = new URL(cdnUrl);
    const hash = u.pathname.split('/').pop();
    const ext = path.extname(originalFilename || '') || '';
    const localName = hash + ext;
    const dest = path.join(MEDIA_DIR, localName);
    if (!fs.existsSync(dest)) {
      await downloadFile(cdnUrl, dest);
    }
    return { localName, ok: true };
  } catch (e) {
    return { localName: null, ok: false, error: e.message };
  }
}

async function processMediaConfig(cfg) {
  const info = cfg.media_file_info;
  if (!info) return { cfg, pending: null };

  const cdnUrl = info.direct_url || info.url;
  if (!cdnUrl || !cdnUrl.includes('leona-production')) {
    return { cfg, pending: null };
  }

  const result = await downloadMedia(cdnUrl, info.filename || '');
  if (result.ok) {
    const newInfo = { ...info, url: `/media/${result.localName}`, direct_url: `/media/${result.localName}` };
    return { cfg: { ...cfg, media_file_info: newInfo }, pending: null };
  } else {
    return { cfg, pending: `${cdnUrl} (${result.error})` };
  }
}

async function main() {
  const rawNodes = JSON.parse(fs.readFileSync(NODES_FILE, 'utf8'));
  const rawConns = JSON.parse(fs.readFileSync(CONNS_FILE, 'utf8'));

  console.log(`Importando: ${rawNodes.length} nós, ${rawConns.length} conexões`);

  // create flow
  const { rows: [flow] } = await db.query(
    `INSERT INTO flows (name, status) VALUES ($1, 'draft') RETURNING *`,
    ['CONSERVAS (importado)']
  );
  console.log(`Fluxo criado: id=${flow.id}`);

  const nodeIdMap = new Map(); // leona_id → new_id
  let nodesCreated = 0;
  let actionsCreated = 0;
  const mediasDownloaded = [];
  const mediasPending = [];
  const actionsSkipped = [];

  const SUPPORTED_ACTIONS = new Set([
    'send_message', 'send_multi_media', 'send_file', 'wait_for_response',
    'save_user_data', 'evaluate_condition', 'add_tags', 'smart_interval',
    'send_notification', 'register_approved_sale',
  ]);

  for (const node of rawNodes) {
    const { rows: [newNode] } = await db.query(
      `INSERT INTO flow_nodes (flow_id, node_type, name, position_x, position_y) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [
        flow.id,
        node.node_type,
        node.name || null,
        node.position?.x ?? 0,
        node.position?.y ?? 0,
      ]
    );
    nodeIdMap.set(node.id, newNode.id);
    nodesCreated++;

    const sortedActions = (node.actions || []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    for (let i = 0; i < sortedActions.length; i++) {
      const action = sortedActions[i];

      if (!SUPPORTED_ACTIONS.has(action.action_type)) {
        actionsSkipped.push(`nó ${node.id} (${node.name}): ${action.action_type}`);
        continue;
      }

      let cfg = { ...(action.config || {}) };

      // process media
      if (['send_multi_media', 'send_file'].includes(action.action_type) && cfg.media_file_info) {
        const { cfg: newCfg, pending } = await processMediaConfig(cfg);
        if (pending) mediasPending.push(pending);
        else if (cfg.media_file_info?.url?.includes('leona-production')) mediasDownloaded.push(cfg.media_file_info.url);
        cfg = newCfg;
      }

      await db.query(
        `INSERT INTO flow_node_actions (node_id, action_type, config, sort_order) VALUES ($1,$2,$3,$4)`,
        [newNode.id, action.action_type, JSON.stringify(cfg), i + 1]
      );
      actionsCreated++;
    }
  }

  // insert connections
  let connsCreated = 0;
  for (const conn of rawConns) {
    const fromNew = nodeIdMap.get(conn.from_node_id);
    const toNew = nodeIdMap.get(conn.to_node_id);
    if (!fromNew || !toNew) continue;

    await db.query(
      `INSERT INTO flow_connections (flow_id, from_node_id, to_node_id, condition_config) VALUES ($1,$2,$3,$4)`,
      [flow.id, fromNew, toNew, JSON.stringify(conn.condition_config || { type: 'always' })]
    );
    connsCreated++;
  }

  console.log('\n=== Resumo da Importação ===');
  console.log(`Fluxo: [${flow.id}] ${flow.name}`);
  console.log(`Nós criados: ${nodesCreated}`);
  console.log(`Ações criadas: ${actionsCreated}`);
  console.log(`Conexões criadas: ${connsCreated}`);
  console.log(`Mídias baixadas: ${mediasDownloaded.length}`);
  if (mediasPending.length) {
    console.log(`\nMídias pendentes (${mediasPending.length}):`);
    mediasPending.forEach(p => console.log('  -', p));
  }
  if (actionsSkipped.length) {
    console.log(`\nAções puladas (tipos não suportados):`);
    actionsSkipped.forEach(a => console.log('  -', a));
  }

  process.exit(0);
}

main().catch(e => { console.error('[import] Erro:', e.message); process.exit(1); });
