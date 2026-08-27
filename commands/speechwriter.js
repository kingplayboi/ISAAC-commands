const axios = require('axios');
const { KEITH_BASE } = require('../config/apis');

const API = KEITH_BASE;

function extractSpeech(data) {
  if (!data) return null;
  if (typeof data === 'string') return data.trim() || null;
  if (data.status === false || data.success === false) return null;

  const candidates = [
    data.result,
    data.result?.speech,
    data.result?.data,
    data.result?.data?.speech,
    data.result?.data?.data,
    data.result?.data?.data?.speech,
    data.speech,
    data.response,
    data.data,
  ];

  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c;
  }

  // A few APIs nest the text under a differently-named field on an object
  for (const c of candidates) {
    if (c && typeof c === 'object') {
      const nested = c.speech || c.text || c.content || c.message;
      if (typeof nested === 'string' && nested.trim()) return nested;
    }
  }

  return null;
}

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

    // 1. Try primary API
    try {
      const url = `${API}/ai/speechwriter?topic=${encodeURIComponent(query)}&length=short&type=dedication&tone=serious`;
      const { data } = await axios.get(url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*'
        }
      });

      speech = extractSpeech(data);
      if (!speech) {
        console.error('[SPEECHWRITER] Primary API returned no usable speech. Raw:', JSON.stringify(data).slice(0, 500));
      }
    } catch (e) {
      console.error('[SPEECHWRITER] Primary API request failed:', e.response?.status, e.response?.data || e.message);
    }

    // 2. Fallback to Gemini if primary failed or returned nothing usable
    if (!speech) {
      try {
        const fallbackUrl = `${API}/ai/gemini?q=${encodeURIComponent(
          `Write a powerful, well-crafted, serious speech on the following topic: "${query}". Keep it well-formatted with clear paragraphs.`
        )}`;
        const { data } = await axios.get(fallbackUrl, { timeout: 30000 });
        speech = extractSpeech(data);
        if (!speech) {
          console.error('[SPEECHWRITER] Gemini fallback returned no usable speech. Raw:', JSON.stringify(data).slice(0, 500));
        }
      } catch (err) {
        console.error('[SPEECHWRITER] Gemini fallback request failed:', err.response?.status, err.response?.data || err.message);
      }
    }

    if (!speech) {
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

