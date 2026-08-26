const { downloadMediaMessage } = require('@whiskeysockets/baileys');

module.exports = [

  // ── POLL ──────────────────────────────────────────────────────────────────
  {
    name: 'poll',
    description: 'Create a poll. Usage: .poll Question | Option1 | Option2',
    async execute(sock, msg, args) {
      const jid = msg.key.remoteJid;
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

  // ── REACT ─────────────────────────────────────────────────────────────────
  {
    name: 'react',
    description: 'React to a message with an emoji. Reply to a message with .react 😂',
    async execute(sock, msg, args) {
      const jid = msg.key.remoteJid;

      if (!msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
        return sock.sendMessage(jid, {
          text: '❌ Reply to a message with .react <emoji>'
        }, { quoted: msg });
      }

      const emoji = args[0];
      if (!emoji) {
        return sock.sendMessage(jid, { text: '❌ Provide an emoji. Example: .react 😂' }, { quoted: msg });
      }

      const ctx = msg.message.extendedTextMessage.contextInfo;
      const quotedParticipant = ctx.participantPn || ctx.participantAlt || ctx.participant;

      const key = {
        remoteJid: jid,
        id: ctx.stanzaId,
        fromMe: quotedParticipant === (sock.user?.id?.split(':')[0] + '@s.whatsapp.net'),
        participant: ctx.participant
      };

      await sock.sendMessage(jid, {
        react: { text: emoji, key }
      });
    }
  },

  // ── DEL ───────────────────────────────────────────────────────────────────
  {
    name: 'del',
    description: 'Delete a message. Reply to a message with .del',
    async execute(sock, msg) {
      const jid = msg.key.remoteJid;
      const quoted = msg.message?.extendedTextMessage?.contextInfo;

      if (!quoted) {
        return sock.sendMessage(jid, {
          text: '❌ Reply to the message you want to delete.'
        }, { quoted: msg });
      }

      const quotedParticipant = quoted.participantPn || quoted.participantAlt || quoted.participant;

      const msgKey = {
        remoteJid: jid,
        id: quoted.stanzaId,
        fromMe: quotedParticipant === (sock.user?.id?.split(':')[0] + '@s.whatsapp.net'),
        participant: quoted.participant
      };

      await sock.sendMessage(jid, { delete: msgKey });
    }
  },

      // ── SETSTATUS ─────────────────────────────────────────────────────────────
  {
    name: 'setstatus',
    description: 'Update bot profile status or post replied text/media to WhatsApp Status.',
    async execute(sock, msg, args) {
      const jid = msg.key.remoteJid;
      const input = args.join(' ');
      const ctx = msg.message?.extendedTextMessage?.contextInfo;
      const quoted = ctx?.quotedMessage;

      // Case 1: Plain text without reply -> Update Profile Bio
      if (!quoted && input) {
        try {
          await sock.updateProfileStatus(input);
          return await sock.sendMessage(jid, { text: `✅ Profile status (bio) updated to:\n*${input}*` }, { quoted: msg });
        } catch (e) {
          return await sock.sendMessage(jid, { text: `❌ Failed to update bio: ${e.message}` }, { quoted: msg });
        }
      }

      // Case 2: Replied to a message -> Post to WhatsApp Status (Story)
      if (quoted) {
        try {
          const { downloadMediaMessage } = require('@whiskeysockets/baileys');
          const statusJid = 'status@broadcast';

          // Fetch contacts/participating JIDs to ensure delivery broadcast
          const botJid = sock.user?.id?.split(':')[0] + '@s.whatsapp.net';
          const broadcastOpts = {
            statusJidList: [botJid],
          };

          // 2a. Replied to Text Message
          if (quoted.conversation || quoted.extendedTextMessage?.text) {
            const statusText = input || quoted.conversation || quoted.extendedTextMessage?.text;
            
            await sock.sendMessage(
              statusJid,
              { 
                text: statusText,
                backgroundColor: '#075E54',
                font: 1
              },
              broadcastOpts
            );
            return await sock.sendMessage(jid, { text: '✅ Text posted to WhatsApp Status!' }, { quoted: msg });
          }

          // 2b. Replied to Media (Image, Video, Audio)
          const mediaType = Object.keys(quoted).find((k) =>
            ['imageMessage', 'videoMessage', 'audioMessage'].includes(k)
          );

          if (!mediaType) {
            return await sock.sendMessage(jid, { text: '❌ Unsupported media type for status.' }, { quoted: msg });
          }

          const mediaBuffer = await downloadMediaMessage(
            {
              message: quoted,
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
            return await sock.sendMessage(jid, { text: '❌ Failed to download media.' }, { quoted: msg });
          }

          const caption = input || quoted[mediaType]?.caption || '';

          if (mediaType === 'imageMessage') {
            await sock.sendMessage(statusJid, { image: mediaBuffer, caption }, broadcastOpts);
          } else if (mediaType === 'videoMessage') {
            await sock.sendMessage(statusJid, { video: mediaBuffer, caption }, broadcastOpts);
          } else if (mediaType === 'audioMessage') {
            const mimetype = quoted.audioMessage?.mimetype || 'audio/mp4';
            await sock.sendMessage(statusJid, { audio: mediaBuffer, mimetype, ptt: true }, broadcastOpts);
          }

          return await sock.sendMessage(jid, { text: '✅ Media successfully posted to WhatsApp Status!' }, { quoted: msg });

        } catch (error) {
          return await sock.sendMessage(jid, { text: `❌ Failed to post status: ${error.message}` }, { quoted: msg });
        }
      }

      // Usage instructions if no input and no reply
      return await sock.sendMessage(
        jid,
        { text: '❌ *Usage:*\n• Reply to an image/video/text with `.setstatus [optional caption]` to post to Story.\n• Use `.setstatus <text>` to update profile bio.' },
        { quoted: msg }
      );
    },
  },


    // ── STATUS ────────────────────────────────────────────────────────────────
  {
    name: 'status',
    description: "Get the profile status/bio of the bot, a tagged user, or a replied user.",
    async execute(sock, msg, args) {
      const jid = msg.key.remoteJid;
      const ctx = msg.message?.extendedTextMessage?.contextInfo;
      const quoted = ctx?.quotedMessage;

      // Determine target JID: tagged user -> replied user -> bot's own JID
      let targetJid = ctx?.mentionedJid?.[0] 
        || (args[0] && args[0].includes('@') ? args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null)
        || ctx?.participant;

      if (!targetJid) {
        // Fallback to bot's own JID (clean decoded JID)
        const botId = sock.user?.id || sock.user?.jid || '';
        targetJid = botId.split(':')[0] + '@s.whatsapp.net';
      }

      const cleanNum = targetJid.split('@')[0];
      const isSelf = targetJid.includes(cleanNum) && sock.user?.id?.includes(cleanNum);

      try {
        const statusObj = await sock.fetchStatus(targetJid);
        const statusText = statusObj?.status || 'No status set.';
        const setAt = statusObj?.setAt ? new Date(statusObj.setAt).toLocaleDateString() : '';

        const header = isSelf 
          ? `📝 *Bot Status:*` 
          : `📝 *Status for @${cleanNum}:*`;

        const message = setAt 
          ? `${header}\n${statusText}\n\n_Set on: ${setAt}_` 
          : `${header}\n${statusText}`;

        await sock.sendMessage(jid, { 
          text: message, 
          mentions: [targetJid] 
        }, { quoted: msg });

      } catch (error) {
        await sock.sendMessage(jid, { 
          text: `❌ Could not fetch status for @${cleanNum}. (Privacy settings may hide it).`, 
          mentions: [targetJid] 
        }, { quoted: msg });
      }
    }
  },



  // ── CAPTION ───────────────────────────────────────────────────────────────
  {
    name: 'caption',
    description: 'Add/change caption on a media message. Reply to media with .caption <text>',
    async execute(sock, msg, args) {
      const jid = msg.key.remoteJid;
      const ctx = msg.message?.extendedTextMessage?.contextInfo;
      const quoted = ctx?.quotedMessage;

      if (!quoted) {
        return sock.sendMessage(jid, {
          text: '❌ Reply to an image or video with .caption <text>'
        }, { quoted: msg });
      }

      const caption = args.join(' ');
      if (!caption) {
        return sock.sendMessage(jid, { text: '❌ Provide a caption text.' }, { quoted: msg });
      }

      const type = quoted.imageMessage ? 'image' : quoted.videoMessage ? 'video' : null;
      if (!type) {
        return sock.sendMessage(jid, { text: '❌ Only images and videos are supported.' }, { quoted: msg });
      }

      const media = await downloadMediaMessage(
        { message: quoted, key: { remoteJid: jid, id: ctx.stanzaId, participant: ctx.participant } },
        'buffer',
        {}
      );

      await sock.sendMessage(jid, {
        [type]: media,
        caption
      }, { quoted: msg });
    }
  },

    // ── DOC ───────────────────────────────────────────────────────────────────
  {
    name: 'doc',
    description: 'Send a media file as a document. Reply to media with .doc',
    async execute(sock, msg) {
      const jid = msg.key.remoteJid;
      const ctx = msg.message?.extendedTextMessage?.contextInfo;
      const quoted = ctx?.quotedMessage;

      if (!quoted) {
        return sock.sendMessage(
          jid,
          { text: '❌ Reply to a media message (image, video, audio, or document) with *.doc*' },
          { quoted: msg }
        );
      }

      // Find the media object inside quoted message (imageMessage, videoMessage, etc.)
      const mediaType = Object.keys(quoted).find((k) =>
        ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'].includes(k)
      );

      if (!mediaType) {
        return sock.sendMessage(
          jid,
          { text: '❌ The replied message is not a media file (image, video, audio, or document).' },
          { quoted: msg }
        );
      }

      try {
        const { downloadMediaMessage } = require('@whiskeysockets/baileys');

        const media = await downloadMediaMessage(
          {
            message: quoted,
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

        const mediaObj = quoted[mediaType];
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
          { text: `❌ Failed to convert media to document: ${error.message}` },
          { quoted: msg }
        );
      }
    },
  },


  // ── CINFO ─────────────────────────────────────────────────────────────────
  {
    name: 'cinfo',
    description: 'Get info about a contact. Usage: .cinfo @user',
    async execute(sock, msg) {
      const jid = msg.key.remoteJid;
      const ctx = msg.message?.extendedTextMessage?.contextInfo;
      const mentioned = ctx?.mentionedJid?.[0] || ctx?.participantPn || ctx?.participantAlt || ctx?.participant;

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

        await sock.sendMessage(jid, { text }, { quoted: msg });
      } catch {
        await sock.sendMessage(jid, { text: '❌ Could not fetch contact info.' }, { quoted: msg });
      }
    }
  },

        // ── CLEAR ─────────────────────────────────────────────────────────────────
  {
    name: 'clear',
    aliases: ['clearchat', 'deletechat'],
    description: 'Clears all messages in this chat.',
    async execute(sock, msg) {
      const rawJid = msg.key.remoteJid;
      const jid = rawJid.endsWith('@lid') && msg.key.remoteJidAlt
        ? msg.key.remoteJidAlt
        : rawJid;

      const { isOwner } = require('../utils/isOwner');
      if (!isOwner(msg)) {
        return await sock.sendMessage(
          jid,
          { text: '❌ *Only the bot owner can clear chats.*' },
          { quoted: msg }
        );
      }

      try {
        // Fetch recent messages to form a valid deletion anchor
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

        await sock.sendMessage(jid, { text: '🧹 *Chat history cleared successfully.*' });
      } catch (e) {
        console.error('[CLEAR CHAT ERROR]', e);

        // Fallback: Empty the chat store if AppState sync is missing
        try {
          await sock.chatModify(
            {
              delete: true,
              lastMessages: [
                {
                  key: msg.key,
                  messageTimestamp: msg.messageTimestamp,
                },
              ],
            },
            jid
          );
        } catch (err) {
          await sock.sendMessage(
            jid,
            { text: '❌ *Failed to clear chat:* WhatsApp multi-device session sync restricted this action.' },
            { quoted: msg }
          );
        }
      }
    }
  },



    // ── SAVE1 ─────────────────────────────────────────────────────────────────
  {
    name: 'save1',
    aliases: ['savestatus', 'statusdownload'],
    description: 'Saves and forwards a quoted WhatsApp status to the current chat.',
    async execute(sock, msg) {
      const rawJid = msg.key.remoteJid;
      const jid = rawJid.endsWith('@lid') && msg.key.remoteJidAlt
        ? msg.key.remoteJidAlt
        : rawJid;

      const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
      const quotedMsg = contextInfo?.quotedMessage;

      if (!quotedMsg) {
        return await sock.sendMessage(
          jid,
          { text: '⚠️ *Please reply to a WhatsApp status with .save1*' },
          { quoted: msg }
        );
      }

      try {
        const { downloadMediaMessage } = require('@whiskeysockets/baileys');

        // Identify message type within quoted message
        const isImage = quotedMsg.imageMessage;
        const isVideo = quotedMsg.videoMessage;
        const isAudio = quotedMsg.audioMessage;
        const isText = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text;

        if (isImage || isVideo || isAudio) {
          // Download status buffer
          const buffer = await downloadMediaMessage(
            { message: quotedMsg },
            'buffer',
            {}
          );

          const caption = isImage?.caption || isVideo?.caption || '';

          if (isImage) {
            await sock.sendMessage(jid, { image: buffer, caption }, { quoted: msg });
          } else if (isVideo) {
            await sock.sendMessage(jid, { video: buffer, caption }, { quoted: msg });
          } else if (isAudio) {
            await sock.sendMessage(jid, { audio: buffer, mimetype: 'audio/mp4' }, { quoted: msg });
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
          { text: '❌ *Failed to download status media. Make sure it has not expired.*' },
          { quoted: msg }
        );
      }
    }
  },


];
