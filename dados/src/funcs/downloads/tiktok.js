/**
 * Sistema de Download e Pesquisa TikTok Otimizado
 * Desenvolvido por Hiudy
 * Versão: 2.0.0 - Otimizada
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
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Referer': 'https://www.tikwm.com/',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Linux"'
      }
    }
  },
  SEARCH: {
    MAX_RESULTS: 5,
    DEFAULT_CURSOR: 0,
    HD_QUALITY: 1
  },
  CACHE: {
    MAX_SIZE: 500, // Reduzido para economizar memória
    EXPIRE_TIME: 30 * 60 * 1000 // 30 minutos
  },
  RETRY: {
    MAX_ATTEMPTS: 3,
    DELAY: 1000
  },
  RATE_LIMIT: {
    REQUESTS_PER_MINUTE: 30,
    MAX_CONCURRENT_REQUESTS: 2
  }
};

// Fila de requisições e controle de taxa
const requestQueue = [];
let isProcessingQueue = false;
let requestCount = 0;
let lastResetTime = Date.now();

// Cache para resultados com limpeza automática
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
      // Remove entradas antigas
      const keysToDelete = Array.from(this.cache.keys())
        .slice(0, Math.floor(CONFIG.CACHE.MAX_SIZE * 0.2)); // Remove 20% mais antigo
      keysToDelete.forEach(key => this.cache.delete(key));
    }

    const key = this.getKey(type, input);
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  // Método para limpar cache manualmente
  clear() {
    this.cache.clear();
  }
}

/**
 * Controla o rate limiting das requisições
 */
function checkRateLimit() {
  const now = Date.now();
  if (now - lastResetTime >= 60000) { // Reset a cada minuto
    requestCount = 0;
    lastResetTime = now;
  }
  
  if (requestCount >= CONFIG.RATE_LIMIT.REQUESTS_PER_MINUTE) {
    const waitTime = 60000 - (now - lastResetTime);
    throw new Error(`Limite de requisições atingido. Tente novamente em ${Math.ceil(waitTime / 1000)} segundos`);
  }
  
  requestCount++;
}

/**
 * Processa a fila de requisições para evitar sobrecarga
 */
async function processRequestQueue() {
  if (isProcessingQueue || requestQueue.length === 0) return;
  
  isProcessingQueue = true;
  
  try {
    // Processa até 2 requisições por vez
    const batchSize = Math.min(CONFIG.RATE_LIMIT.MAX_CONCURRENT_REQUESTS, requestQueue.length);
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

// Cliente da API TikTok
class TikTokClient {
  constructor() {
    this.axios = axios.create({
      baseURL: CONFIG.API.TIKWM.BASE_URL,
      timeout: CONFIG.API.TIKWM.TIMEOUT,
      headers: CONFIG.API.TIKWM.HEADERS,
      httpAgent: {
        keepAlive: true,
        maxSockets: 20,
        maxFreeSockets: 5,
        timeout: 30000
      }
    });
  }

  async request(config, attempt = 1) {
    try {
      checkRateLimit();
      const response = await this.axios.request(config);
      return response.data;
    } catch (error) {
      if (attempt < CONFIG.RETRY.MAX_ATTEMPTS) {
        // Backoff exponencial
        const delay = CONFIG.RETRY.DELAY * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
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
    return new Promise((resolve, reject) => {
      requestQueue.push(async () => {
        try {
          const data = await this.request({
            method: 'GET',
            url: '/',
            params: { url }
          });

          if (!data?.data) {
            throw new Error('Dados inválidos recebidos da API');
          }

          resolve(this.formatDownloadResponse(data.data));
        } catch (error) {
          reject(error);
        }
      });
      
      processRequestQueue();
    });
  }

  async search(keywords) {
    return new Promise((resolve, reject) => {
      requestQueue.push(async () => {
        try {
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

          resolve(data.data.videos);
        } catch (error) {
          reject(error);
        }
      });
      
      processRequestQueue();
    });
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

    // Realiza download com tratamento de erro robusto
    const result = await client.download(url).catch(error => {
      throw new Error(`Falha no download: ${error.message}`);
    });
    
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

    // Realiza pesquisa com tratamento de erro robusto
    const videos = await client.search(name).catch(error => {
      throw new Error(`Falha na pesquisa: ${error.message}`);
    });
    
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

/**
 * Limpa o cache manualmente (útil para liberação de memória)
 */
function clearTikTokCache() {
  cache.clear();
}

export default {
  dl: (url) => tiktok(url),
  search: (text) => tiktokSearch(text),
  clearCache: clearTikTokCache
};