const { isOwner } = require('../utils/isOwner');

module.exports = {
  name: 'blocklist',
  description: "Shows the bot's current WhatsApp blocklist (owner only).",
  async execute(sock, msg) {
    const jid = msg.key.remoteJid;
    if (!isOwner(msg)) {
      return sock.sendMessage(jid, { text: '❌ Only the bot owner can use this command.' }, { quoted: msg });
    }

    try {
      const list = await sock.fetchBlocklist();

      if (!list || !list.length) {
        return await sock.sendMessage(jid, { text: 'ℹ️ No blocked contacts.' }, { quoted: msg });
      }

      const formattedList = list.map((item) => {
        const rawNum = item.split('@')[0].split(':')[0];
        const cleanNum = rawNum.replace(/[^0-9]/g, '');
        return `• +${cleanNum} (@${cleanNum})`;
      });

      const mentions = list.map((item) => {
        const rawNum = item.split('@')[0].split(':')[0];
        return `${rawNum.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
      });

      const text = `🚫 *Blocked Contacts (${list.length}):*\n\n${formattedList.join('\n')}`;

      await sock.sendMessage(jid, { text, mentions }, { quoted: msg });
    } catch (error) {
      await sock.sendMessage(jid, { text: `❌ Could not fetch blocklist: ${error.message}` }, { quoted: msg });
    }
  },
};
