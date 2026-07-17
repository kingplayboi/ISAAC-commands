const fs = require('fs');
const path = require('path');

const os = require('os');
const config = require('../config/config');
const https = require('https');

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

// Safe, universal WhatsApp formatting
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

        // RAM calculation
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

        // Option A Header with safe title formatting
        let menuMessage = `┌──────────────────────────────┐\n`;
        menuMessage += `  🤖 *_ISAAC BOT_*\n`;
        menuMessage += `  ━━━━━━━━━━━━━━━━━━━━━━━\n`;
        menuMessage += `  ⚡ Prefix : [ ${config.prefix || '.'} ]\n`;
        menuMessage += `  🔒 Mode   : ${(config.WORK_TYPE || 'public').toUpperCase()}\n`;
        menuMessage += `  🕒 Time   : ${currentTime}\n`;
        menuMessage += `  🗓️ Date   : ${currentDate}\n`;
        menuMessage += `  💾 Ram    : ${usedRamGb} GB / ${totalRamGb} GB\n`;
        menuMessage += `  ⏱️ Uptime : ${formatUptime(uptimeSeconds)}\n`;
menuMessage += `  🔌 Plugins : ${new Set(commands.values()).size} commands\n`;
menuMessage += `└──────────────────────────────┘\n`;

        // Your 13 commands
const categories = {
    'OWNER': ['addsudo', 'antibot', 'antidelete', 'antilinkall', 'antitag', 'autobio', 'autolike', 'backup', 'badword', 'blocklist', 'broadcast', 'cat', 'checksudo', 'clearsudos', 'delsudo', 'eval', 'fetch', 'gauth', 'getcmd', 'getfile', 'kill', 'kill2', 'logout', 'menutype', 'pair', 'reminder', 'restart', 'settings', 'shell', 'task', 'update', 'updatenow', 'wapresence', 'welcomegoodbye'],
    'GROUP': ['add', 'admin', 'amute', 'antilink', 'approve', 'aunmute', 'ban', 'close', 'demote', 'desc', 'disp-1', 'disp-7', 'disp-90', 'disp-off', 'foreigners', 'goodbye', 'groupinfo', 'groupstatus', 'hidetag', 'icon', 'invite', 'join', 'kick', 'leavegroup', 'link', 'mute', 'open', 'promote', 'reject', 'revoke', 'setgreet', 'subject', 'tag', 'tagall', 'unban', 'unmute', 'vcf', 'warn', 'welcome'],
    'SETTINGS': ['anticall', 'autoread', 'autorecording', 'autotyping', 'autoview', 'mode', 'pdm', 'prefix', 'zushi'],
    'DOWNLOAD': ['audio', 'download', 'fb', 'ig', 'igstory', 'lyrics', 'lyrics2', 'pindl', 'play', 'play2', 'shazam', 'song', 'spotify', 'tiktok', 'twitter', 'video', 'video2'],
    'AI': ['bing', 'claude', 'dall', 'gemini', 'gpt', 'gptdm', 'groq', 'imagine', 'lydia', 'tts', 'upload', 'upscale', 'vision', 'vision2', 'void', 'worm', 'wormgpt'],
    'USER': ['block', 'fullpp', 'gjid', 'ison', 'jid', 'left', 'pp', 'unblock'],
    'TOOLS': ['apk', 'clearcache', 'define', 'gitclone', 'imagesearch', 'qr', 'screenshot', 'url', 'webscan', 'zip', 'zodiac'],
    'SECURITY': ['antifake', 'antigm', 'antigstatus', 'antispam', 'antiword', 'common', 'gpp', 'gstatus'],
    'FOOTBALL': ['bundesliga', 'bundesligascorers', 'epl', 'eplscorers', 'euro', 'fifa', 'fifaplayoffs', 'laliga', 'laligascorers', 'ligue1', 'ligue1scorers', 'livescore', 'news', 'playersearch', 'seriea', 'serieascorers', 'standings', 'table', 'teamsearch', 'ucl', 'uclscorers'],
    'CODING': ['compile-c', 'compile-c++', 'compile-js', 'compile-py', 'enc', 'gpass'],
    'MEDIA': ['botpp', 'getpfp', 'mix', 'photo', 'remini', 'remini2', 'removebg', 's', 'save', 'similarimage', 'smeme', 'take', 'vv', 'vv2'],
    'WHATSAPP': ['antiedit', 'caption', 'cinfo', 'clear', 'del', 'doc', 'online', 'poll', 'react', 'save1', 'setstatus', 'status'],
    'CONVERTER': ['carbon', 'cut', 'merge', 'ocr', 'toaudio', 'toexcel', 'toimg', 'topdf', 'totext', 'tovideo', 'toword'],
    'GAMES': ['answer', 'game', 'guess', 'mans', 'mathquiz', 'move', 'rps', 'tictactoe', 'ttend', 'wgend', 'wordguess'],
    'MISC': ['alive', 'calc', 'donate', 'help', 'isaac', 'joke', 'menu', 'owner', 'ping', 'quote', 'script', 'stats', 'time', 'trt', 'uptime', 'user'],
};        for (const [categoryName, commandList] of Object.entries(categories)) {
            menuMessage += ` ╭─❏ ${categoryName} ❏\n`;
            commandList.forEach(cmd => {
                menuMessage += ` │ ${formatCommand(cmd)}\n`;
            });
            menuMessage += ` ╰─────────────────\n`;
        }

        const imagePath = path.join(__dirname, '../assets/script.jpg');

        if (fs.existsSync(imagePath)) {
            await sock.sendMessage(jid, { image: fs.readFileSync(imagePath), caption: menuMessage });
        } else {
            await sock.sendMessage(jid, { text: menuMessage });
        }
    },
};
