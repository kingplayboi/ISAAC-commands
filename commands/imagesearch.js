const axios = require('axios');
const { KEITH_BASE } = require('../config/apis');

module.exports = {
  name: 'imagesearch',
  aliases: ['imgsearch', 'gis', 'image'],
  description: 'Search for up to 5 real Google images. Usage: .imagesearch <query>',

  async execute(sock, msg, args) {
    const rawJid = msg.key.remoteJid;
    const jid = rawJid.endsWith('@lid') && msg.key.remoteJidAlt
      ? msg.key.remoteJidAlt
      : rawJid;

    const query = args.join(' ').trim();

    if (!query) {
      return await sock.sendMessage(
        jid,
        { text: '❌ *Usage:* `.imagesearch <search term>`' },
        { quoted: msg }
      );
    }

    const thinkingMsg = await sock.sendMessage(
      jid,
      { text: `🔍 *Searching Google Images for:* "${query}"...` },
      { quoted: msg }
    );

    try {
      const { data } = await axios.get(
        `${KEITH_BASE}/api/googleimage?query=${encodeURIComponent(query)}`,
        { timeout: 60000 }
      );

      const images = data?.result || data?.data;

      if (!images || !Array.isArray(images) || images.length === 0) {
        return await sock.sendMessage(
          jid,
          { text: `❌ *No images found for "${query}".*`, edit: thinkingMsg.key },
          { quoted: msg }
        );
      }

      // Limit to 5 images to prevent rate limits or slow sends
      const limitList = images.slice(0, 5);

      await sock.sendMessage(jid, { delete: thinkingMsg.key }).catch(() => {});

      for (let i = 0; i < limitList.length; i++) {
        const item = limitList[i];
        const imgUrl = typeof item === 'string' ? item : item?.url || item?.link;

        if (imgUrl) {
          await sock.sendMessage(
            jid,
            {
              image: { url: imgUrl },
              caption: `🖼️ *Result ${i + 1}/${limitList.length} for:* ${query.toUpperCase()}`
            },
            { quoted: msg }
          );
        }
      }
    } catch (e) {
      console.error('[IMAGESEARCH ERROR]', e);
      await sock.sendMessage(
        jid,
        { text: `❌ *Error fetching images:* ${e.message}`, edit: thinkingMsg.key },
        { quoted: msg }
      );
    }
  }
};

