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
    'api key', 'unauthorized', 'invalid token', 'authentication failed',
    'access denied', 'quota exceeded', 'rate limit', 'forbidden',
    'token expired', 'invalid credentials'
  ];
  
  if (authErrorCodes.includes(statusCode)) return true;

  if (keyErrorMessages.some(msg => errorMessage.includes(msg))) return true;
  
  if (responseData && typeof responseData === 'object') {
    const responseString = JSON.stringify(responseData).toLowerCase();
    if (keyErrorMessages.some(msg => responseString.includes(msg))) return true;
  }
  
  return false;
}

// Notificação de API Key
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
• Verificar se a key está correta no config.json`;

    const ownerId = ownerNumber?.replace(/[^\d]/g, '') + '@s.whatsapp.net';
    await nazu.sendText(ownerId, message);
  } catch (notifyError) {
    console.error('❌ Erro ao notificar dono sobre API key:', notifyError.message);
  }
}

// Função para buscar vídeos no YouTube
async function search(query, apiKey) {
  try {
    if (!apiKey) throw new Error('API key não fornecida');

    const response = await axios.post('https://cog2.cognima.com.br/api/v1/youtube/search', {
      query: query
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      timeout: 120000, // ⏱️ Timeout aumentado para 2min
      maxContentLength: Infinity,
      maxBodyLength: Infinity
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

// Função para baixar áudio (MP3) com LOGS detalhados
async function mp3(url, quality = 128, apiKey) {
  console.log('🎧 [MP3] Iniciando função mp3()...');
  console.log(`🔍 [MP3] URL recebida: ${url}`);
  console.log(`🎚️ [MP3] Qualidade desejada: ${quality}kbps`);

  try {
    if (!apiKey) {
      console.log('❌ [MP3] Nenhuma API key fornecida!');
      throw new Error('API key não fornecida');
    }
    console.log('✅ [MP3] API key recebida com sucesso.');

    console.log('📡 [MP3] Enviando requisição para API Cognima...');
    const response = await axios.post(
      'https://cog2.cognima.com.br/api/v1/youtube/mp3',
      {
        url: url,
        quality: 'mp3'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        timeout: 120000, // ⏱️ 2min
        responseType: 'arraybuffer',
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    console.log('📥 [MP3] Resposta recebida da API!');
    console.log(`📏 [MP3] Tamanho do buffer recebido: ${response.data?.length || 0} bytes`);

    console.log('🔄 [MP3] Convertendo dados para Buffer...');
    const audioBuffer = Buffer.from(response.data);
    console.log('✅ [MP3] Buffer convertido com sucesso.');

    const filename = `audio_${Date.now()}_${quality}kbps.mp3`;
    console.log(`💾 [MP3] Nome do arquivo definido: ${filename}`);

    console.log('🏁 [MP3] Processo concluído com sucesso. Retornando resultado...');
    return {
      ok: true,
      buffer: audioBuffer,
      filename: filename,
      quality: `${quality}kbps`
    };

  } catch (error) {
    console.error('❌ [MP3] Erro no download MP3:', error.message);

    if (error.code === 'ECONNABORTED') {
      console.error('⏱️ [MP3] Timeout atingido ao tentar baixar o áudio.');
    }

    if (isApiKeyError(error)) {
      console.error('🔑 [MP3] Erro relacionado à API key detectado.');
      throw new Error(`API key inválida ou expirada: ${error.response?.data?.message || error.message}`);
    }

    console.error('📋 [MP3] Detalhes do erro:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data?.message || null
    });

    return {
      ok: false,
      msg: 'Erro ao baixar áudio: ' + (error.response?.data?.message || error.message)
    };
  }
}

// Função para baixar vídeo (MP4)
async function mp4(url, quality = 360, apiKey) {
  try {
    if (!apiKey) throw new Error('API key não fornecida');

    const response = await axios.post('https://cog2.cognima.com.br/api/v1/youtube/mp4', {
      url: url,
      quality: '360p'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      timeout: 120000, // ⏱️ 2min
      responseType: 'arraybuffer',
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    return {
      ok: true,
      buffer: Buffer.from(response.data),
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