import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Configuração de caminhos para o ambiente ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Carrega um módulo JavaScript local de forma assíncrona usando import() dinâmico com URL.
 * @param {string} modulePath - O caminho relativo para o módulo.
 * @returns {Promise<any | undefined>} Uma Promise que resolve com o módulo carregado.
 */
async function loadModuleAsync(modulePath) {
    try {
        const moduleUrl = new URL(modulePath, import.meta.url);
        const module = await import(moduleUrl);
        return module.default || module;
    } catch (error) {
        console.warn(`[AVISO] Não foi possível carregar o módulo local: ${modulePath}. Erro: ${error.message}`);
        return undefined;
    }
}

/**
 * Carrega e faz o parse de um arquivo JSON de forma assíncrona.
 * @param {string} filePath - O caminho relativo ou absoluto para o arquivo JSON.
 * @returns {Promise<any | undefined>} O objeto JSON ou undefined se falhar.
 */
async function loadJson(filePath) {
    try {
        const fullPath = path.resolve(__dirname, filePath);
        const data = await fs.readFile(fullPath, "utf-8");
        return JSON.parse(data);
    } catch (error) {
        console.error(`[ERRO] Falha ao carregar o arquivo JSON: ${filePath}. Erro: ${error.message}`);
        return undefined;
    }
}

// Caminhos dos módulos locais organizados por pastas
const localModulePaths = {
    // --- downloads ---
    youtube: "./downloads/youtube.js",
    tiktok: "./downloads/tiktok.js",
    pinterest: "./downloads/pinterest.js",
    igdl: "./downloads/igdl.js",
    Lyrics: "./downloads/lyrics.js",
    mcPlugin: "./downloads/mcplugins.js",
    FilmesDL: "./downloads/filmes.js",

    // --- utils ---
    styleText: "./utils/gerarnick.js",
    VerifyUpdate: "./utils/update-verify.js",
    emojiMix: "./utils/emojimix.js",
    upload: "./utils/upload.js",
    tictactoe: "./utils/tictactoe.js",
    stickerModule: "./utils/sticker.js",
    commandStats: "./utils/commandStats.js",

    // --- private ---
    ia: "./private/ia.js",
    banner: "./private/banner.js",
    temuScammer: "./private/temuScammer.js",
};

export default (async () => {
    try {
        // Carrega todos os módulos locais em paralelo
        const localModulePromises = Object.entries(localModulePaths).map(async ([key, filePath]) => {
            const module = await loadModuleAsync(filePath);
            return [key, module];
        });

        // Carrega os JSONs
        const jsonPromises = [
            loadJson("json/tools.json").then((data) => ["toolsJson", data]),
            loadJson("json/vab.json").then((data) => ["vabJson", data]),
        ];

        // Aguarda a resolução de todas as promises
        const results = await Promise.all([...localModulePromises, ...jsonPromises]);

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