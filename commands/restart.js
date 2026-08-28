const { isOwner } = require('../utils/isOwner');

module.exports = {
    name: 'restart',
    aliases: ['reboot', 'boot'],
    description: 'Restarts the bot process (owner only).',
    async execute(sock, msg) {
        const jid = msg.key.remoteJid;
        if (!isOwner(msg)) {
            return sock.sendMessage(jid, { text: '*❌ Are you my owner ?.*' }, { quoted: msg });
        }

        await sock.sendMessage(jid, { text: '*🔄 Restarting bot... unlike your ex, I\'ll be back.*' }, { quoted: msg });
        setTimeout(() => process.exit(0), 1000);
    },
};
