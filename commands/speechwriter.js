const axios = require('axios');
const { KEITH_BASE } = require('../config/apis');

const API = KEITH_BASE;

module.exports = {
  name: 'speechwriter',
  aliases: ['speech', 'writer'],
  description: 'Generate a custom speech on any topic',

  async execute(sock, msg, args) {
    const rawJid = msg.key.remoteJid;
    const jid = rawJid.endsWith('@lid') && msg.key.remoteJidAlt ? msg.key.remoteJidAlt : rawJid;
    const query = args.join(' ').trim();

    if (!query) {
      return sock.sendMessage(
        jid,
        { text: '❌ Provide a topic, e.g. `.speechwriter how to pass exams`' },
        { quoted: msg }
      );
    }

    const thinkingMsg = await sock.sendMessage(jid, { text: '✍️ *Drafting your speech...*' }, { quoted: msg });

    try {
      const url = `${API}/ai/speechwriter?topic=${encodeURIComponent(query)}&length=short&type=dedication&tone=serious`;
      const { data } = await axios.get(url, { timeout: 120000 });

      let speech = data?.result?.data?.data?.speech || data?.result?.speech || data?.result;

      if (typeof speech === 'object' && speech !== null) {
        speech = speech.text || speech.content || speech.speech || JSON.stringify(speech, null, 2);
      }

      if (!speech || typeof speech !== 'string') {
        throw new Error('Speechwriter API returned an invalid response.');
      }

      await sock.sendMessage(
        jid,
        { text: `🎙️ *Generated Speech*\n\n${speech}`, edit: thinkingMsg.key },
        { quoted: msg }
      );
    } catch (err) {
      console.error('[SPEECHWRITER ERROR]', err);
      await sock.sendMessage(
        jid,
        { text: `❌ Failed to fetch speech: ${err.message}`, edit: thinkingMsg.key },
        { quoted: msg }
      );
    }
  },
};

