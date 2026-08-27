const axios = require('axios');
const FormData = require('form-data');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ── Upload hosts, tried in order until one works ─────────────────────────
// catbox has been actively blocking known hosting/VPS IP ranges — a 412
// there regardless of headers is that signature, not something a header
// fixes. 0x0.st is the fallback; it also requires a User-Agent or it
// rejects the request outright.

async function uploadCatbox(buffer, filename) {
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  form.append('fileToUpload', buffer, { filename });
  const res = await axios.post('https://catbox.moe/user/api.php', form, {
    headers: { ...form.getHeaders(), 'User-Agent': BROWSER_UA },
    timeout: 30000,
  });
  const url = String(res.data).trim();
  if (!url.startsWith('http')) throw new Error(url || 'unexpected response');
  return url;
}

async function upload0x0(buffer, filename) {
  const form = new FormData();
  form.append('file', buffer, { filename });
  const res = await axios.post('https://0x0.st', form, {
    headers: { ...form.getHeaders(), 'User-Agent': BROWSER_UA },
    timeout: 30000,
  });
  const url = String(res.data).trim();
  if (!url.startsWith('http')) throw new Error(url || 'unexpected response');
  return url;
}

const UPLOAD_HOSTS = [
  { name: 'catbox', upload: uploadCatbox },
  { name: '0x0.st', upload: upload0x0 },
];

async function uploadToAnyHost(buffer, filename) {
  const failures = [];
  for (const { name, upload } of UPLOAD_HOSTS) {
    try {
      const url = await upload(buffer, filename);
      console.log(`[URL] Upload succeeded via ${name}`);
      return url;
    } catch (e) {
      const reason = e.response?.status ? `HTTP ${e.response.status}` : e.message;
      console.error(`[URL] ${name} failed:`, reason);
      failures.push(`${name}: ${reason}`);
    }
  }
  throw new Error(failures.join(' | '));
}

function extractQuotedImage(msg) {
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  const quoted = ctx?.quotedMessage;
  if (quoted?.imageMessage) {
    return {
      message: quoted,
      key: { remoteJid: msg.key.remoteJid, id: ctx.stanzaId, fromMe: false, participant: ctx.participant },
    };
  }
  if (msg.message?.imageMessage) {
    return { message: msg.message, key: msg.key };
  }
  return null;
}

module.exports = {
  name: 'url',
  aliases: ['imgurl', 'uploads'],
  description: 'Upload a quoted image and get a direct link',

  async execute(sock, msg) {
    const jid = msg.key.remoteJid;
    const target = extractQuotedImage(msg);

    if (!target) {
      return await sock.sendMessage(jid, { text: 'Quote an image with *.url*.' }, { quoted: msg });
    }

    try {
      const buffer = await downloadMediaMessage(
        { key: target.key, message: target.message },
        'buffer',
        {},
        { reuploadRequest: sock.updateMediaMessage }
      );

      if (buffer.length > 10 * 1024 * 1024) {
        return await sock.sendMessage(jid, { text: 'Media is too large (max 10MB).' }, { quoted: msg });
      }

      const link = await uploadToAnyHost(buffer, 'image.jpg');
      await sock.sendMessage(jid, { text: `Media Link:-\n\n${link}` }, { quoted: msg });
    } catch (error) {
      console.error('[URL ERROR]', error.message);
      await sock.sendMessage(jid, { text: `❌ Upload failed on all hosts: ${error.message}` }, { quoted: msg });
    }
  },
};

