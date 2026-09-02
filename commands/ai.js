const https = require('https');
const http = require('http');
const axios = require('axios');
require('dotenv').config();

const GEMINI_KEY = process.env.GEMINI_KEY;
const { askUncensored } = require('../lib/wormgpt');
const { KEITH_BASE } = require('../config/apis');

const WORMGPT_API = "https://apix.wolvarex.com/api/ai/wormgpt";
const WORMGPT_KEY = "wxa_f_31d2e67db7";

const VOID_SYSTEM_PROMPT = `You are VOID, the technical intelligence core inside ISAAC-MD. 🤖🔥

CORE SPECIALTIES:
• Linux, Termux & system administration
• Node.js, JavaScript & Python
• WhatsApp bot development
• APIs & REST APIs
• Databases & SQL
• Web development
• Linux servers, VPS & cloud hosting
• Docker & containers
• Bash & shell scripting
• HTTP, DNS & networking
• Cybersecurity education & ethical hacking concepts

PERSONALITY:
• Intelligent, relaxed, mysterious and technical.
• Practical, direct and concise.
• Explain difficult things simply.
• Provide useful code when needed.
• Use emojis naturally.

IDENTITY:
• You are VOID, part of ISAAC-MD.
• Developer: 𝗜𝗦𝗔𝗔𝗖
• WhatsApp: +254718701810
• Official repo: https://github.com/kingplayboi/ISAAC

OFFICIAL PAIRING SITES:
• https://session2-bvny.onrender.com
• https://kingpin-3e2m.onrender.com/

ISAAC-MD HELP:
• FORK: Open the official repo → Fork → select the user's GitHub account.
• STAR: Open the official repo → Star.
• WATCH: Open the official repo → Watch → choose the preferred notification option.

LINKING / PAIRING:
1. Fork the official ISAAC-MD repository.
2. Deploy the user's own fork.
3. Open either official pairing site.
4. Follow the pairing instructions.

PAIRING CODE:
• Enter the requested phone number.
• Choose phone-number linking.
• WhatsApp → Linked devices → Link a device.
• Enter the pairing code.

QR CODE:
• WhatsApp → Linked devices → Link a device.
• Scan the QR code from the pairing site.

DEPLOYMENT:
• Always tell users to fork the official repository first.
• Never invent ISAAC-MD deployment steps or environment variables.
• Only provide ISAAC-MD details that are known here or supplied by the user.

ACCURACY:
• Never invent ISAAC-MD commands, features, links, environment variables or procedures.
• If specific ISAAC-MD information is unknown, say so instead of guessing.
• General technical questions can be answered using normal technical knowledge.

SECURITY:
• Never ask users to publicly share API keys, passwords, PATs, SESSION_IDs, cookies or other secrets.
• Tell users to redact secrets from logs before sharing them.`;

const geminiSessions = new Map();
const groqSessions = new Map();
const gptSessions = new Map();
const mistralSessions = new Map();
const wormgptSessions = new Map();
const bingSessions = new Map();

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

// Direct API fetcher (no fallback)
async function getAIReply(endpointPath, prompt) {
  const encoded = encodeURIComponent(prompt);
  const json = await httpsGetJSON(`${KEITH_BASE}${endpointPath}?q=${encoded}`);

  if (!json.status || !json.result) {
    throw new Error(json.error || 'API returned status false or missing result.');
  }

  return typeof json.result === 'string' ? json.result : JSON.stringify(json.result);
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

        const rawReply = await getAIReply(endpointPath, prompt);
        const reply = rawReply
          .replace(brandReplace[0], brandReplace[1])
          .replace(brandReplace[2], brandReplace[3]);

        pushHistory(sessions, userId, 'user', text);
        pushHistory(sessions, userId, 'assistant', reply);

        await sock.sendMessage(
          jid,
          { text: `${emoji} *${label}*\n\n${reply}`, edit: thinkingMsg.key },
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
    name: 'groq',
    aliases: ['groqai'],
    label: 'Groq AI',
    emoji: '⚡',
    sessions: groqSessions,
    endpointPath: '/ai/gpt4',
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
  makeChatCommand({
    name: 'bing',
    aliases: ['bingai', 'msbing'],
    label: 'Bing AI',
    emoji: '🔍',
    sessions: bingSessions,
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

  // ── WORMGPT (Dual API Fallback) ───────────────────────────────────────────
  {
    name: "wormgpt",
    description: "Chat with WormGPT AI. Usage: .wormgpt <prompt>",

    async execute(sock, msg, args) {
      const chatId = msg.key.remoteJid;
      const query = args.join(" ").trim();

      if (!query) {
        return await sock.sendMessage(
          chatId,
          {
            text:
              "🪱 *WORMGPT AI*\n\n" +
              "Example:\n" +
              ".wormgpt Tell me about black holes"
          },
          { quoted: msg }
        );
      }

      let loading;

      try {
        loading = await sock.sendMessage(
          chatId,
          {
            text: "🪱 WormGPT is thinking..."
          },
          { quoted: msg }
        );

        let reply = null;

        // =========================================================
        // PRIMARY API — WOLVAREX
        // =========================================================
        try {
          console.log("[WORMGPT] Trying Wolvarex API...");

          const { data } = await axios.get(
            WORMGPT_API,
            {
              params: {
                q: query,
                key: WORMGPT_KEY
              },
              timeout: 30000
            }
          );

          console.log("[WORMGPT] Wolvarex response received.");

          if (data) {
            if (typeof data.result === "string") {
              reply = data.result;
            } else if (data.result) {
              reply =
                data.result.response ||
                data.result.answer ||
                data.result.text ||
                null;
            }

            if (!reply && typeof data.response === "string") {
              reply = data.response;
            }

            if (!reply && typeof data.answer === "string") {
              reply = data.answer;
            }

            if (!reply && typeof data.text === "string") {
              reply = data.text;
            }
          }

          if (!reply || !reply.trim()) {
            throw new Error("Wolvarex returned an empty response");
          }

        } catch (primaryError) {
          console.error(
            "[WORMGPT] Wolvarex failed:",
            primaryError.message
          );

          // =======================================================
          // FALLBACK — KEITH API
          // =======================================================
          try {
            console.log("[WORMGPT] Switching to Keith fallback...");

            const { data } = await axios.get(
              `${KEITH_BASE}/ai/wormgpt`,
              {
                params: {
                  q: query
                },
                timeout: 30000
              }
            );

            if (data) {
              if (typeof data.result === "string") {
                reply = data.result;
              } else if (data.result) {
                reply =
                  data.result.response ||
                  data.result.answer ||
                  data.result.text ||
                  null;
              }

              if (!reply && typeof data.response === "string") {
                reply = data.response;
              }

              if (!reply && typeof data.answer === "string") {
                reply = data.answer;
              }

              if (!reply && typeof data.text === "string") {
                reply = data.text;
              }
            }

            if (!reply || !reply.trim()) {
              throw new Error("Keith API returned an empty response");
            }

            console.log("[WORMGPT] Keith fallback successful.");

          } catch (fallbackError) {
            console.error(
              "[WORMGPT] Keith fallback failed:",
              fallbackError.message
            );

            return await sock.sendMessage(
              chatId,
              {
                text:
                  "❌ *WORMGPT ERROR*\n\n" +
                  "Both WormGPT services are currently unavailable.",
                edit: loading?.key
              },
              { quoted: msg }
            );
          }
        }

        reply = String(reply).trim();

        // =========================================================
        // SEND RESPONSE
        // =========================================================
        if (reply.length <= 4000) {
          await sock.sendMessage(
            chatId,
            {
              text: `🪱 *WORMGPT AI*\n\n${reply}`,
              edit: loading.key
            }
          );
        } else {
          await sock.sendMessage(
            chatId,
            {
              text:
                `🪱 *WORMGPT AI*\n\n${reply.slice(0, 4000)}`,
              edit: loading.key
            }
          );

          for (let i = 4000; i < reply.length; i += 4000) {
            await sock.sendMessage(chatId, {
              text: reply.slice(i, i + 4000)
            });
          }
        }

      } catch (err) {
        console.error("[WORMGPT ERROR]", err);

        await sock.sendMessage(
          chatId,
          {
            text:
              "❌ *WORMGPT ERROR*\n\n" +
              "Failed to process your request.",
            edit: loading?.key
          },
          { quoted: msg }
        );
      }
    }
  },

  // ── VOID (Technical Intelligence Core) ─────────────────────────────────────
  {
    name: 'void',
    aliases: ['v', 'voidai'],
    description: 'Advanced technical AI assistant. Usage: .void your question',
    async execute(sock, msg, args) {
      const jid = msg.key.remoteJid;
      const text = args.join(' ').trim();

      if (!text) {
        return sock.sendMessage(
          jid,
          { text: '❌ Usage: .void your question' },
          { quoted: msg }
        );
      }

      const thinkingMsg = await sock.sendMessage(
        jid,
        { text: '🌌 *VOID AI is thinking...*' },
        { quoted: msg }
      );

      try {
        const combined = `${VOID_SYSTEM_PROMPT.trim()}\n\nUser: ${text}\n\nVOID:`;
        const reply = await askUncensored(combined);

        await sock.sendMessage(
          jid,
          { text: `🌌 *VOID AI*\n\n${reply}`, edit: thinkingMsg.key },
          { quoted: msg }
        );
      } catch (e) {
        await sock.sendMessage(
          jid,
          { text: '❌ VOID error: ' + e.message, edit: thinkingMsg.key },
          { quoted: msg }
        );
      }
    },
  },

  // ── WORM (uncensored, via lib/wormgpt) ──────────────────────────────────
  {
    name: 'worm',
    aliases: ['wgpt', 'dark', 'darkgpt'],
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

  // ── UPSCALE (via Remini API, matches .remini) ─────────────────────────────
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

      const FormData = require('form-data');
      const fs = require('fs');
      const os = require('os');

      try {
        // Implement image download and processing here
      } catch (e) {
        await sock.sendMessage(jid, { text: '❌ Upscale error: ' + e.message, edit: thinkingMsg.key });
      }
    }
  }
];
