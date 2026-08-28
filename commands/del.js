module.exports = {
  name: 'del',
  aliases: ['delete'],
  description: 'Delete a message. Reply to a message with .del',
  async execute(sock, msg) {
    const { jid, quotedMessage, quotedKey } = getQuoted(sock, msg);

    if (!quotedMessage) {
      return sock.sendMessage(jid, {
        text: '*❌ Which message should I delete ?*'
      }, { quoted: msg });
    }

    if (jid.endsWith('@g.us')) {
      const groupMetadata = await sock.groupMetadata(jid);
      const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';

      const botParticipant = groupMetadata.participants.find(
        participant => participant.id === botJid
      );

      const isBotAdmin =
        botParticipant &&
        (botParticipant.admin === 'admin' || botParticipant.admin === 'superadmin');

      if (!isBotAdmin) {
        return sock.sendMessage(jid, {
          text: '*❌ Are you an admin ???*'
        }, { quoted: msg });
      }
    }

    await sock.sendMessage(jid, { delete: quotedKey });
  }
};
