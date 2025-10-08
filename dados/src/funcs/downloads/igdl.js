/**
 * Download Instagram usando API Cognima
 * Updated to use cog2.cognima.com.br API
 */

import axios from 'axios';

// Sistema de cache para controlar avisos diários de API key
const dailyNotifications = {
  count: 0,
  date: null,
  maxNotifications: 3
};

// Função para verificar se pode enviar notificação
function canSendNotification() {
  const today = new Date().toDateString();
  
  // Reset contador se mudou o dia
  if (dailyNotifications.date !== today) {
    dailyNotifications.count = 0;
    dailyNotifications.date = today;
  }
  
  return dailyNotifications.count < dailyNotifications.maxNotifications;
}

// Função para incrementar contador de notificações
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
        const limitMessage = `� *LIMITE DE AVISOS ATINGIDO*

Já foram enviados ${dailyNotifications.maxNotifications} avisos sobre problemas com API key hoje.

Para evitar spam, não enviarei mais notificações até amanhã.

🔧 *Verifique a API key do Instagram (Cognima) quando possível.*`;

        const ownerId = ownerNumber?.replace(/[^\d]/g, '') + '@s.whatsapp.net';
        await nazu.sendText(ownerId, limitMessage);
        incrementNotificationCount(); // Incrementa para não enviar novamente
      }
      return;
    }

    const message = `�🚨 *ALERTA - PROBLEMA COM API KEY INSTAGRAM* 🚨

📋 *O que é API Key?*
Uma API Key é como uma "senha especial" que permite ao bot acessar os serviços do Instagram através da plataforma Cognima. É necessária para baixar fotos e vídeos.

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