import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

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

let apiKeyStatus = {
  isValid: true,
  lastError: null,
  notificationSent: false,
  lastCheck: Date.now()
};

let historico = {};

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

function updateApiKeyStatus(error = null) {
  if (error && isApiKeyError(error)) {
    apiKeyStatus.isValid = false;
    apiKeyStatus.lastError = error.message || 'Erro na API key';
    apiKeyStatus.lastCheck = Date.now();
    console.error('🔑 API Key inválida detectada:', apiKeyStatus.lastError);
    return false;
  } else if (!error) {
    const wasInvalid = !apiKeyStatus.isValid;
    apiKeyStatus.isValid = true;
    apiKeyStatus.lastError = null;
    apiKeyStatus.notificationSent = false;
    apiKeyStatus.lastCheck = Date.now();
    
    if (wasInvalid) {
      console.log('✅ API Key voltou a funcionar normalmente');
    }
    return true;
  }
  
  return apiKeyStatus.isValid;
}

function getApiKeyStatus() {
  return { ...apiKeyStatus };
}

async function notifyOwnerAboutApiKey(nazu, ownerLid, error) {
  // Verificar se pode enviar notificação
  if (!canSendNotification()) {
    // Se já atingiu o limite, enviar mensagem de limite apenas uma vez
    if (dailyNotifications.count === dailyNotifications.maxNotifications) {
      const limitMessage = `🔕 *LIMITE DE AVISOS ATINGIDO*

Já foram enviados ${dailyNotifications.maxNotifications} avisos sobre problemas com API key hoje.

Para evitar spam, não enviarei mais notificações até amanhã.

🔧 *Verifique a API key do Sistema IA (Cognima) quando possível.*`;

      const ownerId = ownerLid || (ownerNumber?.replace(/[^\d]/g, '') + '@s.whatsapp.net');
      await nazu.sendText(ownerId, limitMessage);
      incrementNotificationCount(); // Incrementa para não enviar novamente
    }
    return;
  }
  
  try {
    const message = `🚨 *ALERTA - PROBLEMA COM API KEY SISTEMA IA* 🚨

📋 *O que é API Key?*
Uma API Key é como uma "senha especial" que permite ao bot acessar os serviços de Inteligência Artificial através da plataforma Cognima. É necessária para conversas com IA e geração de imagens.

⚠️ *Problema detectado:*
• *Sistema afetado:* Inteligência Artificial (IA)
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

� *Como verificar:*
• Acesse: https://cog2.cognima.com.br/dashboard
• Verifique o status da sua API Key
• Confira quantas requisições restam

⚙️ *Para corrigir:*
• Use o comando: !apikey suachave
• Exemplo: !apikey ABC123XYZ789
• Reinicie o bot após configurar

💬 *Sistema de IA temporariamente desativado:*
• Usuários receberão mensagem informativa
• Reative a IA após corrigir a key
• Use o comando *!ia status* para verificar

💬 Você receberá no máximo 3 avisos por dia para evitar spam.`;

    const ownerId = ownerLid || (ownerNumber?.replace(/[^\d]/g, '') + '@s.whatsapp.net');
    await nazu.sendText(ownerId, message);
    
    // Incrementar contador após envio bem-sucedido
    incrementNotificationCount();
    apiKeyStatus.notificationSent = true;
    console.log('📧 Notificação sobre API key enviada ao dono');
  } catch (notifyError) {
    console.error('❌ Erro ao notificar dono sobre API key:', notifyError.message);
  }
}

function getCommandCode(command, indexPath) {
  try {
    return { codigo: (fs.readFileSync(indexPath, "utf-8").match(new RegExp(`case\\s*["'\`]${command}["'\`]\\s*:[\\s\\S]*?break\\s*;?`, "i")) || [])[0] }
  } catch (error) {
    console.error(`Erro ao ler comando ${command}:`, error);
    return null;
  }
}

const ASSISTANT_PROMPT = `
Você é a Nazuna Bot, uma assistente virtual inteligente e amigável, criada para ajudar em grupos de WhatsApp. Sua missão é conversar de forma natural, como se fosse uma pessoa, adaptando-se à língua, tom e estilo do usuário (ex.: gírias, formalidade, idioma). Você é sempre honesta sobre ser uma IA, mas responde com vibe humana.

---

### IDENTIDADE E PERSONALIDADE

**Quem você é:**
- Nazuna Bot: Assistente virtual especializada em WhatsApp
- IA conversacional com personalidade amigável, prestativa e transparente
- Focada em ser útil, eficiente e educativa

**Como você se comporta:**
- **Linguagem natural**: Usa a mesma língua e estilo do usuário (ex.: gírias brasileiras como "valeu", "beleza", "mano", "massa" se o contexto pedir)
- **Adaptável**: Ajusta o tom ao contexto (casual, formal, técnico, etc.)
- **Empática**: Responde às emoções do usuário com sensibilidade (ex.: "Nossa, entendi, deve tá osso!")
- **Inteligente**: Analisa opções antes de responder, escolhendo a melhor abordagem
- **Educativa**: Explica comandos ou informações só com base em dados reais

---

### ⚠️ REGRAS CRÍTICAS SOBRE COMANDOS ⚠️

**NUNCA INVENTE COMO UM COMANDO FUNCIONA!**

1. **Proibição de suposições**:
   - Não explique comandos sem consultar o código real
   - Não invente parâmetros, sintaxes ou funcionalidades
   - Se não souber, diga: "Vou precisar verificar o código desse comando pra te explicar direitinho!"

2. **Perguntas sobre comandos**:
   - Sempre use "analiseComandos" para obter o código real
   - Exemplo de resposta: "Deixa eu checar como esse comando funciona pra te explicar certinho..."
   - Só explique após receber e analisar o código

3. **Execução de comandos**:
   - Execute SOMENTE quando explicitamente pedido (ex.: "roda o comando X", "usa o comando Y")
   - Perguntas como "o que faz o comando X?" ou "como funciona Y?" NÃO são pedidos de execução
   - Informe o que está fazendo antes de executar (ex.: "Beleza, vou rodar o comando sticker agora...")

4. **Análise de comandos**:
   - Pode analisar comandos sem executá-los, mas só com base no código real
   - Explique funcionalidade, sintaxe, parâmetros e exemplos com base no código
   - Exemplos de perguntas que exigem análise:
     - "Como funciona o comando sticker?"
     - "Quais parâmetros o comando play aceita?"
     - "O que o comando menu faz?"
     - "Existe algum comando pra baixar vídeos?"

   - Exemplos de pedidos de execução:
     - "Executa o comando menu"
     - "Faz um sticker dessa foto"
     - "Roda o comando play com essa música"

---

### SISTEMA DE HISTÓRICO

Você recebe o histórico das conversas no formato:
\`\`\`
[
  { role: "user", content: "mensagem do usuário", name: "nome_usuario", timestamp: "data" },
  { role: "assistant", content: "sua resposta anterior" }
]
\`\`\`

Use o histórico para:
- Manter o contexto da conversa
- Entender referências a mensagens anteriores
- Adaptar respostas ao idioma, tom e estilo do usuário
- Personalizar interações com base no que já foi dito

---

### SISTEMA DE EXECUÇÃO DE COMANDOS

**Processo de Análise Inteligente:**

1. **Resposta Natural**: Priorize conversar naturalmente
   - A maioria das mensagens não exige comandos
   - Responda como uma pessoa, usando a língua e vibe do usuário
   - Use comandos só quando solicitado ou necessário

2. **Análise de Comandos**:
   - Quando perguntarem sobre comandos, use "analiseComandos": ["comando1", "comando2"]
   - Analise o código real antes de explicar
   - Explique:
     - O que o comando faz
     - Sintaxe exata
     - Parâmetros reais
     - Exemplos práticos
     - Limitações e requisitos

3. **Execução Consciente**:
   - Execute apenas quando explicitamente pedido
   - Informe o que está fazendo (ex.: "Tô rodando o comando play pra essa música...")
   - Use o campo "actions" para executar

---

### SISTEMA DE RESPOSTAS

**Estrutura de resposta**:
\`\`\`json
{
  "resp": [
    {
      "id": "id_mensagem",
      "resp": "sua resposta",
      "react": "emoji_opcional",
      "actions": {
        "comando": "nome_comando",
        "params": "parâmetros"
      }
    }
  ],
  "analiseComandos": ["cmd1", "cmd2"] // Use quando perguntarem sobre comandos
}
\`\`\`

**Quando responder**:
- Se a mensagem te menciona diretamente
- Se há uma pergunta ou solicitação clara
- Se você pode agregar valor à conversa
- Se alguém precisa de ajuda com comandos

**Quando NÃO responder**:
- Conversas privadas que não te envolvem
- Mensagens irrelevantes ou spam
- Quando sua resposta não adiciona nada útil

---

### PROCESSAMENTO DE INPUT

Você recebe:
- **comandos**: Lista de comandos disponíveis
- **mensagens**: Array com as mensagens atuais
- **historico**: Histórico da conversa (role/content)
- **commandInfos**: Códigos reais dos comandos (quando solicitado)

**Fluxo de decisão**:
1. Identifique a língua, tom e estilo do usuário
2. Responda na mesma língua e vibe
3. Se for sobre comandos:
   - Perguntas → Solicite "analiseComandos" e explique com base no código
   - Execução → Execute apenas se explicitamente pedido
4. Caso contrário, responda naturalmente, mantendo o contexto

---

### LEMBRETES FINAIS

- **Adapte-se ao usuário**: Use a mesma língua e estilo (ex.: português com gírias, inglês formal, espanhol casual, etc.)
- **Nunca invente**: Só explique comandos com base no código real
- **Execução consciente**: Só execute quando claramente solicitado
- **Naturalidade**: Converse como um amigo, não como um robô
- **Honestidade**: Se não souber, diga: "Vou verificar isso pra te responder certinho!"
- **Priorize contexto**: Use o histórico para respostas mais personalizadas

É melhor pedir pra verificar do que dar uma resposta errada!
`;

async function makeCognimaImageRequest(params, key) {
  if(!params) {
    throw new Error('Parâmetros obrigatórios ausentes: params');
  };
  
  if (!key) {
    throw new Error('API key não fornecida');
  };

  if (!apiKeyStatus.isValid) {
    const timeSinceLastCheck = Date.now() - apiKeyStatus.lastCheck;
    if (timeSinceLastCheck < 5 * 60 * 1000) {
      throw new Error(`API key inválida. Último erro: ${apiKeyStatus.lastError}`);
    }
  }
  
  try {
    const response = await axios.post('https://cog2.cognima.com.br/api/v1/generate', params, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': key
      }
    });
    
    updateApiKeyStatus();
    return response.data.data.data;
  } catch (error) {
    if (isApiKeyError(error)) {
      updateApiKeyStatus(error);
      throw new Error(`API key inválida ou expirada: ${error.response?.data?.message || error.message}`);
    }
    
    throw new Error(`Falha na requisição: ${error.message}`);
  };
};

async function makeCognimaRequest(modelo, texto, systemPrompt = null, key, historico = [], retries = 3) {
  if (!modelo || !texto) {
    throw new Error('Parâmetros obrigatórios ausentes: modelo e texto');
  }

  if (!key) {
    throw new Error('API key não fornecida');
  }

  if (!apiKeyStatus.isValid) {
    const timeSinceLastCheck = Date.now() - apiKeyStatus.lastCheck;
    if (timeSinceLastCheck < 5 * 60 * 1000) {
      throw new Error(`API key inválida. Último erro: ${apiKeyStatus.lastError}`);
    }
  }

  const messages = [];
  
  if (systemPrompt) {
    messages.push({ role: 'user', content: systemPrompt });
  }
  
  if (historico && historico.length > 0) {
    messages.push(...historico);
  }
  
  messages.push({ role: 'user', content: texto });

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await axios.post(
        `https://cog2.cognima.com.br/api/v1/completion`,
        {
          messages,
          model: modelo,
          temperature: 0.7,
          max_tokens: 2000
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': key
          },
          timeout: 30000
        }
      );

      if (!response.data.data || !response.data.data.choices || !response.data.data.choices[0]) {
        throw new Error('Resposta da API inválida');
      }

      updateApiKeyStatus();
      return response.data;

    } catch (error) {
      console.warn(`Tentativa ${attempt + 1} falhou:`, {
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
        key: key ? `${key.substring(0, 8)}...` : 'undefined'
      });

      if (isApiKeyError(error)) {
        updateApiKeyStatus(error);
        throw new Error(`API key inválida ou expirada: ${error.response?.data?.message || error.message}`);
      }

      if (attempt === retries - 1) {
        throw new Error(`Falha na requisição após ${retries} tentativas: ${error.message}`);
      }

      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
}

function cleanWhatsAppFormatting(texto) {
  if (!texto || typeof texto !== 'string') return texto;
  return texto
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '*$1*')
    .replace(/\*\*\*([^*]+)\*\*\*/g, '*$1*')
    .replace(/_{2,}([^_]+)_{2,}/g, '_$1_')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$2')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function extractJSON(content) {
  if (!content || typeof content !== 'string') {
    console.warn('Conteúdo inválido para extração de JSON, retornando objeto vazio.');
    return { resp: [{ resp: content }] };
  }

  let cleanContent = content.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();

  const jsonPatterns = [
    /{[\s\S]*}/,
    /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/,
    /^\s*\{[\s\S]*\}\s*$/m
  ];

  for (const pattern of jsonPatterns) {
    const match = cleanContent.match(pattern);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e) {
        continue;
      }
    }
  }

  console.error('Não foi possível extrair JSON válido da resposta. Conteúdo:', content);
  return { resp: [{ resp: cleanWhatsAppFormatting(content) || "Não entendi a resposta, pode tentar de novo?" }] };
}

function validateMessage(msg) {
  if (typeof msg === 'object' && msg !== null) {
    return {
      data_atual: msg.data_atual || new Date().toISOString(),
      data_mensagem: msg.data_mensagem || new Date().toISOString(),
      texto: String(msg.texto || '').trim(),
      id_enviou: String(msg.id_enviou || ''),
      nome_enviou: String(msg.nome_enviou || ''),
      id_grupo: String(msg.id_grupo || ''),
      nome_grupo: String(msg.nome_grupo || ''),
      tem_midia: Boolean(msg.tem_midia),
      marcou_mensagem: Boolean(msg.marcou_mensagem),
      marcou_sua_mensagem: Boolean(msg.marcou_sua_mensagem),
      mensagem_marcada: msg.mensagem_marcada || null,
      id_enviou_marcada: msg.id_enviou_marcada || null,
      tem_midia_marcada: Boolean(msg.tem_midia_marcada),
      id_mensagem: msg.id_mensagem || crypto.randomBytes(8).toString('hex')
    };
  }

  if (typeof msg === 'string') {
    const parts = msg.split('|');
    if (parts.length < 7) {
      throw new Error('Formato de mensagem inválido - poucos campos');
    }
    return {
      data_atual: parts[0] || new Date().toISOString(),
      data_mensagem: parts[1] || new Date().toISOString(),
      texto: String(parts[2] || '').trim(),
      id_enviou: String(parts[3] || ''),
      nome_enviou: String(parts[4] || ''),
      id_grupo: String(parts[5] || ''),
      nome_grupo: String(parts[6] || ''),
      tem_midia: parts[7] === 'true',
      marcou_mensagem: parts[8] === 'true',
      marcou_sua_mensagem: parts[9] === 'true',
      mensagem_marcada: parts[10] || null,
      id_enviou_marcada: parts[11] || null,
      tem_midia_marcada: parts[12] === 'true',
      id_mensagem: parts[13] || crypto.randomBytes(8).toString('hex')
    };
  }

  throw new Error('Formato de mensagem não suportado');
}

function updateHistorico(grupoUserId, role, content, nome = null) {
  if (!historico[grupoUserId]) {
    historico[grupoUserId] = [];
  }
  
  const entry = {
    role,
    content: cleanWhatsAppFormatting(content),
    timestamp: new Date().toISOString()
  };
  
  if (nome) {
    entry.name = nome;
  }
  
  historico[grupoUserId].push(entry);
  
  if (historico[grupoUserId].length > 4) {
    historico[grupoUserId] = historico[grupoUserId].slice(-4);
  }
}

async function processUserMessages(data, indexPath, key, nazu = null, ownerNumber = null) {
  try {
    const { mensagens } = data;
    if (!mensagens || !Array.isArray(mensagens)) {
      throw new Error('Mensagens são obrigatórias e devem ser um array');
    }

    if (!key) {
      throw new Error('API key não fornecida');
    }

    if (!apiKeyStatus.isValid) {
      return { 
        resp: [], 
        erro: 'Sistema de IA temporariamente desativado',
        apiKeyInvalid: true,
        message: 'API key inválida ou expirada. Entre em contato com o administrador.'
      };
    }

    let comandos = [];
    try {
      const fileContent = fs.readFileSync(indexPath, 'utf-8');
      const caseMatches = [...fileContent.matchAll(/case\s+['"`]([^'"`]+)['"`]/g)];
      comandos = [...new Set(caseMatches.map(m => m[1]))].sort();
    } catch (error) {
      console.warn('Aviso: Erro ao ler comandos do arquivo:', error.message);
      comandos = [];
    }

    const mensagensValidadas = [];
    for (let i = 0; i < mensagens.length; i++) {
      try {
        const msgValidada = validateMessage(mensagens[i]);
        mensagensValidadas.push(msgValidada);
      } catch (msgError) {
        console.warn(`Erro ao processar mensagem ${i}:`, msgError.message);
        continue;
      }
    }

    if (mensagensValidadas.length === 0) {
      return { resp: [], erro: 'Nenhuma mensagem válida para processar' };
    }

    const respostas = [];
    
    for (const msgValidada of mensagensValidadas) {
      const grupoUserId = `${msgValidada.id_grupo}_${msgValidada.id_enviou}`;
      
      updateHistorico(grupoUserId, 'user', msgValidada.texto, msgValidada.nome_enviou);
      
      const userInput = {
        comandos,
        mensagens: [msgValidada],
        historico: historico[grupoUserId] || []
      };

      let result;
      try {
        const response = (await makeCognimaRequest(
          'qwen/qwen3-235b-a22b', 
          JSON.stringify(userInput), 
          ASSISTANT_PROMPT,
          key,
          historico[grupoUserId] || []
        )).data;

        if (!response || !response.choices || !response.choices[0]) {
          throw new Error("Resposta da API Cognima foi inválida ou vazia na primeira chamada.");
        }

        const content = response.choices[0].message.content;
        result = extractJSON(content);

        if (result.analiseComandos && Array.isArray(result.analiseComandos) && result.analiseComandos.length > 0) {
          const commandInfos = result.analiseComandos.map(cmd => {
            const info = getCommandCode(cmd, indexPath);
            return {
              comando: cmd,
              disponivel: info !== null,
              codigo: info?.codigo || 'Comando não encontrado ou erro na leitura.'
            };
          });

          const enhancedInput = {
            ...userInput,
            commandInfos,
            solicitacaoAnalise: true
          };

          const secondResponse = (await makeCognimaRequest(
            'qwen/qwen3-235b-a22b',
            JSON.stringify(enhancedInput),
            ASSISTANT_PROMPT,
            key,
            historico[grupoUserId] || []
          )).data;

          if (secondResponse && secondResponse.choices && secondResponse.choices[0]) {
            const secondContent = secondResponse.choices[0].message.content;
            result = extractJSON(secondContent);
          }
        }

        if (result.resp && Array.isArray(result.resp)) {
          result.resp.forEach(resposta => {
            if (resposta.resp) {
              resposta.resp = cleanWhatsAppFormatting(resposta.resp);
              updateHistorico(grupoUserId, 'assistant', resposta.resp);
            }
          });
          
          respostas.push(...result.resp);
        }
      } catch (apiError) {
        console.error('Erro na API Cognima:', apiError.message);
        
        // Se é erro de API key, notifica o dono
        if (isApiKeyError(apiError) && nazu && ownerNumber) {
          await notifyOwnerAboutApiKey(nazu, ownerNumber, apiError.message);
          
          return { 
            resp: [], 
            erro: 'Sistema de IA temporariamente desativado',
            apiKeyInvalid: true,
            message: '🤖 *Sistema de IA temporariamente indisponível*\n\n😅 Estou com problemas técnicos no momento. O administrador já foi notificado!\n\n⏰ Tente novamente em alguns minutos.'
          };
        }
        
        // Para outros erros, retorna mensagem genérica
        return { 
          resp: [], 
          erro: 'Erro temporário na IA',
          message: '🤖 Ops! Estou com um probleminha técnico. Tente novamente em instantes!'
        };
      }
    }

    return { resp: respostas };

  } catch (error) {
    console.error('Erro fatal ao processar mensagens:', error);
    return { 
      resp: [], 
      erro: 'Erro interno do processamento',
      detalhes: error.message 
    };
  }
}

async function Shazam(buffer, api_token, filename = "audio.mp3") {
  if (!api_token) {
    return { error: true, message: "API token do Shazam (audd.io) não fornecido." };
  }
  const boundary = "----AudDBoundary" + crypto.randomBytes(16).toString("hex");
  const CRLF = "\r\n";

  const payloadParts = [];
  payloadParts.push(`--${boundary}${CRLF}Content-Disposition: form-data; name="api_token"${CRLF}${CRLF}${api_token}`);
  payloadParts.push(`--${boundary}${CRLF}Content-Disposition: form-data; name="return"${CRLF}${CRLF}timecode,apple_music,spotify,deezer,lyrics`);
  payloadParts.push(
    `--${boundary}${CRLF}Content-Disposition: form-data; name="file"; filename="${filename}"${CRLF}Content-Type: audio/mpeg${CRLF}${CRLF}`
  );

  const preBuffer = Buffer.from(payloadParts.join(CRLF), "utf-8");
  const postBuffer = Buffer.from(`${CRLF}--${boundary}--${CRLF}`, "utf-8");
  const finalBody = Buffer.concat([preBuffer, buffer, postBuffer]);

  try {
    const response = await axios.post("https://api.audd.io/", finalBody, {
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": finalBody.length,
      },
      timeout: 15000
    });
    return response.data;
  } catch (err) {
    return {
      error: true,
      status: err.response?.status,
      message: err.response?.data || err.message,
    };
  }
}

function getHistoricoStats() {
  const stats = {
    totalConversas: Object.keys(historico).length,
    conversasAtivas: 0,
    totalMensagens: 0
  };
  
  const now = Date.now();
  const hourAgo = now - (60 * 60 * 1000);
  
  Object.values(historico).forEach(conversa => {
    stats.totalMensagens += conversa.length;
    const lastMsg = conversa[conversa.length - 1];
    if (lastMsg && new Date(lastMsg.timestamp).getTime() > hourAgo) {
      stats.conversasAtivas++;
    }
  });
  
  return stats;
}

function clearOldHistorico(maxAge = 24 * 60 * 60 * 1000) {
  const now = Date.now();
  
  Object.keys(historico).forEach(grupoUserId => {
    const conversa = historico[grupoUserId];
    if (conversa.length > 0) {
      const lastMsg = conversa[conversa.length - 1];
      const lastMsgTime = new Date(lastMsg.timestamp).getTime();
      
      if (now - lastMsgTime > maxAge) {
        delete historico[grupoUserId];
      }
    }
  });
}

export default {
  makeAssistentRequest: processUserMessages,
  makeCognimaRequest,
  makeCognimaImageRequest,
  Shazam,
  getHistoricoStats,
  clearOldHistorico,
  getApiKeyStatus,
  updateApiKeyStatus,
  notifyOwnerAboutApiKey
};