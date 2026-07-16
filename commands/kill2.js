{
    command: ['kill2', 'kickall2'],
    aliases: ['kickall2', 'kick-all2'],
    description: 'Nuclear kick a remote group by invite link (Owner only)',
    category: 'group',
    handler: async (client, m, { reply, Owner, NotOwner, text, args }) => {
      if (!Owner) return m.reply(NotOwner);
      if (!text) return m.reply('Provide a valid group link. Ensure the bot is in that group with admin privileges!');
      let groupId, groupName;
      try {
        let inviteCode = args[0].split('https://chat.whatsapp.com/')[1];
        const groupInfo = await client.groupGetInviteInfo(inviteCode);
        ({ id: groupId, subject: groupName } = groupInfo);
      } catch {
        return m.reply('Why are you giving me an invalid group link?');
      }
      try {
        const { jidNormalizedUser } = require('@whiskeysockets/baileys');
        const groupMetadata = await client.groupMetadata(groupId);
        const botJid = jidNormalizedUser(client.user.id);
        const nicko = groupMetadata.participants.filter(p => p.id !== botJid).map(p => p.id);
        await m.reply(`☠️Initializing and Preparing to kill☠️ ${groupName}`);
        await client.groupSettingUpdate(groupId, 'announcement');
        await client.removeProfilePicture(groupId);
        await client.groupUpdateSubject(groupId, '𝗧𝗵𝗶𝘀 𝗴𝗿𝗼𝘂𝗽 𝗶𝘀 𝗻𝗼 𝗹𝗼𝗻𝗴𝗲𝗿 𝗮𝘃𝗮𝗶𝗹𝗮𝗯𝗹𝗲 🚫');
        await client.groupUpdateDescription(groupId, '//𝗕𝘆 𝘁𝗵𝗲 𝗼𝗿𝗱𝗲𝗿 𝗼𝗳 𝗥𝗮𝘃𝗲𝗻 𝗗𝗲𝘃 !');
        await client.groupRevokeInvite(groupId);
        await client.sendMessage(groupId, {
          text: `At this time, My owner has initiated kill command remotely.\nThis has triggered me to remove all ${nicko.length} group participants in the next second.\n\nGoodbye Everyone! 👋\n\n⚠️THIS PROCESS CANNOT BE TERMINATED⚠️`,
          mentions: nicko
        });
        await client.groupParticipantsUpdate(groupId, nicko, 'remove');
        await client.sendMessage(groupId, { text: 'Goodbye Group owner👋\nIt\'s too cold in Here🥶' });
        await client.groupLeave(groupId);
        await m.reply('```Successfully Killed💀```');
      } catch {
        m.reply('```Kill command failed, bot is either not in that group, or not an admin```.');
      }
    }
  },
