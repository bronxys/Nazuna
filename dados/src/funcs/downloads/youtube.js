/**
 * Sistema de Download e Pesquisa YouTube Otimizado com OceanSaver
 * Adaptado por Hiudy
 * Versão: 4.0.0
 */

import axios from 'axios';
import yts from 'yt-search';
import { createDecipheriv } from 'crypto';
import { Readable } from 'stream';

// Configurações
const CONFIG = {
  FORMATS: {
    AUDIO: ['mp3', 'm4a', 'opus', 'webm'],
    VIDEO: ['144', '240', '360', '480', '720', '1080']
  }
};

function getVideoId(url) {
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|v\/|embed\/|user\/[^\/\n\s]+\/)?(?:watch\?v=|v%3D|embed%2F|video%2F)?|youtu\.be\/|youtube\.com\/watch\?v=|youtube\.com\/(?:embed|shorts)\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// OceanSaver implementation
const ytdl = {
  request: async (url, formatOrQuality) => {
    try {
      const encodedUrl = encodeURIComponent(url);
      const { data } = await axios.get(
        `https://p.oceansaver.in/ajax/download.php?format=${formatOrQuality}&url=${encodedUrl}`
      );

      if (!data.success || !data.id) {
        return { status: false, message: 'Failed to get task ID from OceanSaver' };
      }

      return {
        status: true,
        taskId: data.id,
        quality: formatOrQuality
      };
    } catch (error) {
      return { status: false, message: `Request error: ${error.message}` };
    }
  },

  convert: async (taskId) => {
    try {
      const { data } = await axios.get(
        `https://p.oceansaver.in/api/progress?id=${taskId}`
      );
      return data;
    } catch (error) {
      return { success: false, message: `Convert error: ${error.message}` };
    }
  },

  repeatRequest: async (taskId, quality) => {
    for (let i = 0; i < 20; i++) {
      const response = await ytdl.convert(taskId);
      if (response && response.download_url) {
        return {
          status: true,
          quality,
          url: response.download_url
        };
      }
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    return { status: false, message: 'Timeout waiting for download link' };
  },

  download: async (url, formatOrQuality) => {
    const init = await ytdl.request(url, formatOrQuality);
    if (!init.status) return init;

    return await ytdl.repeatRequest(init.taskId, init.quality);
  }
};

async function mp3(input, quality = "m4a") {
  try {
    const id = getVideoId(input);
    if (!id) throw new Error('URL inválida');
    if (!CONFIG.FORMATS.AUDIO.includes(quality)) {
      throw new Error('Qualidade de áudio inválida');
    }
    
    const url = `https://youtube.com/watch?v=${id}`;
    const meta = await yts(url);
    const result = await ytdl.download(url, 'mp3');
    
    if (!result.status) {
      throw new Error(result.message);
    }
    
    const buffer = (await axios.get(result.url, { responseType: 'arraybuffer' })).data;

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
    
    const url = `https://youtube.com/watch?v=${id}`;
    const meta = await yts(url);
    const result = await ytdl.download(url, quality.toString());
    
    if (!result.status) {
      throw new Error(result.message);
    }
    
    const buffer = (await axios.get(result.url, { responseType: 'arraybuffer' })).data;

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
    const searchRes = await yts(name);
    if (!searchRes.videos?.length) {
      return { ok: false, msg: 'Não encontrei nenhuma música.' };
    }
    return { ok: true, criador: 'Hiudy', data: searchRes.videos[0] };
  } catch (error) {
    return { ok: false, msg: 'Ocorreu um erro ao realizar a pesquisa.' };
  }
}

export default {
  search: (text) => search(text),
  mp3: (url) => mp3(url),
  mp4: (url) => mp4(url)
};