const REACTION_SEQUENCE = ['🤕', '😂', '👀', '🔥', '😈', '🌚', '💀', '🖕', '⚡', '😡', '🤬', '🐛', '✅'];
const REACTION_DELAY_MS = 80; // fast cycle

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function react(sock, msg, emoji) {
  await sock.sendMessage(msg.key.remoteJid, {
    react: { text: emoji, key: msg.key },
  });
}

module.exports = {
  name: 'ping',
  aliases: ['speed'],
  description: 'Shows bot response speed.',
  async execute(sock, msg, args) {
    const rawJid = msg.key.remoteJid;
    const jid = rawJid.endsWith('@lid') && msg.key.senderPn
      ? msg.key.senderPn
      : rawJid;

    const start = process.hrtime.bigint();

    const reactionSequence = (async () => {
      for (const emoji of REACTION_SEQUENCE) {
        await react(sock, msg, emoji);
        await delay(REACTION_DELAY_MS);
      }
      await react(sock, msg, '');
    })();

     const canEdit = true;
 let sent;
    try {
      sent = await sock.sendMessage(
        jid,
        { text: '𝗣𝗶𝗻𝗴𝗶𝗻𝗴...' },
        { quoted: msg }
      );
    } catch (err) {
      console.error('[ping] Failed to send placeholder message:', err);
      return;
    }

    const end = process.hrtime.bigint();
    const speed = (Number(end - start) / 1e6).toFixed(4);

    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    const uptimeStr = `${hours}h ${minutes}m ${seconds}s`;

    const text = `╭─❖ *P O N G !* ❖─╮
│
│  😡 *Speed:*  ${speed} ms
│  ⏱️ *Uptime:*  ${uptimeStr}
│  🖥️ *Status:*  Online ✅
│
╰────────────────╯`;

    if (canEdit) {
      try {
        await sock.sendMessage(jid, {
          text,
          edit: sent.key,
        });
      } catch (err) {
        console.error('[ping] Edit failed, falling back to new message:', err);
        await sock.sendMessage(jid, { text }, { quoted: msg });
      }
    } else {
      try {
        await sock.sendMessage(jid, { text }, { quoted: msg });
      } catch (err) {
        console.error('[ping] Failed to send final message:', err);
      }
    }

    await reactionSequence;
  },
};
