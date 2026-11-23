function getField(fields, name) {
  if (fields[name] !== undefined) return String(fields[name]);
  const lower = name.toLowerCase();
  for (const k of Object.keys(fields)) {
    if (k.toLowerCase() === lower) return String(fields[k]);
  }
  return '';
}

function evaluateOne(cond, contact) {
  const tags = contact.tags || [];
  const fields = contact.custom_fields || {};

  if (cond.category === 'system' && cond.systemSubtype === 'tag') {
    const tagName = (cond.tagName || '').toLowerCase();
    return tags.some(t => t.toLowerCase() === tagName);
  }

  const val = getField(fields, cond.fieldName || '').toLowerCase();
  const target = String(cond.fieldValue || '').toLowerCase();

  if (cond.fieldOperator === 'contains') return val.includes(target);
  if (cond.fieldOperator === 'equal') return val === target;
  return false;
}

function evaluate(config, contact) {
  const { ruleType = 'any', conditions = [] } = config;
  if (!conditions.length) return false;
  const results = conditions.map(c => evaluateOne(c, contact));
  return ruleType === 'all' ? results.every(Boolean) : results.some(Boolean);
}

module.exports = { evaluate };
