import {
    makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} from '@cognima/walib';
import {
    Boom
} from '@hapi/boom';
import NodeCache from '@cacheable/node-cache';
import readline from 'readline';
import pino from 'pino';
import fs from 'fs/promises';
import path from 'path';
import qrcode from 'qrcode-terminal';
import { readFile } from "fs/promises";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const configPath = new URL("./config.json", import.meta.url);
const config = JSON.parse(await readFile(configPath, "utf8"));

import indexModule from './index.js';

const logger = pino({
    level: 'silent'
});

const AUTH_DIR = path.join(__dirname, '..', 'database', 'qr-code');
const DATABASE_DIR = path.join(__dirname, '..', 'database');
const GLOBAL_BLACKLIST_PATH = path.join(__dirname, '..', 'database', 'dono', 'globalBlacklist.json');
const msgRetryCounterCache = new NodeCache({
    stdTTL: 5 * 60,
    useClones: false
});
const groupCache = new NodeCache({
    stdTTL: 5 * 60,
    useClones: false
});
const {
    prefixo,
    nomebot,
    nomedono,
    numerodono
} = config;
const codeMode = process.argv.includes('--code');
const messagesCache = new Map();
setInterval(() => messagesCache.clear(), 600000);

const ask = (question) => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise((resolve) => rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
    }));
};

async function clearAuthDir() {
    try {
        await fs.rm(AUTH_DIR, {
            recursive: true,
            force: true
        });
        console.log(`🗑️ Pasta de autenticação (${AUTH_DIR}) excluída com sucesso.`);
    } catch (err) {
        console.error(`❌ Erro ao excluir pasta de autenticação: ${err.message}`);
    }
}

async function loadGroupSettings(groupId) {
    const groupFilePath = path.join(DATABASE_DIR, 'grupos', `${groupId}.json`);
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
    const jsonGp = await loadGroupSettings(groupMetadata.id);
    const mentions = participants.map(p => p);
    const bannerName = participants.length === 1 ? participants[0].split('@')[0] : `${participants.length} Membros`;
    const replacements = {
        '#numerodele#': participants.map(p => `@${p.split('@')[0]}`).join(', '),
        '#nomedogp#': groupMetadata.subject,
        '#desc#': groupMetadata.desc || 'Nenhuma',
        '#membros#': groupMetadata.participants.length,
    };
    const defaultText = isWelcome ?
        (jsonGp.textbv ? jsonGp.textbv : "🚀 Bem-vindo(a/s), #numerodele#! Vocês entraram no grupo *#nomedogp#*. Membros: #membros#.") :
        (jsonGp.exit.text ? jsonGp.exit.text : "👋 Adeus, #numerodele#! Até mais!");
    const text = formatMessageText(settings.text || defaultText, replacements);
    const message = {
        text,
        mentions
    };
    if (settings.image) {
        let profilePicUrl = 'https://raw.githubusercontent.com/nazuninha/uploads/main/outros/1747053564257_bzswae.bin';
        if (participants.length === 1 && isWelcome) {
            profilePicUrl = await NazunaSock.profilePictureUrl(participants[0], 'image').catch(() => profilePicUrl);
        }
        
        const loadedModulesPromise = await import(new URL('./funcs/exports.js', import.meta.url));
        const modules = await loadedModulesPromise.default;
        const {
        banner,
        } = modules;
       
        const image = settings.image !== 'banner' ? {
            url: settings.image
        } : await banner.Welcome(profilePicUrl, bannerName, groupMetadata.subject, groupMetadata.participants.length);
        
        message.image = image;
        message.caption = text;
        delete message.text;
    }
    return message;
}

async function handleGroupParticipantsUpdate(NazunaSock, inf) {
    try {
        const from = inf.id;
        if (inf.participants.some(p => p.startsWith(NazunaSock.user.id.split(':')[0])))
            return;
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
                    const message = await createGroupMessage(NazunaSock, groupMetadata, membersToWelcome, groupSettings.welcome || {
                        text: groupSettings.textbv
                    });
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

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function scanForJids(directory) {
    const jidPattern = /(\d+@s\.whatsapp\.net)/g;
    const uniqueJids = new Set();
    const affectedFiles = new Map();
    const jidFiles = new Map();

    const scanFileContent = async (filePath) => {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            let match;
            const fileJids = new Set();
            while ((match = jidPattern.exec(content)) !== null) {
                const jid = match[1];
                uniqueJids.add(jid);
                fileJids.add(jid);
            }
            if (fileJids.size > 0) {
                affectedFiles.set(filePath, fileJids);
            }
        } catch (err) {
            console.error(`Erro ao escanear conteúdo de ${filePath}: ${err.message}`);
        }
    };

    const checkAndScanFilename = async (fullPath) => {
        try {
            const basename = path.basename(fullPath, '.json');
            const filenameMatch = basename.match(jidPattern);
            if (filenameMatch) {
                const jidFromName = filenameMatch[0];
                uniqueJids.add(jidFromName);
                jidFiles.set(jidFromName, fullPath);
                await scanFileContent(fullPath);
            } else {
                await scanFileContent(fullPath);
            }
        } catch (err) {
            console.error(`Erro ao processar ${fullPath}: ${err.message}`);
        }
    };

    const scanDir = async (dirPath) => {
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = join(dirPath, entry.name);
                if (entry.isDirectory()) {
                    await scanDir(fullPath);
                } else if (entry.name.endsWith('.json')) {
                    await checkAndScanFilename(fullPath);
                }
            }
        } catch (err) {
            console.error(`Erro ao escanear diretório ${dirPath}: ${err.message}`);
        }
    };

    await scanDir(directory);

    try {
        const configContentPath = configPath.pathname;
        await scanFileContent(configContentPath);
        const configBasename = path.basename(configContentPath, '.json');
        if (configBasename.match(jidPattern)) {
            const jidFromName = configBasename.match(jidPattern)[0];
            uniqueJids.add(jidFromName);
            jidFiles.set(jidFromName, configContentPath);
        }
    } catch (err) {
        console.error(`Erro ao escanear config.json: ${err.message}`);
    }

    return {
        uniqueJids: Array.from(uniqueJids),
        affectedFiles: Array.from(affectedFiles.entries()),
        jidFiles: Array.from(jidFiles.entries())
    };
}

async function replaceJidsInContent(affectedFiles, jidToLidMap) {
    let totalReplacements = 0;
    const updatedFiles = [];

    for (const [filePath, jids] of affectedFiles) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            let updatedContent = content;
            let fileReplacements = 0;

            for (const jid of jids) {
                const lid = jidToLidMap.get(jid);
                if (lid) {
                    const escapedJid = escapeRegExp(jid);
                    const regex = new RegExp(escapedJid, 'g');
                    const beforeCount = (updatedContent.match(regex) || []).length;
                    updatedContent = updatedContent.replace(regex, lid);
                    const afterCount = (updatedContent.match(regex) || []).length;
                    fileReplacements += (beforeCount - afterCount);
                    totalReplacements += (beforeCount - afterCount);
                }
            }

            if (fileReplacements > 0) {
                await fs.writeFile(filePath, updatedContent, 'utf-8');
                updatedFiles.push(path.basename(filePath));
            }
        } catch (err) {
            console.error(`Erro ao substituir em ${filePath}: ${err.message}`);
        }
    }

    return { totalReplacements, updatedFiles };
}

async function handleJidFiles(jidFiles, jidToLidMap) {
    let totalReplacements = 0;
    const updatedFiles = [];
    const renamedFiles = [];

    for (const [jid, oldPath] of jidFiles) {
        const lid = jidToLidMap.get(jid);
        if (!lid) {
            console.warn(`LID não encontrado para JID ${jid} em ${oldPath}. Pulando renomeação.`);
            continue;
        }

        try {
            const content = await fs.readFile(oldPath, 'utf-8');
            let updatedContent = content;
            let fileReplacements = 0;

            for (const [oldJid, newLid] of jidToLidMap) {
                const escapedOldJid = escapeRegExp(oldJid);
                const regex = new RegExp(escapedOldJid, 'g');
                const beforeCount = (updatedContent.match(regex) || []).length;
                updatedContent = updatedContent.replace(regex, newLid);
                const afterCount = (updatedContent.match(regex) || []).length;
                fileReplacements += (beforeCount - afterCount);
            }
            totalReplacements += fileReplacements;

            const dir = path.dirname(oldPath);
            const newPath = join(dir, `${lid}.json`);

            try {
                await fs.access(newPath);
                console.warn(`Arquivo ${newPath} já existe. Pulando renomeação para ${oldPath}.`);
                continue;
            } catch {}

            await fs.writeFile(newPath, updatedContent, 'utf-8');

            await fs.unlink(oldPath);

            updatedFiles.push(path.basename(newPath));
            renamedFiles.push({ old: path.basename(oldPath), new: path.basename(newPath) });

            if (fileReplacements > 0) {
                console.log(`Substituídas ${fileReplacements} ocorrências no conteúdo de ${path.basename(oldPath)}.`);
            }
        } catch (err) {
            console.error(`Erro ao processar renomeação de ${oldPath}: ${err.message}`);
        }
    }

    return { totalReplacements, updatedFiles, renamedFiles };
}

async function performMigration(NazunaSock) {
    const ownerJid = `${numerodono}@s.whatsapp.net`;
    console.log('🔍 Iniciando mapeamento da database para migração de JIDs...');

    let scanResult;
    try {
        scanResult = await scanForJids(DATABASE_DIR);
    } catch (err) {
        console.error(`Erro crítico no scan: ${err.message}`);
        await NazunaSock.sendMessage(ownerJid, { text: `❌ Erro ao escanear database: ${err.message}. Iniciando bot sem migração.` });
        return;
    }

    const { uniqueJids, affectedFiles, jidFiles } = scanResult;

    if (uniqueJids.length === 0) {
        console.log('ℹ️ Nenhum JID encontrado na database. Iniciando bot normalmente.');
        return;
    }

    const initialMsg = `🌟 *Olá, ${nomedono}!* 🌟\n\n` +
        `🔍 Detectei *${uniqueJids.length} JID(s)* únicos em *${affectedFiles.length + jidFiles.length} fonte(s)* (arquivos e nomes).\n\n` +
        `🚀 Iniciando migração automática para LIDs. Isso pode levar alguns minutos, mas garanto que vale a pena! A bot ficará pausada para mensagens até finalizar. Aguarde aqui... 💕`;
    
    try {
        await NazunaSock.sendMessage(ownerJid, { text: initialMsg });
    } catch (sendErr) {
        console.error(`Erro ao enviar mensagem inicial: ${sendErr.message}`);
    }

    let lidResults;
    try {
        const jidStrings = uniqueJids.map(jid => String(jid));
        lidResults = await NazunaSock.onWhatsApp(jidStrings);
    } catch (fetchErr) {
        console.error(`Erro ao buscar LIDs: ${fetchErr.message}`);
        const fetchErrMsg = `⚠️ *Erro na migração!* ⚠️\n\nFalha ao obter LIDs: ${fetchErr.message}. Verifique a conexão e reinicie a bot. Iniciando normalmente por enquanto. 😔`;
        try {
            await NazunaSock.sendMessage(ownerJid, { text: fetchErrMsg });
        } catch {}
        return;
    }

    const jidToLidMap = new Map();
    for (const { jid, lid } of lidResults) {
        if (lid) {
            jidToLidMap.set(jid, lid);
        } else {
            console.warn(`LID não encontrado para JID: ${jid}`);
        }
    }

    if (jidToLidMap.size === 0) {
        const noLidMsg = `⚠️ *Migração incompleta!* ⚠️\n\nNão foi possível obter LIDs para nenhum dos JIDs detectados. Verifique a conectividade e tente novamente. A bot iniciará normalmente por enquanto. 😔`;
        try {
            await NazunaSock.sendMessage(ownerJid, { text: noLidMsg });
        } catch {}
        return;
    }

    let totalReplacements = 0;
    const allUpdatedFiles = [];
    const renamedDetails = [];

    try {
        const renameResult = await handleJidFiles(jidFiles, jidToLidMap);
        totalReplacements += renameResult.totalReplacements;
        allUpdatedFiles.push(...renameResult.updatedFiles);
        renamedDetails.push(...renameResult.renamedFiles);

        const filteredAffected = affectedFiles.filter(([filePath]) => !jidFiles.some(([, jidPath]) => jidPath === filePath));
        const contentResult = await replaceJidsInContent(filteredAffected, jidToLidMap);
        totalReplacements += contentResult.totalReplacements;
        allUpdatedFiles.push(...contentResult.updatedFiles);
    } catch (processErr) {
        console.error(`Erro no processamento de substituições: ${processErr.message}`);
        const procErrMsg = `⚠️ *Erro parcial na migração!* ⚠️\n\nProblema durante substituições: ${processErr.message}. Alguns arquivos podem não ter sido atualizados. Reiniciar a bot para tentar novamente.`;
        try {
            await NazunaSock.sendMessage(ownerJid, { text: procErrMsg });
        } catch {}
        return;
    }

    let finalMsg = `🎉 *Migração concluída com sucesso!* 🎉\n\n` +
        `✨ Realizei *${totalReplacements} substituição(ões)* em *${allUpdatedFiles.length} arquivo(s)*.\n` +
        `🔄 Troquei *${jidToLidMap.size} JID(s)* por seus respectivos LIDs.\n\n`;

    if (renamedDetails.length > 0) {
        finalMsg += `📁 Renomeei *${renamedDetails.length} arquivo(s)*:\n`;
        renamedDetails.forEach(({ old: oldName, new: newName }) => {
            finalMsg += `• ${oldName} → ${newName}\n`;
        });
        finalMsg += `\n`;
    }

    finalMsg += `🌸 Agora a bot está otimizada e pronta para brilhar! Aproveite ao máximo, ${nomedono}. Se precisar de algo, é só chamar. <3`;
    
    try {
        await NazunaSock.sendMessage(ownerJid, { text: finalMsg });
    } catch (sendErr) {
        console.error(`Erro ao enviar mensagem final: ${sendErr.message}`);
    }
    console.log(`✅ Migração finalizada: ${totalReplacements} edições em ${allUpdatedFiles.length} arquivos.`);
}

async function createBotSocket(authDir) {
    try {
        const { 
            banner 
        } = await import(new URL('./funcs/exports.js', import.meta.url));
        await fs.mkdir(path.join(DATABASE_DIR, 'grupos'), { recursive: true });
        await fs.mkdir(authDir, { recursive: true });
        const {
            state,
            saveCreds,
            signalRepository
        } = await useMultiFileAuthState(authDir, makeCacheableSignalKeyStore);
        const {
            version,
            isLatest
        } = await fetchLatestBaileysVersion();
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
            signalRepository,
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
                if (meta)
                    groupCache.set(ev.id, meta);
            } catch (e) {
                console.error(`❌ Erro ao atualizar metadados do grupo ${ev.id}: ${e.message}`);
            }
        });

        NazunaSock.ev.on('group-participants.update', async (inf) => {
            await handleGroupParticipantsUpdate(NazunaSock, inf);
        });

        let messagesListenerAttached = false;

        const attachMessagesListener = () => {
            if (messagesListenerAttached) return;
            messagesListenerAttached = true;

            NazunaSock.ev.on('messages.upsert', async (m) => {
                if (!m.messages || !Array.isArray(m.messages) || m.type !== 'notify')
                    return;
                try {
                    if (typeof indexModule === 'function') {
                        for (const info of m.messages) {
                            if (!info.message || !info.key.remoteJid)
                                continue;
                            if (info?.WebMessageInfo) {
                                continue;
                            }
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
        };

        NazunaSock.ev.on('connection.update', async (update) => {
            const {
                connection,
                lastDisconnect,
                qr
            } = update;
            if (qr && !NazunaSock.authState.creds.registered && !codeMode) {
                console.log('🔗 QR Code gerado para autenticação:');
                qrcode.generate(qr, {
                    small: true
                }, (qrcodeText) => {
                    console.log(qrcodeText);
                });
                console.log('📱 Escaneie o QR code acima com o WhatsApp para autenticar o bot.');
            }
            if (connection === 'open') {
                console.log(`🔄 Conexão aberta. Iniciando verificação de migração...`);
                await performMigration(NazunaSock);
                attachMessagesListener();
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
                } [reason] || 'Motivo desconhecido';
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