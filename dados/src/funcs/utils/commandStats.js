import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from 'url';

// --- Configuração para ambiente ESM ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATS_FILE = path.join(__dirname, '../../../database/commandStats.json');

// Cache em memória para as estatísticas
let statsCache = null;
// Variáveis para controlar a escrita e evitar race conditions
let isWriting = false;
let hasPendingWrite = false;

/**
 * Carrega as estatísticas do arquivo JSON para o cache na memória.
 * Cria o arquivo se ele não existir.
 */
async function initializeStats() {
    try {
        await fs.access(STATS_FILE);
        const data = await fs.readFile(STATS_FILE, 'utf8');
        statsCache = JSON.parse(data);
    } catch (error) {
        // Se o arquivo não existe ou há erro de leitura, cria um novo
        statsCache = {
            commands: {},
            lastUpdated: new Date().toISOString()
        };
        try {
            await fs.mkdir(path.dirname(STATS_FILE), { recursive: true });
            await fs.writeFile(STATS_FILE, JSON.stringify(statsCache, null, 2));
        } catch (writeError) {
            console.error('Error creating initial stats file:', writeError);
        }
    }
}

/**
 * Salva o cache de estatísticas de volta no arquivo JSON de forma segura.
 */
async function saveStats() {
    // Se já está escrevendo, agenda uma nova escrita e retorna
    if (isWriting) {
        hasPendingWrite = true;
        return;
    }

    isWriting = true;
    try {
        statsCache.lastUpdated = new Date().toISOString();
        await fs.writeFile(STATS_FILE, JSON.stringify(statsCache, null, 2));
    } catch (error) {
        console.error('Error writing stats file:', error);
    } finally {
        isWriting = false;
        // Se uma escrita foi agendada enquanto estava ocupado, executa-a agora
        if (hasPendingWrite) {
            hasPendingWrite = false;
            saveStats();
        }
    }
}

/**
 * Rastreia o uso de um comando, atualizando o cache em memória.
 * @param {string} command - O nome do comando.
 * @param {string} userId - O ID do usuário.
 */
async function trackCommandUsage(command, userId) {
    if (!statsCache) await initializeStats();

    const commandStats = statsCache.commands[command] || {
        count: 0,
        users: {},
        lastUsed: ''
    };

    commandStats.count++;
    commandStats.users[userId] = (commandStats.users[userId] || 0) + 1;
    commandStats.lastUsed = new Date().toISOString();

    statsCache.commands[command] = commandStats;

    // Salva as alterações no disco (de forma segura e otimizada)
    await saveStats();
    return true;
}

/**
 * Retorna uma lista dos comandos mais utilizados.
 * @param {number} limit - O número de comandos a serem retornados.
 * @returns {Promise<Array>} Uma lista dos comandos mais usados.
 */
async function getMostUsedCommands(limit = 10) {
    if (!statsCache) await initializeStats();

    const commandsArray = Object.entries(statsCache.commands).map(([name, data]) => ({
        name,
        count: data.count,
        lastUsed: data.lastUsed,
        uniqueUsers: Object.keys(data.users).length
    }));

    commandsArray.sort((a, b) => b.count - a.count);
    return commandsArray.slice(0, limit);
}

/**
 * Retorna estatísticas detalhadas de um comando específico.
 * @param {string} command - O nome do comando.
 * @returns {Promise<Object|null>} As estatísticas do comando ou null se não for encontrado.
 */
async function getCommandStats(command) {
    if (!statsCache) await initializeStats();
    
    const commandData = statsCache.commands[command];
    if (!commandData) {
        return null;
    }

    const topUsers = Object.entries(commandData.users)
        .map(([userId, count]) => ({ userId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    return {
        name: command,
        count: commandData.count,
        lastUsed: commandData.lastUsed,
        uniqueUsers: Object.keys(commandData.users).length,
        topUsers
    };
}

// Inicializa as estatísticas quando o módulo é carregado
initializeStats();

export {
    trackCommandUsage,
    getMostUsedCommands,
    getCommandStats
};

export default {
    trackCommandUsage,
    getMostUsedCommands,
    getCommandStats
};
