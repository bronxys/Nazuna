import { promises as fs } from "fs";
import fsSync from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import webp from "node-webpmux";
import axios from "axios";
import ffmpeg from "fluent-ffmpeg";

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

// Busca conteúdo remoto como Buffer
async function getBuffer(url) {
    const { data, headers } = await axios.get(url, { responseType: 'arraybuffer' });
    if (!data || data.length === 0) {
        throw new Error(`Falha ao baixar mídia: buffer vazio (${url})`);
    }
    console.log(`Download concluído: ${url} (${data.length} bytes; content-type=${headers['content-type']})`);
    return Buffer.from(data);
}

// Obtém duração de um vídeo
async function probeDuration(filePath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) return reject(err);
            resolve(metadata?.format?.duration || 0);
        });
    });
}

// Heurística simples para detectar se buffer parece vídeo MP4/WEBM/GIF
function guessVideoFromBuffer(buf) {
    if (!buf || buf.length < 16) return false;
    // mp4: ftyp
    if (buf.slice(4, 8).toString() === 'ftyp') return true;
    // webm: 1A 45 DF A3
    if (buf[0] === 0x1A && buf[1] === 0x45 && buf[2] === 0xDF && buf[3] === 0xA3) return true;
    // gif: GIF8
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return true;
    return false;
}

/**
 * Converte mídia para WebP (estático ou animado)
 * @param {Buffer} mediaBuffer 
 * @param {boolean} isVideo 
 * @param {boolean} forceSquare 
 * @returns {Promise<Buffer>}
 */
async function convertToWebp(mediaBuffer, isVideo = false, forceSquare = false) {
    // Se já for WebP e não é vídeo: retorna direto
    if (!isVideo && mediaBuffer[0] === 0x52 && mediaBuffer[1] === 0x49 && mediaBuffer[2] === 0x46 && mediaBuffer[3] === 0x46 && mediaBuffer.slice(8, 12).toString() === 'WEBP') {
        console.log('Entrada já é WebP estático. Pulando conversão.');
        return mediaBuffer;
    }

    // Ajusta heurística caso o chamador marque image mas buffer seja vídeo
    if (!isVideo && guessVideoFromBuffer(mediaBuffer)) {
        console.log('Heurística detectou vídeo apesar de type=image. Convertendo como vídeo.');
        isVideo = true;
    }

    let detectedExt = 'jpg';
    if (mediaBuffer[0] === 0x89 && mediaBuffer[1] === 0x50) detectedExt = 'png';
    else if (mediaBuffer[0] === 0xFF && mediaBuffer[1] === 0xD8) detectedExt = 'jpg';
    else if (isVideo) detectedExt = 'mp4'; // usaremos extensão genérica

    const tmpIn = generateTempFileName(detectedExt);
    const tmpOut = generateTempFileName('webp');

    await fs.writeFile(tmpIn, mediaBuffer);
    const st = await fs.stat(tmpIn);
    if (st.size === 0) throw new Error('Arquivo temporário de entrada vazio');

    let duration = 0;
    if (isVideo) {
        try {
            duration = await probeDuration(tmpIn);
        } catch {
            console.warn('Não foi possível obter duração do vídeo (prosseguindo mesmo assim).');
        }
    }

    const maxSeconds = isVideo ? 8 : 0; // WhatsApp stickers animados geralmente <= 6-8s
    const targetSeconds = isVideo ? Math.min(duration || maxSeconds, maxSeconds) : 0;

    console.log(`Convertendo para WebP (${isVideo ? 'vídeo animado' : 'imagem'}) | Duração detectada: ${duration.toFixed(2)}s | Limitando a: ${targetSeconds || 'N/A'}s`);

    const buildFilters = () => {
        const baseScale = forceSquare
            ? 'scale=320:320'
            : 'scale=320:320:force_original_aspect_ratio=decrease,pad=320:320:(ow-iw)/2:(oh-ih)/2:color=0x00000000';

        if (isVideo) {
            // Ordem: scale -> fps
            return `${baseScale},fps=15`;
        }
        return baseScale;
    };

    const commonImageOptions = [
        '-c:v', 'libwebp',
        '-lossless', '0',
        '-compression_level', '6',
        '-preset', 'default'
    ];

    // Função de execução (para permitir fallback)
    const runFfmpeg = (useFallback = false) => new Promise((resolve, reject) => {
        let cmd = ffmpeg(tmpIn)
            .outputOptions([
                '-vf', buildFilters(),
                ...commonImageOptions,
                ...(isVideo
                    ? [
                        '-q:v', useFallback ? '60' : '45',
                        '-loop', '0',
                        '-an',
                        '-vsync', '0',
                        ...(targetSeconds ? ['-t', String(targetSeconds)] : [])
                    ]
                    : [
                        '-q:v', '70'
                    ])
            ])
            .format('webp')
            .on('start', c => console.log('FFmpeg START:', c))
            .on('progress', p => {
                if (p.percent) console.log(`Progresso: ${Math.round(p.percent)}%`);
            })
            .on('error', err => {
                console.error('Erro no FFmpeg:', err.message);
                reject(err);
            })
            .on('end', () => {
                console.log('Conversão concluída.');
                resolve();
            })
            .save(tmpOut);
    });

    try {
        try {
            await runFfmpeg(false);
        } catch (e) {
            if (isVideo) {
                console.warn('Tentativa principal falhou. Reexecutando com fallback...');
                await runFfmpeg(true);
            } else {
                throw e;
            }
        }

        const outStats = await fs.stat(tmpOut).catch(() => null);
        if (!outStats || outStats.size === 0) {
            throw new Error('Arquivo WebP final não foi gerado ou está vazio.');
        }

        const buffer = await fs.readFile(tmpOut);
        if (buffer.length > 1024 * 1024) {
            console.warn(`Sticker resultante >1MB (${buffer.length} bytes). Considere reduzir qualidade.`);
        } else {
            console.log(`Sticker gerado (${buffer.length} bytes).`);
        }
        return buffer;
    } finally {
        // Limpeza
        await fs.unlink(tmpIn).catch(() => {});
        await fs.unlink(tmpOut).catch(() => {});
    }
}

// Escreve EXIF
async function writeExif(webpBuffer, metadata) {
    try {
        const img = new webp.Image();
        await img.load(webpBuffer);

        const json = {
            "sticker-pack-id": "https://github.com/hiudyy",
            "sticker-pack-name": metadata.packname || '',
            "sticker-pack-publisher": metadata.author || '',
            "emojis": ["NazuninhaBot"]
        };

        const exifAttr = Buffer.from([
            0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00,
            0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x16, 0x00, 0x00, 0x00
        ]);
        const jsonBuff = Buffer.from(JSON.stringify(json), "utf-8");
        const exif = Buffer.concat([exifAttr, jsonBuff]);
        exif.writeUIntLE(jsonBuff.length, 14, 4);

        img.exif = exif;
        return await img.save(null);
    } catch (err) {
        console.error('Erro ao adicionar EXIF (continuando sem):', err.message);
        return webpBuffer;
    }
}

/**
 * Envia sticker
 * @param {*} nazu 
 * @param {string} jid 
 * @param {object} options 
 * @param {object} messageInfo 
 */
const sendSticker = async (nazu, jid, {
    sticker: input,
    type = 'image',
    packname = '',
    author = '',
    forceSquare = false
}, { quoted } = {}) => {
    try {
        if (!['image', 'video'].includes(type)) {
            throw new Error('O tipo de mídia deve ser "image" ou "video".');
        }

        let inputBuffer;

        if (Buffer.isBuffer(input)) {
            inputBuffer = input;
        } else if (typeof input === 'string') {
            if (/^https?:\/\//i.test(input)) {
                inputBuffer = await getBuffer(input);
            } else {
                inputBuffer = await fs.readFile(input).catch(() => {
                    throw new Error(`Não foi possível ler arquivo local: ${input}`);
                });
            }
        } else if (input && typeof input === 'object' && input.url) {
            inputBuffer = await getBuffer(input.url);
        } else if (/^data:.*?;base64,/i.test(input)) {
            inputBuffer = Buffer.from(String(input).split(',')[1], 'base64');
        } else {
            throw new Error('Entrada de sticker inválida.');
        }

        if (!inputBuffer || inputBuffer.length < 10) {
            throw new Error('Buffer de entrada inválido ou muito pequeno.');
        }

        console.log(`Processando sticker: type=${type} size=${inputBuffer.length}B`);

        let webpBuffer = await convertToWebp(inputBuffer, type === 'video', forceSquare);

        if (packname || author) {
            webpBuffer = await writeExif(webpBuffer, { packname, author });
        }

        await nazu.sendMessage(jid, { sticker: webpBuffer }, { quoted });
        console.log('Sticker enviado com sucesso.');

        return webpBuffer;
    } catch (err) {
        console.error('Erro ao processar/enviar sticker:', err);
        throw err;
    }
};

export { sendSticker };
export default { sendSticker };