import { promises as fs } from "fs";
import fsSync from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import webp from "node-webpmux";
import axios from "axios";
import ffmpeg from "fluent-ffmpeg";
import { PassThrough } from "stream";

// --- Configuração para ambiente ESM ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Função para gerar nomes de arquivo temporários
const generateTempFileName = (extension) => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000);
    const tmpDir = path.join(__dirname, '../../../database/tmp');
    if (!fsSync.existsSync(tmpDir)) {
        fsSync.mkdirSync(tmpDir, { recursive: true });
    }
    return path.join(tmpDir, `${timestamp}_${random}.${extension}`);
};

/**
 * Busca o conteúdo de uma URL e retorna como um Buffer.
 * @param {string} url - A URL do recurso.
 * @returns {Promise<Buffer>} O conteúdo como um Buffer.
 */
async function getBuffer(url) {
    const { data } = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(data);
}

/**
 * Obtém a duração de um vídeo usando ffprobe.
 * @param {string} inputPath - Caminho do arquivo de vídeo.
 * @returns {Promise<number>} A duração em segundos.
 */
async function getVideoDuration(inputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(inputPath, (err, metadata) => {
            if (err) return reject(err);
            resolve(metadata.format.duration);
        });
    });
}

/**
 * Converte um buffer de mídia (imagem/vídeo) para um buffer WebP.
 * Utiliza arquivos temporários para melhor compatibilidade com FFmpeg.
 * @param {Buffer} mediaBuffer - O buffer da mídia de entrada.
 * @param {boolean} isVideo - Indica se a mídia é um vídeo.
 * @param {boolean} forceSquare - Força o output a ser um quadrado.
 * @returns {Promise<Buffer>} O buffer da mídia convertida para WebP.
 */
async function convertToWebp(mediaBuffer, isVideo = false, forceSquare = false) {
    // Detecta formato baseado no header do arquivo
    let extension = 'jpg'; // padrão
    if (mediaBuffer[0] === 0x89 && mediaBuffer[1] === 0x50) {
        extension = 'png';
    } else if (mediaBuffer[0] === 0xFF && mediaBuffer[1] === 0xD8) {
        extension = 'jpg';
    } else if (isVideo) {
        extension = 'mp4';
    }
    
    const tmpFileOut = generateTempFileName('webp');
    const tmpFileIn = generateTempFileName(extension);
    
    try {
        // Escreve o buffer em arquivo temporário
        await fs.writeFile(tmpFileIn, mediaBuffer);
        
        // Verifica se o arquivo foi criado corretamente
        const stats = await fs.stat(tmpFileIn);
        if (stats.size === 0) {
            throw new Error('Arquivo temporário de entrada está vazio');
        }
        
        console.log(`Arquivo temporário criado: ${tmpFileIn} (${stats.size} bytes)`);
        
        // Configuração simplificada baseada no tipo
        let ffmpegCommand = ffmpeg(tmpFileIn);
        
        if (isVideo) {
            // Configurações para vídeo
            ffmpegCommand = ffmpegCommand
                .outputOptions([
                    '-vf', forceSquare ? 'scale=320:320,fps=15' : 'scale=320:320:force_original_aspect_ratio=decrease,pad=320:320:(ow-iw)/2:(oh-ih)/2,fps=15',
                    '-c:v', 'libwebp',
                    '-lossless', '0',
                    '-compression_level', '6',
                    '-q:v', '50',
                    '-preset', 'default',
                    '-loop', '0',
                    '-t', '10'
                ])
                .format('webp');
        } else {
            // Configurações para imagem
            ffmpegCommand = ffmpegCommand
                .outputOptions([
                    '-vf', forceSquare ? 'scale=320:320' : 'scale=320:320:force_original_aspect_ratio=decrease,pad=320:320:(ow-iw)/2:(oh-ih)/2',
                    '-c:v', 'libwebp',
                    '-lossless', '0',
                    '-compression_level', '6',
                    '-q:v', '75'
                ])
                .format('webp');
        }
        
        console.log('Iniciando conversão FFmpeg...');
        
        // Executa a conversão
        await new Promise((resolve, reject) => {
            ffmpegCommand
                .on("start", (cmdLine) => {
                    console.log('FFmpeg comando:', cmdLine);
                })
                .on("progress", (progress) => {
                    if (progress.percent) {
                        console.log(`Progresso: ${Math.round(progress.percent)}%`);
                    }
                })
                .on("error", (err) => {
                    console.error("Erro no FFmpeg:", err.message);
                    reject(err);
                })
                .on("end", () => {
                    console.log("Conversão WebP concluída");
                    resolve();
                })
                .save(tmpFileOut);
        });
        
        // Verifica se o arquivo de saída foi criado
        try {
            const outputStats = await fs.stat(tmpFileOut);
            if (outputStats.size === 0) {
                throw new Error('Arquivo de saída WebP está vazio');
            }
            console.log(`Arquivo WebP gerado: ${outputStats.size} bytes`);
        } catch (statError) {
            throw new Error('Arquivo de saída WebP não foi criado');
        }
        
        // Lê o arquivo convertido
        const buff = await fs.readFile(tmpFileOut);
        
        // Verifica o tamanho do arquivo
        if (buff.length > 1000000) {
            console.warn(`Arquivo gerado tem ${buff.length} bytes (>1MB). Considere reduzir qualidade.`);
        } else {
            console.log(`Sticker WebP criado com sucesso: ${buff.length} bytes`);
        }
        
        return buff;
        
    } finally {
        // Limpa arquivos temporários
        try {
            await fs.unlink(tmpFileIn).catch(() => {});
            await fs.unlink(tmpFileOut).catch(() => {});
        } catch (cleanupError) {
            console.warn("Erro ao limpar arquivos temporários:", cleanupError);
        }
    }
}

/**
 * Escreve metadados EXIF em um buffer de mídia WebP.
 * @param {Buffer} webpBuffer - O buffer da mídia em formato WebP.
 * @param {object} metadata - Contém packname e author.
 * @returns {Promise<Buffer>} O buffer WebP com os metadados EXIF.
 */
async function writeExif(webpBuffer, metadata) {
    try {
        const img = new webp.Image();
        await img.load(webpBuffer);

        const json = {
            "sticker-pack-id": `https://github.com/hiudyy`,
            "sticker-pack-name": metadata.packname,
            "sticker-pack-publisher": metadata.author,
            "emojis": ["NazuninhaBot"]
        };

        const exifAttr = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]);
        const jsonBuff = Buffer.from(JSON.stringify(json), "utf-8");
        const exif = Buffer.concat([exifAttr, jsonBuff]);
        exif.writeUIntLE(jsonBuff.length, 14, 4);
        
        img.exif = exif;
        return await img.save(null);
    } catch (error) {
        console.error("Erro ao processar EXIF:", error);
        return webpBuffer; // Retorna o buffer original se houver erro
    }
}

/**
 * Prepara e envia um sticker.
 * @param {any} nazu - A instância do cliente do bot.
 * @param {string} jid - O ID do chat de destino.
 * @param {object} options - Opções do sticker.
 * @param {object} messageInfo - Informações da mensagem a ser respondida.
 */
const sendSticker = async (nazu, jid, {
    sticker: path,
    type = 'image',
    packname = '',
    author = '',
    forceSquare = false
}, { quoted } = {}) => {
    try {
        if (!['image', 'video'].includes(type)) {
            throw new Error('O tipo de mídia deve ser "image" ou "video".');
        }

        // 1. Resolver a entrada para um Buffer
        let inputBuffer;
        if (Buffer.isBuffer(path)) {
            inputBuffer = path;
        } else if (/^data:.*?\/.*?;base64,/i.test(path)) {
            inputBuffer = Buffer.from(path.split(',')[1], 'base64');
        } else if (path.url) {
            inputBuffer = await getBuffer(path.url);
        } else if (typeof path === 'string') {
            try {
                inputBuffer = await fs.readFile(path);
            } catch (error) {
                throw new Error(`Não foi possível ler o caminho do sticker: ${path}`);
            }
        } else {
            throw new Error('Formato de entrada inválido para sticker');
        }

        // Verifica se o buffer é válido
        if (!inputBuffer || inputBuffer.length === 0) {
            throw new Error('Buffer de entrada vazio ou inválido');
        }

        console.log(`Processando sticker - Tipo: ${type}, Tamanho: ${inputBuffer.length} bytes`);

        // 2. Converter para WebP
        let webpBuffer = await convertToWebp(inputBuffer, type === 'video', forceSquare);

        // 3. Adicionar EXIF se necessário
        if (packname || author) {
            webpBuffer = await writeExif(webpBuffer, { packname, author });
        }

        // 4. Enviar o sticker
        await nazu.sendMessage(jid, { sticker: webpBuffer }, { quoted });

        console.log('Sticker enviado com sucesso');
        return webpBuffer;

    } catch (error) {
        console.error('Erro ao processar sticker:', error);
        throw error;
    }
};

export { sendSticker };
export default { sendSticker };