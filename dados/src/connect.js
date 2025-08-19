const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@cognima/walib');
const { Boom } = require('@hapi/boom');
const { NodeCache } = require('@cacheable/node-cache');
const readline = require('readline');
const pino = require('pino');
const fs = require('fs').promises;
const path = require('path');
const qrcode = require('qrcode-terminal');

const logger = pino({ level: 'silent' });
const AUTH_DIR = path.join(__dirname, '..', 'database', 'qr-code');
const DATABASE_DIR = path.join(__dirname, '..', 'database', 'grupos');
const GLOBAL_BLACKLIST_PATH = path.join(__dirname, '..', 'database', 'dono', 'globalBlacklist.json');
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

async function clearAuthDir() {
  try {
    await fs.rm(AUTH_DIR, { recursive: true, force: true });
    console.log(`🗑️ Pasta de autenticação (${AUTH_DIR}) excluída com sucesso.`);
  } catch (err) {
    console.error(`❌ Erro ao excluir pasta de autenticação: ${err.message}`);
  }
}

async function loadGroupSettings(groupId) {
  const groupFilePath = path.join(DATABASE_DIR, `${groupId}.json`);
  try {
    const data = await fs.readFile(groupFilePath, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    console.error(`❌ Erro ao ler configurações do grupo ${groupId}: ${e.message}`);
    return {};
  }
}

async function loadGlobalBlacklist() {
  try {
    const data = await fs.readFile(GLOBAL_BLACKLIST_PATH, 'utf-8');
    return JSON.parse(data).users || {};
  } catch (e) {
    console.error(`❌ Erro ao ler blacklist global: ${e.message}`);
    return {};
  }
}

function formatMessageText(template, replacements) {
  let text = template;
  for (const [key, value] of Object.entries(replacements)) {
    text = text.replaceAll(key, value);
  }
  return text;
}

async function createGroupMessage(NazunaSock, groupMetadata, participants, settings, isWelcome = true) {
  const mentions = participants.map(p => p);
  const bannerName = participants.length === 1 ? participants[0].split('@')[0] : `${participants.length} Membros`;
  const replacements = {
    '#numerodele#': participants.map(p => `@${p.split('@')[0]}`).join(', '),
    '#nomedogp#': groupMetadata.subject,
    '#desc#': groupMetadata.desc || 'Nenhuma',
    '#membros#': groupMetadata.participants.length,
  };

  const defaultText = isWelcome
  ? (jsonGp.textbv ? jsonGp.textbv : "🚀 Bem-vindo(a/s), #numerodele#! Vocês entraram no grupo *#nomedogp#*. Membros: #membros#.")
  : (jsonGp.exit.text ? jsonGp.exit.text : "👋 Adeus, #numerodele#! Até mais!");
  const text = formatMessageText(settings.text || defaultText, replacements);

  const message = { text, mentions };
  if (settings.image) {
    let profilePicUrl = 'https://raw.githubusercontent.com/nazuninha/uploads/main/outros/1747053564257_bzswae.bin';
    if (participants.length === 1 && isWelcome) {
      profilePicUrl = await NazunaSock.profilePictureUrl(participants[0], 'image').catch(() => profilePicUrl);
    }
    const { banner } = await require(path.join(__dirname, 'funcs', 'exports.js'));
    const image = settings.image !== 'banner'
      ? { url: settings.image }
      : { url: await banner.Welcome(profilePicUrl, bannerName, groupMetadata.subject, groupMetadata.participants.length) };
    message.image = image;
    message.caption = text;
    delete message.text;
  }
  return message;
}

async function handleGroupParticipantsUpdate(NazunaSock, inf) {
  try {
    const from = inf.id;
    if (inf.participants.some(p => p.startsWith(NazunaSock.user.id.split(':')[0]))) return;

    let groupMetadata = groupCache.get(from) || await NazunaSock.groupMetadata(from).catch(() => null);
    if (!groupMetadata) {
      console.error(`❌ Metadados do grupo ${from} não encontrados.`);
      return;
    }
    groupCache.set(from, groupMetadata);

    const groupSettings = await loadGroupSettings(from);
    const globalBlacklist = await loadGlobalBlacklist();

    switch (inf.action) {
      case 'add': {
        const membersToWelcome = [];
        const membersToRemove = [];
        const removalReasons = [];

        for (const participant of inf.participants) {
          if (globalBlacklist[participant]) {
            membersToRemove.push(participant);
            removalReasons.push(`@${participant.split('@')[0]} (blacklist global: ${globalBlacklist[participant].reason})`);
            continue;
          }
          if (groupSettings.blacklist?.[participant]) {
            membersToRemove.push(participant);
            removalReasons.push(`@${participant.split('@')[0]} (lista negra do grupo: ${groupSettings.blacklist[participant].reason})`);
            continue;
          }
          if (groupSettings.antifake && !['55', '35'].includes(participant.substring(0, 2))) {
            membersToRemove.push(participant);
            removalReasons.push(`@${participant.split('@')[0]} (número não permitido)`);
            continue;
          }
          if (groupSettings.antipt && participant.substring(0, 3) === '351') {
            membersToRemove.push(participant);
            removalReasons.push(`@${participant.split('@')[0]} (número de Portugal)`);
            continue;
          }
          if (groupSettings.bemvindo) {
            membersToWelcome.push(participant);
          }
        }

        if (membersToRemove.length > 0) {
          console.log(`[MODERAÇÃO] Removendo ${membersToRemove.length} membros do grupo ${groupMetadata.subject}.`);
          await NazunaSock.groupParticipantsUpdate(from, membersToRemove, 'remove');
          await NazunaSock.sendMessage(from, {
            text: `🚫 Foram removidos ${membersToRemove.length} membros por regras de moderação:\n- ${removalReasons.join('\n- ')}`,
            mentions: membersToRemove,
          });
        }

        if (membersToWelcome.length > 0) {
          console.log(`[BOAS-VINDAS] Enviando mensagem para ${membersToWelcome.length} novos membros em ${groupMetadata.subject}.`);
          const message = await createGroupMessage(NazunaSock, groupMetadata, membersToWelcome, groupSettings.welcome || { text: groupSettings.textbv });
          await NazunaSock.sendMessage(from, message);
        }
        break;
      }
      case 'remove': {
        if (groupSettings.exit?.enabled) {
          console.log(`[SAÍDA] Enviando mensagem de saída para ${inf.participants.length} membros em ${groupMetadata.subject}.`);
          const message = await createGroupMessage(NazunaSock, groupMetadata, inf.participants, groupSettings.exit, false);
          await NazunaSock.sendMessage(from, message);
        }
        break;
      }
      case 'promote':
      case 'demote': {
        if (groupSettings.x9) {
          for (const participant of inf.participants) {
            const action = inf.action === 'promote' ? 'promovido a ADM' : 'rebaixado de ADM';
            console.log(`[X9] ${participant.split('@')[0]} foi ${action} em ${groupMetadata.subject}.`);
            await NazunaSock.sendMessage(from, {
              text: `🚨 @${participant.split('@')[0]} foi ${action} por @${inf.author.split('@')[0]}.`,
              mentions: [participant, inf.author],
            });
          }
        }
        break;
      }
    }
  } catch (error) {
    console.error(`❌ Erro em handleGroupParticipantsUpdate: ${error.message}\n${error.stack}`);
  }
}

async function createBotSocket(authDir) {
  try {
    const { banner } = await require(path.join(__dirname, 'funcs', 'exports.js'));

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
      browser: ['Ubuntu', 'Edge', '110.0.1587.56'],
      logger,
    });

    if (codeMode && !NazunaSock.authState.creds.registered) {
      let phoneNumber = await ask('📱 Insira o número de telefone (com código de país, ex: +5511999999999): ');
      phoneNumber = phoneNumber.replace(/\D/g, '');
      if (!/^\d{10,15}$/.test(phoneNumber) || !phoneNumber.startsWith('55')) {
        console.log('⚠️ Número inválido! Use um número válido com código de país (ex: +5511999999999).');
        process.exit(1);
      }

      const code = await NazunaSock.requestPairingCode(phoneNumber.replaceAll('+', '').replaceAll(' ', '').replaceAll('-', ''));
      console.log(`🔑 Código de pareamento: ${code}`);
      console.log('📲 Envie este código no WhatsApp para autenticar o bot.');
    }

    NazunaSock.ev.on('creds.update', saveCreds);

    NazunaSock.ev.on('groups.update', async ([ev]) => {
      try {
        const meta = await NazunaSock.groupMetadata(ev.id).catch(() => null);
        if (meta) groupCache.set(ev.id, meta);
      } catch (e) {
        console.error(`❌ Erro ao atualizar metadados do grupo ${ev.id}: ${e.message}`);
      }
    });

    NazunaSock.ev.on('group-participants.update', async (inf) => {
      await handleGroupParticipantsUpdate(NazunaSock, inf);
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
          console.error('⚠️ Módulo index.js não é uma função válida. Verifique o arquivo index.js.');
        }
      } catch (err) {
        console.error(`❌ Erro ao processar mensagem: ${err.message}`);
      }
    });

    NazunaSock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && !NazunaSock.authState.creds.registered && !codeMode) {
        console.log('🔗 QR Code gerado para autenticação:');
        qrcode.generate(qr, { small: true }, (qrcodeText) => {
          console.log(qrcodeText);
        });
        console.log('📱 Escaneie o QR code acima com o WhatsApp para autenticar o bot.');
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

        if (reason === DisconnectReason.badSession || reason === DisconnectReason.loggedOut) {
          await clearAuthDir();
          console.log('🔄 Nova autenticação será necessária na próxima inicialização.');
        }

        console.log('🔄 Aguardando 5 segundos antes de reconectar...');
        setTimeout(() => {
          startNazu();
        }, 5000);
      }
    });

    return NazunaSock;
  } catch (err) {
    console.error(`❌ Erro ao criar socket do bot: ${err.message}`);
    throw err;
  }
}

async function startNazu() {
  try {
    console.log('🚀 Iniciando Nazuna...');
    await createBotSocket(AUTH_DIR);
  } catch (err) {
    console.error(`❌ Erro ao iniciar o bot: ${err.message}`);
    console.log('🔄 Aguardando 5 segundos antes de tentar novamente...');
    setTimeout(() => {
      startNazu();
    }, 5000);
  }
}

startNazu();