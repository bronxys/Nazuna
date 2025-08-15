#!/usr/bin/env node

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');
const os = require('os');

const CONFIG_PATH = path.join(process.cwd(), 'dados', 'src', 'config.json');
const NODE_MODULES_PATH = path.join(process.cwd(), 'node_modules');
const QR_CODE_DIR = path.join(process.cwd(), 'dados', 'database', 'qr-code');
const CONNECT_FILE = path.join(process.cwd(), 'dados', 'src', 'connect.js');
const RESTART_DELAY = 1;
const isWindows = os.platform() === 'win32';
const dualMode = process.argv.includes('dual');

let version = 'Desconhecida';
try {
  const packageJson = JSON.parse(fsSync.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  version = packageJson.version;
} catch (error) {
}

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[1;32m',
  red: '\x1b[1;31m',
  blue: '\x1b[1;34m',
  yellow: '\x1b[1;33m',
  cyan: '\x1b[1;36m',
  magenta: '\x1b[1;35m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

function mensagem(text) {
  console.log(`${colors.green}${text}${colors.reset}`);
}

function aviso(text) {
  console.log(`${colors.red}${text}${colors.reset}`);
}

function info(text) {
  console.log(`${colors.cyan}${text}${colors.reset}`);
}

function detalhe(text) {
  console.log(`${colors.dim}${text}${colors.reset}`);
}

function separador() {
  console.log(`${colors.blue}============================================${colors.reset}`);
}

let botProcess = null;
let restartCount = 0;
const MAX_RESTART_COUNT = 10;
const RESTART_COUNT_RESET_INTERVAL = 60000;

function setupGracefulShutdown() {
  const shutdown = () => {
    console.log('\n');
    mensagem('🛑 Encerrando o Nazuna... Até logo!');
    if (botProcess) {
      botProcess.removeAllListeners('close');
      botProcess.kill();
    }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  if (isWindows) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.on('SIGINT', shutdown);
  }
}

async function displayHeader() {
  const header = [
    `${colors.bold}🚀 Nazuna - Conexão WhatsApp${colors.reset}`,
    `${colors.bold}📦 Versão: ${version}${colors.reset}`,
  ];

  separador();
  for (const line of header) {
    await new Promise((resolve) => {
      process.stdout.write(line + '\n');
      setTimeout(resolve, 100);
    });
  }
  separador();
  console.log();
}

async function checkPrerequisites() {
  if (!fsSync.existsSync(CONFIG_PATH)) {
    aviso('⚠️ Arquivo de configuração (config.json) não encontrado!');
    mensagem('📝 Execute o comando: npm run config');
    process.exit(1);
  }

  if (!fsSync.existsSync(NODE_MODULES_PATH)) {
    aviso('⚠️ Módulos do Node.js não encontrados! Iniciando instalação automática com npm run config:install...');
    try {
      await new Promise((resolve, reject) => {
        const installProcess = spawn('npm', ['run', 'config:install'], {
          stdio: 'inherit',
          shell: isWindows,
        });

        installProcess.on('close', (code) => {
          if (code === 0) {
            mensagem('📦 Instalação dos módulos concluída com sucesso!');
            resolve();
          } else {
            reject(new Error(`Instalação falhou com código ${code}`));
          }
        });

        installProcess.on('error', (error) => {
          reject(new Error(`Erro ao executar npm run config:install: ${error.message}`));
        });
      });
    } catch (error) {
      aviso(`❌ Falha na instalação dos módulos: ${error.message}`);
      mensagem('📦 Tente executar manualmente: npm run config:install');
      process.exit(1);
    }
  }

  if (!fsSync.existsSync(CONNECT_FILE)) {
    aviso(`⚠️ Arquivo de conexão (${CONNECT_FILE}) não encontrado!`);
    aviso('🔍 Verifique a instalação do projeto.');
    process.exit(1);
  }
}

function startBot(codeMode = false) {
  const args = ['--expose-gc', CONNECT_FILE];
  if (codeMode) args.push('--code');
  if (dualMode) args.push('--dual');

  info(codeMode ? `🔑 Iniciando com código de pareamento (modo dual: ${dualMode ? 'Ativado' : 'Desativado'})` : `📷 Iniciando com QR Code (modo dual: ${dualMode ? 'Ativado' : 'Desativado'})`);

  botProcess = spawn('node', args, {
    stdio: 'inherit',
    env: { ...process.env, FORCE_COLOR: '1' },
  });

  botProcess.on('error', (error) => {
    aviso(`❌ Erro ao iniciar o processo do bot: ${error.message}`);
    restartBot(codeMode);
  });

  botProcess.on('close', (code) => {
    if (code !== 0) {
      aviso(`⚠️ O bot terminou com erro (código: ${code}).`);
      restartBot(codeMode);
    }
  });

  return botProcess;
}

function restartBot(codeMode) {
  restartCount++;
  let delay = RESTART_DELAY;

  aviso(`🔄 Reiniciando o bot em ${delay / 1000} segundos...`);

  setTimeout(() => {
    if (botProcess) {
      botProcess.removeAllListeners('close');
      botProcess.removeAllListeners('error');
    }
    startBot(codeMode);
  }, delay);
}

async function checkAutoConnect() {
  try {
    if (!fsSync.existsSync(QR_CODE_DIR)) {
      await fs.mkdir(QR_CODE_DIR, { recursive: true });
      return false;
    }

    const files = await fs.readdir(QR_CODE_DIR);
    return files.length > 2;
  } catch (error) {
    aviso(`❌ Erro ao verificar diretório de QR Code: ${error.message}`);
    return false;
  }
}

async function promptConnectionMethod() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log(`${colors.yellow}🔧 Escolha o método de conexão:${colors.reset}`);
    console.log(`${colors.yellow}1. 📷 Conectar via QR Code${colors.reset}`);
    console.log(`${colors.yellow}2. 🔑 Conectar via código de pareamento${colors.reset}`);
    console.log(`${colors.yellow}3. 🚪 Sair${colors.reset}`);

    rl.question('➡️ Digite o número da opção desejada: ', (answer) => {
      console.log();
      rl.close();

      switch (answer.trim()) {
        case '1':
          mensagem('📷 Iniciando conexão via QR Code...');
          resolve({ method: 'qr' });
          break;
        case '2':
          mensagem('🔑 Iniciando conexão via código de pareamento...');
          resolve({ method: 'code' });
          break;
        case '3':
          mensagem('👋 Encerrando... Até mais!');
          process.exit(0);
          break;
        default:
          aviso('⚠️ Opção inválida! Usando conexão via QR Code como padrão.');
          resolve({ method: 'qr' });
      }
    });
  });
}

async function main() {
  try {
    setupGracefulShutdown();
    await displayHeader();
    await checkPrerequisites();
    const hasSession = await checkAutoConnect();
    if (hasSession) {
      mensagem('📷 Sessão de QR Code detectada. Conectando automaticamente...');
      startBot(false);
    } else {
      const { method } = await promptConnectionMethod();
      startBot(method === 'code');
    }
  } catch (error) {
    aviso(`❌ Erro inesperado: ${error.message}`);
    process.exit(1);
  }
}

main().catch((error) => {
  aviso(`❌ Erro fatal: ${error.message}`);
  process.exit(1);
});