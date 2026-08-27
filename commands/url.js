const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const mime = require('mime-types');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { uploadToImgBB, uploadMedia } = require('../lib/upload');

function extractQuotedImage(msg) {
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  const quoted = ctx?.quotedMessage;
  if (quoted?.imageMessage) {
    return {
      message: quoted,
      key: { remoteJid: msg.key.remoteJid, id: ctx.stanzaId, fromMe: false, participant: ctx.participant },
      mimetype: quoted.imageMessage.mimetype || 'image/jpeg',
    };
  }
  if (msg.message?.imageMessage) {
    return {
      message: msg.message,
      key: msg.key,
      mimetype: msg.message.imageMessage.mimetype || 'image/jpeg',
    };
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

    let tempPath;
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

      const ext = mime.extension(target.mimetype) || 'jpg';
      tempPath = path.join(os.tmpdir(), `url_${Date.now()}.${ext}`);
      await fs.writeFile(tempPath, buffer);

      let link;
      try {
        link = await uploadToImgBB(tempPath);
      } catch (e) {
        console.error('[URL] imgbb failed, falling back to generic hosts:', e.message);
        link = await uploadMedia(tempPath);
      }

      await sock.sendMessage(jid, { text: `Media Link:-\n\n${link}` }, { quoted: msg });
    } catch (error) {
      console.error('[URL ERROR]', error.message);
      await sock.sendMessage(jid, { text: `❌ Upload failed: ${error.message}` }, { quoted: msg });
    } finally {
      if (tempPath) fs.remove(tempPath).catch(() => {});
    }
  },
};

