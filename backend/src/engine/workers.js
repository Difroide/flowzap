require('dotenv').config();
const { Worker } = require('bullmq');
const db = require('../db');
const { executeFrom } = require('./runner');
const { connection } = require('./queue');

const worker = new Worker('flow-timeouts', async job => {
  const { stateId, kind } = job.data;

  const { rows: [state] } = await db.query('SELECT * FROM contact_flow_states WHERE id=$1', [stateId]);
  if (!state) return;

  if (kind === 'timeout') {
    if (state.status !== 'waiting_response') return;

    const { rows: connections } = await db.query(
      'SELECT * FROM flow_connections WHERE from_node_id=$1',
      [state.current_node_id]
    );
    const nextConn = connections.find(c => c.condition_config?.source_handle === 'timeout');

    if (nextConn) {
      await db.query(
        `UPDATE contact_flow_states SET current_node_id=$1, status='running', timeout_job_id=NULL, updated_at=now() WHERE id=$2`,
        [nextConn.to_node_id, stateId]
      );
      await executeFrom(stateId);
    } else {
      await db.query(
        `UPDATE contact_flow_states SET status='done', timeout_job_id=NULL, updated_at=now() WHERE id=$1`,
        [stateId]
      );
    }
    return;
  }

  if (kind === 'interval') {
    if (state.status !== 'waiting_interval') return;

    const { rows: connections } = await db.query(
      'SELECT * FROM flow_connections WHERE from_node_id=$1',
      [state.current_node_id]
    );
    const nextConn = connections.find(c => {
      const cc = c.condition_config || {};
      return !cc.condition_result && !cc.source_handle;
    });

    if (nextConn) {
      await db.query(
        `UPDATE contact_flow_states SET current_node_id=$1, status='running', updated_at=now() WHERE id=$2`,
        [nextConn.to_node_id, stateId]
      );
      await executeFrom(stateId);
    } else {
      await db.query(
        `UPDATE contact_flow_states SET status='done', updated_at=now() WHERE id=$1`,
        [stateId]
      );
    }
    return;
  }

}, { connection });

worker.on('failed', (job, err) => {
  console.error(`[workers] job ${job?.id} falhou:`, err.message);
});

console.log('[workers] flow-timeouts worker iniciado');

module.exports = worker;
