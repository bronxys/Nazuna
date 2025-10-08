/**
 * Download e Pesquisa TikTok usando API Cognima
 * Updated to use cog2.cognima.com.br API
 */

import axios from 'axios';

const dailyNotifications = {
  count: 0,
  date: null,
  maxNotifications: 3
};

function canSendNotification() {
  const today = new Date().toDateString();
  
  if (dailyNotifications.date !== today) {
    dailyNotifications.count = 0;
    dailyNotifications.date = today;
  }
  
  return dailyNotifications.count < dailyNotifications.maxNotifications;
}

function incrementNotificationCount() {
  dailyNotifications.count++;
}

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
    // Verificar se pode enviar notificação
    if (!canSendNotification()) {
      // Se já atingiu o limite, enviar mensagem de limite apenas uma vez
      if (dailyNotifications.count === dailyNotifications.maxNotifications) {
        const limitMessage = `🔕 *LIMITE DE AVISOS ATINGIDO*

Já foram enviados ${dailyNotifications.maxNotifications} avisos sobre problemas com API key hoje.

Para evitar spam, não enviarei mais notificações até amanhã.

🔧 *Verifique a API key do TikTok (Cognima) quando possível.*`;

        const ownerId = ownerNumber?.replace(/[^\d]/g, '') + '@s.whatsapp.net';
        await nazu.sendText(ownerId, limitMessage);
        incrementNotificationCount(); // Incrementa para não enviar novamente
      }
      return;
    }

    const message = `🚨 *ALERTA - PROBLEMA COM API KEY TIKTOK* 🚨

📋 *O que é API Key?*
Uma API Key é como uma "senha especial" que permite ao bot acessar os serviços do TikTok através da plataforma Cognima. É necessária para baixar vídeos e áudios.

⚠️ *Problema detectado:*
• *Comando afetado:* ${command}
• *Erro específico:* ${error || 'Chave inválida ou expirada'}
• *Data/Hora:* ${new Date().toLocaleString('pt-BR')}
• *Aviso:* ${dailyNotifications.count + 1}/${dailyNotifications.maxNotifications} de hoje

� *Informações da API Cognima:*
• Oferece 150 requisições GRATUITAS por dia
• Após esgotar, é necessário adquirir um plano pago
• Para adquirir: wa.me/553399285117
• Painel: https://cog2.cognima.com.br

🔧 *Possíveis causas e soluções:*
1️⃣ *API Key expirada* → Renovar no painel Cognima
2️⃣ *Limite de 150 requisições esgotado* → Aguardar próximo dia ou adquirir via WhatsApp
3️⃣ *Chave incorreta* → Verificar se está correta no config.json
4️⃣ *Problema temporário do servidor* → Aguardar alguns minutos

📊 *Como verificar:*
• Acesse: https://cog2.cognima.com.br/dashboard
• Verifique o status da sua API Key
• Confira quantas requisições restam

⚙️ *Para corrigir:*
• Use o comando: !apikey suachave
• Exemplo: !apikey ABC123XYZ789
• Reinicie o bot após configurar

💬 Você receberá no máximo 3 avisos por dia para evitar spam.`;

    const ownerId = ownerNumber?.replace(/[^\d]/g, '') + '@s.whatsapp.net';
    await nazu.sendText(ownerId, message);
    
    // Incrementar contador após envio bem-sucedido
    incrementNotificationCount();
    
    console.log('📧 Notificação sobre API key enviada ao dono');
  } catch (notifyError) {
    console.error('❌ Erro ao notificar dono sobre API key:', notifyError.message);
  }
}

// Função para pesquisar vídeos no TikTok
async function tiktokSearch(query, apiKey) {
  try {
    if (!apiKey) {
      throw new Error('API key não fornecida');
    }

    const response = await axios.post('https://cog2.cognima.com.br/api/v1/tiktok/search', {
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
      title: response.data.data.title,
      urls: response.data.data.urls,
      type: response.data.data.type,
      mime: response.data.data.mime,
      audio: response.data.data.audio
    };

  } catch (error) {
    console.error('Erro na pesquisa TikTok:', error.message);
    
    if (isApiKeyError(error)) {
      throw new Error(`API key inválida ou expirada: ${error.response?.data?.message || error.message}`);
    }
    
    return { 
      ok: false, 
      msg: 'Erro ao pesquisar vídeo: ' + (error.response?.data?.message || error.message) 
    };
  }
}

// Função para baixar vídeo do TikTok
async function tiktokDownload(url, apiKey) {
  try {
    if (!apiKey) {
      throw new Error('API key não fornecida');
    }

    const response = await axios.post('https://cog2.cognima.com.br/api/v1/tiktok/download', {
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

    return {
      ok: true,
      criador: 'Hiudy',
      title: response.data.data.title,
      urls: response.data.data.urls,
      type: response.data.data.type,
      mime: response.data.data.mime,
      audio: response.data.data.audio
    };

  } catch (error) {
    console.error('Erro no download TikTok:', error.message);
    
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
  dl: (url, apiKey) => tiktokDownload(url, apiKey),
  search: (text, apiKey) => tiktokSearch(text, apiKey),
  notifyOwnerAboutApiKey
};