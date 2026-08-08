function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${days}d ${hours}h ${minutes}m ${secs}s`;
}

module.exports = {
  name: 'runtime',
  aliases: ['stats'],
  description: 'Check bot runtime',
  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const text =
      `𝐈𝐒𝐀𝐀𝐂-𝐌𝐃 𝗵𝗮𝘀 𝗯𝗲𝗲𝗻 𝗿𝘂𝗻𝗻𝗶𝗻𝗴 𝘀𝗶𝗻𝗰𝗲 ${formatUptime(process.uptime())}\n\n` +
      `https://chat.whatsapp.com/JPH5gho7uxfBMviXg7sNNs`;

    // Sent as plain text so WhatsApp auto-generates its own native
    // "Join Group" preview card (real group photo, correct tap-to-join
    // behavior) — more reliable than faking a card via externalAdReply.
    await sock.sendMessage(jid, { text }, { quoted: msg });
  },
};
