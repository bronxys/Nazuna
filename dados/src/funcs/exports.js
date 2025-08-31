import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from 'url';

// Configuração de caminhos para o ambiente ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Carrega um módulo JavaScript local de forma assíncrona usando import() dinâmico.
 * @param {string} modulePath - O caminho completo para o módulo.
 * @returns {Promise<any | undefined>} Uma Promise que resolve com o módulo carregado.
 */
async function loadModuleAsync(modulePath) {
    try {
        const module = await import(modulePath);
        return module.default || module; // Retorna a exportação padrão ou o módulo inteiro
    } catch (error) {
        console.warn(`[AVISO] Não foi possível carregar o módulo local: ${path.basename(modulePath)}. Erro: ${error.message}`);
        return undefined;
    }
}

/**
 * Carrega e faz o parse de um arquivo JSON de forma assíncrona.
 * @param {string} filePath - O caminho completo para o arquivo JSON.
 * @returns {Promise<any | undefined>} O objeto JSON ou undefined se falhar.
 */
async function loadJson(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`[ERRO] Falha ao carregar o arquivo JSON: ${path.basename(filePath)}. Erro: ${error.message}`);
        return undefined;
    }
}

/**
 * Tenta carregar um módulo remoto com várias tentativas.
 * @param {Function} requireRemote - A função que carrega o módulo remoto.
 * @param {string} url - A URL do módulo.
 * @param {string} moduleName - O nome do módulo para logs.
 * @param {number} maxRetries - Número máximo de tentativas.
 * @param {number} retryInterval - Intervalo entre tentativas em ms.
 * @returns {Promise<any>} O módulo carregado.
 */
async function loadRemoteModuleWithRetry(requireRemote, url, moduleName, maxRetries = 5, retryInterval = 500) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const module = await requireRemote(url);
            return module;
        } catch (error) {
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, retryInterval));
            } else {
                console.error(`[ERRO] Todas as tentativas de carregar '${moduleName}' falharam.`);
                return {};
            }
        }
    }
}

// Definição dos caminhos e URLs
const utilsDir = path.join(__dirname, 'utils');
const jsonDir = path.join(__dirname, 'json');

const remoteModuleUrls = {
    youtube: 'https://gitlab.com/hiudyy/nazuna-funcs/-/raw/main/funcs/downloads/youtube.js',
    tiktok: 'https://gitlab.com/hiudyy/nazuna-funcs/-/raw/main/funcs/downloads/tiktok.js',
    pinterest: 'https://gitlab.com/hiudyy/nazuna-funcs/-/raw/main/funcs/downloads/pinterest.js',
    igdl: 'https://gitlab.com/hiudyy/nazuna-funcs/-/raw/main/funcs/downloads/igdl.js',
    Lyrics: 'https://gitlab.com/hiudyy/nazuna-funcs/-/raw/main/funcs/downloads/lyrics.js',
    mcPlugin: 'https://gitlab.com/hiudyy/nazuna-funcs/-/raw/main/funcs/downloads/mcplugins.js',
    FilmesDL: 'https://gitlab.com/hiudyy/nazuna-funcs/-/raw/main/funcs/downloads/filmes.js',
    styleText: 'https://gitlab.com/hiudyy/nazuna-funcs/-/raw/main/funcs/utils/gerarnick.js',
    ia: 'https://gitlab.com/hiudyy/nazuna-funcs/-/raw/main/funcs/private/ia.js',
    banner: 'https://gitlab.com/hiudyy/nazuna-funcs/-/raw/main/funcs/private/banner.js',
    VerifyUpdate: 'https://gitlab.com/hiudyy/nazuna-funcs/-/raw/main/funcs/utils/update-verify.js'
};

const localModulePaths = {
    emojiMix: path.join(utilsDir, 'emojimix.js'),
    upload: path.join(utilsDir, 'upload.js'),
    tictactoe: path.join(utilsDir, 'tictactoe.js'),
    stickerModule: path.join(utilsDir, 'sticker.js'),
    commandStats: path.join(utilsDir, 'commandStats.js'),
};


export default (async () => {
    try {
        // Carrega a dependência 'requireRemote' primeiro
        const importUtil = await loadModuleAsync(path.join(utilsDir, 'import.js'));
        if (!importUtil || !importUtil.requireRemote) {
            throw new Error("A função 'requireRemote' não pôde ser carregada do arquivo 'import.js'.");
        }
        const { requireRemote } = importUtil;

        // Cria todas as promises para carregar recursos em paralelo
        const localModulePromises = Object.entries(localModulePaths).map(async ([key, filePath]) => {
            const module = await loadModuleAsync(filePath);
            return [key, module];
        });

        const remoteModulePromises = Object.entries(remoteModuleUrls).map(async ([key, url]) => {
            let module = await loadRemoteModuleWithRetry(requireRemote, url, key);
            module = module.default ? module.default : module;
            return [key, module];
        });

        const jsonPromises = [
            loadJson(path.join(jsonDir, 'tools.json')).then(data => ['toolsJson', data]),
            loadJson(path.join(jsonDir, 'vab.json')).then(data => ['vabJson', data])
        ];

        // Aguarda a resolução de todas as promises
        const results = await Promise.all([
            ...localModulePromises,
            ...remoteModulePromises,
            ...jsonPromises
        ]);
        
        // Converte o array de resultados em um objeto único
        const loadedResources = Object.fromEntries(results);
        
        // Monta o objeto final para exportação
        return {
            ...loadedResources,
            sendSticker: loadedResources.stickerModule?.sendSticker,
            stickerModule: undefined,
            toolsJson: () => loadedResources.toolsJson,
            vabJson: () => loadedResources.vabJson,
        };

    } catch (error) {
        console.error(`[ERRO FATAL] Ocorreu um erro crítico durante a inicialização:`, error.message);
        console.log(`[SISTEMA] Encerrando a aplicação devido a uma falha na inicialização.`);
        process.exit(1);
    }
})();
