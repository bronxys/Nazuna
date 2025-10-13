#!/usr/bin/env node

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { spawn, execSync } from 'child_process';
import readline from 'readline/promises';
import os from 'os';
import { performance } from 'perf_hooks';

const CONFIG_PATH = path.join(process.cwd(), 'dados', 'src', 'config.json');
const NODE_MODULES_PATH = path.join(process.cwd(), 'node_modules');
const QR_CODE_DIR = path.join(process.cwd(), 'dados', 'database', 'qr-code');
const CONNECT_FILE = path.join(process.cwd(), 'dados', 'src', 'connect.js');
const isWindows = os.platform() === 'win32';
const isTermux = fsSync.existsSync('/data/data/com.termux');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[1;32m',
  red: '\x1b[1;31m',
  blue: '\x1b[1;34m',
  yellow: '\x1b[1;33m',
  cyan: '\x1b[1;36m',
  bold: '\x1b[1m',
};

// Enhanced logging with timestamps
const logger = {
  info: (text) => console.log(`${colors.cyan}[${new Date().toISOString()}]${colors.reset} ${text}`),
  success: (text) => console.log(`${colors.green}[${new Date().toISOString()}]${colors.reset} ${text}`),
  warning: (text) => console.log(`${colors.yellow}[${new Date().toISOString()}]${colors.reset} ${text}`),
  error: (text) => console.log(`${colors.red}[${new Date().toISOString()}]${colors.reset} ${text}`),
  debug: (text) => process.env.DEBUG === 'true' && console.log(`${colors.cyan}[DEBUG]${colors.reset} ${text}`),
};

const mensagem = (text) => logger.success(text);
const aviso = (text) => logger.error(text);
const info = (text) => logger.info(text);
const separador = () => console.log(`${colors.blue}============================================${colors.reset}`);

const getVersion = () => {
  try {
    const packageJson = JSON.parse(fsSync.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
    return packageJson.version || 'Desconhecida';
  } catch (error) {
    logger.warning(`Não foi possível obter a versão: ${error.message}`);
    return 'Desconhecida';
  }
};

let botProcess = null;
let restartCount = 0;
const MAX_RESTARTS = 5;
const RESTART_DELAY = 5000; // 5 seconds
const version = getVersion();

// System monitoring
const getSystemResources = () => {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = (usedMemory / totalMemory) * 100;
  
  return {
    memoryUsage: memoryUsage.toFixed(2),
    freeMemory: Math.round(freeMemory / 1024 / 1024),
    uptime: process.uptime(),
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
  };
};

async function setupTermuxAutostart() {
  if (!isTermux) {
    info('📱 Não está rodando no Termux. Ignorando configuração de autostart.');
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await rl.question(`${colors.yellow}📱 Detectado ambiente Termux. Deseja configurar inicialização automática? (s/n): ${colors.reset}`);
  rl.close();

  if (answer.trim().toLowerCase() !== 's') {
    info('📱 Configuração de autostart ignorada pelo usuário.');
    return;
  }

  info('📱 Configurando inicialização automática no Termux...');

  try {
    const termuxProperties = path.join(process.env.HOME, '.termux', 'termux.properties');
    await fs.mkdir(path.dirname(termuxProperties), { recursive: true });
    if (!fsSync.existsSync(termuxProperties)) {
      await fs.writeFile(termuxProperties, '');
    }
    execSync(`sed '/^# *allow-external-apps *= *true/s/^# *//' ${termuxProperties} -i && termux-reload-settings`, { stdio: 'inherit' });
    mensagem('📝 Configuração de termux.properties concluída.');

    const bashrcPath = path.join(process.env.HOME, '.bashrc');
    const termuxServiceCommand = `
am startservice --user 0 \\
  -n com.termux/com.termux.app.RunCommandService \\
  -a com.termux.RUN_COMMAND \\
  --es com.termux.RUN_COMMAND_PATH '/data/data/com.termux/files/usr/bin/npm' \\
  --esa com.termux.RUN_COMMAND_ARGUMENTS 'start' \\
  --es com.termux.RUN_COMMAND_SESSION_NAME 'Nazuna Bot' \\
  --es com.termux.RUN_COMMAND_WORKDIR '${path.join(process.cwd())}' \\
  --ez com.termux.RUN_COMMAND_BACKGROUND 'false' \\
  --es com.termux.RUN_COMMAND_SESSION_ACTION '0'
`.trim();

    let bashrcContent = '';
    if (fsSync.existsSync(bashrcPath)) {
      bashrcContent = await fs.readFile(bashrcPath, 'utf8');
    }

    if (!bashrcContent.includes(termuxServiceCommand)) {
      await fs.appendFile(bashrcPath, `\n${termuxServiceCommand}\n`);
      mensagem('📝 Comando am startservice adicionado ao ~/.bashrc');
    } else {
      info('📝 Comando am startservice já presente no ~/.bashrc');
    }

    mensagem('📱 Configuração de inicialização automática no Termux concluída!');
  } catch (error) {
    aviso(`❌ Erro ao configurar autostart no Termux: ${error.message}`);
  }
}

function setupGracefulShutdown() {
  const shutdown = (signal) => {
    logger.info(`🛑 Recebido sinal ${signal}. Encerrando o Nazuna... Até logo!`);
    
    if (botProcess) {
      logger.info('🔄 Encerrando processo do bot...');
      botProcess.removeAllListeners();
      botProcess.kill('SIGTERM');
      
      // Force kill after 5 seconds if still running
      setTimeout(() => {
        if (botProcess && !botProcess.killed) {
          logger.warning('⚠️ Forçando encerramento do processo...');
          botProcess.kill('SIGKILL');
        }
      }, 5000);
    }
    
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('uncaughtException', (error) => {
    logger.error(`❌ Exceção não capturada: ${error.message}`);
    logger.error(error.stack);
    shutdown('uncaughtException');
  });
  process.on('unhandledRejection', (reason, promise) => {
    logger.error(`❌ Rejeição não tratada em ${promise}: ${reason}`);
    shutdown('unhandledRejection');
  });

  if (isWindows) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.on('SIGINT', () => shutdown('SIGINT'));
  }
}

async function checkPrerequisites() {
  const startTime = performance.now();
  logger.info('🔍 Verificando pré-requisitos...');
  
  let allChecksPassed = true;
  
  if (!fsSync.existsSync(CONFIG_PATH)) {
    aviso('⚠️ Arquivo de configuração (config.json) não encontrado! Iniciando configuração automática...');
    try {
      await new Promise((resolve, reject) => {
        const configProcess = spawn('npm', ['run', 'config'], { stdio: 'inherit', shell: isWindows });
        configProcess.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`Configuração falhou com código ${code}`))));
        configProcess.on('error', reject);
      });
      mensagem('📝 Configuração concluída com sucesso!');
    } catch (error) {
      aviso(`❌ Falha na configuração: ${error.message}`);
      mensagem('📝 Tente executar manualmente: npm run config');
      allChecksPassed = false;
    }
  }

  if (!fsSync.existsSync(NODE_MODULES_PATH)) {
    aviso('⚠️ Módulos do Node.js não encontrados! Iniciando instalação automática...');
    try {
      await new Promise((resolve, reject) => {
        const installProcess = spawn('npm', ['run', 'config:install'], { stdio: 'inherit', shell: isWindows });
        installProcess.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`Instalação falhou com código ${code}`))));
        installProcess.on('error', reject);
      });
      mensagem('📦 Instalação dos módulos concluída com sucesso!');
    } catch (error) {
      aviso(`❌ Falha na instalação dos módulos: ${error.message}`);
      mensagem('📦 Tente executar manualmente: npm run config:install');
      allChecksPassed = false;
    }
  }

  // Check connect file
  if (!fsSync.existsSync(CONNECT_FILE)) {
    aviso(`⚠️ Arquivo de conexão (${CONNECT_FILE}) não encontrado!`);
    aviso('🔍 Verifique a instalação do projeto.');
    allChecksPassed = false;
  }
  
  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.replace('v', '').split('.')[0]);
  if (majorVersion < 20) {
    aviso(`⚠️ Versão do Node.js (${nodeVersion}) é inferior à recomendada (>=20.0.0)`);
    allChecksPassed = false;
  }
  
  const endTime = performance.now();
  logger.info(`✅ Verificação de pré-requisitos concluída em ${((endTime - startTime) / 1000).toFixed(2)}s`);
  
  if (!allChecksPassed) {
    process.exit(1);
  }
}

function startBot(codeMode = false) {
  const args = ['--expose-gc', CONNECT_FILE];
  if (codeMode) args.push('--code');

  info(`📷 Iniciando com ${codeMode ? 'código de pareamento' : 'QR Code'}`);
  logger.info(`📋 Argumentos: ${args.join(' ')}`);
  logger.info(`🖥️ Recursos do sistema: ${JSON.stringify(getSystemResources())}`);

  botProcess = spawn('node', args, {
    stdio: 'inherit',
    env: { ...process.env, FORCE_COLOR: '1' },
  });

  botProcess.on('error', (error) => {
    logger.error(`❌ Erro ao iniciar o processo do bot: ${error.message}`);
    restartBot(codeMode);
  });

  botProcess.on('close', (code) => {
    logger.info(`⚠️ O bot terminou com código de saída: ${code}`);
    
    if (code !== 0) {
      aviso(`⚠️ O bot terminou com erro (código: ${code}).`);
      restartBot(codeMode);
    } else {
      logger.info('✅ Bot encerrado normalmente');
      restartCount = 0; // Reset restart count on normal shutdown
    }
  });

  botProcess.on('exit', (code, signal) => {
    logger.info(`🔚 Processo do bot saiu com código: ${code}, sinal: ${signal}`);
  });

  return botProcess;
}

function restartBot(codeMode) {
  restartCount++;
  
  if (restartCount >= MAX_RESTARTS) {
    logger.error(`❌ Número máximo de reinícios (${MAX_RESTARTS}) atingido. Encerrando para evitar loop infinito.`);
    logger.error('🔍 Verifique os logs para identificar a causa do problema.');
    process.exit(1);
  }
  
  logger.warning(`🔄 Reiniciando o bot (${restartCount}/${MAX_RESTARTS}) em ${RESTART_DELAY / 1000} segundos...`);
  
  setTimeout(() => {
    if (botProcess) {
      botProcess.removeAllListeners();
      botProcess.kill();
    }
    startBot(codeMode);
  }, RESTART_DELAY);
}

async function checkAutoConnect() {
  try {
    logger.debug('🔍 Verificando sessão existente...');
    
    if (!fsSync.existsSync(QR_CODE_DIR)) {
      logger.debug('📁 Criando diretório de QR Code...');
      await fs.mkdir(QR_CODE_DIR, { recursive: true });
      return false;
    }
    
    const files = await fs.readdir(QR_CODE_DIR);
    const hasSession = files.length > 2;
    
    return hasSession;
  } catch (error) {
    logger.error(`❌ Erro ao verificar diretório de QR Code: ${error.message}`);
    return false;
  }
}

async function promptConnectionMethod() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(`${colors.yellow}🔧 Escolha o método de conexão:${colors.reset}`);
  console.log(`${colors.yellow}1. 📷 Conectar via QR Code${colors.reset}`);
  console.log(`${colors.yellow}2. � Conectar via código de pareamento${colors.reset}`);
  console.log(`${colors.yellow}3. 🚪 Sair${colors.reset}`);

  const answer = await rl.question('➡️ Digite o número da opção desejada: ');
  console.log();
  rl.close();

  switch (answer.trim()) {
    case '1':
      mensagem('� Iniciando conexão via QR Code...');
      return { method: 'qr' };
    case '2':
      mensagem('🔑 Iniciando conexão via código de pareamento...');
      return { method: 'code' };
    case '3':
      mensagem('👋 Encerrando... Até mais!');
      process.exit(0);
    default:
      aviso('⚠️ Opção inválida! Usando conexão via QR Code como padrão.');
      return { method: 'qr' };
  }
}

async function displayHeader() {
  const systemInfo = getSystemResources();
  const header = [
    `${colors.bold}🚀 Nazuna - Conexão WhatsApp${colors.reset}`,
    `${colors.bold}📦 Versão: ${version}${colors.reset}`,
    `${colors.bold}💾 Uso de Memória: ${systemInfo.memoryUsage}%${colors.reset}`,
    `${colors.bold}🖥️ Plataforma: ${systemInfo.platform} (${systemInfo.arch})${colors.reset}`,
    `${colors.bold}🔧 CPUs: ${systemInfo.cpus}${colors.reset}`,
  ];

  separador();
  for (const line of header) {
    console.log(line);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  separador();
  console.log();
}

async function main() {
  const startTime = performance.now();
  
  try {
    logger.info('🚀 Iniciando processo de inicialização do Nazuna...');
    
    setupGracefulShutdown();
    await displayHeader();
    await checkPrerequisites();
    await setupTermuxAutostart();

    const hasSession = await checkAutoConnect();
    if (hasSession) {
      mensagem('📷 Sessão de QR Code detectada. Conectando automaticamente...');
      startBot(false);
    } else {
      const { method } = await promptConnectionMethod();
      startBot(method === 'code');
    }
    
    const endTime = performance.now();
    logger.info(`✅ Inicialização concluída em ${((endTime - startTime) / 1000).toFixed(2)}s`);
    
    // Log system status periodically
    setInterval(() => {
      const resources = getSystemResources();
      logger.debug(`📊 Status do sistema: Memória ${resources.memoryUsage}%, Uptime ${Math.round(resources.uptime / 60)}m`);
    }, 60000); // Every minute
    
  } catch (error) {
    logger.error(`❌ Erro inesperado durante a inicialização: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  }
}

await main();