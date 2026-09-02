const { query } = require('../utils/db');
const { isOwner } = require('../utils/isOwner');
const { isSenderAdmin } = require('../utils/isAdmin');

const KEY = 'antidemote';
const DEFAULTS = { enabled: false, action: 'promote', warnLimit: 3, warns: {} };

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
  promote: '⬆️ Re-promote victim + demote demoter',
  remove: '🚫 Remove both',
  warn: '⚠️ Warn + re-promote'
};

module.exports = {
  name: 'antidemote',
  aliases: ['antidem', 'nodemote'],
  description: 'Prevent unauthorized demotions in group',
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
        return sock.sendMessage(jid, { text: '📋 No groups have anti-demote enabled.' }, { quoted: msg });
      }

      let text = '*🔄 Anti-Demote Active Groups*\n\n';
      groups.forEach((g, i) => {
        text += `*${i + 1}.* \`${g.jid}\`\n`;
        text += `   └ ⚙️ Action: *${(g.action || 'promote').toUpperCase()}*\n`;
        text += `   └ ⚠️ Warn Limit: *${g.warnLimit || 3}*\n\n`;
      });

      return sock.sendMessage(jid, { text }, { quoted: msg });
    }

    const settings = await getSettings(jid);

    if (!subcommand) {
      const statusText = settings.enabled ? '✅ ENABLED' : '❌ DISABLED';

      const text =
        `*🔄 Anti-Demote Settings for this Group*\n\n` +
        `📍 *JID:* \`${jid}\`\n\n` +
        `🔹 *Status:* ${statusText}\n` +
        `🔹 *Action:* ${ACTION_LABELS[settings.action] || ACTION_LABELS.promote}\n` +
        `🔹 *Warn Limit:* ${settings.warnLimit}\n\n` +
        `*Actions:*\n` +
        `▸ *promote* - Re-promote victim + demote demoter\n` +
        `▸ *remove* - Remove both users from group\n` +
        `▸ *warn* - Warn first, then remove after limit\n\n` +
        `*Commands:*\n` +
        `▸ *.antidemote on* - Enable\n` +
        `▸ *.antidemote off* - Disable\n` +
        `▸ *.antidemote action promote/remove/warn* - Set action\n` +
        `▸ *.antidemote limit <1-10>* - Set warn limit\n` +
        `▸ *.antidemote reset* - Reset warnings\n` +
        `▸ *.antidemote list* - List active groups`;

      return sock.sendMessage(jid, { text }, { quoted: msg });
    }

    switch (subcommand) {
      case 'on':
      case 'enable': {
        const updated = await setSettings(jid, { enabled: true });
        return sock.sendMessage(jid, {
          text: `✅ Anti-Demote has been *ENABLED* for this group!\nAction: *${(updated.action || 'promote').toUpperCase()}*`
        }, { quoted: msg });
      }

      case 'off':
      case 'disable': {
        await setSettings(jid, { enabled: false });
        return sock.sendMessage(jid, { text: '❌ Anti-Demote has been *DISABLED* for this group!' }, { quoted: msg });
      }

      case 'action': {
        if (!value || !['promote', 'remove', 'warn'].includes(value)) {
          return sock.sendMessage(jid, { text: '❌ Use: `.antidemote action promote/remove/warn`' }, { quoted: msg });
        }

        await setSettings(jid, { action: value, enabled: settings.enabled || true });

        return sock.sendMessage(jid, {
          text: `✅ Anti-Demote action set to: *${value.toUpperCase()}*\n${ACTION_LABELS[value]}`
        }, { quoted: msg });
      }

      case 'limit': {
        const limit = parseInt(value, 10);
        if (isNaN(limit) || limit < 1 || limit > 10) {
          return sock.sendMessage(jid, { text: '❌ Limit must be between 1 and 10' }, { quoted: msg });
        }

        await setSettings(jid, { warnLimit: limit });
        return sock.sendMessage(jid, { text: `✅ Anti-Demote warn limit set to: *${limit}*` }, { quoted: msg });
      }

      case 'reset':
      case 'resetwarns': {
        await setSettings(jid, { warns: {} });
        return sock.sendMessage(jid, { text: '✅ All anti-demote warning counts reset for this group!' }, { quoted: msg });
      }

      default:
        return sock.sendMessage(jid, {
          text:
            '❌ Invalid command!\n\n' +
            '▸ *.antidemote on* - Enable\n' +
            '▸ *.antidemote off* - Disable\n' +
            '▸ *.antidemote action promote/remove/warn* - Set action\n' +
            '▸ *.antidemote limit <1-10>* - Set warn limit\n' +
            '▸ *.antidemote reset* - Reset warnings\n' +
            '▸ *.antidemote list* - List active groups'
        }, { quoted: msg });
    }
  }
};

