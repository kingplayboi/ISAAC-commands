const { query } = require('../utils/db');
const { isOwner } = require('../utils/isOwner');
const { isSenderAdmin } = require('../utils/isAdmin');

const KEY = 'antipromote';
const DEFAULTS = { enabled: false, action: 'demote', warnLimit: 3, warns: {} };

async function getSettings(jid) {
  const { rows } = await query(
    'SELECT value FROM group_settings WHERE jid = $1 AND key = $2',
    [jid, KEY]
  );
  return rows[0] ? { ...DEFAULTS, ...rows[0].value } : { ...DEFAULTS };
}

async function setSettings(jid, patch) {
  const current = await getSettings(jid);
  const next = { ...current, ...patch };

  await query(
    `INSERT INTO group_settings (jid, key, value) VALUES ($1, $2, $3)
     ON CONFLICT (jid, key) DO UPDATE SET value = EXCLUDED.value`,
    [jid, KEY, next]
  );

  return next;
}

async function getAllEnabledGroups() {
  const { rows } = await query(
    'SELECT jid, value FROM group_settings WHERE key = $1',
    [KEY]
  );
  return rows
    .filter(r => r.value?.enabled)
    .map(r => ({ jid: r.jid, ...r.value }));
}

const ACTION_LABELS = {
  demote: '⬇️ Demote both',
  remove: '🚫 Remove both',
  warn: '⚠️ Warn + demote'
};

module.exports = {
  name: 'antipromote',
  aliases: ['antiprom', 'nopromote'],
  description: 'Prevent unauthorized promotions in group',
  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;

    if (!jid.endsWith('@g.us')) {
      return sock.sendMessage(jid, { text: '❌ This command can only be used in groups!' }, { quoted: msg });
    }
    const senderJid = msg.key.participant || msg.key.remoteJid;
    const metadata = await sock.groupMetadata(jid);
    const authorized = isOwner(msg) || isSenderAdmin(metadata, senderJid);

    if (!authorized) {
      return sock.sendMessage(jid, { text: '❌ Only the bot owner or a group admin can use this command!' }, { quoted: msg });
    }

    const subcommand = args[0]?.toLowerCase();
    const value = args[1];

    if (subcommand === 'list') {
      const groups = await getAllEnabledGroups();

      if (groups.length === 0) {
        return sock.sendMessage(jid, { text: '📋 No groups have anti-promote enabled.' }, { quoted: msg });
      }

      let text = '*🚫 Anti-Promote Active Groups*\n\n';
      groups.forEach((g, i) => {
        text += `*${i + 1}.* \`${g.jid}\`\n`;
        text += `   └ ⚙️ Action: *${(g.action || 'demote').toUpperCase()}*\n`;
        text += `   └ ⚠️ Warn Limit: *${g.warnLimit || 3}*\n\n`;
      });

      return sock.sendMessage(jid, { text }, { quoted: msg });
    }

    const settings = await getSettings(jid);

    if (!subcommand) {
      const statusText = settings.enabled ? '✅ ENABLED' : '❌ DISABLED';

      const text =
        `*🚫 Anti-Promote Settings for this Group*\n\n` +
        `📍 *JID:* \`${jid}\`\n\n` +
        `🔹 *Status:* ${statusText}\n` +
        `🔹 *Action:* ${ACTION_LABELS[settings.action] || ACTION_LABELS.demote}\n` +
        `🔹 *Warn Limit:* ${settings.warnLimit}\n\n` +
        `*Actions:*\n` +
        `▸ *demote* - Demote both users\n` +
        `▸ *remove* - Remove both users from group\n` +
        `▸ *warn* - Warn first, then remove after limit\n\n` +
        `*Commands:*\n` +
        `▸ *.antipromote on* - Enable\n` +
        `▸ *.antipromote off* - Disable\n` +
        `▸ *.antipromote action demote/remove/warn* - Set action\n` +
        `▸ *.antipromote limit <1-10>* - Set warn limit\n` +
        `▸ *.antipromote reset* - Reset warnings\n` +
        `▸ *.antipromote list* - List active groups`;

      return sock.sendMessage(jid, { text }, { quoted: msg });
    }

    switch (subcommand) {
      case 'on':
      case 'enable': {
        const updated = await setSettings(jid, { enabled: true });
        return sock.sendMessage(jid, {
          text: `✅ Anti-Promote has been *ENABLED* for this group!\nAction: *${(updated.action || 'demote').toUpperCase()}*`
        }, { quoted: msg });
      }

      case 'off':
      case 'disable': {
        await setSettings(jid, { enabled: false });
        return sock.sendMessage(jid, { text: '❌ Anti-Promote has been *DISABLED* for this group!' }, { quoted: msg });
      }

      case 'action': {
        if (!value || !['demote', 'remove', 'warn'].includes(value)) {
          return sock.sendMessage(jid, { text: '❌ Use: `.antipromote action demote/remove/warn`' }, { quoted: msg });
        }

        await setSettings(jid, { action: value, enabled: settings.enabled || true });

        return sock.sendMessage(jid, {
          text: `✅ Anti-Promote action set to: *${value.toUpperCase()}*\n${ACTION_LABELS[value]}`
        }, { quoted: msg });
      }

      case 'limit': {
        const limit = parseInt(value, 10);
        if (isNaN(limit) || limit < 1 || limit > 10) {
          return sock.sendMessage(jid, { text: '❌ Limit must be between 1 and 10' }, { quoted: msg });
        }

        await setSettings(jid, { warnLimit: limit });
        return sock.sendMessage(jid, { text: `✅ Anti-Promote warn limit set to: *${limit}*` }, { quoted: msg });
      }

      case 'reset':
      case 'resetwarns': {
        await setSettings(jid, { warns: {} });
        return sock.sendMessage(jid, { text: '✅ All anti-promote warning counts reset for this group!' }, { quoted: msg });
      }

      default:
        return sock.sendMessage(jid, {
          text:
            '❌ Invalid command!\n\n' +
            '▸ *.antipromote on* - Enable\n' +
            '▸ *.antipromote off* - Disable\n' +
            '▸ *.antipromote action demote/remove/warn* - Set action\n' +
            '▸ *.antipromote limit <1-10>* - Set warn limit\n' +
            '▸ *.antipromote reset* - Reset warnings\n' +
            '▸ *.antipromote list* - List active groups'
        }, { quoted: msg });
    }
  }
};

