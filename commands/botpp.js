const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { isOwner } = require('../utils/isOwner');

module.exports = {
  name: 'botpp',
  aliases: ['setmenu', 'setmenupp'],
  description: "Update the menu banner image by replying to an image or a user's message (owner only).",

  async execute(sock, msg) {
    const rawJid = msg.key.remoteJid;
    const jid = rawJid.endsWith('@lid') && msg.key.remoteJidAlt
      ? msg.key.remoteJidAlt
      : rawJid;

    if (!isOwner(msg)) {
      return await sock.sendMessage(
        jid,
        { text: '❌ *Only the bot owner can change the menu picture.*' },
        { quoted: msg }
      );
    }

    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    const quoted = ctx?.quotedMessage;

    if (!quoted && !ctx?.participant) {
      return await sock.sendMessage(
        jid,
        { text: '❌ *Please reply to an image OR reply to a user\'s message with .botpp*' },
        { quoted: msg }
      );
    }

    let imageBuffer = null;

    try {
      // Option A: Replied directly to an image
      if (quoted?.imageMessage) {
        imageBuffer = await downloadMediaMessage(
          { message: quoted },
          'buffer',
          {}
        );
      } 
      // Option B: Replied to a user's message (text/audio/etc) -> Fetch their profile picture
      else if (ctx?.participant) {
        const targetJid = ctx.participant;
        
        let profilePicUrl;
        try {
          profilePicUrl = await sock.profilePictureUrl(targetJid, 'image');
        } catch {
          return await sock.sendMessage(
            jid,
            { text: '❌ *Could not fetch profile picture. The user might have hidden it.*' },
            { quoted: msg }
          );
        }

        const res = await axios.get(profilePicUrl, { responseType: 'arraybuffer' });
        imageBuffer = Buffer.from(res.data);
      }

      if (!imageBuffer) {
        return await sock.sendMessage(
          jid,
          { text: '❌ *Could not process image.*' },
          { quoted: msg }
        );
      }

      // Save to assets/menu.jpg
      const assetsDir = path.join(__dirname, '../assets');
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
      }

      const menuPath = path.join(assetsDir, 'menu.jpg');
      fs.writeFileSync(menuPath, imageBuffer);

      await sock.sendMessage(
        jid,
        { text: '✅ *Menu image updated successfully! Type .menu to verify.*' },
        { quoted: msg }
      );

    } catch (e) {
      console.error('[BOTPP ERROR]', e);
      await sock.sendMessage(
        jid,
        { text: `❌ *Failed to update menu image:* ${e.message}` },
        { quoted: msg }
      );
    }
  },
};

