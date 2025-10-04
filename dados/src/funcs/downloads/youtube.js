/**
 * Download e Pesquisa YouTube usando API Cognima
 * Updated to use cog2.cognima.com.br API
 */

import axios from 'axios';
import { spawn } from 'child_process';
import { Readable } from 'stream';

// Função para verificar se a API key é válida
function isApiKeyError(error) {
  if (!error) return false;
  
  const errorMessage = (error.message || '').toLowerCase();
  const statusCode = error.response?.status;
  const responseData = error.response?.data;
  
  const authErrorCodes = [401, 403, 429];
  
  const keyErrorMessages = [
    'api key',
    'unauthorized',
    'invalid token',
    'authentication failed',
    'access denied',
    'quota exceeded',
    'rate limit',
    'forbidden',
    'token expired',
    'invalid credentials'
  ];
  
  if (authErrorCodes.includes(statusCode)) {
    return true;
  }
  
  if (keyErrorMessages.some(msg => errorMessage.includes(msg))) {
    return true;
  }
  
  if (responseData && typeof responseData === 'object') {
    const responseString = JSON.stringify(responseData).toLowerCase();
    if (keyErrorMessages.some(msg => responseString.includes(msg))) {
      return true;
    }
  }
  
  return false;
}

// Função para converter buffer usando FFmpeg
async function convertWithFFmpeg(inputBuffer, outputFormat, quality, isVideo = false) {
  return new Promise((resolve, reject) => {
    try {
      if (!Buffer.isBuffer(inputBuffer) || inputBuffer.length < 1000) {
        return reject(new Error('⚠️ Buffer inválido ou vazio — nada para converter.'));
      }

      const chunks = [];
      let ffmpegArgs;

      if (isVideo) {
        ffmpegArgs = [
          '-i', 'pipe:0',
          '-c:v', 'libx264',
          '-c:a', 'aac',
          '-preset', 'fast',
          '-crf', '23',
          '-vf', `scale=-2:${quality}`,
          '-movflags', '+faststart',
          '-f', 'mp4',
          'pipe:1'
        ];
      } else {
        ffmpegArgs = [
          '-i', 'pipe:0',
          '-c:a', 'libmp3lame',
          '-b:a', `${quality}k`,
          '-ar', '44100',
          '-ac', '2',
          '-f', 'mp3',
          'pipe:1'
        ];
      }

      const ffmpeg = spawn('ffmpeg', ffmpegArgs, { stdio: ['pipe', 'pipe', 'pipe'] });

      ffmpeg.stdout.on('data', chunk => chunks.push(chunk));

      ffmpeg.stderr.on('data', data => {
        // 🔍 Log útil para depuração (pode comentar depois)
        // console.log('[FFmpeg stderr]', data.toString());
      });

      ffmpeg.on('close', code => {
        if (code === 0) {
          return resolve(Buffer.concat(chunks));
        } else {
          return reject(new Error(`❌ FFmpeg terminou com código ${code}`));
        }
      });

      ffmpeg.on('error', err => {
        reject(new Error(`❌ Erro ao executar FFmpeg: ${err.message}`));
      });

      // 🧱 Tratamento de erro de pipe antes do EPIPE aparecer
      ffmpeg.stdin.on('error', err => {
        if (err.code === 'EPIPE') {
          reject(new Error('❌ EPIPE: O FFmpeg encerrou antes de receber todos os dados.'));
        } else {
          reject(new Error(`Erro no stdin do FFmpeg: ${err.message}`));
        }
      });

      // ✍️ Escreve o buffer e finaliza corretamente
      ffmpeg.stdin.write(inputBuffer);
      ffmpeg.stdin.end();

    } catch (err) {
      reject(err);
    }
  });
}

// Função para notificar o dono sobre problemas com a API key
async function notifyOwnerAboutApiKey(nazu, ownerNumber, error, command) {
  try {
    const message = `🚨 *ALERTA - API KEY INVÁLIDA* 🚨

⚠️ A API key do YouTube (Cognima) está com problemas:

*Comando:* ${command}
*Erro:* ${error || 'Chave inválida ou expirada'}
*Data:* ${new Date().toLocaleString('pt-BR')}

🔧 *Ações necessárias:*
• Verificar se a API key não expirou
• Confirmar se ainda há créditos na conta
• Verificar se a key está correta no config.json

💡 *Você pode entrar em contato para solicitar uma key gratuita com limite de 50 requests por dia ou comprar a ilimitada por R$15/mês!*

📞 *Contato:* wa.me/553399285117`;

    const ownerId = ownerNumber?.replace(/[^\d]/g, '') + '@s.whatsapp.net';
    await nazu.sendText(ownerId, message);
    
    console.log('📧 Notificação sobre API key enviada ao dono');
  } catch (notifyError) {
    console.error('❌ Erro ao notificar dono sobre API key:', notifyError.message);
  }
}

// Função para buscar vídeos no YouTube
async function search(query, apiKey) {
  try {
    if (!apiKey) {
      throw new Error('API key não fornecida');
    }

    const response = await axios.post('https://cog2.cognima.com.br/api/v1/youtube/search', {
      query: query
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      timeout: 30000
    });

    if (!response.data.success || !response.data.data) {
      throw new Error('Resposta inválida da API');
    }

    return {
      ok: true,
      criador: 'Hiudy',
      data: response.data.data.data
    };

  } catch (error) {
    console.error('Erro na busca YouTube:', error.message);
    
    if (isApiKeyError(error)) {
      throw new Error(`API key inválida ou expirada: ${error.response?.data?.message || error.message}`);
    }
    
    return { 
      ok: false, 
      msg: 'Erro ao buscar vídeo: ' + (error.response?.data?.message || error.message) 
    };
  }
}

// Função para baixar áudio (MP3) com conversão MPEG
async function mp3(url, quality = 128, apiKey) {
  try {
    if (!apiKey) {
      throw new Error('API key não fornecida');
    }

    const response = await axios.post('https://cog2.cognima.com.br/api/v1/youtube/mp3', {
      url: url,
      quality: quality
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      timeout: 60000,
      responseType: 'arraybuffer'
    });

    const rawBuffer = Buffer.from(response.data);
    
    // Converter com FFmpeg para garantir compatibilidade MPEG
    const convertedBuffer = await convertWithFFmpeg(rawBuffer, 'mp3', quality, false);
    
    return {
      ok: true,
      buffer: convertedBuffer,
      filename: `audio_${Date.now()}_${quality}kbps.mp3`,
      quality: `${quality}kbps`
    };

  } catch (error) {
    console.error('Erro no download MP3:', error);
    
    if (isApiKeyError(error)) {
      throw new Error(`API key inválida ou expirada: ${error.response?.data?.message || error.message}`);
    }
    
    return { 
      ok: false, 
      msg: 'Erro ao baixar áudio: ' + (error.response?.data?.message || error.message) 
    };
  }
}

// Função para baixar vídeo (MP4) com conversão
async function mp4(url, quality = 360, apiKey) {
  try {
    if (!apiKey) {
      throw new Error('API key não fornecida');
    }

    const response = await axios.post('https://cog2.cognima.com.br/api/v1/youtube/mp4', {
      url: url,
      quality: quality
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      timeout: 60000,
      responseType: 'arraybuffer'
    });

    const rawBuffer = Buffer.from(response.data);
    
    // Converter com FFmpeg para garantir compatibilidade
    const convertedBuffer = await convertWithFFmpeg(rawBuffer, 'mp4', quality, true);
    
    return {
      ok: true,
      buffer: convertedBuffer,
      filename: `video_${Date.now()}_${quality}p.mp4`,
      quality: `${quality}p`
    };

  } catch (error) {
    console.error('Erro no download MP4:', error.message);
    
    if (isApiKeyError(error)) {
      throw new Error(`API key inválida ou expirada: ${error.response?.data?.message || error.message}`);
    }
    
    return { 
      ok: false, 
      msg: 'Erro ao baixar vídeo: ' + (error.response?.data?.message || error.message) 
    };
  }
}

export default {
  search: (text, apiKey) => search(text, apiKey),
  mp3: (url, q, apiKey) => mp3(url, q, apiKey),
  mp4: (url, q, apiKey) => mp4(url, q, apiKey),
  ytmp3: (url, q, apiKey) => mp3(url, q, apiKey),
  ytmp4: (url, q, apiKey) => mp4(url, q, apiKey),
  notifyOwnerAboutApiKey
};