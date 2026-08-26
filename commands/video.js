const axios = require('axios');
const { KEITH_BASE } = require('../config/apis');

module.exports = {
  name: 'video',
  aliases: ['ytv', 'ytmp4'],
  description: 'Download YouTube video (MP4). Usage: .video <video name or link>',
  async execute(sock, msg, args) {
    const rawJid = msg.key.remoteJid;
    const jid = rawJid.endsWith('@lid') && msg.key.remoteJidAlt
      ? msg.key.remoteJidAlt
      : rawJid;

    const text = args.join(' ').trim();

    if (!text) {
      return sock.sendMessage(
        jid,
        { text: '🎬 Provide a video name or YouTube link!\nEg: `.video Blinding Lights`' },
        { quoted: msg }
      );
    }

    let searching = null;

    try {
      await sock.sendMessage(jid, { react: { text: '🎬', key: msg.key } });
      searching = await sock.sendMessage(jid, { text: `🔍 Searching *${text}*...` }, { quoted: msg });

      let videoUrl, videoTitle;

      if (/(youtube\.com|youtu\.be)/i.test(text)) {
        videoUrl = text;
        videoTitle = 'YouTube Video';
      } else {
        const search = await axios.get(`${KEITH_BASE}/search/yts?query=${encodeURIComponent(text)}`);
        const videos = search.data?.result;

        if (!Array.isArray(videos) || videos.length === 0) {
          return sock.sendMessage(jid, { text: `❌ No results found for: *${text}*`, edit: searching.key });
        }

        videoUrl = videos[0].url;
        videoTitle = videos[0].title;
      }

      await sock.sendMessage(jid, { text: `😍 Found: *${videoTitle}*\n⏳ Downloading...`, edit: searching.key });

      const apiRes = await axios.get(
        `${KEITH_BASE}/download/ytmp4?url=${encodeURIComponent(videoUrl)}`,
        { timeout: 60000 }
      );
      
      const resData = apiRes.data;
      const downloadUrl = resData?.result?.downloadUrl || resData?.result?.url || resData?.data?.url;

      if (!resData?.status || !downloadUrl) {
        return sock.sendMessage(jid, { text: '❌ Download failed. API returned no valid video URL.', edit: searching.key });
      }

      const finalTitle = resData?.result?.title || videoTitle;
      const fileName = `${finalTitle.replace(/[\/\\:*?"<>|]/g, '').trim()}.mp4`;

      // Send video via Direct URL stream to preserve memory
      await sock.sendMessage(
        jid,
        {
          video: { url: downloadUrl },
          mimetype: 'video/mp4',
          caption: `🎬 *${finalTitle}*`
        },
        { quoted: msg }
      );

      await sock.sendMessage(jid, { text: `✅ Successfully downloaded *${finalTitle}*`, edit: searching.key });

    } catch (err) {
      console.error('[VIDEO COMMAND ERROR]', err);
      const errText = '❌ Download failed: ' + (err.response?.data?.error || err.message);
      if (searching?.key) {
        await sock.sendMessage(jid, { text: errText, edit: searching.key });
      } else {
        await sock.sendMessage(jid, { text: errText }, { quoted: msg });
      }
    }
  },
};

