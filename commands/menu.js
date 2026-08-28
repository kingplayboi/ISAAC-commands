const fs = require('fs');
const path = require('path');

const os = require('os');
const config = require('../config/config');
const https = require('https');
const settingsStore = require('../utils/settingsStore');

function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadBuffer(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function formatCommand(text) {
    return `\`\`\`${text.toUpperCase()}\`\`\``;
}

function formatUptime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
}

module.exports = {
    name: 'menu',
    description: 'Displays the clean command menu.',
    async execute(sock, msg, args, commands) {
        const jid = msg.key.remoteJid;

        const totalRamGb = (os.totalmem() / (1024 * 1024 * 1024)).toFixed(1);
        const freeRamGb = (os.freemem() / (1024 * 1024 * 1024)).toFixed(1);
        const usedRamGb = (parseFloat(totalRamGb) - parseFloat(freeRamGb)).toFixed(1);

        const uptimeSeconds = process.uptime();
        const systemDate = new Date();

        const currentDate = new Intl.DateTimeFormat('en-GB', {
    timeZone: config.timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
}).format(systemDate);

const currentTime = new Intl.DateTimeFormat('en-US', {
    timeZone: config.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
}).format(systemDate);

        const prefix = settingsStore.get('prefix', config.prefix);
        const workType = settingsStore.get('mode', config.WORK_TYPE);

        let menuMessage = `┌──────────────────────────────┐\n`;
        menuMessage += `  🤖 *_ISAAC BOT_*\n`;
        menuMessage += `  ━━━━━━━━━━━━━━━━━━━━━━━\n`;
        menuMessage += `  ⚡ Prefix : [ ${prefix || '.'} ]\n`;
        menuMessage += `  🔒 Mode   : ${(workType || 'public').toUpperCase()}\n`;
        menuMessage += `  🕒 Time   : ${currentTime}\n`;
        menuMessage += `  🗓️ Date   : ${currentDate}\n`;
        menuMessage += `  💾 Ram    : ${usedRamGb} GB / ${totalRamGb} GB\n`;
        menuMessage += `  ⏱️ Uptime : ${formatUptime(uptimeSeconds)}\n`;
menuMessage += `  🔌 Plugins : ${new Set(commands.values()).size} commands\n`;
menuMessage += `└──────────────────────────────┘\n`;

const categories = {
    'OWNER': ['self', 'public', 'settings', 'botpp', 'getpfp', 'pair', 'pair2', 'save', 'save1', 'kill', 'kill2', 'update', 'updatenow', 'eval', 'antilinkall', 'menutype', 'antibot', 'antitag', 'welcomegoodbye', 'broadcast', 'restart', 'blocklist', 'logout', 'fetch', 'shell', 'getcmd', 'getfile', 'cat', 'addsudo', 'delsudo', 'checksudo', 'clearsudos', 'oadmin', 'mygroups'],
    'GROUP': ['leavegroup', 'demote', 'groupinfo', 'kick', 'badword', 'mute', 'promote', 'tagall', 'warn', 'add', 'invite', 'join', 'welcome', 'goodbye', 'unmute', 'amute', 'aunmute', 'ban', 'unban', 'close', 'open', 'desc', 'subject', 'link', 'revoke', 'icon', 'hidetag', 'antilink', 'antigm', 'setgreet', 'tag', 'disp-1', 'disp-7', 'disp-90', 'disp-off', 'approve', 'reject', 'admin', 'vcf', 'groupstatus', 'foreigners', 'antigstatus', 'antispam', 'antiword', 'common', 'gpp', 'gstatus'],],
    'SETTINGS': ['anticall', 'antidelete', 'antiedit', 'wapresence', 'autoread', 'autorecording', 'autotyping', 'mode', 'prefix', 'autoview', 'autolike', 'autobio', 'pdm', 'zushi'],
    'DOWNLOADS': ['download', 'igstory', 'pindl', 'play2', 'video', 'video2', 'audio', 'spotify', 'play', 'tiktok', 'ig', 'fb', 'twitter', 'song', 'shazam', 'lyrics', 'lyrics2'],
    'AI': ['gemini', 'imagine', 'vision2', 'groq', 'mi', 'worm', 'gpt', 'dall', 'bing', 'upscale', 'vision', 'void', 'claude', 'wormgpt', 'tts', 'vocalremover', 'transcribe', 'muslimai', 'bibleai', 'speechwriter'],
    'USER': ['block', 'unblock', 'pp', 'fullpp', 'jid', 'gjid', 'left', 'ison'],
    'TOOLS': ['fancy', 'webscan', 'zip', 'screenshot', 'gitclone', 'apk', 'clearcache', 'qr', 'upload', 'zodiac', 'url', 'define'],
    'FOOTBALL': ['livescore', 'standings', 'bundesliga', 'epl', 'laliga', 'ligue1', 'seriea', 'ucl', 'news', 'playersearch', 'teamsearch', 'fifa', 'fifaplayoffs', 'euro', 'eplscorers', 'laligascorers', 'bundesligascorers', 'serieascorers', 'ligue1scorers', 'uclscorers'],
    'CODING': ['enc', 'gpass', 'compile-py', 'compile-js', 'compile-c', 'compile-c++', 'base', 'unbase'],
    'MEDIA': ['s', 'take', 'photo', 'mix', 'smeme', 'vv', 'vv2', 'removebg', 'imagesearch', 'similarimage', 'remini'],
    'WHATSAPP': ['poll', 'react', 'del', 'setstatus', 'status', 'caption', 'doc', 'cinfo', 'clear'],
    'CONVERTER': ['topdf', 'toexcel', 'toword', 'tovideo', 'toaudio', 'toimg', 'totext', 'attp', 'ocr', 'totext', 'carbon', 'cut', 'merge'],
    'GAMES': ['game', 'tictactoe', 'move', 'ttend', 'rps', 'wordguess', 'guess', 'wgend', 'mathquiz', 'mans', 'answer'],
    'UTILITY': ['isaac', 'trt', 'runtime', 'script', 'owner', 'calc', 'donate', 'alive', 'help', 'joke', 'menu', 'ping', 'quote', 'user', 'stats', 'uptime', 'time'],
};        for (const [categoryName, commandList] of Object.entries(categories)) {
            menuMessage += ` ╭─❏ *${categoryName}* ❏\n`;
            commandList.forEach(cmd => {
                menuMessage += ` │ ${formatCommand(cmd)}\n`;
            });
            menuMessage += ` ╰─────────────────\n`;
        }

                 const savedBanner = settingsStore.get('menu_banner', null);
        const localImagePath = path.join(__dirname, '../assets/script.jpg');
        const fallbackUrl = 'https://i.imgur.com/3Z8Xy9G.jpeg';

        let menuBanner = null;

        if (savedBanner) {
            menuBanner = Buffer.from(savedBanner, 'base64');
        } else if (fs.existsSync(localImagePath)) {
            menuBanner = fs.readFileSync(localImagePath);
        } else {
            try {
                menuBanner = await downloadBuffer(fallbackUrl);
            } catch (err) {
                console.error('[MENU IMAGE FETCH ERROR]', err);
            }
        }

        if (menuBanner) {
            await sock.sendMessage(jid, { image: menuBanner, caption: menuMessage }, { quoted: msg });
        } else {
            await sock.sendMessage(jid, { text: menuMessage }, { quoted: msg });
        }
    },
};

