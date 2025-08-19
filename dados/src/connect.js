/*
═════════════════════════════
  Nazuna - Conexão WhatsApp
  Autor: Hiudy
  Revisão: 19/08/2025
═════════════════════════════
*/

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

const { prefixo, nomebot, nomedono } = require('./config.json');

const AUTH_DIR = path.join(__dirname, '..', 'database', 'qr-code');
const DATABASE_DIR = path.join(__dirname, '..', 'database', 'grupos');

const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY_BASE_MS = 1000;
const HEARTBEAT_INTERVAL_MS = 45000;
const DEAD_CONNECTION_TIMEOUT_MS = 180000;
const SEND_MESSAGE_TIMEOUT_MS = 60000;
const MESSAGE_CACHE_CLEANUP_INTERVAL_MS = 180000;

const logger = pino({ level: 'silent' });

class TimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TimeoutError';
  }
}

const msgRetryCounterCache = new NodeCache({ stdTTL: 15 * 60, useClones: false });
const groupCache = new NodeCache({ stdTTL: 45 * 60, useClones: false });
const messagesCache = new Map();

let indexModule;
let currentSocket = null;
let reconnectAttempts = 0;
let isReconnecting = false;
let heartbeatInterval = null;
let lastHeartbeat = Date.now();
const codeMode = process.argv.includes('--code');

try {
  indexModule = require(path.join(__dirname, 'index.js'));
} catch (error) {
  console.error(`❌ Erro fatal ao carregar o arquivo principal index.js: ${error.message}`);
  process.exit(1);
}

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
    console.log(`🗑️  Diretório de autenticação (${AUTH_DIR}) limpo com sucesso.`);
  } catch (err) {
    console.error(`❌ Erro ao limpar o diretório de autenticação: ${err.message}`);
  }
}

function getReconnectDelay() {
  const delay = Math.min(RECONNECT_DELAY_BASE_MS * Math.pow(2, reconnectAttempts), 60000);
  return delay + Math.random() * 1000;
}

function startHeartbeat(socket) {
  stopHeartbeat();
  heartbeatInterval = setInterval(async () => {
    try {
      if (socket && socket.ws && socket.ws.readyState === socket.ws.OPEN) {
        await socket.sendPresenceUpdate('available');
        lastHeartbeat = Date.now();
        console.log('💓 Heartbeat enviado com sucesso.');
      } else {
        console.log('⚠️ Socket não está aberto. Verificando tempo desde o último heartbeat...');
        if (Date.now() - lastHeartbeat > DEAD_CONNECTION_TIMEOUT_MS) {
          console.log(`💀 Conexão morta detectada! (sem heartbeat por ${DEAD_CONNECTION_TIMEOUT_MS / 1000}s)`);
          if (!isReconnecting) {
            safeShutdown();
          }
        }
      }
    } catch (error) {
      console.error(`❌ Erro no heartbeat: ${error.message}`);
    }
  }, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

function safeShutdown() {
  console.log('🛑 Iniciando desligamento seguro...');
  stopHeartbeat();
  if (currentSocket && currentSocket.ws) {
    try {
      console.log('🔌 Fechando conexão do WebSocket...');
      currentSocket.logout();
    } catch (error) {
      console.error(`❌ Erro ao fechar o WebSocket: ${error.message}`);
    }
  }
  currentSocket = null;
  console.log('♻️  O processo será reiniciado em 2 segundos...');
  setTimeout(() => {
    process.exit(27);
  }, 2000);
}

async function createBotSocket() {
  let NazunaSock;
  try {
    const { banner } = await require(__dirname + '/funcs/exports.js');
    await fs.mkdir(DATABASE_DIR, { recursive: true });
    await fs.mkdir(AUTH_DIR, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`📱 Usando Baileys v${version.join('.')} (${isLatest ? 'mais recente' : 'desatualizada'})`);

    NazunaSock = makeWASocket({
      version,
      msgRetryCounterCache,
      cachedGroupMetadata: (jid) => groupCache.get(jid),
      auth: state,
      logger,
      connectTimeoutMs: 180000,
      defaultQueryTimeoutMs: 180000,
      keepAliveIntervalMs: 30000,
      retryRequestDelayMs: 300,
      maxMsgRetryCount: 20,
      markOnlineOnConnect: false,
      printQRInTerminal: !codeMode,
      qrTimeout: 180000,
      syncFullHistory: false,
      fireInitQueries: false,
      generateHighQualityLinkPreview: false,
      getMessage: async (key) => messagesCache.get(key.id),
      options: {
        keepAlive: true,
        pingTimeout: 45000,
        pingInterval: 30000,
      },
      browser: ['Firefox', '130.0', 'macOS']
    });

    currentSocket = NazunaSock;

    console.log(`🔧 Aplicando patch de timeout de ${SEND_MESSAGE_TIMEOUT_MS / 1000}s na função sendMessage...`);
    const originalSendMessage = NazunaSock.sendMessage.bind(NazunaSock);
    NazunaSock.sendMessage = async (...args) => {
      try {
        return await Promise.race([
          originalSendMessage(...args),
          new Promise((_, reject) =>
            setTimeout(() => reject(new TimeoutError(`Envio da mensagem excedeu ${SEND_MESSAGE_TIMEOUT_MS / 1000}s`)), SEND_MESSAGE_TIMEOUT_MS)
          ),
        ]);
      } catch (error) {
        if (error instanceof TimeoutError) {
          console.error(`❌⏱️ ERRO FATAL: ${error.message}.`);
          if (currentSocket) {
            try {
              await currentSocket.logout();
            } catch (logoutError) {
              console.error(`❌ Erro ao fazer logout do socket: ${logoutError.message}`);
            }
            currentSocket = null;
          }
          reconnectAttempts++;
          const delay = getReconnectDelay();
          console.log(`🔄 Reconectando internamente em ${Math.round(delay / 1000)}s...`);
          setTimeout(() => createBotSocket(), delay);
          return new Promise(() => {});
        }
        console.error(`❌ Erro durante o envio da mensagem (não-timeout): ${error.message}`);
        throw error;
      }
    };

    registerEventHandlers(NazunaSock, banner, saveCreds);

    return NazunaSock;
  } catch (err) {
    console.error(`❌ Erro crítico ao criar o socket do bot: ${err.message}`);
    if (NazunaSock && NazunaSock.ws) {
      try { NazunaSock.logout(); } catch {}
    }
    throw err;
  }
}

function registerEventHandlers(NazunaSock, banner, saveCreds) {
  NazunaSock.ev.on('creds.update', saveCreds);
  NazunaSock.ev.on('connection.update', (update) => handleConnectionUpdate(NazunaSock, update));
  NazunaSock.ev.on('messages.upsert', (m) => handleMessagesUpsert(NazunaSock, m));
  NazunaSock.ev.on('group-participants.update', (inf) => handleGroupParticipantsUpdate(NazunaSock, inf, banner));
  NazunaSock.ev.on('groups.update', async (updates) => {
    for (const update of updates) {
      try {
        const meta = await NazunaSock.groupMetadata(update.id);
        groupCache.set(update.id, meta);
      } catch (e) {
        console.error(`❌ Erro ao atualizar metadados do grupo ${update.id}: ${e.message}`);
      }
    }
  });
  NazunaSock.ev.on('error', (error) => console.error(`❌ Erro inesperado no socket: ${error.message}`));
}

async function handleConnectionUpdate(NazunaSock, update) {
  const { connection, lastDisconnect, qr } = update;

  if (qr && codeMode && !NazunaSock.authState.creds.registered) {
    const phoneNumber = await ask('📱 Insira o número de telefone (com DDI, ex: 5511999999999): ');
    console.log('Número inserido:', phoneNumber);
    if (!/^\+?\d{10,15}$/.test(phoneNumber)) {
      console.log('⚠️ Número inválido! Deve conter apenas dígitos, com DDI (ex: 5511999999999). Reinicie e tente novamente.');
      process.exit(1);
    }
    const cleanedNumber = phoneNumber.replace('+', '');
    const code = await NazunaSock.requestPairingCode(cleanedNumber);
    console.log(`🔑 Seu código de pareamento é: ${code}`);
  }

  if (connection === 'connecting') {
    console.log('🔄 Conectando ao WhatsApp...');
  }

  if (connection === 'open') {
    console.log(`✅ Bot ${nomebot} conectado com sucesso! Prefixo: [ ${prefixo} ] | Dono: ${nomedono}`);
    reconnectAttempts = 0;
    isReconnecting = false;
    lastHeartbeat = Date.now();
    startHeartbeat(NazunaSock);
  }

  if (connection === 'close') {
    stopHeartbeat();
    currentSocket = null;
    isReconnecting = false;

    const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
    const shouldReconnect = reason !== DisconnectReason.loggedOut && reason !== DisconnectReason.forbidden;

    console.log(`❌ Conexão fechada. Motivo: ${DisconnectReason[reason] || 'Desconhecido'} (Código: ${reason})`);

    if (reason === DisconnectReason.loggedOut || reason === DisconnectReason.badSession) {
      console.log('Sessão inválida. Limpando credenciais...');
      await clearAuthDir();
    }

    if (shouldReconnect) {
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.log(`❌ Máximo de ${MAX_RECONNECT_ATTEMPTS} tentativas de reconexão atingido. Desligando.`);
        process.exit(1);
      } else {
        reconnectAttempts++;
        const delay = getReconnectDelay();
        console.log(`🔄 Tentando reconectar em ${Math.round(delay / 1000)}s... (Tentativa ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
        setTimeout(startNazu, delay);
        isReconnecting = true;
      }
    }
  }
}

async function handleMessagesUpsert(NazunaSock, m) {
  if (m.type !== 'notify' || !Array.isArray(m.messages)) return;
  for (const info of m.messages) {
    if (!info.message || !info.key.remoteJid) continue;
    messagesCache.set(info.key.id, info.message);
    try {
      await indexModule(NazunaSock, info, null, groupCache, messagesCache);
    } catch (err) {
      console.error(`❌ Erro ao processar mensagem no index.js: ${err.message}\n${err.stack}`);
    }
  }
}

async function handleGroupParticipantsUpdate(NazunaSock, inf, banner) {
  try {
    const from = inf.id;
    if (inf.participants.some(p => p.startsWith(NazunaSock.user.id.split(':')[0]))) return;

    let groupMetadata = groupCache.get(from) || await NazunaSock.groupMetadata(from).catch(() => null);
    if (!groupMetadata) return;
    groupCache.set(from, groupMetadata);

    const groupSettings = await fs.readFile(path.join(DATABASE_DIR, `${from}.json`), 'utf-8').then(JSON.parse).catch(() => ({}));
    const globalBlacklist = await fs.readFile(path.join(__dirname, '..', 'database', 'dono', 'globalBlacklist.json'), 'utf-8').then(JSON.parse).catch(() => ({ users: {} }));

    switch (inf.action) {
      case 'add': {
        const membersToWelcome = [], membersToRemove = [], removalReasons = [];
        for (const participant of inf.participants) {
          if (globalBlacklist.users?.[participant]) {
            membersToRemove.push(participant);
            removalReasons.push(`@${participant.split('@')[0]} (blacklist global)`);
            continue;
          }
          if (groupSettings.blacklist?.[participant]) {
            membersToRemove.push(participant);
            removalReasons.push(`@${participant.split('@')[0]} (lista negra do grupo)`);
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
          const mentions = membersToWelcome.map(p => `@${p.split('@')[0]}`).join(', ');
          const newTotalMembers = groupMetadata.participants.length - membersToRemove.length + membersToWelcome.length;

          const welcomeText = (groupSettings.textbv || `🚀 Bem-vindo(a/s), #numerodele#! Vocês entraram no grupo *#nomedogp#*. Membros: #membros#.`)
            .replaceAll('#numerodele#', mentions)
            .replaceAll('#nomedogp#', groupMetadata.subject)
            .replaceAll('#desc#', groupMetadata.desc || 'Nenhuma')
            .replaceAll('#membros#', newTotalMembers);

          const message = { text: welcomeText, mentions: membersToWelcome };

          if (groupSettings.welcome?.image) {
            let bannerName, profilePicUrl = 'https://raw.githubusercontent.com/nazuninha/uploads/main/outros/1747053564257_bzswae.bin';
            if (membersToWelcome.length === 1) {
              const singleUser = membersToWelcome[0];
              bannerName = singleUser.split('@')[0];
              profilePicUrl = await NazunaSock.profilePictureUrl(singleUser, 'image').catch(() => profilePicUrl);
            } else {
              bannerName = `${membersToWelcome.length} Novos Membros`;
            }
            const image = groupSettings.welcome.image !== 'banner'
              ? { url: groupSettings.welcome.image }
              : { url: await banner.Welcome(profilePicUrl, bannerName, groupMetadata.subject, newTotalMembers) };
            message.image = image;
            message.caption = welcomeText;
            delete message.text;
          }
          await NazunaSock.sendMessage(from, message);
        }
        break;
      }
      case 'remove': {
        if (groupSettings.exit?.enabled) {
          const mentions = inf.participants.map(p => `@${p.split('@')[0]}`).join(', ');
          const exitText = (groupSettings.exit.text || `👋 Adeus, #numerodele#! Até mais!`)
            .replaceAll('#numerodele#', mentions)
            .replaceAll('#nomedogp#', groupMetadata.subject)
            .replaceAll('#membros#', groupMetadata.participants.length);
          await NazunaSock.sendMessage(from, { text: exitText, mentions: inf.participants });
        }
        break;
      }
      case 'promote':
      case 'demote': {
        for (const participant of inf.participants) {
          if (groupSettings.x9) {
            const action = inf.action === 'promote' ? 'promovido a ADM' : 'rebaixado de ADM';
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
    console.error(`❌ Erro grave no 'group-participants.update': ${error.message}\n${error.stack}`);
  }
}

async function startNazu() {
  if (isReconnecting) {
    console.log('⚠️ Tentativa de início enquanto uma reconexão já está em andamento. Abortando.');
    return;
  }
  try {
    console.log('🚀 Iniciando Nazuna...');
    if (currentSocket) {
      console.log('🔌 Fechando conexão antiga antes de iniciar uma nova...');
      try { currentSocket.logout(); } catch {}
      currentSocket = null;
    }
    await createBotSocket();
  } catch (err) {
    console.error(`❌ Erro fatal ao iniciar o bot: ${err.message}`);
    if (!currentSocket && reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.log("❌ Falha crítica na inicialização, não foi possível nem mesmo começar a conectar. Encerrando.");
      process.exit(1);
    }
  }
}

setInterval(() => {
  if (messagesCache.size > 500) {
    const entries = Array.from(messagesCache.entries()).slice(-250);
    messagesCache.clear();
    entries.forEach(([key, value]) => messagesCache.set(key, value));
    console.log(`🧹 Cache de mensagens otimizado para ${messagesCache.size} entradas.`);
  }
}, MESSAGE_CACHE_CLEANUP_INTERVAL_MS);

process.on('SIGINT', () => {
  console.log('\n🛑 Recebido sinal de interrupção (Ctrl+C).');
  safeShutdown();
});
process.on('SIGTERM', () => {
  console.log('\n🛑 Recebido sinal de término.');
  safeShutdown();
});
process.on('uncaughtException', (error, origin) => {
  console.error(`❌ Erro não capturado em: ${origin}`);
  console.error(error);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promise rejeitada não tratada:', promise);
  console.error('Motivo:', reason);
});

startNazu();