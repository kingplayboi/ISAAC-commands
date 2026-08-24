const axios = require('axios');
const FormData = require('form-data');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { KEITH_BASE } = require('../config/apis');

async function uploadToCatbox(buffer, filename) {
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  form.append('fileToUpload', buffer, { filename });
  const res = await axios.post('https://catbox.moe/user/api.php', form, { headers: form.getHeaders() });
  return res.data;
}

module.exports = {
  name: 'vision2',
  aliases: ['v2', 'analyze2', 'imgai2'],
  description: 'Analyze an image with AI (quote an image)',

  async execute(sock, msg, args) {
    const rawJid = msg.key.remoteJid;
    const jid = rawJid.endsWith('@lid') && msg.key.remoteJidAlt
      ? msg.key.remoteJidAlt
      : rawJid;

    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    const quoted = ctx?.quotedMessage;
    const question = args.join(' ').trim();

    if (!quoted?.imageMessage) {
      return await sock.sendMessage(
        jid,
        { text: '📌 Reply to an image message to analyze it.' },
        { quoted: msg }
      );
    }

    if (!question) {
      return await sock.sendMessage(
        jid,
        { text: '❌ Provide a question/instruction!\nExample: *.vision2 what is in this image?*' },
        { quoted: msg }
      );
    }

    const thinkingMsg = await sock.sendMessage(
      jid,
      { text: '🤖 *Analyzing your image...*' },
      { quoted: msg }
    );

    try {
      const buffer = await downloadMediaMessage(
        { key: { remoteJid: jid, id: ctx.stanzaId, fromMe: false, participant: ctx.participant }, message: quoted },
        'buffer',
        {},
        { reuploadRequest: sock.updateMediaMessage }
      );

      const imageUrl = await uploadToCatbox(buffer, 'image.jpg');

      const res = await axios.get(
        `${KEITH_BASE}/ai/vision?image=${encodeURIComponent(imageUrl)}&q=${encodeURIComponent(question)}`,
        { timeout: 120000 }
      );
      const result = res.data;

      if (!result?.status || !result?.result) {
        return await sock.sendMessage(
          jid,
          { text: '❌ No response from Vision AI. Try again.', edit: thinkingMsg.key },
          { quoted: msg }
        );
      }

      const responseText = typeof result.result === 'string'
        ? result.result
        : result.result.response || JSON.stringify(result.result);

      await sock.sendMessage(
        jid,
        { text: `👁️ *Vision Analysis*\n\n${responseText}`, edit: thinkingMsg.key },
        { quoted: msg }
      );
    } catch (error) {
      console.error('[VISION2 ERROR]', error);
      await sock.sendMessage(
        jid,
        { text: `❌ Failed to analyze image: ${error.message}`, edit: thinkingMsg.key },
        { quoted: msg }
      );
    }
  },
};

