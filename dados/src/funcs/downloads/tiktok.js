/**
 * Sistema de Download e Pesquisa TikTok Otimizado
 * Desenvolvido por Hiudy
 * Versão: 2.0.0
 */

import axios from 'axios';

// Configurações
const CONFIG = {
  API: {
    TIKWM: {
      BASE_URL: 'https://www.tikwm.com/api',
      TIMEOUT: 30000,
      HEADERS: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Cookie': 'current_language=pt-BR',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36'
      }
    }
  },
  SEARCH: {
    MAX_RESULTS: 5,
    DEFAULT_CURSOR: 0,
    HD_QUALITY: 1
  },
  CACHE: {
    MAX_SIZE: 1000,
    EXPIRE_TIME: 30 * 60 * 1000 // 30 minutos
  },
  RETRY: {
    MAX_ATTEMPTS: 3,
    DELAY: 1000
  }
};

// Cache para resultados
class TikTokCache {
  constructor() {
    this.cache = new Map();
  }

  getKey(type, input) {
    return `${type}:${input}`;
  }

  get(type, input) {
    const key = this.getKey(type, input);
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > CONFIG.CACHE.EXPIRE_TIME) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  set(type, input, data) {
    if (this.cache.size >= CONFIG.CACHE.MAX_SIZE) {
      const oldestKey = Array.from(this.cache.keys())[0];
      this.cache.delete(oldestKey);
    }

    const key = this.getKey(type, input);
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
}

// Cliente da API TikTok
class TikTokClient {
  constructor() {
    this.axios = axios.create({
      baseURL: CONFIG.API.TIKWM.BASE_URL,
      timeout: CONFIG.API.TIKWM.TIMEOUT,
      headers: CONFIG.API.TIKWM.HEADERS
    });
  }

  async request(config, attempt = 1) {
    try {
      const response = await this.axios.request(config);
      return response.data;
    } catch (error) {
      if (attempt < CONFIG.RETRY.MAX_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY.DELAY * attempt));
        return this.request(config, attempt + 1);
      }
      throw this.formatError(error);
    }
  }

  formatError(error) {
    const message = error.response?.data?.message || error.message;
    return new Error(`Erro na API TikTok: ${message}`);
  }

  async download(url) {
    const data = await this.request({
      method: 'GET',
      url: '/',
      params: { url }
    });

    if (!data?.data) {
      throw new Error('Dados inválidos recebidos da API');
    }

    return this.formatDownloadResponse(data.data);
  }

  async search(keywords) {
    const data = await this.request({
      method: 'POST',
      url: '/feed/search',
      data: {
        keywords,
        count: CONFIG.SEARCH.MAX_RESULTS,
        cursor: CONFIG.SEARCH.DEFAULT_CURSOR,
        HD: CONFIG.SEARCH.HD_QUALITY
      }
    });

    if (!data?.data?.videos?.length) {
      throw new Error('Nenhum vídeo encontrado');
    }

    return data.data.videos;
  }

  formatDownloadResponse(data) {
    const response = {
      ok: true,
      criador: 'Hiudy'
    };

    if (data.music_info?.play) {
      response.audio = data.music_info.play;
    }

    if (data.images) {
      response.type = 'image';
      response.mime = '';
      response.urls = data.images;
    } else {
      response.type = 'video';
      response.mime = 'video/mp4';
      response.urls = [data.play];
    }

    if (data.title) {
      response.title = data.title;
    }

    return response;
  }
}

// Cache e cliente instanciados uma única vez
const cache = new TikTokCache();
const client = new TikTokClient();

/**
 * Download de conteúdo do TikTok
 * @param {string} url - URL do TikTok
 * @returns {Promise<Object>} Informações do download
 */
async function tiktok(url) {
  try {
    // Valida URL
    if (!url || typeof url !== 'string') {
      throw new Error('URL inválida');
    }

    // Verifica cache
    const cached = cache.get('download', url);
    if (cached) return cached;

    // Realiza download
    const result = await client.download(url);
    
    // Salva no cache
    cache.set('download', url, result);
    
    return result;
  } catch (error) {
    console.error('Erro no download TikTok:', error);
    return {
      ok: false,
      msg: 'Ocorreu um erro ao realizar o download'
    };
  }
}

/**
 * Pesquisa conteúdo no TikTok
 * @param {string} name - Termo de pesquisa
 * @returns {Promise<Object>} Resultados da pesquisa
 */
async function tiktokSearch(name) {
  try {
    // Valida termo de pesquisa
    if (!name || typeof name !== 'string') {
      throw new Error('Termo de pesquisa inválido');
    }

    // Verifica cache
    const cached = cache.get('search', name);
    if (cached) return cached;

    // Realiza pesquisa
    const videos = await client.search(name);
    
    // Seleciona vídeo aleatório
    const randomVideo = videos[Math.floor(Math.random() * videos.length)];
    
    const result = {
      ok: true,
      criador: 'Hiudy',
      title: randomVideo.title,
      urls: [randomVideo.play],
      type: 'video',
      mime: 'video/mp4',
      audio: randomVideo.music
    };

    // Salva no cache
    cache.set('search', name, result);
    
    return result;
  } catch (error) {
    console.error('Erro na pesquisa TikTok:', error);
    return {
      ok: false,
      msg: 'Ocorreu um erro ao realizar a pesquisa'
    };
  }
}

export default {
  dl: (url) => tiktok(url),
  search: (text) => tiktokSearch(text)
};