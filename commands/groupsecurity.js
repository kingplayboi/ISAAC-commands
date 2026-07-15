/**
 * commands/groupsecurity.js
 * ---------------------------
 * Group security/anti-spam commands: antifake, antigm, antigstatus, antilink,
 * antispam, antiword, common, gpp, gstatus
 *
 * Toggle settings are stored per-group in config/groupSettings.json.
 * Actual enforcement (detecting links, banned words, etc.) should be wired
 * into events/messages.js separately — these commands just manage the toggles.
 */

const fs = require('fs');
const path = require('path');
const { isOwner } = require('../utils/isOwner');

const settingsPath = path.join(__dirname, '../config/groupSettings.json');

function loadSettings() {
  if (fs.existsSync(settingsPath)) {
    return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  }
  return {};
}

function saveSettings(settings) {
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

function toggleSetting(jid, key, mode) {
  const settings = loadSettings();
  if (!settings[jid]) settings[jid] = {};
  settings[jid][key] = mode === 'on';
  saveSettings(settings);
}

function makeToggleCommand(name, settingKey, label, emoji) {
  return {
    name,
    description: `Toggle ${label}. Usage: .${name} on/off`,
    async execute(sock, msg, args) {
      const jid = msg.key.remoteJid;
      if (!jid.endsWith('@g.us')) {
        return sock.sendMessage(jid, { text: '❌ This command only works in groups.' }, { quoted: msg });
      }

      const mode = args[0]?.toLowerCase();
      if (mode !== 'on' && mode !== 'off') {
        return sock.sendMessage(jid, { text: `❌ Usage: .${name} on  or  .${name} off` }, { quoted: msg });
      }

      toggleSetting(jid, settingKey, mode);
      await sock.sendMessage(jid, { text: `${emoji} ${label} turned ${mode}.` }, { quoted: msg });
    }
  };
}

module.exports = [

  // ── ANTIFAKE — blocks numbers not matching certain country codes ────────────
  makeToggleCommand('antifake', 'antifake', 'Anti-fake number protection', '🛡️'),

  // ── ANTIGM — anti group mentions spam ────────────────────────────────────────
  makeToggleCommand('antigm', 'antigm', 'Anti-group-mention spam protection', '🛡️'),

  // ── ANTIGSTATUS — block @everyone-style group status spam ───────────────────
  makeToggleCommand('antigstatus', 'antigstatus', 'Anti-group-status spam protection', '🛡️'),

  // ── ANTILINK — auto-remove messages containing links ─────────────────────────
  makeToggleCommand('antilink', 'antilink', 'Anti-link protection', '🔗'),

  // ── ANTISPAM — rate-limit repeated messages ───────────────────────────────────
  makeToggleCommand('antispam', 'antispam', 'Anti-spam protection', '🚫'),

  // ── ANTIWORD — block banned words ─────────────────────────────────────────────
  makeToggleCommand('antiword', 'antiword', 'Banned word filter', '🤬'),

  // ── COMMON — shows current group settings summary ───────────────────────────
  {
    name: 'common',
    description: 'Show current group protection settings.',
    async execute(sock, msg) {
      const jid = msg.key.remoteJid;
      if (!jid.endsWith('@g.us')) {
        return sock.sendMessage(jid, { text: '❌ This command only works in groups.' }, { quoted: msg });
      }

      const settings = loadSettings()[jid] || {};
      const flag = (v) => v ? '✅ ON' : '❌ OFF';

      const text = `
╭──〔 🛡️ GROUP SETTINGS 〕──╮
🔗 Antilink: ${flag(settings.antilink)}
🚫 Antispam: ${flag(settings.antispam)}
🤬 Antiword: ${flag(settings.antiword)}
🛡️ Antifake: ${flag(settings.antifake)}
🛡️ Antigm: ${flag(settings.antigm)}
🛡️ Antigstatus: ${flag(settings.antigstatus)}
👋 Welcome: ${flag(settings.welcome)}
👋 Goodbye: ${flag(settings.goodbye)}
╰──────────────────╯`.trim();

      await sock.sendMessage(jid, { text }, { quoted: msg });
    }
  },

  // ── GPP — Get group profile picture ──────────────────────────────────────────
  {
    name: 'gpp',
    description: "Get the group's profile picture.",
    async execute(sock, msg) {
      const jid = msg.key.remoteJid;
      if (!jid.endsWith('@g.us')) {
        return sock.sendMessage(jid, { text: '❌ This command only works in groups.' }, { quoted: msg });
      }

      try {
        const ppUrl = await sock.profilePictureUrl(jid, 'image');
        const https = require('https');
        const buffer = await new Promise((resolve, reject) => {
          https.get(ppUrl, (res) => {
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
          }).on('error', reject);
        });

        await sock.sendMessage(jid, { image: buffer, caption: '🖼 Group Profile Picture' }, { quoted: msg });
      } catch (e) {
        await sock.sendMessage(jid, { text: '❌ This group has no profile picture set.' }, { quoted: msg });
      }
    }
  },

  // ── GSTATUS — post text/media to the group's actual WhatsApp status feed ────
  // (distinct from posting into the group chat — this uses Baileys'
  // groupStatusMessage, which shows up in the status/updates area, scoped
  // to this group.) Owner-only, matching the bot's other broadcast-style
  // commands.
  {
    name: 'gstatus',
    aliases: ['togroupstatus', 'statusgroup', 'gcstatus', 'gas', 'gps'],
    description: "Post a message or replied media to this group's status feed (owner only). Usage: .gstatus <text>  or  reply to media with .gstatus <caption>",
    async execute(sock, msg, args) {
      const jid = msg.key.remoteJid;

      if (!isOwner(msg)) {
        return sock.sendMessage(jid, { text: '❌ Only the bot owner can use this command.' }, { quoted: msg });
      }
      if (!jid.endsWith('@g.us')) {
        return sock.sendMessage(jid, { text: '❌ This command only works in groups.' }, { quoted: msg });
      }

      const text = args.join(' ').trim();
      const ctx = msg.message?.extendedTextMessage?.contextInfo;
      const quoted = ctx?.quotedMessage;

      if (!text && !quoted) {
        return sock.sendMessage(
          jid,
          {
            text:
              '📌 Usage:\n' +
              '• .gstatus <text>\n' +
              '• Reply to an image/video/audio/document/sticker with .gstatus <caption>\n' +
              '• Or just .gstatus to forward quoted media without caption',
          },
          { quoted: msg }
        );
      }

      let tmpFiles = [];

      try {
        const { downloadMediaMessage } = require('@whiskeysockets/baileys');
        const os = require('os');
        const path = require('path');

        const payload = { groupStatusMessage: {} };

        if (quoted) {
          const quotedKey = { remoteJid: jid, id: ctx.stanzaId, participant: ctx.participant, fromMe: false };
          const quotedMsg = { message: quoted, key: quotedKey };

          if (quoted.imageMessage) {
            const caption = text || quoted.imageMessage.caption || '';
            const buffer = await downloadMediaMessage(quotedMsg, 'buffer', {});
            const filePath = path.join(os.tmpdir(), `gstatus_${Date.now()}.jpg`);
            fs.writeFileSync(filePath, buffer);
            tmpFiles.push(filePath);
            payload.groupStatusMessage.image = { url: filePath };
            if (caption) payload.groupStatusMessage.caption = caption;

          } else if (quoted.videoMessage) {
            const caption = text || quoted.videoMessage.caption || '';
            const buffer = await downloadMediaMessage(quotedMsg, 'buffer', {});
            const filePath = path.join(os.tmpdir(), `gstatus_${Date.now()}.mp4`);
            fs.writeFileSync(filePath, buffer);
            tmpFiles.push(filePath);
            payload.groupStatusMessage.video = { url: filePath };
            if (caption) payload.groupStatusMessage.caption = caption;

          } else if (quoted.audioMessage) {
            const buffer = await downloadMediaMessage(quotedMsg, 'buffer', {});
            const inputPath = path.join(os.tmpdir(), `gstatus_in_${Date.now()}.ogg`);
            const outputPath = path.join(os.tmpdir(), `gstatus_out_${Date.now()}.ogg`);
            fs.writeFileSync(inputPath, buffer);

            const ffmpegPath = process.env.FFMPEG_PATH || require('ffmpeg-static') || 'ffmpeg';
            const { execFile } = require('child_process');
            const { promisify } = require('util');
            const execFileAsync = promisify(execFile);
            await execFileAsync(ffmpegPath, [
              '-y', '-i', inputPath, '-c:a', 'libopus', '-b:a', '128k', outputPath,
            ]);

            tmpFiles.push(inputPath, outputPath);
            payload.groupStatusMessage.audio = { url: outputPath };

          } else if (quoted.documentMessage) {
            const buffer = await downloadMediaMessage(quotedMsg, 'buffer', {});
            const fileName = quoted.documentMessage.fileName || `gstatus_${Date.now()}`;
            const filePath = path.join(os.tmpdir(), fileName);
            fs.writeFileSync(filePath, buffer);
            tmpFiles.push(filePath);
            payload.groupStatusMessage.document = { url: filePath };

          } else if (quoted.stickerMessage) {
            const buffer = await downloadMediaMessage(quotedMsg, 'buffer', {});
            const filePath = path.join(os.tmpdir(), `gstatus_${Date.now()}.webp`);
            fs.writeFileSync(filePath, buffer);
            tmpFiles.push(filePath);
            payload.groupStatusMessage.sticker = { url: filePath };

          } else if (quoted.conversation || quoted.extendedTextMessage?.text) {
            payload.groupStatusMessage.text = quoted.conversation || quoted.extendedTextMessage.text;
          }

          if (text && !payload.groupStatusMessage.caption && !payload.groupStatusMessage.text) {
            payload.groupStatusMessage.caption = text;
          }
        } else {
          payload.groupStatusMessage.text = text;
        }

        await sock.sendMessage(jid, payload, { quoted: msg });
      } catch (err) {
        await sock.sendMessage(jid, { text: `❌ Error sending group status: ${err.message}` }, { quoted: msg });
      } finally {
        tmpFiles.forEach((f) => {
          try { fs.unlinkSync(f); } catch {}
        });
      }
    }
  },

];
