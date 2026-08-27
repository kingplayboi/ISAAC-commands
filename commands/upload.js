const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const mime = require('mime-types');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { uploadMedia } = require('../lib/upload');

function extractQuotedMedia(msg) {
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  const quoted = ctx?.quotedMessage;
  const typeOf = (m) => m?.imageMessage ? 'imageMessage' : m?.videoMessage ? 'videoMessage' : m?.audioMessage ? 'audioMessage' : null;

  if (quoted) {
    const t = typeOf(quoted);
    if (t) {
      return {
        message: quoted,
        key: { remoteJid: msg.key.remoteJid, id: ctx.stanzaId, fromMe: false, participant: ctx.participant },
        mimetype: quoted[t]?.mimetype || '',
      };
    }
  }
  if (msg.message) {
    const t = typeOf(msg.message);
    if (t) {
      return {
        message: msg.message,
        key: msg.key,
        mimetype: msg.message[t]?.mimetype || '',
      };
    }
  }
  return null;
}

module.exports = {
  name: 'upload',
  description: 'Upload a quoted image, video, or audio and get a link',

  async execute(sock, msg) {
    const jid = msg.key.remoteJid;
    const target = extractQuotedMedia(msg);

    if (!target) {
      return await sock.sendMessage(jid, { text: 'Quote an image, video, or audio message.' }, { quoted: msg });
    }

    let tempPath;
    try {
      const buffer = await downloadMediaMessage(
        { key: target.key, message: target.message },
        'buffer',
        {},
        { reuploadRequest: sock.updateMediaMessage }
      );

      if (buffer.length > 190 * 1024 * 1024) {
        return await sock.sendMessage(jid, { text: 'Media is too large (max ~190MB).' }, { quoted: msg });
      }

      const ext = mime.extension(target.mimetype) || 'bin';
      tempPath = path.join(os.tmpdir(), `upload_${Date.now()}.${ext}`);
      await fs.writeFile(tempPath, buffer);

      const link = await uploadMedia(tempPath);
      await sock.sendMessage(jid, { text: `Media Link:-\n\n${link}` }, { quoted: msg });
    } catch (error) {
      console.error('[UPLOAD ERROR]', error.message);
      await sock.sendMessage(jid, { text: `Upload failed: ${error.message}` }, { quoted: msg });
    } finally {
      if (tempPath) fs.remove(tempPath).catch(() => {});
    }
  },
};

