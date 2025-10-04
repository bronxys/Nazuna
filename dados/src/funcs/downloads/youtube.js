/**
 * Download e Pesquisa YouTube usando AdonixYtdl
 * Made By Ado  <<< github.com/Ado-rgb >>>
 */

import axios from 'axios';
import yts from 'yt-search';

// Qualidades disponíveis (formato de compatibilidade)
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

// Scraper AdonixYtdl
async function adonixytdl(url) {
  const headers = {
    "accept": "*/*",
    "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    "sec-ch-ua": '"Not A(Brand";v="8", "Chromium";v="132"',
    "sec-ch-ua-mobile": "?1",
    "sec-ch-ua-platform": '"Android"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "cross-site",
    "Referer": "https://id.ytmp3.mobi/",
    "Referrer-Policy": "strict-origin-when-cross-origin"
  };

  const initial = await axios.get(`https://d.ymcdn.org/api/v1/init?p=y&23=1llum1n471&_=${Math.random()}`, { headers });
  const init = initial.data;

  const id = url.match(/(?:youtu\.be\/|youtube\.com\/(?:.*v=|.*\/|.*embed\/))([^&?/]+)/)?.[1];
  if (!id) throw new Error('No se pudo obtener ID del video.');

  const mp4_ = init.convertURL + `&v=${id}&f=mp4&_=${Math.random()}`;
  const mp3_ = init.convertURL + `&v=${id}&f=mp3&_=${Math.random()}`;

  const mp4__ = await axios.get(mp4_, { headers });
  const mp3__ = await axios.get(mp3_, { headers });

  let info = {};
  while (true) {
    const j = await axios.get(mp3__.data.progressURL, { headers });
    info = j.data;
    if (info.progress == 3) break;
  }

  return {
    title: info.title,
    mp3: mp3__.data.downloadURL,
    mp4: mp4__.data.downloadURL
  };
}

async function mp3(input, quality = 128) {
  try {
    const id = getYouTubeVideoId(input);
    if (!id) throw new Error('URL inválida');

    // Cache de metadados
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

    // Usar AdonixYtdl para obter os links
    const result = await adonixytdl(url);
    if (!result.mp3) throw new Error('Falha ao gerar link de áudio');

    // Baixar o arquivo
    const buffer = (await axios.get(result.mp3, { responseType: 'arraybuffer', timeout: 60000 })).data;
    
    return {
      ok: true,
      buffer: Buffer.from(buffer),
      filename: `${result.title || 'download'} (${quality}kbps).mp3`,
      quality: `${quality}kbps`,
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

    // Cache de metadados
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

    // Usar AdonixYtdl para obter os links
    const result = await adonixytdl(url);
    if (!result.mp4) throw new Error('Falha ao gerar link de vídeo');

    // Baixar o arquivo
    const buffer = (await axios.get(result.mp4, { responseType: 'arraybuffer', timeout: 60000 })).data;
    
    return {
      ok: true,
      buffer: Buffer.from(buffer),
      filename: `${result.title || 'download'} (${quality}p).mp4`,
      quality: `${quality}p`,
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