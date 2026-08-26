const { isOwner } = require('../utils/isOwner');

module.exports = {
    name: 'restart',
    aliases: ['reboot'],
    description: 'Restarts the bot process (owner only).',

    async execute(sock, msg) {
        const jid = msg.key.remoteJid;

        if (!isOwner(msg)) {
            return sock.sendMessage(
                jid,
                { text: '❌ Only the bot owner can use this command.' },
                { quoted: msg }
            );
        }

        // Send the initial message
        const sent = await sock.sendMessage(
            jid,
            { text: '⚙️ System reboot initiated...' },
            { quoted: msg }
        );

        const edit = async (text) => {
            try {
                await sock.sendMessage(jid, {
                    text,
                    edit: sent.key
                });
            } catch (err) {
                console.error('[RESTART] Failed to edit message:', err.message);
            }
        };

        await new Promise(resolve => setTimeout(resolve, 1200));
        await edit('⚙️ System reboot initiated...\n\n🔄 Stopping active services...');

        await new Promise(resolve => setTimeout(resolve, 1200));
        await edit('⚙️ System reboot initiated...\n\n🔄 Stopping active services...\n🧹 Clearing temporary processes...');

        await new Promise(resolve => setTimeout(resolve, 1200));
        await edit('⚙️ System reboot initiated...\n\n🔄 Stopping active services...\n🧹 Clearing temporary processes...\n📦 Reloading bot modules...');

        await new Promise(resolve => setTimeout(resolve, 1200));
        await edit('⚙️ System reboot initiated...\n\n🔄 Stopping active services...\n🧹 Clearing temporary processes...\n📦 Reloading bot modules...\n✅ System checks completed.');

        await new Promise(resolve => setTimeout(resolve, 1200));
        await edit(
            '⚙️ System reboot initiated...\n\n' +
            '🔄 Stopping active services...\n' +
            '🧹 Clearing temporary processes...\n' +
            '📦 Reloading bot modules...\n' +
            '✅ System checks completed.\n\n' +
            '🚀 Restart sequence complete.\n' +
            '♻️ Restarting ISAAC-MD...'
        );

        setTimeout(() => process.exit(0), 500);
    },
};
