const axios = require('axios');

// Hardcoded Pexels API key
const PEXELS_KEY = '22nupLnhgtJu5tHR6EvQpptBBCmWQ5mhNoYkRJ5uNUiuCGczUPnjZa0J';

module.exports = {
  name: 'imagesearch',
  aliases: ['imgsearch', 'pexels'],
  description: 'Search for high quality stock images on Pexels. Usage: .imagesearch <query>',

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

    try {
      const response = await axios.get(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5`,
        {
          headers: { Authorization: PEXELS_KEY }
        }
      );

      const photos = response.data?.photos;

      if (!photos || photos.length === 0) {
        return await sock.sendMessage(
          jid,
          { text: `❌ *No images found for "${query}".*` },
          { quoted: msg }
        );
      }

      // Send the top photo as an image with details as caption
      const topPhoto = photos[0];
      const caption = `🖼️ *PEXELS SEARCH:* ${query.toUpperCase()}\n\n` +
                      `📸 *Photographer:* ${topPhoto.photographer}\n` +
                      `🔗 *Original:* ${topPhoto.url}`;

      await sock.sendMessage(
        jid,
        {
          image: { url: topPhoto.src.large },
          caption: caption
        },
        { quoted: msg }
      );

    } catch (e) {
      console.error('[IMAGESEARCH ERROR]', e);
      await sock.sendMessage(
        jid,
        { text: `❌ *Error searching Pexels:* ${e.message}` },
        { quoted: msg }
      );
    }
  }
};
