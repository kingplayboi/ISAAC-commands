const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { isOwner } = require('../utils/isOwner');

module.exports = {
  name: 'botpp',
  aliases: ['setbotpp', 'setpp'],
  description: "Update the bot's profile picture (owner only). Usage: reply to an image with .botpp",

  async execute(sock, msg) {
    const rawJid = msg.key.remoteJid;
    const jid = rawJid.endsWith('@lid') && msg.key.remoteJidAlt
      ? msg.key.remoteJidAlt
      : rawJid;

    if (!isOwner(msg)) {
      return await sock.sendMessage(
        jid,
        { text: '❌ *Only the bot owner can change the profile picture.*' },
        { quoted: msg }
      );
    }

    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    const quoted = ctx?.quotedMessage;

    if (!quoted?.imageMessage) {
      return await sock.sendMessage(
        jid,
        { text: '❌ *Reply to an image with .botpp*' },
        { quoted: msg }
      );
    }

    try {
      // Download media buffer cleanly using Baileys options
      const media = await downloadMediaMessage(
        { message: quoted },
        'buffer',
        {}
      );

      // Extract and sanitize raw bot user JID (strip session device suffixes)
      const rawUserJid = sock.user?.id || sock.user?.jid;
      const botJid = rawUserJid ? rawUserJid.split(':')[0] + '@s.whatsapp.net' : null;

      if (!botJid) {
        throw new Error('Could not resolve bot user JID from session.');
      }

      await sock.updateProfilePicture(botJid, media);
      await sock.sendMessage(
        jid,
        { text: '✅ *Bot profile picture updated successfully.*' },
        { quoted: msg }
      );
    } catch (e) {
      console.error('[BOTPP ERROR]', e);
      await sock.sendMessage(
        jid,
        { text: `❌ *Could not update profile picture:* ${e.message}` },
        { quoted: msg }
      );
    }
  },
};

