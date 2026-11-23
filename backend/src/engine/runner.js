const db = require('../db');
const { executeAction } = require('./actions');

async function executeFrom(stateId) {
  const MAX_ITER = 100;

  for (let i = 0; i < MAX_ITER; i++) {
    const { rows: [state] } = await db.query('SELECT * FROM contact_flow_states WHERE id=$1', [stateId]);
    if (!state || state.status === 'done') return;

    const { rows: [contact] } = await db.query('SELECT * FROM contacts WHERE id=$1', [state.contact_id]);
    if (!contact) return;

    // inject instance_name from flow
    if (!state.instance_name) {
      const { rows: [flow] } = await db.query('SELECT instance_name FROM flows WHERE id=$1', [state.flow_id]);
      state.instance_name = flow ? flow.instance_name : null;
    }

    if (!state.current_node_id) {
      await db.query(`UPDATE contact_flow_states SET status='done', updated_at=now() WHERE id=$1`, [stateId]);
      return;
    }

    const { rows: actions } = await db.query(
      'SELECT * FROM flow_node_actions WHERE node_id=$1 ORDER BY sort_order ASC',
      [state.current_node_id]
    );
    const { rows: connections } = await db.query(
      'SELECT * FROM flow_connections WHERE from_node_id=$1',
      [state.current_node_id]
    );

    let blocked = false;
    let conditionResult = null;

    for (let ai = 0; ai < actions.length; ai++) {
      const action = actions[ai];

      if (action.action_type === 'wait_for_response' || action.action_type === 'smart_interval') {
        // process save_user_data actions that come after the blocking action
        for (let j = ai + 1; j < actions.length; j++) {
          if (actions[j].action_type === 'save_user_data') {
            await executeAction(actions[j], state, contact);
          }
        }
        await executeAction(action, state, contact);
        blocked = true;
        break;
      }

      const result = await executeAction(action, state, contact);
      if (result && result.conditionResult !== undefined) {
        conditionResult = result.conditionResult;
      }
    }

    if (blocked) return;

    // choose next connection
    let next = null;
    if (conditionResult !== null) {
      const want = conditionResult ? 'success' : 'failure';
      next = connections.find(c => c.condition_config && c.condition_config.condition_result === want);
    }
    if (!next) {
      next = connections.find(c => {
        const cc = c.condition_config || {};
        return !cc.condition_result && !cc.source_handle;
      });
    }
    if (!next && connections.length) next = connections[0];

    if (!next) {
      await db.query(`UPDATE contact_flow_states SET status='done', updated_at=now() WHERE id=$1`, [stateId]);
      return;
    }

    await db.query(
      `UPDATE contact_flow_states SET current_node_id=$1, status='running', updated_at=now() WHERE id=$2`,
      [next.to_node_id, stateId]
    );
  }

  console.warn(`[runner] stateId=${stateId} atingiu ${MAX_ITER} iterações sem terminar`);
}

module.exports = { executeFrom };
