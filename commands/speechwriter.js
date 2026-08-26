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

    let speech = null;

    // 1. Try Primary API
    try {
      const url = `${API}/ai/speechwriter?topic=${encodeURIComponent(query)}&length=short&type=dedication&tone=serious`;
      const { data } = await axios.get(url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*'
        }
      });

      if (data && data.success !== false) {
        speech = data?.result?.data?.data?.speech
          || data?.result?.data?.speech
          || data?.result?.speech
          || data?.result?.data
          || data?.result;

        if (typeof speech === 'object' && speech !== null) {
          speech = speech.speech || speech.text || speech.content;
        }
      }
    } catch (e) {
      console.log('[SPEECHWRITER API FAILED, FALLING BACK TO GEMINI]', e.message);
    }

    // 2. Fallback to Gemini AI if API failed or returned nonce error
    if (!speech || typeof speech !== 'string') {
      try {
        const fallbackUrl = `${API}/ai/gemini?q=${encodeURIComponent(
          `Write a powerful, well-crafted, serious speech on the following topic: "${query}". Keep it well-formatted with clear paragraphs.`
        )}`;
        const { data } = await axios.get(fallbackUrl, { timeout: 30000 });
        
        speech = data?.result || data?.response || data?.data;
      } catch (err) {
        console.error('[SPEECHWRITER FALLBACK ERROR]', err);
      }
    }

    if (!speech || typeof speech !== 'string') {
      return await sock.sendMessage(
        jid,
        { text: '❌ *Failed to generate speech. Please try again later.*', edit: thinkingMsg.key },
        { quoted: msg }
      );
    }

    await sock.sendMessage(
      jid,
      { text: `🎙️ *Generated Speech*\n\n${speech.trim()}`, edit: thinkingMsg.key },
      { quoted: msg }
    );
  },
};

