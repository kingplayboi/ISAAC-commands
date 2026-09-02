const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { isOwner } = require('../utils/isOwner');
const { isBotAdmin, getBotIdentifiers } = require('../utils/isAdmin');

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
    return { jid, ctx: null, quotedMessage: null, quotedKey: null };
  }

  const quotedParticipant = ctx.participantPn || ctx.participantAlt || ctx.participant;
  const botNumber = sock.user?.id?.split(':')[0];

  const quotedKey = {
    remoteJid: jid,
    id: ctx.stanzaId,
    fromMe: !!botNumber && !!quotedParticipant && quotedParticipant.startsWith(botNumber),
    participant: ctx.participant,
  };

  return { jid, ctx, quotedMessage, quotedKey };
}

let cachedBotBio = null;

module.exports = [

  {
    name: 'poll',
    description: 'Create a poll. Usage: .poll Question | Option1 | Option2',
    async execute(sock, msg, args) {
      const jid = resolveJid(msg);
      const input = args.join(' ');
      const parts = input.split('|').map(p => p.trim());

      if (parts.length < 3) {
        return sock.sendMessage(jid, {
          text: '❌ Usage: .poll Question | Option1 | Option2 | ...'
        }, { quoted: msg });
      }

      const question = parts[0];
      const options = parts.slice(1);

      await sock.sendMessage(jid, {
        poll: {
          name: question,
          values: options,
          selectableCount: 1
        }
      });
    }
  },

  {
  name: 'del',
  aliases: ['delete'],
  description: 'Delete a message. Reply to a message with .del',
  async execute(sock, msg) {
    const { jid, ctx, quotedMessage, quotedKey } = getQuoted(sock, msg);

    if (!quotedMessage) {
      return sock.sendMessage(jid, {
        text: '*Which message should I delete ?*'
      }, { quoted: msg });
    }

    const quotedParticipant = ctx.participantPn || ctx.participantAlt || ctx.participant;
    const quotedDigits = quotedParticipant?.split('@')[0]?.split(':')[0];
    const botNumber = sock.user?.id?.split(':')[0];
    const isOwnMessage = !!botNumber && quotedDigits === botNumber;

    if (jid.endsWith('@g.us') && !isOwnMessage) {
      const groupMetadata = await sock.groupMetadata(jid);
      const botJid = (sock.user?.id || '').split(':')[0] + '@s.whatsapp.net';

      const botParticipant = groupMetadata.participants.find(
        participant => participant.id === botJid
      );

      const isBotAdmin =
        botParticipant &&
        (botParticipant.admin === 'admin' || botParticipant.admin === 'superadmin');

      if (!isBotAdmin) {
        return sock.sendMessage(jid, {
          text: '*Are you an admin ???.*'
        }, { quoted: msg });
      }
    }

    await sock.sendMessage(jid, {
      delete: { ...quotedKey, fromMe: isOwnMessage }
    });
  }
},

  {
    name: 'react',
    description: 'React to a message with an emoji. Reply to a message with .react 😂',
    async execute(sock, msg, args) {
      const { jid, quotedMessage, quotedKey } = getQuoted(sock, msg);

      if (!quotedMessage) {
        return sock.sendMessage(jid, {
          text: '❌ Reply to a message with .react <emoji>'
        }, { quoted: msg });
      }

      const emoji = args[0];
      if (!emoji) {
        return sock.sendMessage(jid, { text: '❌ Provide an emoji. Example: .react 😂' }, { quoted: msg });
      }

      await sock.sendMessage(jid, { react: { text: emoji, key: quotedKey } });
    }
  },

  {
    name: 'setstatus',
    aliases: ['poststatus'],
    description: "Reply to text/image/video/audio/sticker with .setstatus [caption] to post it to WhatsApp Status. With no reply, .setstatus <text> updates the bot's profile bio instead.",
    async execute(sock, msg, args) {
      const { jid, ctx, quotedMessage } = getQuoted(sock, msg);
      const input = args.join(' ').trim();

      if (!quotedMessage) {
        if (!input) {
          return sock.sendMessage(jid, {
            text: '❌ *Usage:*\n• Reply to text/image/video/audio/sticker with `.setstatus [caption]` to post to Status.\n• Use `.setstatus <text>` with no reply to update the profile bio.'
          }, { quoted: msg });
        }

        try {
          await sock.updateProfileStatus(input);
          cachedBotBio = input;
          return sock.sendMessage(jid, { text: `✅ Profile status (bio) updated to:\n*${input}*` }, { quoted: msg });
        } catch (e) {
          return sock.sendMessage(jid, { text: `❌ Failed to update bio: ${e.message}` }, { quoted: msg });
        }
      }

      try {
        const statusJid = 'status@broadcast';

        let statusJidList = [sock.user?.id?.split(':')[0] + '@s.whatsapp.net'];

        try {
          const groups = await Promise.race([
            sock.groupFetchAllParticipating(),
            new Promise((_, rej) => setTimeout(() => rej(new Error('group lookup timed out')), 10000)),
          ]);

          const jids = new Set(statusJidList);

          for (const group of Object.values(groups || {})) {
            for (const p of group.participants || []) {
              if (p.id && p.id.endsWith('@s.whatsapp.net')) jids.add(p.id);
            }
          }

          statusJidList = Array.from(jids);
        } catch (e) {
          console.error('[SETSTATUS] Could not build recipient list, sending to bot only:', e.message);
        }

        const quotedText = quotedMessage.conversation || quotedMessage.extendedTextMessage?.text;

        if (quotedText) {
          await sock.sendMessage(statusJid, {
            text: input || quotedText
          }, {
            backgroundColor: '#075E54',
            font: 1,
            statusJidList
          });

          return sock.sendMessage(jid, {
            text: `✅ Text posted to WhatsApp Status! (${statusJidList.length} recipient(s))`
          }, { quoted: msg });
        }

        const mediaType = Object.keys(quotedMessage).find((k) =>
          ['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage'].includes(k)
        );

        if (!mediaType) {
          return sock.sendMessage(jid, {
            text: '❌ Unsupported message type for status. Reply to text, image, video, audio, or a sticker.'
          }, { quoted: msg });
        }

        const mediaBuffer = await downloadMediaMessage(
          {
            message: quotedMessage,
            key: {
              remoteJid: jid,
              id: ctx.stanzaId,
              participant: ctx.participant || msg.key.participant,
            },
          },
          'buffer',
          {}
        );

        if (!mediaBuffer) {
          return sock.sendMessage(jid, {
            text: '❌ Failed to download the replied media.'
          }, { quoted: msg });
        }

        const caption = input || quotedMessage[mediaType]?.caption || '';

        if (mediaType === 'imageMessage') {
          await sock.sendMessage(statusJid, {
            image: mediaBuffer,
            caption,
            statusJidList
          });
        } else if (mediaType === 'videoMessage') {
          await sock.sendMessage(statusJid, {
            video: mediaBuffer,
            caption,
            statusJidList
          });
        } else if (mediaType === 'audioMessage') {
          const mimetype = quotedMessage.audioMessage?.mimetype || 'audio/mp4';

          await sock.sendMessage(statusJid, {
            audio: mediaBuffer,
            mimetype,
            statusJidList
          });
        } else if (mediaType === 'stickerMessage') {
          await sock.sendMessage(statusJid, {
            sticker: mediaBuffer,
            statusJidList
          });
        }

        return sock.sendMessage(jid, {
          text: `✅ Media posted to WhatsApp Status! (${statusJidList.length} recipient(s))`
        }, { quoted: msg });

      } catch (error) {
        console.error('[SETSTATUS ERROR]', error);

        return sock.sendMessage(jid, {
          text: `❌ Failed to post status: ${error.message}`
        }, { quoted: msg });
      }
    },
  },

  {
    name: 'status',
    description: "Get the profile status/bio of the bot, a tagged user, or a replied user.",
    async execute(sock, msg, args) {
      const jid = resolveJid(msg);
      const ctx = msg.message?.extendedTextMessage?.contextInfo;

      let targetJid = ctx?.mentionedJid?.[0]
        || (args[0] && args[0].includes('@') ? args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null)
        || ctx?.participantPn
        || ctx?.participantAlt
        || ctx?.participant;

      const botJid = (sock.user?.id || sock.user?.jid || '').split(':')[0] + '@s.whatsapp.net';

      if (!targetJid) targetJid = botJid;

      const isSelf = targetJid === botJid;
      const cleanNum = targetJid.split('@')[0];
      const who = isSelf ? 'Bio' : `@${cleanNum}'s status`;

      if (isSelf) {
        const bioText = cachedBotBio || 'No bio set yet — set one with .setstatus <text>.';

        return sock.sendMessage(jid, {
          text: `${who}: ${bioText}`
        }, { quoted: msg });
      }

      try {
        const raw = await sock.fetchStatus(targetJid);
        const record = Array.isArray(raw) ? raw[0] : raw;

        const statusText = (
          (typeof record?.status === 'string' && record.status) ||
          record?.status?.status ||
          ''
        ).trim();

        const setAt = record?.setAt || record?.status?.setAt;

        const message = statusText
          ? `${who}: ${statusText}${setAt ? ` (set ${new Date(setAt).toLocaleDateString()})` : ''}`
          : `${who}: no status set, or it's hidden by their privacy settings.`;

        await sock.sendMessage(jid, {
          text: message,
          mentions: [targetJid]
        }, { quoted: msg });

      } catch (error) {
        await sock.sendMessage(jid, {
          text: `❌ Could not fetch status for @${cleanNum}.`,
          mentions: [targetJid]
        }, { quoted: msg });
      }
    }
  },

  {
    name: 'caption',
    description: 'Add/change caption on a media message. Reply to media with .caption <text>',
    async execute(sock, msg, args) {
      const { jid, ctx, quotedMessage } = getQuoted(sock, msg);

      if (!quotedMessage) {
        return sock.sendMessage(jid, {
          text: '❌ Reply to an image or video with .caption <text>'
        }, { quoted: msg });
      }

      const caption = args.join(' ');

      if (!caption) {
        return sock.sendMessage(jid, {
          text: '❌ Provide a caption text.'
        }, { quoted: msg });
      }

      const type = quotedMessage.imageMessage
        ? 'image'
        : quotedMessage.videoMessage
          ? 'video'
          : null;

      if (!type) {
        return sock.sendMessage(jid, {
          text: '❌ Only images and videos are supported.'
        }, { quoted: msg });
      }

      const media = await downloadMediaMessage(
        {
          message: quotedMessage,
          key: {
            remoteJid: jid,
            id: ctx.stanzaId,
            participant: ctx.participant
          }
        },
        'buffer',
        {}
      );	

      await sock.sendMessage(jid, {
        [type]: media,
        caption
      }, { quoted: msg });
    }
  },

  {
    name: 'doc',
    description: 'Send a media file as a document. Reply to media with .doc',
    async execute(sock, msg) {
      const { jid, ctx, quotedMessage } = getQuoted(sock, msg);

      if (!quotedMessage) {
        return sock.sendMessage(
          jid,
          {
            text: '❌ Reply to a media message (image, video, audio, or document) with *.doc*'
          },
          { quoted: msg }
        );
      }

      const mediaType = Object.keys(quotedMessage).find((k) =>
        ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'].includes(k)
      );

      if (!mediaType) {
        return sock.sendMessage(
          jid,
          {
            text: '❌ The replied message is not a media file (image, video, audio, or document).'
          },
          { quoted: msg }
        );
      }

      try {
        const media = await downloadMediaMessage(
          {
            message: quotedMessage,
            key: {
              remoteJid: jid,
              id: ctx.stanzaId,
              participant: ctx.participant || msg.key.participant,
            },
          },
          'buffer',
          {}
        );

        if (!media) {
          return sock.sendMessage(
            jid,
            { text: '❌ Failed to download media file.' },
            { quoted: msg }
          );
        }

        const mediaObj = quotedMessage[mediaType];
        const mimetype = mediaObj?.mimetype || 'application/octet-stream';
        const defaultExt = mimetype.split('/')[1]?.split(';')[0] || 'bin';
        const fileName = mediaObj?.fileName || `file_${Date.now()}.${defaultExt}`;

        await sock.sendMessage(
          jid,
          {
            document: media,
            mimetype,
            fileName,
          },
          { quoted: msg }
        );
      } catch (error) {
        await sock.sendMessage(
          jid,
          {
            text: `❌ Failed to convert media to document: ${error.message}`
          },
          { quoted: msg }
        );
      }
    },
  },

  {
    name: 'cinfo',
    description: 'Get info about a contact. Usage: .cinfo @user',
    async execute(sock, msg) {
      const jid = resolveJid(msg);
      const ctx = msg.message?.extendedTextMessage?.contextInfo;
      const mentioned = ctx?.mentionedJid?.[0]
        || ctx?.participantPn
        || ctx?.participantAlt
        || ctx?.participant;

      if (!mentioned) {
        return sock.sendMessage(jid, {
          text: '❌ Tag or reply to a user. Example: .cinfo @user'
        }, { quoted: msg });
      }

      try {
        const info = await sock.onWhatsApp(mentioned);
        const status = await sock.fetchStatus(mentioned);
        const pp = await sock.profilePictureUrl(mentioned, 'image').catch(() => null);

        const text = `
╭──〔 👤 CONTACT INFO 〕──╮
📱 *Number:* +${mentioned.split('@')[0]}
✅ *On WhatsApp:* ${info?.[0]?.exists ? 'Yes' : 'No'}
📝 *Status:* ${status?.status || 'None'}
🖼 *Profile Pic:* ${pp ? pp : 'Not available'}
╰──────────────────╯`.trim();

        await sock.sendMessage(
          jid,
          {
            text,
            mentions: [mentioned]
          },
          { quoted: msg }
        );
      } catch {
        await sock.sendMessage(
          jid,
          { text: '❌ Could not fetch contact info.' },
          { quoted: msg }
        );
      }
    }
  },

  {
    name: 'clear',
    aliases: ['clearchat', 'deletechat'],
    description: 'Clears all messages in this chat.',
    async execute(sock, msg) {
      const jid = resolveJid(msg);

      if (!isOwner(msg)) {
        return await sock.sendMessage(
          jid,
          { text: '❌ *Only the bot owner can clear chats.*' },
          { quoted: msg }
        );
      }

      try {
        await sock.chatModify({ clear: 'all' }, jid);
        await sock.sendMessage(jid, {
          text: '🧹 *Chat history cleared successfully.*'
        });
      } catch (e) {
        console.error('[CLEAR CHAT ERROR]', e);

        try {
          await sock.chatModify(
            {
              clear: {
                messages: [
                  {
                    id: msg.key.id,
                    fromMe: msg.key.fromMe || false,
                    timestamp: msg.messageTimestamp,
                  },
                ],
              },
            },
            jid
          );

          await sock.sendMessage(jid, {
            text: '🧹 *Chat history cleared successfully.*'
          });
        } catch (err) {
          console.error('[CLEAR CHAT FALLBACK ERROR]', err);

          await sock.sendMessage(
            jid,
            {
              text: '❌ *Failed to clear chat:* WhatsApp multi-device session sync restricted this action.'
            },
            { quoted: msg }
          );
        }
      }
    }
  },

  {
    name: 'save1',
    aliases: ['savestatus', 'statusdownload'],
    description: 'Saves and forwards a quoted WhatsApp status to the current chat.',
    async execute(sock, msg) {
      const { jid, quotedMessage } = getQuoted(sock, msg);

      if (!quotedMessage) {
        return await sock.sendMessage(
          jid,
          { text: '⚠️ *Please reply to a WhatsApp status with .save1*' },
          { quoted: msg }
        );
      }

      try {
        const isImage = quotedMessage.imageMessage;
        const isVideo = quotedMessage.videoMessage;
        const isAudio = quotedMessage.audioMessage;
        const isSticker = quotedMessage.stickerMessage;
        const isText = quotedMessage.conversation || quotedMessage.extendedTextMessage?.text;

        if (isImage || isVideo || isAudio || isSticker) {
          const buffer = await downloadMediaMessage(
            { message: quotedMessage },
            'buffer',
            {}
          );

          const caption = isImage?.caption || isVideo?.caption || '';

          if (isImage) {
            await sock.sendMessage(jid, {
              image: buffer,
              caption
            }, { quoted: msg });
          } else if (isVideo) {
            await sock.sendMessage(jid, {
              video: buffer,
              caption
            }, { quoted: msg });
          } else if (isAudio) {
            await sock.sendMessage(jid, {
              audio: buffer,
              mimetype: 'audio/mp4'
            }, { quoted: msg });
          } else if (isSticker) {
            await sock.sendMessage(jid, {
              sticker: buffer
            }, { quoted: msg });
          }
        } else if (isText) {
          await sock.sendMessage(
            jid,
            { text: `📝 *Status Text:*\n\n${isText}` },
            { quoted: msg }
          );
        } else {
          await sock.sendMessage(
            jid,
            { text: '❌ *Unsupported status format.*' },
            { quoted: msg }
          );
        }
      } catch (err) {
        console.error('[SAVE1 ERROR]', err);

        await sock.sendMessage(
          jid,
          {
            text: '❌ *Failed to download status media. Make sure it has not expired.*'
          },
          { quoted: msg }
        );
      }
    }
  },

  // ── Remove group profile picture ──────────────────────────────
  {
    name: 'rgpp',
    aliases: ['removegpp', 'deletegpp', 'cleargpp'],
    description: 'Remove group profile picture',
    async execute(sock, msg) {
      const jid = resolveJid(msg);

      if (!isOwner(msg)) {
        return sock.sendMessage(jid, { text: '❌ Owner Only Command!' }, { quoted: msg });
      }
      if (!jid.endsWith('@g.us')) {
        return sock.sendMessage(jid, { text: '❌ This command can only be used in a group!' }, { quoted: msg });
      }

      try {
        const metadata = await sock.groupMetadata(jid);
        await sock.removeProfilePicture(metadata.id);
        return sock.sendMessage(jid, { text: '🗑️ Group profile picture removed successfully!' }, { quoted: msg });
      } catch (err) {
        console.error('rgpp error:', err);
        return sock.sendMessage(jid, { text: `❌ Failed to remove group profile picture.\nError: ${err.message}` }, { quoted: msg });
      }
    }
  },

  // ── Remove your own (bot's) profile picture ───────────────────
  {
    name: 'rpp',
    aliases: ['removepic', 'deletepp', 'clearpp'],
    description: "Remove your own profile picture",
    async execute(sock, msg) {
      const jid = resolveJid(msg);

      if (!isOwner(msg)) {
        return sock.sendMessage(jid, { text: '❌ Owner Only Command!' }, { quoted: msg });
      }

      try {
        const iqNode = {
          tag: 'iq',
          attrs: {
            to: '@s.whatsapp.net',
            type: 'set',
            xmlns: 'w:profile:picture'
          },
          content: [
            {
              tag: 'picture',
              attrs: { type: 'image' },
              content: []
            }
          ]
        };

        await sock.query(iqNode);
        return sock.sendMessage(jid, { text: '🗑️ Profile picture removed successfully!' }, { quoted: msg });
      } catch (err) {
        console.error('rpp error:', err);
        return sock.sendMessage(jid, { text: `❌ Failed to remove profile picture.\nError: ${err.message}` }, { quoted: msg });
      }
    }
  },

  // ── Send quoted text/media to group status ────────────────────
  {
    name: 'togroupstatus',
    aliases: ['groupstatus', 'statusgroup'],
    description: 'Send quoted text or media to group status',
    async execute(sock, msg, args) {
      const { jid, quotedMessage } = getQuoted(sock, msg);
      const q = args.join(' ').trim();

      if (!isOwner(msg)) {
        return sock.sendMessage(jid, { text: '❌ Owner Only Command!' }, { quoted: msg });
      }
      if (!q && !quotedMessage) {
        return sock.sendMessage(jid, {
          text: '📌 Usage:\n' +
            '• .togroupstatus <text>\n' +
            '• Reply to an image/video/audio/document/sticker with .togroupstatus <caption>\n' +
            '• Or just .togroupstatus to forward quoted media without caption'
        }, { quoted: msg });
      }

      try {
        let payload = { groupStatusMessage: {} };

        if (quotedMessage) {
          if (quotedMessage.imageMessage) {
            const caption = q || quotedMessage.imageMessage.caption || '';
            const filePath = await sock.downloadAndSaveMediaMessage(quotedMessage.imageMessage);
            payload.groupStatusMessage.image = { url: filePath };
            if (caption) payload.groupStatusMessage.caption = caption;
          } else if (quotedMessage.videoMessage) {
            const caption = q || quotedMessage.videoMessage.caption || '';
            const filePath = await sock.downloadAndSaveMediaMessage(quotedMessage.videoMessage);
            payload.groupStatusMessage.video = { url: filePath };
            if (caption) payload.groupStatusMessage.caption = caption;
          } else if (quotedMessage.audioMessage) {
            const filePath = await sock.downloadAndSaveMediaMessage(quotedMessage.audioMessage);
            payload.groupStatusMessage.audio = { url: filePath };
          } else if (quotedMessage.documentMessage) {
            const filePath = await sock.downloadAndSaveMediaMessage(quotedMessage.documentMessage);
            payload.groupStatusMessage.document = { url: filePath };
          } else if (quotedMessage.stickerMessage) {
            const filePath = await sock.downloadAndSaveMediaMessage(quotedMessage.stickerMessage);
            payload.groupStatusMessage.sticker = { url: filePath };
          } else if (quotedMessage.conversation || quotedMessage.extendedTextMessage?.text) {
            payload.groupStatusMessage.text = quotedMessage.conversation || quotedMessage.extendedTextMessage.text;
          }

          if (q && !payload.groupStatusMessage.caption) {
            payload.groupStatusMessage.caption = q;
          }
        } else {
          payload.groupStatusMessage.text = q;
        }

        await sock.sendMessage(jid, payload, { quoted: msg });
      } catch (err) {
        console.error('togroupstatus error:', err);
        return sock.sendMessage(jid, { text: `❌ Error sending group status: ${err.message}` }, { quoted: msg });
      }
    }
  },

  // ── Create a new group ─────────────────────────────────────────
  {
    name: 'creategc',
    aliases: ['creategroup'],
    description: 'Create a new WhatsApp group with optional participants',
    async execute(sock, msg, args) {
      const jid = resolveJid(msg);
      const sender = msg.key.participant || msg.key.remoteJid;
      const q = args.join(' ').trim();

      if (!isOwner(msg)) {
        return sock.sendMessage(jid, { text: '❌ Owner Only Command!' }, { quoted: msg });
      }
      if (!q) {
        return sock.sendMessage(jid, {
          text: '✏️ Usage: .creategc GroupName\nOr: .creategc GroupName 1234567890,9876543210'
        }, { quoted: msg });
      }

      try {
        let groupName = q;
        let participants = [sender];

        const parts = q.split(/\s+/);
        if (parts.length > 1 && parts[parts.length - 1].match(/\d{10,}/)) {
          groupName = parts.slice(0, -1).join(' ');
          const numbers = parts[parts.length - 1].split(',');

          for (const num of numbers) {
            const cleanNum = num.replace(/[^0-9]/g, '');
            if (cleanNum.length >= 10) {
              participants.push(cleanNum + '@s.whatsapp.net');
            }
          }
        }

        const group = await sock.groupCreate(groupName, participants);
        const inviteCode = await sock.groupInviteCode(group.id);

        const text = `✅ *Group Created!*\n\n` +
          `*Name*: ${groupName}\n` +
          `*Members*: ${participants.length}\n` +
          `*Link*: https://chat.whatsapp.com/${inviteCode}\n\n` +
          `The group has been created with you as the admin.`;

        return sock.sendMessage(jid, { text }, { quoted: msg });
      } catch (err) {
        console.error('creategc error:', err);
        return sock.sendMessage(jid, { text: `❌ Failed to create group: ${err.message}` }, { quoted: msg });
      }
    }
  },

  // ── Demote all group admins ─────────────────────────────────────
  {
    name: 'demoteall',
    aliases: ['demoteadmins', 'stripadmins'],
    description: 'Demote all group admins',
    async execute(sock, msg) {
      const jid = resolveJid(msg);

      if (!isOwner(msg)) {
        return sock.sendMessage(jid, { text: '❌ Owner Only Command!' }, { quoted: msg });
      }
      if (!jid.endsWith('@g.us')) {
        return sock.sendMessage(jid, { text: '❌ This command only works in groups!' }, { quoted: msg });
      }

      const metadata = await sock.groupMetadata(jid);
      if (!isBotAdmin(sock, metadata)) {
        return sock.sendMessage(jid, { text: '❌ Bot must be admin to demote others.' }, { quoted: msg });
      }

      try {
        const botIds = getBotIdentifiers(sock);

        const admins = metadata.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');
        const demoteIds = admins
          .map(a => a.id)
          .filter(id => !botIds.has(id)); // add owner-number exclusion here if you keep an owner list

        if (demoteIds.length === 0) {
          return sock.sendMessage(jid, { text: 'ℹ️ No admins found to demote.' }, { quoted: msg });
        }

        await sock.groupParticipantsUpdate(jid, demoteIds, 'demote');

        return sock.sendMessage(jid, {
          text: `🔻 All admins have been demoted (${demoteIds.length}).`,
          mentions: demoteIds
        }, { quoted: msg });
      } catch (err) {
        console.error('demoteall error:', err);
        return sock.sendMessage(jid, { text: `❌ Failed to demote admins: ${err.message}` }, { quoted: msg });
      }
    }
  },

  // ── Promote all non-admin members ────────────────────────────────
  {
    name: 'promoteall',
    aliases: ['promotemembers', 'makeadmins'],
    description: 'Promote all non-admin members to group admin',
    async execute(sock, msg) {
      const jid = resolveJid(msg);

      if (!jid.endsWith('@g.us')) {
        return sock.sendMessage(jid, { text: '❌ This command only works in groups!' }, { quoted: msg });
      }
      if (!isOwner(msg)) {
        return sock.sendMessage(jid, { text: '❌ Only the bot owner can use this command.' }, { quoted: msg });
      }

      const metadata = await sock.groupMetadata(jid);
      if (!isBotAdmin(sock, metadata)) {
        return sock.sendMessage(jid, { text: '❌ I need to be a group admin to promote others.' }, { quoted: msg });
      }

      try {
        const botIds = getBotIdentifiers(sock);

        const promoteIds = metadata.participants
          .map(p => p.id)
          .filter(id =>
            !botIds.has(id) &&
            !metadata.participants.find(p => p.id === id && (p.admin === 'a
