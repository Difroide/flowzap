function getField(fields, name) {
  if (fields[name] !== undefined) return String(fields[name]);
  const lower = name.toLowerCase();
  for (const k of Object.keys(fields)) {
    if (k.toLowerCase() === lower) return String(fields[k]);
  }
  return '';
}

function interpolate(text, contact) {
  if (!text) return text || '';
  const fields = contact.custom_fields || {};
  return text.replace(/\{([^}]+)\}/g, (_, key) => {
    if (key === 'full_name') return contact.name || '';
    if (key === 'phone_number') return contact.phone || '';
    if (key === 'source_url') return contact.custom_fields?.source_url || '';
    if (key === 'stl_session') return contact.custom_fields?.stl_session || '';
    return getField(fields, key);
  });
}

module.exports = { interpolate };
