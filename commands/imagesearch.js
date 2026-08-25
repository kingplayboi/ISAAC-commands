const axios = require('axios');

module.exports = {
  name: 'imagesearch',
  aliases: ['imgsearch', 'gis', 'image'],
  description: 'Search for up to 10 real Google images. Usage: .imagesearch <query>',

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

    await sock.sendMessage(
      jid,
      { text: `🔍 *Searching Google Images for:* "${query}"...` },
      { quoted: msg }
    );

    try {
      // Fetch results from Google Image API endpoint
      const response = await axios.get(
        `https://api.vreden.web.id/api/googleimage?query=${encodeURIComponent(query)}`
      );

      const images = response.data?.result || response.data?.data;

      if (!images || images.length === 0) {
        return await sock.sendMessage(
          jid,
          { text: `❌ *No images found for "${query}".*` },
          { quoted: msg }
        );
      }

      // Limit results to 10 images maximum
      const limitList = images.slice(0, 10);

      // Send each image directly to chat
      for (let i = 0; i < limitList.length; i++) {
        const imgUrl = typeof limitList[i] === 'string' ? limitList[i] : limitList[i].url || limitList[i].link;

        if (imgUrl) {
          await sock.sendMessage(
            jid,
            {
              image: { url: imgUrl },
              caption: `🖼️ *Result ${i + 1}/${limitList.length} for:* ${query.toUpperCase()}`
            }
          );
        }
      }

    } catch (e) {
      console.error('[IMAGESEARCH ERROR]', e);

      // Fallback API if the primary endpoint fails
      try {
        const fallbackRes = await axios.get(
          `https://api.lolhuman.xyz/api/gimage?apikey=apiKey&query=${encodeURIComponent(query)}`
        );
        const fallbackImages = fallbackRes.data?.result?.slice(0, 10) || [];

        for (let i = 0; i < fallbackImages.length; i++) {
          await sock.sendMessage(jid, {
            image: { url: fallbackImages[i] },
            caption: `🖼️ *Result ${i + 1}/${fallbackImages.length} for:* ${query.toUpperCase()}`
          });
        }
      } catch (err) {
        await sock.sendMessage(
          jid,
          { text: `❌ *Error fetching images:* ${e.message}` },
          { quoted: msg }
        );
      }
    }
  }
};

