const https = require('https');
const { jidNormalizedUser } = require('@whiskeysockets/baileys');

function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadBuffer(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

module.exports = {
  name: '𝗜𝗦𝗔𝗔𝗖',
  description: "Shows the deployed bot's number and ISAAC premium services.",
  async execute(sock, msg) {
    const jid = msg.key.remoteJid;

    const ppSourceNumber = '254754574642'; // digits only, with country code, no +
    const ppSourceJid = `${ppSourceNumber}@s.whatsapp.net`;

    const botJid = sock.user?.id ? jidNormalizedUser(sock.user.id) : null;
    const botNumber = botJid ? botJid.split('@')[0].split(':')[0] : 'Unknown';

    const caption =
      `╭──〔 👑 ISAAC ASSISTANT 〕──╮\n` +
      `📞 *Bot Number:* +${botNumber}\n` +
      `🔗 *Chat:* https://wa.me/${botNumber}\n` +
      `╰──────────────────╯\n\n` +
      `🫪 *ISAAC — Premium Services*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🤖 *BOT SHOP*\n` +
      `▸ Anti-ban • Auto-reply • Multi-device\n` +
      `▸ Basic: $1 | Pro: $4 | Ultimate: $10\n\n` +
      `🚀 *DEPLOYMENT*\n` +
      `▸ 5-min setup • DDoS protection\n` +
      `▸ Quick: ksh100/mo | Custom: ksh500/mo`;

    try {
      const ppUrl = await sock.profilePictureUrl(ppSourceJid, 'image');
      const buffer = await downloadBuffer(ppUrl);
      await sock.sendMessage(jid, { image: buffer, caption }, { quoted: msg });
    } catch {
      await sock.sendMessage(jid, { text: caption + '\n\n(No profile picture available.)' }, { quoted: msg });
    }
  },
};
