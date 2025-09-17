/**
 * Download e Pesquisa YouTube usando SaveTube
 * Migrado de AdonixYtdl -> SaveTube
 */

import axios from 'axios';
import yts from 'yt-search';
import { createDecipheriv } from 'crypto';

// Qualidades suportadas pelo SaveTube
const AUDIO_QUALITIES = [92, 128, 256, 320];
const VIDEO_QUALITIES = [144, 360, 480, 720, 1080];

// Cache para resultados de busca e metadados (com expiração)
const searchCache = new Map();
const metadataCache = new Map();

// Limpa entradas antigas do cache baseado no tempo
function cleanCache() {
  const now = Date.now();
  for (const [key, value] of searchCache.entries()) {
    if (now - value.timestamp > 60 * 60 * 1000) searchCache.delete(key); // 1h
  }
  for (const [key, value] of metadataCache.entries()) {
    if (now - value.timestamp > 30 * 60 * 1000) metadataCache.delete(key); // 30m
  }
}
setInterval(cleanCache, 10 * 60 * 1000); // a cada 10m

function getYouTubeVideoId(url) {
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|v\/|embed\/|user\/[^\/\n\s]+\/)?(?:watch\?v=|v%3D|embed%2F|video%2F)?|youtu\.be\/|youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/|youtube\.com\/playlist\?list=)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// Funções auxiliares para decodificar resposta SaveTube
const hexcode = (hex) => Buffer.from(hex, 'hex');
const decode = (enc) => {
  try {
    const secret_key = 'C5D58EF67A7584E4A29F6C35BBC4EB12';
    const data = Buffer.from(enc, 'base64');
    const iv = data.slice(0, 16);
    const content = data.slice(16);
    const key = hexcode(secret_key);
    const decipher = createDecipheriv('aes-128-cbc', key, iv);
    const decrypted = Buffer.concat([decipher.update(content), decipher.final()]);
    return JSON.parse(decrypted.toString());
  } catch (error) {
    throw new Error(error.message);
  }
};

async function savetube(link, quality, type) {
  try {
    const cdn = (await axios.get('https://media.savetube.me/api/random-cdn')).data.cdn;
    const infoget = (await axios.post(`https://${cdn}/v2/info`, { url: link }, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36',
        'Referer': 'https://yt.savetube.me/1kejjj1?id=362796039'
      }
    })).data;
    const info = decode(infoget.data);
    const response = (await axios.post(`https://${cdn}/download`, {
      downloadType: type,
      quality: `${quality}`,
      key: info.key
    }, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36',
        'Referer': 'https://yt.savetube.me/start-download?from=1kejjj1%3Fid%3D362796039'
      }
    })).data;

    return {
      status: true,
      quality: `${quality}${type === 'audio' ? 'kbps' : 'p'}`,
      availableQuality: type === 'audio' ? AUDIO_QUALITIES : VIDEO_QUALITIES,
      url: response.data.downloadUrl,
      filename: `${info.title} (${quality}${type === 'audio' ? 'kbps).mp3' : 'p).mp4'}`
    };
  } catch (error) {
    console.error('SaveTube error:', error.message);
    return { status: false, message: 'Converting error' };
  }
}

async function mp3(input, quality = 128) {
  try {
    const id = getYouTubeVideoId(input);
    if (!id) throw new Error('URL inválida');
    const format = AUDIO_QUALITIES.includes(Number(quality)) ? Number(quality) : 128;

    // cache de metadados
    const cacheKey = `meta:${id}`;
    let meta;
    if (metadataCache.has(cacheKey)) {
      const cached = metadataCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 30 * 60 * 1000) meta = cached.data;
    }
    const url = `https://youtube.com/watch?v=${id}`;
    if (!meta) {
      meta = await yts(url);
      metadataCache.set(cacheKey, { data: meta, timestamp: Date.now() });
    }
    const result = await savetube(url, format, 'audio');
    if (!result.status) throw new Error(result.message || 'Falha ao gerar link');
    const buffer = (await axios.get(result.url, { responseType: 'arraybuffer', timeout: 60000 })).data;
    return {
      ok: true,
      buffer: Buffer.from(buffer),
      filename: result.filename || 'download.mp3',
      quality: result.quality,
      availableQuality: AUDIO_QUALITIES
    };
  } catch (err) {
    return { ok: false, msg: 'Erro ao processar o áudio: ' + err.message };
  }
}

async function mp4(input, quality = 360) {
  try {
    const id = getYouTubeVideoId(input);
    if (!id) throw new Error('URL inválida');
    const format = VIDEO_QUALITIES.includes(Number(quality)) ? Number(quality) : 360;

    const cacheKey = `meta:${id}`;
    let meta;
    if (metadataCache.has(cacheKey)) {
      const cached = metadataCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 30 * 60 * 1000) meta = cached.data;
    }
    const url = `https://youtube.com/watch?v=${id}`;
    if (!meta) {
      meta = await yts(url);
      metadataCache.set(cacheKey, { data: meta, timestamp: Date.now() });
    }
    const result = await savetube(url, format, 'video');
    if (!result.status) throw new Error(result.message || 'Falha ao gerar link');
    const buffer = (await axios.get(result.url, { responseType: 'arraybuffer', timeout: 60000 })).data;
    return {
      ok: true,
      buffer: Buffer.from(buffer),
      filename: result.filename || 'download.mp4',
      quality: result.quality,
      availableQuality: VIDEO_QUALITIES
    };
  } catch (err) {
    return { ok: false, msg: 'Erro ao processar o vídeo: ' + err.message };
  }
}

// Mantém função search com cache simples (sem fila complexa agora)
async function search(name) {
  try {
    const cacheKey = `search:${name}`;
    if (searchCache.has(cacheKey)) {
      const cached = searchCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 60 * 60 * 1000) return cached.data;
    }
    const searchRes = await yts(name);
    if (!searchRes.videos?.length) return { ok: false, msg: 'Não encontrei nenhuma música.' };
    const result = { ok: true, criador: 'Hiudy', data: searchRes.videos[0] };
    searchCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    return { ok: false, msg: 'Ocorreu um erro ao realizar a pesquisa.' };
  }
}

export default {
  search: (text) => search(text),
  mp3: (url, q) => mp3(url, q),
  mp4: (url, q) => mp4(url, q),
  ytmp3: (url, q) => mp3(url, q),
  ytmp4: (url, q) => mp4(url, q)
};