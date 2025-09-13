/**
 * Sistema de Download e Pesquisa YouTube Otimizado com AdonixYtdl
 * Adaptado por Hiudy
 * Versão: 4.0.0 - Otimizada
 */

import axios from 'axios';
import yts from 'yt-search';

// Configurações
const CONFIG = {
  FORMATS: {
    AUDIO: ['mp3', 'm4a', 'opus', 'webm'],
    VIDEO: ['144', '240', '360', '480', '720', '1080']
  }
};

// Cache para resultados de busca e metadados (com expiração)
const searchCache = new Map();
const metadataCache = new Map();

// Limites de requisições e controle de taxa
const requestQueue = [];
let isProcessingQueue = false;
const MAX_CONCURRENT_REQUESTS = 3;

function getVideoId(url) {
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|v\/|embed\/|user\/[^\/\n\s]+\/)?(?:watch\?v=|v%3D|embed%2F|video%2F)?|youtu\.be\/|youtube\.com\/watch\?v=|youtube\.com\/(?:embed|shorts)\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

/**
 * Limpa entradas antigas do cache baseado no tempo
 */
function cleanCache() {
  const now = Date.now();
  
  // Limpa cache de busca (1 hora de validade)
  for (const [key, value] of searchCache.entries()) {
    if (now - value.timestamp > 60 * 60 * 1000) {
      searchCache.delete(key);
    }
  }
  
  // Limpa cache de metadados (30 minutos de validade)
  for (const [key, value] of metadataCache.entries()) {
    if (now - value.timestamp > 30 * 60 * 1000) {
      metadataCache.delete(key);
    }
  }
}

// Limpa o cache a cada 10 minutos
setInterval(cleanCache, 10 * 60 * 1000);

/**
 * Processa a fila de requisições para evitar sobrecarga
 */
async function processRequestQueue() {
  if (isProcessingQueue || requestQueue.length === 0) return;
  
  isProcessingQueue = true;
  
  try {
    // Processa até 3 requisições por vez
    const batchSize = Math.min(MAX_CONCURRENT_REQUESTS, requestQueue.length);
    const batch = requestQueue.splice(0, batchSize);
    
    await Promise.all(batch.map(request => request()));
  } catch (error) {
    console.error("Erro ao processar fila de requisições:", error.message);
  } finally {
    isProcessingQueue = false;
    
    // Processa o próximo lote se houver
    if (requestQueue.length > 0) {
      setTimeout(processRequestQueue, 1000);
    }
  }
}

// Implementação do AdonixYtdl
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
    }

    const initial = await axios.get(`https://d.ymcdn.org/api/v1/init?p=y&23=1llum1n471&_=${Math.random()}`, { headers })
    const init = initial.data

    const id = url.match(/(?:youtu\.be\/|youtube\.com\/(?:.*v=|.*\/|.*embed\/))([^&?/]+)/)?.[1]
    if (!id) throw new Error('No se pudo obtener ID del video.')

    const mp4_ = init.convertURL + `&v=${id}&f=mp4&_=${Math.random()}`
    const mp3_ = init.convertURL + `&v=${id}&f=mp3&_=${Math.random()}`

    const mp4__ = await axios.get(mp4_, { headers })
    const mp3__ = await axios.get(mp3_, { headers })

    let info = {}
    while (true) {
        const j = await axios.get(mp3__.data.progressURL, { headers })
        info = j.data
        if (info.progress == 3) break
    }

    return {
        title: info.title,
        mp3: mp3__.data.downloadURL,
        mp4: mp4__.data.downloadURL
    }
}

async function mp3(input, quality = "m4a") {
  try {
    const id = getVideoId(input);
    if (!id) throw new Error('URL inválida');
    if (!CONFIG.FORMATS.AUDIO.includes(quality)) {
      throw new Error('Qualidade de áudio inválida');
    }
    
    // Verifica cache de metadados
    const cacheKey = `meta:${id}`;
    let meta;
    
    if (metadataCache.has(cacheKey)) {
      const cached = metadataCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 30 * 60 * 1000) {
        meta = cached.data;
      }
    }
    
    const url = `https://youtube.com/watch?v=${id}`;
    
    if (!meta) {
      meta = await yts(url);
      
      // Armazena no cache
      metadataCache.set(cacheKey, {
        data: meta,
        timestamp: Date.now()
      });
    }
    
    const result = await adonixytdl(url);
    
    if (!result.mp3) {
      throw new Error('Falha ao obter link de download do áudio');
    }
    
    const buffer = (await axios.get(result.mp3, {
      responseType: 'arraybuffer',
      timeout: 30000 // Timeout de 30 segundos
    })).data;

    return {
      ok: true,
      buffer: Buffer.from(buffer),
      filename: "download.mp3",
      quality: `${quality}kbps`,
      availableQuality: CONFIG.FORMATS.AUDIO
    };
  } catch (err) {
    return { ok: false, msg: 'Erro ao processar o áudio: ' + err.message };
  }
}

async function mp4(input, quality = "360") {
  try {
    const id = getVideoId(input);
    if (!id) throw new Error('URL inválida');
    if (!CONFIG.FORMATS.VIDEO.includes(quality)) {
      throw new Error('Qualidade de vídeo inválida');
    }
    
    // Verifica cache de metadados
    const cacheKey = `meta:${id}`;
    let meta;
    
    if (metadataCache.has(cacheKey)) {
      const cached = metadataCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 30 * 60 * 1000) {
        meta = cached.data;
      }
    }
    
    const url = `https://youtube.com/watch?v=${id}`;
      
    if (!meta) {
      meta = await yts(url);
      
      // Armazena no cache
      metadataCache.set(cacheKey, {
        data: meta,
        timestamp: Date.now()
      });
    }
    
    const result = await adonixytdl(url);
    
    if (!result.mp4) {
      throw new Error('Falha ao obter link de download do vídeo');
    }
    
    const buffer = (await axios.get(result.mp4, {
      responseType: 'arraybuffer',
      timeout: 30000 // Timeout de 30 segundos
    })).data;

    return {
      ok: true,
      buffer: Buffer.from(buffer),
      filename: "download.mp4",
      quality: `${quality}p`,
      availableQuality: CONFIG.FORMATS.VIDEO
    };
  } catch (err) {
    return { ok: false, msg: 'Erro ao processar o vídeo: ' + err.message };
  }
}

async function search(name) {
  try {
    // Verifica cache de busca
    const cacheKey = `search:${name}`;
    
    if (searchCache.has(cacheKey)) {
      const cached = searchCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 60 * 60 * 1000) { // 1 hora de cache
        return cached.data;
      }
    }
    
    return new Promise((resolve, reject) => {
      requestQueue.push(async () => {
        try {
          const searchRes = await yts(name);
          if (!searchRes.videos?.length) {
            resolve({ ok: false, msg: 'Não encontrei nenhuma música.' });
            return;
          }
          
          const result = { ok: true, criador: 'Hiudy', data: searchRes.videos[0] };
          
          // Armazena no cache
          searchCache.set(cacheKey, {
            data: result,
            timestamp: Date.now()
          });
          
          resolve(result);
        } catch (error) {
          reject({ ok: false, msg: 'Ocorreu um erro ao realizar a pesquisa.' });
        }
      });
      
      processRequestQueue();
    });
  } catch (error) {
    return { ok: false, msg: 'Ocorreu um erro ao realizar a pesquisa.' };
  }
}

export default {
  search: (text) => search(text),
  mp3: (url) => mp3(url),
  mp4: (url) => mp4(url)
};