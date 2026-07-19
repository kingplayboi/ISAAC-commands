const https = require('https');

function downloadBuffer(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadBuffer(res.headers.location, timeoutMs).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });

    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('Timed out downloading image'));
    });
  });
}

module.exports = {
  name: 'isaac',
  description: "Shows the ISAAC owner's name, number, profile picture, and premium services.",
  async execute(sock, msg) {
    const jid = msg.key.remoteJid;

    const ownerName = 'kingplayboi';
    const ownerNumber = '254754574642'; // digits only, with country code, no +
    const ownerJid = `${ownerNumber}@s.whatsapp.net`;

    const caption =
      `╭──〔 👑 ISAAC ASSISTANT 〕──╮\n` +
      `👤 *Owner:* ${ownerName}\n` +
      `📞 *Number:* +${ownerNumber}\n` +
      `🔗 *Chat:* https://wa.me/${ownerNumber}\n` +
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
      const ppUrl = await sock.profilePictureUrl(ownerJid, 'image');
      const buffer = await downloadBuffer(ppUrl);
      await sock.sendMessage(jid, { image: buffer, caption }, { quoted: msg });
    } catch (e) {
      await sock.sendMessage(jid, { text: caption + '\n\n(No profile picture available.)' }, { quoted: msg });
    }
  },
};
