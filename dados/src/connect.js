/*
═════════════════════════════
  Nazuna - Conexão WhatsApp
  Autor: Hiudy
  Revisão: 01/08/2025
═════════════════════════════
*/

const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@cognima/walib');
const Banner = require('@cognima/banners');
const { Boom } = require('@hapi/boom');
const { NodeCache } = require('@cacheable/node-cache');
const readline = require('readline');
const pino = require('pino');
const fs = require('fs').promises;
const path = require('path');

const logger = pino({ level: 'silent' });
const AUTH_DIR = path.join(__dirname, '..', 'database', 'qr-code');
const DATABASE_DIR = path.join(__dirname, '..', 'database', 'grupos');
const msgRetryCounterCache = new NodeCache({ stdTTL: 5 * 60, useClones: false });
const groupCache = new NodeCache({ stdTTL: 5 * 60, useClones: false });
const { prefixo, nomebot, nomedono, numerodono } = require('./config.json');
const indexModule = require(path.join(__dirname, 'index.js'));

const codeMode = process.argv.includes('--code');

const messagesCache = new Map();
setInterval(() => messagesCache.clear(), 600000);

const ask = (question) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    resolve(answer.trim());
  }));
};

async function createBotSocket(authDir) {
  await fs.mkdir(DATABASE_DIR, { recursive: true });
  await fs.mkdir(authDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version, isLatest } = await fetchLatestBaileysVersion();

  const NazunaSock = makeWASocket({
    version,
    emitOwnEvents: true,
    fireInitQueries: true,
    generateHighQualityLinkPreview: true,
    syncFullHistory: true,
    markOnlineOnConnect: true,
    connectTimeoutMs: 60000,
    retryRequestDelayMs: 5000,
    qrTimeout: 180000,
    keepAliveIntervalMs: 30_000,
    defaultQueryTimeoutMs: undefined,
    msgRetryCounterCache,
    cachedGroupMetadata: async (jid) => groupCache.get(jid),
    auth: state,
    logger,
  });

  NazunaSock.ev.on('creds.update', saveCreds);

  if (codeMode && !NazunaSock.authState.creds.registered) {
    let phoneNumber = await ask('📱 Por favor, insira o número de telefone (com DDD, sem espaços ou caracteres especiais): ');
    phoneNumber = phoneNumber.replace(/\D/g, '');
    if (!/^\d{10,15}$/.test(phoneNumber)) {
      console.log('⚠️ Número inválido! Insira um número válido com 10 a 15 dígitos.');
      process.exit(1);
    }

    const code = await NazunaSock.requestPairingCode(phoneNumber.replaceAll('+', '').replaceAll(' ', '').replaceAll('-', ''));
    console.log(`🔑 Código de pareamento: ${code}`);
    console.log('📲 Envie este código no WhatsApp para autenticar o bot.');
  }

  NazunaSock.ev.on('groups.update', async ([ev]) => {
    const meta = await NazunaSock.groupMetadata(ev.id).catch(() => null);
    if (meta) groupCache.set(ev.id, meta);
  });

  NazunaSock.ev.on('group-participants.update', async (inf) => {
    const from = inf.id;
    if (inf.participants[0].startsWith(NazunaSock.user.id.split(':')[0])) return;

    let groupMetadata = groupCache.get(from);
    if (!groupMetadata) {
      groupMetadata = await NazunaSock.groupMetadata(from).catch(() => null);
      if (!groupMetadata) return;
      groupCache.set(from, groupMetadata);
    }

    const groupFilePath = path.join(DATABASE_DIR, `${from}.json`);
    let jsonGp;
    try {
      jsonGp = JSON.parse(await fs.readFile(groupFilePath, 'utf-8'));
    } catch (e) {
      return;
    }

    if ((inf.action === 'promote' || inf.action === 'demote') && jsonGp.x9) {
      const action = inf.action === 'promote' ? 'promovido a administrador' : 'rebaixado de administrador';
      const by = inf.author || 'alguém';
      await NazunaSock.sendMessage(from, {
        text: `🚨 Atenção! @${inf.participants[0].split('@')[0]} foi ${action} por @${by.split('@')[0]}.`,
        mentions: [inf.participants[0], by],
      });
    }

    if (inf.action === 'add' && jsonGp.antifake) {
      const participant = inf.participants[0];
      const countryCode = participant.split('@')[0].substring(0, 2);
      if (!['55', '35'].includes(countryCode)) {
        await NazunaSock.groupParticipantsUpdate(from, [participant], 'remove');
        await NazunaSock.sendMessage(from, {
          text: `🚫 @${participant.split('@')[0]} foi removido por suspeita de número falso (código de país não permitido).`,
          mentions: [participant],
        });
      }
    }

    if (inf.action === 'add' && jsonGp.antipt) {
      const participant = inf.participants[0];
      const countryCode = participant.split('@')[0].substring(0, 3);
      if (countryCode === '351') {
        await NazunaSock.groupParticipantsUpdate(from, [participant], 'remove');
        await NazunaSock.sendMessage(from, {
          text: `🇵🇹 @${participant.split('@')[0]} foi removido por ser um número de Portugal (anti-PT ativado).`,
          mentions: [participant],
        });
      }
    }

    if (inf.action === 'add' && jsonGp.blacklist?.[inf.participants[0]]) {
      const sender = inf.participants[0];
      try {
        await NazunaSock.groupParticipantsUpdate(from, [sender], 'remove');
        await NazunaSock.sendMessage(from, {
          text: `🚫 @${sender.split('@')[0]} foi removido do grupo por estar na lista negra. Motivo: ${jsonGp.blacklist[sender].reason}`,
          mentions: [sender],
        });
      } catch (e) {
        console.error(`❌ Erro ao remover usuário da lista negra no grupo ${from}: ${e.message}`);
      }
      return;
    }

    if (inf.action === 'add' && jsonGp.bemvindo) {
      const sender = inf.participants[0];
      const welcomeText = jsonGp.textbv && jsonGp.textbv.length > 1
        ? jsonGp.textbv
        : `🎉 Bem-vindo(a), @${sender.split('@')[0]}! Você entrou no grupo *${groupMetadata.subject}*. Leia as regras e aproveite! Membros: ${groupMetadata.participants.length}. Descrição: ${groupMetadata.desc || 'Nenhuma'}.`;

      const formattedText = welcomeText
        .replaceAll('#numerodele#', `@${sender.split('@')[0]}`)
        .replaceAll('#nomedogp#', groupMetadata.subject)
        .replaceAll('#desc#', groupMetadata.desc || '')
        .replaceAll('#membros#', groupMetadata.participants.length);

      try {
        const message = { text: formattedText, mentions: [sender] };
        if (jsonGp.welcome?.image) {
          let profilePic = 'https://raw.githubusercontent.com/nazuninha/uploads/main/outros/1747053564257_bzswae.bin';
          try {
            profilePic = await NazunaSock.profilePictureUrl(sender, 'image');
          } catch (error) {}
          const image = jsonGp.welcome.image !== 'banner'
            ? { url: jsonGp.welcome.image }
            : await new Banner.welcomeLeave()
                .setAvatar(profilePic)
                .setTitle('Bem-vindo(a)!')
                .setMessage('Aceita um cafézinho enquanto lê as regras?')
                .build();
          message.image = image;
          message.caption = formattedText;
          delete message.text;
        }
        await NazunaSock.sendMessage(from, message);
      } catch (e) {
        console.error(`❌ Erro ao enviar mensagem de boas-vindas no grupo ${from}: ${e.message}`);
      }
    }

    if (inf.action === 'remove' && jsonGp.exit?.enabled) {
      const sender = inf.participants[0];
      const exitText = jsonGp.exit.text && jsonGp.exit.text.length > 1
        ? jsonGp.exit.text
        : `👋 @${sender.split('@')[0]} saiu do grupo *${groupMetadata.subject}*. Até mais! Membros restantes: ${groupMetadata.participants.length}.`;

      const formattedText = exitText
        .replaceAll('#numerodele#', `@${sender.split('@')[0]}`)
        .replaceAll('#nomedogp#', groupMetadata.subject)
        .replaceAll('#desc#', groupMetadata.desc || '')
        .replaceAll('#membros#', groupMetadata.participants.length);

      try {
        const message = { text: formattedText, mentions: [sender] };
        if (jsonGp.exit?.image) {
          message.image = { url: jsonGp.exit.image };
          message.caption = formattedText;
          delete message.text;
        }
        await NazunaSock.sendMessage(from, message);
      } catch (e) {
        console.error(`❌ Erro ao enviar mensagem de saída no grupo ${from}: ${e.message}`);
      }
    }
  });

  NazunaSock.ev.on('messages.upsert', async (m) => {
    if (!m.messages || !Array.isArray(m.messages) || m.type !== 'notify') return;
    try {
      if (typeof indexModule === 'function') {
        for (const info of m.messages) {
          if (!info.message || !info.key.remoteJid) continue;
          messagesCache.set(info.key.id, info.message);
          await indexModule(NazunaSock, info, null, groupCache, messagesCache);
        }
      } else {
        console.error('⚠️ Módulo index.js inválido ou não encontrado.');
      }
    } catch (err) {
      console.error(`❌ Erro ao processar mensagem: ${err.message}`);
    }
  });

  NazunaSock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && !NazunaSock.authState.creds.registered) {
      console.log('🔗 QR Code gerado para autenticação:');
      console.log(qr);
      console.log('📱 Escaneie o QR code com o WhatsApp para autenticar o bot.');
    }

    if (connection === 'open') {
      console.log(`✅ Bot ${nomebot} iniciado com sucesso! Prefixo: ${prefixo} | Dono: ${nomedono}`);
    }

    if (connection === 'close') {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const reasonMessage = {
        [DisconnectReason.loggedOut]: 'Deslogado do WhatsApp',
        401: 'Sessão expirada',
        [DisconnectReason.connectionClosed]: 'Conexão fechada',
        [DisconnectReason.connectionLost]: 'Conexão perdida',
        [DisconnectReason.connectionReplaced]: 'Conexão substituída',
        [DisconnectReason.timedOut]: 'Tempo de conexão esgotado',
        [DisconnectReason.badSession]: 'Sessão inválida',
        [DisconnectReason.restartRequired]: 'Reinício necessário',
      }[reason] || 'Motivo desconhecido';
      console.log(`❌ Conexão fechada. Código: ${reason} | Motivo: ${reasonMessage}`);

      console.log('🔄 Tentando reconectar o bot...');
      startNazu();
    }

    if (connection === 'connecting') {
      console.log('🔄 Atualizando sessão...');
    }
  });

  return NazunaSock;
}

async function startNazu() {
  try {
    console.log('🚀 Iniciando Nazuna...');
    await createBotSocket(AUTH_DIR);
  } catch (err) {
    console.error(`❌ Erro ao iniciar o bot: ${err.message}`);
    process.exit(1);
  }
}

startNazu();