#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const readline = require('readline');
const db = require('../src/db');

// force stub
process.env._SIM = '1';
const evolution = require('../src/engine/evolution-stub');
// monkey-patch evolution in actions
const actionsModule = require('../src/engine/actions');

const { executeFrom } = require('../src/engine/runner');
const { queue } = require('../src/engine/queue');

const FAKE_PHONE = '5500000000000';
const FAKE_INSTANCE = 'sim';

async function getOrCreateContact() {
  const { rows: [c] } = await db.query(
    `INSERT INTO contacts (phone, instance_name, name) VALUES ($1,$2,$3)
     ON CONFLICT (phone, instance_name) DO UPDATE SET name=$3 RETURNING *`,
    [FAKE_PHONE, FAKE_INSTANCE, 'Simulado']
  );
  return c;
}

async function resetContact(contact, flowId) {
  await db.query(
    `UPDATE contact_flow_states SET status='done' WHERE contact_id=$1 AND flow_id=$2`,
    [contact.id, flowId]
  );
  await db.query(`UPDATE contacts SET custom_fields='{}', tags='{}' WHERE id=$1`, [contact.id]);
}

async function startFlow(contact, flowId) {
  const { rows: [startNode] } = await db.query(
    `SELECT * FROM flow_nodes WHERE flow_id=$1 AND node_type='start' LIMIT 1`,
    [flowId]
  );
  if (!startNode) { console.log('Nó start não encontrado'); return null; }

  const { rows: [state] } = await db.query(
    `INSERT INTO contact_flow_states (contact_id, flow_id, current_node_id, status)
     VALUES ($1,$2,$3,'running')
     ON CONFLICT (contact_id, flow_id) DO UPDATE SET current_node_id=$3, status='running', save_field=NULL, timeout_job_id=NULL, updated_at=now()
     RETURNING *`,
    [contact.id, flowId, startNode.id]
  );
  state.instance_name = FAKE_INSTANCE;
  return state;
}

async function sendMessage(contact, flowId, text) {
  await db.query(
    'INSERT INTO message_logs (contact_id, direction, content) VALUES ($1,$2,$3)',
    [contact.id, 'in', text]
  );

  const { rows: [state] } = await db.query(
    `SELECT * FROM contact_flow_states WHERE contact_id=$1 AND flow_id=$2 ORDER BY updated_at DESC LIMIT 1`,
    [contact.id, flowId]
  );

  if (!state) { console.log('[sim] Sem estado ativo'); return; }

  if (state.status === 'waiting_response') {
    if (state.timeout_job_id) {
      try { const j = await queue.getJob(state.timeout_job_id); if (j) await j.remove(); } catch {}
    }

    if (state.save_field) {
      const { rows: [c] } = await db.query('SELECT * FROM contacts WHERE id=$1', [contact.id]);
      const fields = c.custom_fields || {};
      fields[state.save_field] = text;
      await db.query(`UPDATE contacts SET custom_fields=$1 WHERE id=$2`, [JSON.stringify(fields), contact.id]);
      await db.query(`UPDATE contact_flow_states SET save_field=NULL, updated_at=now() WHERE id=$1`, [state.id]);
    }

    const { rows: connections } = await db.query(
      'SELECT * FROM flow_connections WHERE from_node_id=$1',
      [state.current_node_id]
    );
    const next = connections.find(c => c.condition_config?.source_handle === 'client-response');
    if (next) {
      await db.query(
        `UPDATE contact_flow_states SET current_node_id=$1, status='running', updated_at=now() WHERE id=$2`,
        [next.to_node_id, state.id]
      );
      await executeFrom(state.id);
    }
    return;
  }

  if (state.status === 'running' || state.status === 'waiting_interval') {
    console.log(`[sim] Estado atual: ${state.status} — mensagem ignorada`);
    return;
  }

  console.log(`[sim] Estado: ${state.status}`);
}

async function forceTimeout(contact, flowId) {
  const { rows: [state] } = await db.query(
    `SELECT * FROM contact_flow_states WHERE contact_id=$1 AND flow_id=$2 ORDER BY updated_at DESC LIMIT 1`,
    [contact.id, flowId]
  );
  if (!state) { console.log('[sim] Sem estado'); return; }

  const kind = state.status === 'waiting_response' ? 'timeout' : state.status === 'waiting_interval' ? 'interval' : null;
  if (!kind) { console.log(`[sim] Estado ${state.status} não é bloqueante`); return; }

  const { rows: connections } = await db.query(
    'SELECT * FROM flow_connections WHERE from_node_id=$1',
    [state.current_node_id]
  );

  let next;
  if (kind === 'timeout') {
    next = connections.find(c => c.condition_config?.source_handle === 'timeout');
  } else {
    next = connections.find(c => {
      const cc = c.condition_config || {};
      return !cc.condition_result && !cc.source_handle;
    });
  }

  if (next) {
    await db.query(
      `UPDATE contact_flow_states SET current_node_id=$1, status='running', timeout_job_id=NULL, updated_at=now() WHERE id=$2`,
      [next.to_node_id, state.id]
    );
    await executeFrom(state.id);
  } else {
    console.log('[sim] Sem conexão de timeout/interval');
  }
}

async function main() {
  const flowId = parseInt(process.argv[2]);
  if (!flowId) {
    console.log('Uso: node scripts/simulate.js <flow_id>');
    process.exit(1);
  }

  const { rows: [flow] } = await db.query('SELECT * FROM flows WHERE id=$1', [flowId]);
  if (!flow) { console.error('Fluxo não encontrado:', flowId); process.exit(1); }

  console.log(`\n=== Simulador de Fluxo ===`);
  console.log(`Fluxo: [${flow.id}] ${flow.name}`);
  console.log(`Contato: ${FAKE_PHONE} (instância: ${FAKE_INSTANCE})`);
  console.log(`Comandos especiais: !timeout (força timeout), !reset (reinicia), !status (mostra estado)\n`);

  const contact = await getOrCreateContact();
  await resetContact(contact, flowId);
  const state = await startFlow(contact, flowId);
  if (!state) { process.exit(1); }

  await executeFrom(state.id);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.setPrompt('você> ');
  rl.prompt();

  rl.on('line', async line => {
    const input = line.trim();
    if (!input) { rl.prompt(); return; }

    if (input === '!timeout') {
      console.log('[sim] Forçando timeout...');
      await forceTimeout(contact, flowId);
    } else if (input === '!reset') {
      await resetContact(contact, flowId);
      const s = await startFlow(contact, flowId);
      if (s) await executeFrom(s.id);
    } else if (input === '!status') {
      const { rows: [s] } = await db.query(
        `SELECT cfs.*, fn.name as node_name, fn.node_type FROM contact_flow_states cfs
         LEFT JOIN flow_nodes fn ON fn.id = cfs.current_node_id
         WHERE cfs.contact_id=$1 AND cfs.flow_id=$2`,
        [contact.id, flowId]
      );
      console.log('[sim] Estado:', s ? `${s.status} | nó: ${s.node_name} (${s.node_type})` : 'nenhum');
    } else {
      console.log(`[você→funil] ${input}`);
      await sendMessage(contact, flowId, input);
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log('\n[sim] Encerrando...');
    process.exit(0);
  });
}

main().catch(e => { console.error(e); process.exit(1); });
