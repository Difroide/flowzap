const BASE = process.env.EVOLUTION_URL || 'http://localhost:8080';
const APIKEY = process.env.EVOLUTION_APIKEY || 'flowdev123';

async function evo(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'apikey': APIKEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw Object.assign(new Error(`Evolution ${method} ${path} → ${res.status}: ${text}`), { status: res.status, body: text });
  return text ? JSON.parse(text) : null;
}

function createInstance(name) {
  return evo('POST', '/instance/create', { instanceName: name, qrcode: true, integration: 'WHATSAPP-BAILEYS' });
}

function connect(name) {
  return evo('GET', `/instance/connect/${name}`);
}

function connectionState(name) {
  return evo('GET', `/instance/connectionState/${name}`);
}

function logout(name) {
  return evo('DELETE', `/instance/logout/${name}`);
}

function deleteInstance(name) {
  return evo('DELETE', `/instance/delete/${name}`);
}

function setWebhook(name, url) {
  return evo('POST', `/webhook/set/${name}`, {
    webhook: {
      enabled: true,
      url: url || `${process.env.PUBLIC_URL}/webhook/evolution`,
      events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
    },
  });
}

function sendText(name, number, text, delay) {
  return evo('POST', `/message/sendText/${name}`, { number, text, delay });
}

function sendMedia(name, number, { mediatype, media, fileName, caption, delay }) {
  return evo('POST', `/message/sendMedia/${name}`, { number, mediatype, media, fileName, caption, delay });
}

function sendAudio(name, number, audioUrl, delay) {
  return evo('POST', `/message/sendWhatsAppAudio/${name}`, { number, audio: audioUrl, delay });
}

function fetchInstances() {
  return evo('GET', '/instance/fetchInstances');
}

module.exports = { createInstance, connect, connectionState, fetchInstances, logout, deleteInstance, setWebhook, sendText, sendMedia, sendAudio };
