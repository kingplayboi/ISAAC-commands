const https = require('https');
const { KEITH_BASE } = require('../config/apis');

// Same helper shape as commands/ai.js's httpsGetJSON — reusing the pattern
// that's already confirmed working against Keith's response format.
function httpsGetJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function fetchSpeech(topic) {
  const url = `${KEITH_BASE}/ai/speechwriter?topic=${encodeURIComponent(topic)}&length=short&type=dedication&tone=serious`;
  const json = await httpsGetJSON(url);

  if (!json.status || !json.result) {
    // Keith puts a human-readable reason in `result` even on failure
    // (confirmed via curl on the ytmp4 endpoint) — surface it if present.
    throw new Error(typeof json.result === 'string' ? json.result : (json.error || 'API returned no result.'));
  }

  return typeof json.result === 'string' ? json.result : JSON.stringify(json.result);
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

    // 1. Primary: dedicated speechwriter endpoint
    try {
      speech = await fetchSpeech(query);
    } catch (e) {
      console.error('[SPEECHWRITER] Primary endpoint failed:', e.message);
    }

    // 2. Fallback: the same /ai/gpt4 endpoint the .gpt/.groq/.gemini/.bing
    // commands already use successfully, with a speech-writing prompt.
    if (!speech) {
      try {
        const prompt = `Write a powerful, well-crafted, serious speech on the following topic: "${query}". Keep it well-formatted with clear paragraphs.`;
        const json = await httpsGetJSON(`${KEITH_BASE}/ai/gpt4?q=${encodeURIComponent(prompt)}`);
        if (json.status && json.result) {
          speech = typeof json.result === 'string' ? json.result : JSON.stringify(json.result);
        } else {
          console.error('[SPEECHWRITER] Fallback returned no usable result. Raw:', JSON.stringify(json).slice(0, 500));
        }
      } catch (err) {
        console.error('[SPEECHWRITER] Fallback request failed:', err.message);
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

