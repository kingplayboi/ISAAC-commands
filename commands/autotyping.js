const config = require('../config/config');

module.exports = {
    name: 'autotyping',
    description: 'Toggle automatic typing status for incoming messages.',
    async execute(sock, msg, args, commands) {
        if (!msg.key.fromMe) return; // Owner only

        if (args[0] === 'on') {
            config.AUTO_TYPING = true;
            return await sock.sendMessage(msg.key.remoteJid, { text: '💬 *Auto-Typing:* ENABLED [🟢]' });
        } else if (args[0] === 'off') {
            config.AUTO_TYPING = false;
            return await sock.sendMessage(msg.key.remoteJid, { text: '💬 *Auto-Typing:* DISABLED [🔴]' });
        }

        const status = config.AUTO_TYPING ? 'ENABLED [🟢]' : 'DISABLED [🔴]';
        await sock.sendMessage(msg.key.remoteJid, { 
            text: `💬 *Auto-Typing Status:* ${status}\n\n💡 Use \`.autotyping on\` or \`.autotyping off\` to change it.` 
        });
    },
};
