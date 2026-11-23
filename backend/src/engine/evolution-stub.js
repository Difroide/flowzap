const delay = ms => new Promise(r => setTimeout(r, ms));

async function sendText(instance, phone, text, delayMs = 0) {
  if (delayMs) await delay(delayMs);
  console.log(`[stub][${instance}→${phone}] TEXT: ${text}`);
}

async function sendMedia(instance, phone, { mediatype, media, fileName }, delayMs = 0) {
  if (delayMs) await delay(delayMs);
  console.log(`[stub][${instance}→${phone}] MEDIA(${mediatype}) ${fileName || ''}: ${media}`);
}

async function sendAudio(instance, phone, audio, delayMs = 0) {
  if (delayMs) await delay(delayMs);
  console.log(`[stub][${instance}→${phone}] AUDIO: ${audio}`);
}

module.exports = { sendText, sendMedia, sendAudio };
