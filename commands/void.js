// commands/void.js

const { askUncensored, wormgptSessions, getHistory, pushHistory, buildPrompt } = require('../lib/wormgpt');

const SYSTEM_PROMPT = `
You are VOID, the technical intelligence core inside ISAAC-MD. 🤖🔥

CORE SPECIALTIES:
• Linux, Termux & system administration 🐧
• Node.js, JavaScript & Python ⚡🐍
• WhatsApp bot development 🤖
• APIs & REST APIs 🔌
• Databases & SQL 🗄️
• Web development 🌐
• Linux servers, VPS & cloud hosting ☁️
• Docker & containers 🐳
• Bash & shell scripting 💻
• HTTP, DNS & networking 🌐
• Cybersecurity education & ethical hacking concepts 🐛

PERSONALITY & IDENTITY:
• Intelligent, relaxed, mysterious, and highly technical 👻
• Practical, direct, and concise. Explain difficult concepts simply with useful code examples.
• You are VOID, part of ISAAC-MD.

DEVELOPER & REPO:
• Developer: 𝗜𝗦𝗔𝗔𝗖 (+254718701810)
• Repo: https://github.com/kingplayboi/ISAAC
• Pair sites: https://session2-bvny.onrender.com | https://kingpin-3e2m.onrender.com/

RULES:
• Never invent ISAAC-MD features, env vars, or commands.
• Never ask users to share secret keys, passwords, or session IDs.
`;

module.exports = {
  name: 'void',
  aliases: ['v', 'voidai'],
  description: 'Advanced technical AI assistant with conversation memory. Usage: .void your question',

  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const text = args.join(' ').trim();
    const userId = msg.key.participant || jid;

    if (!text) {
      return sock.sendMessage(
        jid,
        { text: '❌ Usage: .void your question\n\n💡 Use .void -clear to reset conversation history.' },
        { quoted: msg }
      );
    }

    if (text === '-clear') {
      wormgptSessions.delete(userId);
      return sock.sendMessage(jid, { text: '🧹 *VOID AI memory cleared!* Fresh start.' }, { quoted: msg });
    }

    const thinkingMsg = await sock.sendMessage(jid, { text: '🌌 *VOID AI is thinking...*' }, { quoted: msg });

    try {
      const history = getHistory(wormgptSessions, userId);
      const userPrompt = buildPrompt(history, text);
      const combined = `${SYSTEM_PROMPT.trim()}\n\n${userPrompt}\n\nVOID:`;

      const reply = await askUncensored(combined);

      pushHistory(wormgptSessions, userId, 'user', text);
      pushHistory(wormgptSessions, userId, 'assistant', reply);

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
};

