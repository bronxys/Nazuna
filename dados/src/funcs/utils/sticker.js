import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import webp from "node-webpmux";
import axios from "axios";
import ffmpeg from "fluent-ffmpeg";
import { PassThrough } from "stream";

// --- Configuração para ambiente ESM ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
 * Converte um buffer de mídia (imagem/vídeo) para um buffer WebP usando streams.
 * @param {Buffer} mediaBuffer - O buffer da mídia de entrada.
 * @param {boolean} isVideo - Indica se a mídia é um vídeo.
 * @param {boolean} forceSquare - Força o output a ser um quadrado.
 * @returns {Promise<Buffer>} O buffer da mídia convertida para WebP.
 */
async function convertToWebp(mediaBuffer, isVideo = false, forceSquare = false) {
    const scaleOption = forceSquare
        ? "scale=320:320,fps=15"
        : "scale='min(320,iw)':'min(320,ih)':force_original_aspect_ratio=decrease,pad=320:320:(ow-iw)/2:(oh-ih)/2:color=white@0.0,fps=15";
    
    const outputOptions = [
        "-vcodec", "libwebp", "-vf", scaleOption, "-loop", "0",
        "-pix_fmt", "yuva420p", "-lossless", "0", "-compression_level", "6",
        ...(isVideo ? ["-b:v", "500k"] : ["-quality", "50"])
    ];

    const inputStream = new PassThrough();
    inputStream.end(mediaBuffer);

    const ffmpegProcess = ffmpeg(inputStream)
        .addOutputOptions(outputOptions)
        .toFormat("webp");

    return new Promise((resolve, reject) => {
        const chunks = [];
        ffmpegProcess
            .on("error", reject)
            .on("end", () => resolve(Buffer.concat(chunks)))
            .pipe(new PassThrough().on('data', chunk => chunks.push(chunk)));
    });
}

/**
 * Escreve metadados EXIF em um buffer de mídia WebP.
 * @param {Buffer} webpBuffer - O buffer da mídia em formato WebP.
 * @param {object} metadata - Contém packname e author.
 * @returns {Promise<Buffer>} O buffer WebP com os metadados EXIF.
 */
async function writeExif(webpBuffer, metadata) {
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
    } else {
        try {
            inputBuffer = await fs.readFile(path);
        } catch (error) {
            throw new Error(`Não foi possível ler o caminho do sticker: ${path}`);
        }
    }

    // 2. Converter para WebP
    let webpBuffer = await convertToWebp(inputBuffer, type === 'video', forceSquare);

    // 3. Adicionar EXIF se necessário
    if (packname || author) {
        webpBuffer = await writeExif(webpBuffer, { packname, author });
    }

    // 4. Enviar o sticker
    await nazu.sendMessage(jid, { sticker: webpBuffer }, { quoted });

    return webpBuffer;
};

export { sendSticker };
export default { sendSticker };