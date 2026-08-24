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
      const { data } = await axios.get(url, {
        timeout: 120000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*'
        }
      });

      // Navigate through potential nested object layers
      let speech = data?.result;

      if (typeof speech === 'object' && speech !== null) {
        speech = speech.data?.speech || speech.speech || speech.result || speech.text || speech.content;
      }

      // Fallback stringify if it's still an object
      if (typeof speech === 'object' && speech !== null) {
        speech = JSON.stringify(speech, null, 2);
      }

      if (!speech || typeof speech !== 'string') {
        throw new Error('Could not parse valid speech text from response.');
      }

      await sock.sendMessage(
        jid,
        { text: `🎙️ *Generated Speech*\n\n${speech.trim()}`, edit: thinkingMsg.key },
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

