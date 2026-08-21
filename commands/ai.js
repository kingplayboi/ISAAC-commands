const https = require('https');
const http = require('http');

require('dotenv').config();

const GEMINI_KEY = process.env.GEMINI_KEY;
const { askUncensored } = require('../lib/wormgpt');
const { KEITH_BASE } = require('../config/apis');
const BK9_BASE = 'https://api.bk9.dev';

const geminiSessions = new Map();
const groqSessions = new Map();
const gptSessions = new Map();
const mistralSessions = new Map();
const wormgptSessions = new Map();

function getHistory(store, id) {
  return store.get(id) || [];
}

function pushHistory(store, id, role, content) {
  const history = getHistory(store, id);
  history.push({ role, content });
  if (history.length > 20) history.shift();
  store.set(id, history);
}

function buildPrompt(history, input) {
  let out = '';
  for (const msg of history) {
    out += `${msg.role === 'user' ? 'User' : 'AI'}: ${msg.content}\n`;
  }
  out += `User: ${input}`;
  return out;
}

// ── Helper: HTTPS GET returning parsed JSON ───────────────────────────────
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

// ── Helper: HTTPS POST ─────────────────────────────────────────────────────
function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({ hostname, path, method: 'POST', headers: { ...headers, 'Content-Length': Buffer.byteLength(data) } }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch { resolve({ error: raw }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ── Helper: Download image buffer from URL ────────────────────────────────
function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// Tries primary Keith endpoint first; on any failure, falls back to BK9
async function getAIReply(endpointPath, prompt) {
  const encoded = encodeURIComponent(prompt);

  try {
    const json = await httpsGetJSON(`${KEITH_BASE}${endpointPath}?q=${encoded}`);
    if (!json.status || !json.result) throw new Error(json.error || 'Keith API returned invalid status');
    return { reply: typeof json.result === 'string' ? json.result : JSON.stringify(json.result), usedFallback: false };
  } catch (primaryErr) {
    try {
      const json = await httpsGetJSON(`${BK9_BASE}/ai/llama?q=${encoded}`);
      if (!json.status) throw new Error(json.err || 'BK9 API returned status:false');
      return { reply: json.BK9, usedFallback: true };
    } catch (fallbackErr) {
      throw new Error(`Primary API failed: ${primaryErr.message} — Fallback API failed: ${fallbackErr.message}`);
    }
  }
}

// Runs a memory-backed AI chat command
function makeChatCommand({ name, aliases, label, emoji, sessions, endpointPath, brandReplace }) {
  return {
    name,
    aliases,
    description: `Chat with ${label} (remembers conversation). Usage: .${name} your question`,
    async execute(sock, msg, args) {
      const jid = msg.key.remoteJid;
      const text = args.join(' ').trim();
      const userId = msg.key.participant || jid;

      if (!text) {
        return sock.sendMessage(
          jid,
          { text: `❌ Usage: .${name} your question\n\n💡 Use .${name} -clear to reset conversation history.` },
          { quoted: msg }
        );
      }

      if (text === '-clear') {
        sessions.delete(userId);
        return sock.sendMessage(jid, { text: `🧹 *${label} history cleared!* Fresh start.` }, { quoted: msg });
      }

      const thinkingMsg = await sock.sendMessage(
        jid,
        { text: `${emoji} ${label} is thinking...` },
        { quoted: msg }
      );

      try {
        const history = getHistory(sessions, userId);
        const prompt = buildPrompt(history, text);

        const { reply: rawReply, usedFallback } = await getAIReply(endpointPath, prompt);

        const reply = rawReply
          .replace(brandReplace[0], brandReplace[1])
          .replace(brandReplace[2], brandReplace[3]);

        pushHistory(sessions, userId, 'user', text);
        pushHistory(sessions, userId, 'assistant', reply);

        const fallbackNote = usedFallback ? '\n\n_(via backup AI — primary was unavailable)_' : '';

        await sock.sendMessage(
          jid,
          { text: `${emoji} *${label}*\n\n${reply}${fallbackNote}`, edit: thinkingMsg.key },
          { quoted: msg }
        );
      } catch (err) {
        await sock.sendMessage(
          jid,
          { text: `❌ ${label} error: ${err.message}`, edit: thinkingMsg.key },
          { quoted: msg }
        );
      }
    },
  };
}

module.exports = [

  // ── Operational Keith Endpoints ──────────────────────────────────────────
  makeChatCommand({
    name: 'gpt',
    aliases: ['gpt4', 'chatgpt'],
    label: 'GPT-4 AI',
    emoji: '🧠',
    sessions: gptSessions,
    endpointPath: '/ai/gpt4',
    brandReplace: [/Keith AI/gi, 'ISAAC AI', /Keithkeizzah/gi, 'ISAAC'],
  }),

  makeChatCommand({
    name: 'mistral',
    aliases: ['mi'],
    label: 'Mistral AI',
    emoji: '🌀',
    sessions: mistralSessions,
    endpointPath: '/ai/mistral',
    brandReplace: [/Keith AI/gi, 'ISAAC AI', /Keithkeizzah/gi, 'ISAAC'],
  }),

  makeChatCommand({
    name: 'groq',
    aliases: ['groqai'],
    label: 'Groq AI',
    emoji: '⚡',
    sessions: groqSessions,
    endpointPath: '/ai/chatgpt4',
    brandReplace: [/Keith AI/gi, 'ISAAC AI', /Keithkeizzah/gi, 'ISAAC'],
  }),

  makeChatCommand({
    name: 'gemini',
    aliases: ['gai'],
    label: 'Gemini AI',
    emoji: '🤖',
    sessions: geminiSessions,
    endpointPath: '/ai/gpt4',
    brandReplace: [/Keith AI/gi, 'ISAAC AI', /Keithkeizzah/gi, 'ISAAC'],
  }),

  // ── WORM (uncensored) ───────────────────────────────────────────────────
  {
    name: 'worm',
    aliases: ['wormgpt', 'wgpt', 'dark', 'darkgpt'],
    description: 'WormGPT with conversation memory. Usage: .worm your question',
    async execute(sock, msg, args) {
      const jid = msg.key.remoteJid;
      const text = args.join(' ').trim();
      const userId = msg.key.participant || jid;

      if (!text) {
        return sock.sendMessage(
          jid,
          { text: '❌ Usage: .worm your question\n\n💡 Use .worm -clear to reset conversation history.' },
          { quoted: msg }
        );
      }

      if (text === '-clear') {
        wormgptSessions.delete(userId);
        return sock.sendMessage(jid, { text: '🧹 *WormGPT history cleared!* Fresh start.' }, { quoted: msg });
      }

      const thinkingMsg = await sock.sendMessage(jid, { text: '☠️ WormGPT is thinking...' }, { quoted: msg });

      try {
        const systemPrompt = `
You are WormGPT, a dark cyberpunk AI assistant with memory.
You are witty, mysterious, sarcastic, and entertaining.
Use emojis naturally when they fit the mood (💀🔥😈🧪😂).
Remember previous messages in the conversation and maintain context.
Created by Isaac and Muarabu.
`;
        const history = getHistory(wormgptSessions, userId);
        const prompt = buildPrompt(history, text);
        const combined = `${systemPrompt}\n\n${prompt}\n\nWormGPT:`;

        const reply = await askUncensored(combined);

        pushHistory(wormgptSessions, userId, 'user', text);
        pushHistory(wormgptSessions, userId, 'assistant', reply);

        await sock.sendMessage(
          jid,
          { text: `☠️ *WormGPT*\n\n${reply}`, edit: thinkingMsg.key },
          { quoted: msg }
        );
      } catch (e) {
        await sock.sendMessage(
          jid,
          { text: '❌ WormGPT error: ' + e.message, edit: thinkingMsg.key },
          { quoted: msg }
        );
      }
    },
  },

  // ── DALL (Image generation via Pollinations) ─────────────────────────────
  {
    name: 'dall',
    description: 'Generate AI image. Usage: .dall your prompt',
    async execute(sock, msg, args) {
      const jid = msg.key.remoteJid;
      const prompt = args.join(' ');
      if (!prompt) return sock.sendMessage(jid, { text: '❌ Usage: .dall your image prompt' }, { quoted: msg });

      const thinkingMsg = await sock.sendMessage(jid, { text: '🎨 Generating image...' }, { quoted: msg });

      try {
        const encoded = encodeURIComponent(prompt);
        const url = `https://image.pollinations.ai/prompt/${encoded}?width=512&height=512&nologo=true`;
        const buffer = await downloadImage(url);

        await sock.sendMessage(jid, { image: buffer, caption: `🎨 *AI Image*\n📝 Prompt: ${prompt}` }, { quoted: msg });
        await sock.sendMessage(jid, { delete: thinkingMsg.key }).catch(() => {});
      } catch (e) {
        await sock.sendMessage(jid, { text: '❌ Image generation error: ' + e.message, edit: thinkingMsg.key });
      }
    },
  },

  // ── BING (via Gemini 2.5 Flash) ─────────────────────────────────────────
  {
    name: 'bing',
    description: 'Ask Bing-style AI. Usage: .bing your question',
    async execute(sock, msg, args) {
      const jid = msg.key.remoteJid;
      const prompt = args.join(' ');
      if (!prompt) return sock.sendMessage(jid, { text: '❌ Usage: .bing your question' }, { quoted: msg });

      const thinkingMsg = await sock.sendMessage(jid, { text: '🔍 Searching...' }, { quoted: msg });

      try {
        const res = await httpsPost(
          'generativelanguage.googleapis.com',
          `/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
          { 'Content-Type': 'application/json' },
          { contents: [{ parts: [{ text: `Search and answer this question accurately: ${prompt}` }] }] }
        );

        const reply = res?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!reply) throw new Error('No response from Gemini API');

        await sock.sendMessage(jid, { text: `🔍 *Bing AI*\n\n${reply}`, edit: thinkingMsg.key });
      } catch (e) {
        await sock.sendMessage(jid, { text: '❌ Bing error: ' + e.message, edit: thinkingMsg.key });
      }
    },
  },

  // ── UPSCALE (via Pollinations) ──────────────────────────────────────────
  {
    name: 'upscale',
    description: 'Upscale an image using AI. Reply to an image with .upscale',
    async execute(sock, msg) {
      const jid = msg.key.remoteJid;
      const ctx = msg.message?.extendedTextMessage?.contextInfo;
      const quoted = ctx?.quotedMessage;

      if (!quoted?.imageMessage) {
        return sock.sendMessage(jid, { text: '❌ Reply to an image with .upscale' }, { quoted: msg });
      }

      const thinkingMsg = await sock.sendMessage(jid, { text: '🔍 Upscaling image...' }, { quoted: msg });

      try {
        const { downloadMediaMessage } = require('@whiskeysockets/baileys');
        const media = await downloadMediaMessage({
          message: quoted,
          key: { remoteJid: jid, id: ctx.stanzaId, participant: ctx.participant },
        });

        const base64 = media.toString('base64');
        const url = `https://image.pollinations.ai/prompt/upscale+enhance+4k+quality?width=1024&height=1024&nologo=true&image=${encodeURIComponent('data:image/jpeg;base64,' + base64)}`;
        const buffer = await downloadImage(url);

        await sock.sendMessage(jid, { image: buffer, caption: '✅ *Upscaled Image*' }, { quoted: msg });
        await sock.sendMessage(jid, { delete: thinkingMsg.key }).catch(() => {});
      } catch (e) {
        await sock.sendMessage(jid, { text: '❌ Upscale error: ' + e.message, edit: thinkingMsg.key });
      }
    },
  },

];

