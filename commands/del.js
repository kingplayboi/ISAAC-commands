const { isOwner } = require('../utils/isOwner');

function resolveJid(msg) {
  const rawJid = msg.key.remoteJid;
  return rawJid.endsWith('@lid') && msg.key.remoteJidAlt
    ? msg.key.remoteJidAlt
    : rawJid;
}

function getQuoted(sock, msg) {
  const jid = resolveJid(msg);
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  const quotedMessage = ctx?.quotedMessage;

  if (!quotedMessage) {
    return { jid, ctx: null, quotedMessage: null, quotedKey: null, isOwnMessage: false };
  }

  const quotedParticipant = ctx.participantPn || ctx.participantAlt || ctx.participant;
  const botNumber = sock.user?.id?.split(':')[0];
  const quotedDigits = quotedParticipant?.split('@')[0]?.split(':')[0];
  const isOwnMessage = !!botNumber && quotedDigits === botNumber;

  const quotedKey = {
    remoteJid: jid,
    id: ctx.stanzaId,
    fromMe: isOwnMessage,
    participant: ctx.participant,
  };

  return { jid, ctx, quotedMessage, quotedKey, isOwnMessage };
}

module.exports = {
  name: 'del',
  aliases: ['delete'],
  description: 'Delete a message. Reply to a message with .del',
  async execute(sock, msg) {
    const { jid, quotedMessage, quotedKey, isOwnMessage } = getQuoted(sock, msg);

    if (!quotedMessage) {
      return sock.sendMessage(jid, {
        text: '❌ *Which message should I delete?*'
      }, { quoted: msg });
    }

    const isGroup = jid.endsWith('@g.us');

    if (isOwnMessage) {
      if (isGroup) {
        return sock.sendMessage(jid, {
          text: '❌ *I cannot delete my own messages.*'
        }, { quoted: msg });
      }
      if (!isOwner(msg)) {
        return sock.sendMessage(jid, {
          text: '❌ *Only my owner can delete my messages.*'
        }, { quoted: msg });
      }
      await sock.sendMessage(jid, { delete: quotedKey });
      return;
    }

    if (!isGroup) {
      return sock.sendMessage(jid, {
        text: '❌ *I can only delete messages in groups, and only with admin rights.*'
      }, { quoted: msg });
    }

    try {
      const metadata = await sock.groupMetadata(jid);
      const botNumber = sock.user?.id?.split(':')[0];
      const botIsAdmin = metadata.participants.some((p) => {
        const pDigits = (p.id || '').split('@')[0].split(':')[0];
        return pDigits === botNumber && (p.admin === 'admin' || p.admin === 'superadmin');
      });

      if (!botIsAdmin) {
        return sock.sendMessage(jid, { text: '❌ *Are you an admin ???*' }, { quoted: msg });
      }
    } catch (e) {
      console.error('[DEL ERROR] Could not fetch group metadata:', e.message);
      return sock.sendMessage(jid, { text: '❌ *Could not check admin status. Try again.*' }, { quoted: msg });
    }

    await sock.sendMessage(jid, { delete: quotedKey });
  }
};

