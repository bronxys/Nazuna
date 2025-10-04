/**
 * Download Instagram usando API Cognima
 * Updated to use cog2.cognima.com.br API
 */

import axios from 'axios';

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

// Função para notificar o dono sobre problemas com a API key
async function notifyOwnerAboutApiKey(nazu, ownerNumber, error, command) {
  try {
    const message = `🚨 *ALERTA - API KEY INVÁLIDA* 🚨

⚠️ A API key do Instagram (Cognima) está com problemas:

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

// Função para baixar post do Instagram
async function igdl(url, apiKey) {
  try {
    if (!apiKey) {
      throw new Error('API key não fornecida');
    }

    const response = await axios.post('https://cog2.cognima.com.br/api/v1/instagram/download', {
      url: url
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

    const apiData = response.data.data;
    
    // Processar os dados para baixar os buffers
    const results = [];
    
    if (apiData.media && Array.isArray(apiData.media)) {
      for (const mediaItem of apiData.media) {
        try {
          // Baixar o conteúdo da mídia
          const mediaResponse = await axios.get(mediaItem.url, { 
            responseType: 'arraybuffer',
            timeout: 60000
          });
          
          results.push({
            type: mediaItem.type || 'image', // 'video' ou 'image'
            buff: mediaResponse.data,
            url: mediaItem.url,
            mime: mediaItem.mime || 'application/octet-stream'
          });
        } catch (downloadError) {
          console.error('Erro ao baixar mídia do Instagram:', downloadError.message);
          // Continua com as outras mídias mesmo se uma falhar
        }
      }
    }

    if (results.length === 0) {
      throw new Error('Nenhuma mídia foi baixada com sucesso');
    }

    return {
      ok: true,
      criador: 'Hiudy',
      data: results,
      count: apiData.count || results.length
    };

  } catch (error) {
    console.error('Erro no download Instagram:', error.message);
    
    if (isApiKeyError(error)) {
      throw new Error(`API key inválida ou expirada: ${error.response?.data?.message || error.message}`);
    }
    
    return { 
      ok: false, 
      msg: 'Erro ao baixar post: ' + (error.response?.data?.message || error.message) 
    };
  }
}

export default {
  dl: (url, apiKey) => igdl(url, apiKey),
  notifyOwnerAboutApiKey
};