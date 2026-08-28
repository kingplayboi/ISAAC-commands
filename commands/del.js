async function isJidGroupAdmin(metadata, jid) {
  if (!jid) return false;
  const digits = jid.split('@')[0].split(':')[0];
  return metadata.participants.some((p) => {
    const pDigits = (p.id || '').split('@')[0].split(':')[0];
    return pDigits === digits && (p.admin === 'admin' || p.admin === 'superadmin');
  });
}

module.exports = {
  name: 'del',
  aliases: ['delete'],
  description: 'Delete a quoted message.',
  async execute(sock, msg) {
    const jid = msg.key.remoteJid;
    const isGroup = jid.endsWith('@g.us');

    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    const quotedMessage = ctx?.quotedMessage;

    if (!quotedMessage) {
      return sock.sendMessage(jid, { text: '❌ *No message quoted for deletion.*' }, { quoted: msg });
    }

    const stanzaId = ctx.stanzaId || '';
    const quotedParticipant = ctx.participantPn || ctx.participantAlt || ctx.participant;
    const quotedDigits = quotedParticipant?.split('@')[0]?.split(':')[0];
    const botNumber = sock.user?.id?.split(':')[0];
    const isOwnMessage = !!botNumber && quotedDigits === botNumber;

    if (isOwnMessage) {
      await sock.sendMessage(jid, {
        delete: { remoteJid: jid, fromMe: true, id: stanzaId, participant: isGroup ? ctx.participant : undefined }
      });
      return;
    }

    if (!isGroup) {
      return sock.sendMessage(jid, {
        text: '❌ *I can only delete my own messages in a DM.*'
      }, { quoted: msg });
    }

    let metadata;
    try {
      metadata = await sock.groupMetadata(jid);
    } catch (e) {
      console.error('[DEL ERROR] Could not fetch group metadata:', e.message);
      return sock.sendMessage(jid, { text: '❌ *Could not check group admin status. Try again.*' }, { quoted: msg });
    }

    const botIsAdmin = await isJidGroupAdmin(metadata, botNumber ? `${botNumber}@s.whatsapp.net` : null);
    if (!botIsAdmin) {
      return sock.sendMessage(jid, { text: '❌ *I need to be an admin to delete messages.*' }, { quoted: msg });
    }

    const senderJid = msg.key.participant || msg.participant;
    const senderIsAdmin = await isJidGroupAdmin(metadata, senderJid);
    if (!senderIsAdmin) {
      return sock.sendMessage(jid, { text: '❌ *Only group admins can use this command.*' }, { quoted: msg });
    }

    const isBaileysMessage = stanzaId.length === 20 || stanzaId.startsWith('BAE5');

    if (isBaileysMessage) {
      return sock.sendMessage(jid, {
        text: '❌ *I cannot delete this. Quoted message appears to be from another bot.*'
      }, { quoted: msg });
    }

    await sock.sendMessage(jid, {
      delete: { remoteJid: jid, fromMe: false, id: stanzaId, participant: quotedParticipant }
    });
  }
};
