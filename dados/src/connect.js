/*
═════════════════════════════
  Nazuna - Conexão WhatsApp
  Autor: Hiudy
  Revisão: 16/08/2025
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

const logger = pino({ level: 'silent' });
const AUTH_DIR = path.join(__dirname, '..', 'database', 'qr-code');
const DATABASE_DIR = path.join(__dirname, '..', 'database', 'grupos');

const msgRetryCounterCache = new NodeCache({ 
  stdTTL: 15 * 60,
  useClones: false,
  checkperiod: 30,
  deleteOnExpire: true,
  maxKeys: 1000
});

const groupCache = new NodeCache({ 
  stdTTL: 45 * 60,
  useClones: false,
  checkperiod: 60,
  deleteOnExpire: true,
  maxKeys: 500
});

const { prefixo, nomebot, nomedono, numerodono } = require('./config.json');

let indexLoadTimeout;
let indexModule;
let indexRebootTimer;
const INDEX_LOAD_TIMEOUT = 30 * 1000;
const INDEX_REBOOT_INTERVAL = 30 * 60 * 1000;

function safeShutdown() {
  console.log('🛑 Iniciando desligamento seguro...');
  stopHeartbeat();
  
  if (indexRebootTimer) {
    clearTimeout(indexRebootTimer);
    indexRebootTimer = null;
  }
  
  if (currentSocket) {
    try {
      console.log('🔌 Fechando conexão socket...');
      currentSocket.end();
      currentSocket = null;
    } catch (error) {
      console.error(`❌ Erro ao fechar socket: ${error.message}`);
    }
  }
  
  setTimeout(() => {
    console.log('♻️ Reiniciando processo...');
    process.exit(27);
  }, 2000);
}

function scheduleIndexReboot() {
  if (indexRebootTimer) {
    clearTimeout(indexRebootTimer);
  }
  
  indexRebootTimer = setTimeout(() => {
    console.log('🔄 Reinicialização automática programada (30 minutos). Executando desligamento seguro...');
    safeShutdown();
  }, INDEX_REBOOT_INTERVAL);
}

try {
  indexLoadTimeout = setTimeout(() => {
    console.log('❌ Tempo de carregamento do index.js excedeu 30 segundos. Executando desligamento seguro...');
    safeShutdown();
  }, INDEX_LOAD_TIMEOUT);
  indexModule = require(path.join(__dirname, 'index.js'));
  scheduleIndexReboot();
} finally {
  clearTimeout(indexLoadTimeout);
}

const codeMode = process.argv.includes('--code');

const messagesCache = new Map();
const MESSAGE_CACHE_CLEANUP_INTERVAL = 180000;
setInterval(() => {
  const oldSize = messagesCache.size;
  if (oldSize > 500) {
    const entries = Array.from(messagesCache.entries());
    const toKeep = entries.slice(-250);
    messagesCache.clear();
    toKeep.forEach(([key, value]) => messagesCache.set(key, value));
    console.log(`🧹 Cache de mensagens otimizado: ${oldSize} → ${messagesCache.size}`);
  }
}, MESSAGE_CACHE_CLEANUP_INTERVAL);

let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY_BASE = 1000;
let currentSocket = null;
let isReconnecting = false;

let heartbeatInterval = null;
let lastHeartbeat = Date.now();

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

function getReconnectDelay() {
  const delay = Math.min(RECONNECT_DELAY_BASE * Math.pow(2, reconnectAttempts), 60000);
  return delay + Math.random() * 1000;
}

function startHeartbeat(socket) {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }
  
  heartbeatInterval = setInterval(async () => {
    try {
      if (socket && socket.ws && socket.ws.readyState === socket.ws.OPEN) {
        await socket.sendPresenceUpdate('available');
        lastHeartbeat = Date.now();
        console.log('💓 Heartbeat enviado');
      } else {
        console.log('⚠️ Socket não está aberto durante heartbeat');
        if (Date.now() - lastHeartbeat > 180000) {
          console.log('💀 Conexão morta detectada (3min sem heartbeat), executando reconexão segura...');
          if (socket && socket.end) {
            try {
              socket.end();
            } catch (endError) {
              console.error(`❌ Erro ao fechar socket no heartbeat: ${endError.message}`);
            }
          }
          if (!isReconnecting) {
            safeShutdown();
          }
        }
      }
    } catch (error) {
      console.error(`❌ Erro no heartbeat: ${error.message}`);
    }
  }, 45000);
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

async function createBotSocket(authDir) {
  let NazunaSock;
  try {
    const { banner } = await require(__dirname + '/funcs/exports.js');
    
    await fs.mkdir(DATABASE_DIR, { recursive: true });
    await fs.mkdir(authDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version, isLatest } = await fetchLatestBaileysVersion();

    console.log(`📱 Usando versão do WhatsApp: ${version.join('.')} ${isLatest ? '(mais recente)' : '(não é a mais recente)'}`);

    NazunaSock = makeWASocket({
      version,
      msgRetryCounterCache,
      cachedGroupMetadata: async (jid) => groupCache.get(jid),
      auth: state,
      logger,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 10000,
      retryRequestDelayMs: 250,
      maxMsgRetryCount: 5,
      markOnlineOnConnect: true,
      printQRInTerminal: false,
      qrTimeout: 60000,
      options: {
        keepAlive: true,
        pingTimeout: 20000,
        pingInterval: 15000
      }
    });

    currentSocket = NazunaSock;
    
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

    NazunaSock.ev.on('groups.update', async (updates) => {
      try {
        for (const ev of updates) {
          const meta = await NazunaSock.groupMetadata(ev.id).catch(() => null);
          if (meta) {
            groupCache.set(ev.id, meta);
            console.log(`📊 Metadados do grupo ${ev.id} atualizados`);
          }
        }
      } catch (e) {
        console.error(`❌ Erro ao atualizar metadados dos grupos: ${e.message}`);
      }
    });

    NazunaSock.ev.on('group-participants.update', async (inf) => {
      try {
        const from = inf.id;
        if (NazunaSock.user && inf.participants[0].startsWith(NazunaSock.user.id.split(':')[0])) return;

        let groupMetadata = groupCache.get(from);
        if (!groupMetadata) {
          try {
            groupMetadata = await NazunaSock.groupMetadata(from);
            groupCache.set(from, groupMetadata);
          } catch (e) {
            console.error(`❌ Erro ao obter metadados do grupo ${from}: ${e.message}`);
            return;
          }
        }

        const groupFilePath = path.join(DATABASE_DIR, `${from}.json`);
        let jsonGp;
        try {
          const data = await fs.readFile(groupFilePath, 'utf-8');
          jsonGp = JSON.parse(data);
        } catch (e) {
          console.error(`❌ Erro ao ler arquivo do grupo ${from}: ${e.message}`);
          return;
        }

        if ((inf.action === 'promote' || inf.action === 'demote') && jsonGp.x9) {
          const action = inf.action === 'promote' ? 'promovido a administrador' : 'rebaixado de administrador';
          const by = inf.author || 'alguém';
          await NazunaSock.sendMessage(from, {
            text: `🚨 Atenção! @${inf.participants[0].split('@')[0]} foi ${action} por @${by.split('@')[0]}.`,
            mentions: [inf.participants[0], by],
          });
        };

        if ((inf.action === 'promote' || inf.action === 'demote') && jsonGp.antiarqv) {
          const author = inf.author || inf.id;
          const participant = inf.participants[0];
          const groupOwners = jsonGp.groupOwners || [];

          if (author === NazunaSock.user.id || groupOwners.includes(author)) {
            return;
          };

          try {
            if (inf.action === 'promote') {
              await NazunaSock.groupParticipantsUpdate(from, [participant], 'demote');
            } else if (inf.action === 'demote') {
              await NazunaSock.groupParticipantsUpdate(from, [participant], 'promote');
            };
            await NazunaSock.groupParticipantsUpdate(from, [author], 'demote');
          } catch (e) {
            console.error(`❌ Erro ao aplicar anti-arquivamento no grupo ${from}: ${e.message}`);
          };
          return;
        };
        
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
        
        const globalBlacklistData = JSON.parse(await fs.readFile(path.join(__dirname, '..', 'database', 'dono', 'globalBlacklist.json'), 'utf-8').catch(() => '{}'));
         
        if (inf.action === 'add' && globalBlacklistData.users?.[inf.participants[0]]) {
          const sender = inf.participants[0];
          try {
            await NazunaSock.groupParticipantsUpdate(from, [sender], 'remove');
            await NazunaSock.sendMessage(from, {
              text: `🚫 @${sender.split('@')[0]} foi removido do grupo por estar na blacklist global. Motivo: ${globalBlacklistData.users[sender].reason}`,
              mentions: [sender],
            });
          } catch (e) {
            console.error(`❌ Erro ao remover usuário da blacklist global no grupo ${from}: ${e.message}`);
          }
          return;
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
            : `🚀 Bem-vindo(a), @${sender.split('@')[0]}! Você entrou no grupo *${groupMetadata.subject}*. Leia as regras e aproveite! Membros: ${groupMetadata.participants.length}. Descrição: ${groupMetadata.desc || 'Nenhuma'}.`;

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
              const image = jsonGp.welcome.image !== 'banner' ? { url: jsonGp.welcome.image } : {url: await banner.Welcome(profilePic, sender.split('@')[0], groupMetadata.subject, groupMetadata.participants.length)};
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
      } catch (error) {
        console.error(`❌ Erro geral no processamento de participantes do grupo: ${error.message}`);
      }
    });

    NazunaSock.ev.on('messages.upsert', async (m) => {
      if (!m.messages || !Array.isArray(m.messages) || m.type !== 'notify') return;
      
      try {
        if (typeof indexModule === 'function') {
          for (const info of m.messages) {
            if (!info.message || !info.key.remoteJid) continue;

            const MESSAGE_PROCESS_TIMEOUT = 1200 * 1000;
            let messageProcessTimeout;
            const timeoutPromise = new Promise((_, reject) => {
              messageProcessTimeout = setTimeout(() => {
                reject(new Error('❌ Tempo de processamento de mensagens excedeu 30 segundos.'));
              }, MESSAGE_PROCESS_TIMEOUT);
            });

            if (messagesCache.size > 1000) {
              const oldestKeys = Array.from(messagesCache.keys()).slice(0, 100);
              oldestKeys.forEach(key => messagesCache.delete(key));
            }
            messagesCache.set(info.key.id, info.message);

            try {
              await Promise.race([
                indexModule(NazunaSock, info, null, groupCache, messagesCache),
                timeoutPromise
              ]);
            } finally {
              clearTimeout(messageProcessTimeout);
            }
          }
        } else {
          console.error('⚠️ Módulo index.js não é uma função válida. Verifique o arquivo index.js.');
        }
      } catch (err) {
        console.error(err.message);
        if (err.message.includes('Tempo de processamento de mensagens')) {
          console.log('⚠️ Timeout no processamento de mensagens. Executando desligamento seguro...');
          safeShutdown();
        }
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

      if (connection === 'connecting') {
        console.log('🔄 Conectando ao WhatsApp...');
      }

      if (connection === 'open') {
        console.log(`✅ Bot ${nomebot} conectado com sucesso! Prefixo: ${prefixo} | Dono: ${nomedono}`);
        reconnectAttempts = 0;
        isReconnecting = false;
        startHeartbeat(NazunaSock);
        lastHeartbeat = Date.now();
      }

      if (connection === 'close') {
        stopHeartbeat();
        
        const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
        const reasonMessage = {
          [DisconnectReason.loggedOut]: 'Deslogado do WhatsApp',
          401: 'Sessão expirada',
          [DisconnectReason.connectionClosed]: 'Conexão fechada',
          [DisconnectReason.connectionLost]: 'Conexão perdida',
          [DisconnectReason.connectionReplaced]: 'Conexão substituída',
          [DisconnectReason.timedOut]: 'Tempo de conexão esgotado',
          [DisconnectReason.restartRequired]: 'Reinício necessário',
          [DisconnectReason.badSession]: 'Sessão inválida ou corrompida',
          [DisconnectReason.connectionBroken]: 'Conexão quebrada',
          [DisconnectReason.multideviceMismatch]: 'Incompatibilidade de multi-dispositivo',
          [DisconnectReason.forbidden]: 'Acesso negado',
          [DisconnectReason.unavailableService]: 'Serviço indisponível',
        }[reason] || `Motivo desconhecido: ${reason}`;
        
        console.log(`❌ Conexão fechada. Código: ${reason} | Motivo: ${reasonMessage}`);
        console.log(`🔢 Tentativa de reconexão: ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS}`);

        currentSocket = null;

        if (reason === DisconnectReason.badSession || reason === DisconnectReason.loggedOut) {
          await clearAuthDir();
          console.log('🔄 Nova autenticação será necessária na próxima inicialização.');
          reconnectAttempts = 0;
        }

        if (reason === DisconnectReason.forbidden) {
          console.log('🚫 Acesso negado. Não tentando reconectar.');
          return;
        }

        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          console.log(`❌ Máximo de tentativas de reconexão atingido (${MAX_RECONNECT_ATTEMPTS}). Parando o bot.`);
          console.log('💡 Reinicie manualmente o bot ou verifique sua conexão com a internet.');
          return;
        }

        if (!isReconnecting) {
          isReconnecting = true;
          reconnectAttempts++;
          const delay = getReconnectDelay();
          console.log(`🔄 Tentando reconectar em ${Math.round(delay / 1000)} segundos...`);
          
          setTimeout(() => {
            startNazu();
          }, delay);
        }
      }
    });

    NazunaSock.ev.on('error', (error) => {
      console.error(`❌ Erro no socket: ${error.message}`);
    });

    return NazunaSock;
  } catch (err) {
    console.error(`❌ Erro ao criar socket do bot: ${err.message}`);
    
    if (NazunaSock && NazunaSock.ws && NazunaSock.ws.readyState === NazunaSock.ws.OPEN) {
      console.log('🔌 Fechando conexão existente devido a erro...');
      try {
        NazunaSock.end();
      } catch (endError) {
        console.error(`❌ Erro ao fechar conexão: ${endError.message}`);
      }
    }
    
    throw err;
  }
}

async function startNazu() {
  const MAX_RUNTIME = 90 * 60 * 1000;
  setTimeout(() => {
    console.log('🛑 Tempo máximo de execução (1h30min) atingido. Executando desligamento seguro...');
    safeShutdown();
  }, MAX_RUNTIME);

  try {
    console.log('🚀 Iniciando Nazuna...');
    
    if (currentSocket && currentSocket.ws && currentSocket.ws.readyState === currentSocket.ws.OPEN) {
      console.log('⚠️ Conexão já existe, fechando antes de criar nova...');
      try {
        currentSocket.end();
      } catch (error) {
        console.error(`❌ Erro ao fechar conexão existente: ${error.message}`);
      }
      currentSocket = null;
    }
    
    await createBotSocket(AUTH_DIR);
  } catch (err) {
    console.error(`❌ Erro fatal ao iniciar o bot: ${err.message}`);
    
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      const delay = getReconnectDelay();
      console.log(`🔄 Tentando reiniciar o bot em ${Math.round(delay / 1000)} segundos... (Tentativa ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
      
      setTimeout(() => {
        startNazu();
      }, delay);
    } else {
      console.log(`❌ Máximo de tentativas de inicialização atingido. Bot será encerrado.`);
      process.exit(1);
    }
  }
}

process.on('SIGINT', () => {
  console.log('\n🛑 Recebido sinal de interrupção. Executando desligamento seguro...');
  safeShutdown();
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Recebido sinal de término. Executando desligamento seguro...');
  safeShutdown();
});

process.on('uncaughtException', (error) => {
  console.error(`❌ Erro não capturado: ${error.message}`);
  console.error(error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`❌ Promise rejeitada não tratada em: ${promise}`);
  console.error(`Motivo: ${reason}`);
});

startNazu();
