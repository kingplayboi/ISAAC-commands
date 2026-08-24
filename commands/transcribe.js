const axios = require('axios');
const FormData = require('form-data');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { KEITH_BASE } = require('../config/apis');

const API = KEITH_BASE;

async function uploadToCatbox(buffer, filename) {
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  form.append('fileToUpload', buffer, { filename });
  const res = await axios.post('https://catbox.moe/user/api.php', form, { headers: form.getHeaders() });
  return res.data;
}

module.exports = {
  name: 'transcribe',
  aliases: ['speech2text', 'audio2text', 'whisper'],
  description: 'Transcribe quoted audio or video to text',

  async execute(sock, msg) {
    const rawJid = msg.key.remoteJid;
    const jid = rawJid.endsWith('@lid') && msg.key.remoteJidAlt ? msg.key.remoteJidAlt : rawJid;

    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    const quoted = ctx?.quotedMessage;

    const audioMsg = quoted?.audioMessage;
    const videoMsg = quoted?.videoMessage;

    if (!audioMsg && !videoMsg) {
      return sock.sendMessage(
        jid,
        { text: '📌 Reply to an audio or video message to transcribe it.' },
        { quoted: msg }
      );
    }

    const thinkingMsg = await sock.sendMessage(jid, { text: '🎙️ *Transcribing audio...*' }, { quoted: msg });

    try {
      const buffer = await downloadMediaMessage(
        { key: { remoteJid: jid, id: ctx.stanzaId, fromMe: false, participant: ctx.participant }, message: quoted },
        'buffer',
        {},
        { reuploadRequest: sock.updateMediaMessage }
      );

      const ext = audioMsg ? 'mp3' : 'mp4';
      const mediaUrl = await uploadToCatbox(buffer, `media.${ext}`);

      const { data } = await axios.get(`${API}/ai/transcribe?q=${encodeURIComponent(mediaUrl)}`, { timeout: 180000 });

      if (!data?.status || !data?.result?.text) {
        throw new Error('No transcription text returned.');
      }

      await sock.sendMessage(
        jid,
        { text: `📝 *Transcription*\n\n${data.result.text}`, edit: thinkingMsg.key },
        { quoted: msg }
      );
    } catch (err) {
      console.error('[TRANSCRIBE ERROR]', err);
      await sock.sendMessage(
        jid,
        { text: `❌ Failed to transcribe: ${err.message}`, edit: thinkingMsg.key },
        { quoted: msg }
      );
    }
  },
};
