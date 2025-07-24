#!/usr/bin/env node

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { execSync, exec } = require('child_process');
const readline = require('readline');
const os = require('os');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Configuration constants
const CONFIG_FILE = path.join(process.cwd(), 'dados', 'src', 'config.json');
const isWindows = os.platform() === 'win32';

// Version extraction from package.json
let version = 'Desconhecida';
try {
  const packageJson = JSON.parse(fsSync.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  version = packageJson.version;
} catch (error) {
  // Silently handle missing package.json
}

// ANSI color codes for console output
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
  underline: '\x1b[4m',
};

// Console message helpers
function printMessage(text) {
  console.log(`${colors.green}${text}${colors.reset}`);
}

function printWarning(text) {
  console.log(`${colors.red}${text}${colors.reset}`);
}

function printInfo(text) {
  console.log(`${colors.cyan}${text}${colors.reset}`);
}

function printDetail(text) {
  console.log(`${colors.dim}${text}${colors.reset}`);
}

function printSeparator() {
  console.log(`${colors.blue}============================================${colors.reset}`);
}

// Validate user input
function validateInput(input, field) {
  switch (field) {
    case 'prefixo':
      if (input.length !== 1) {
        printWarning('⚠️ O prefixo deve ter exatamente 1 caractere.');
        return false;
      }
      return true;

    case 'numero':
      if (!/^[0-9]{10,15}$/.test(input)) {
        printWarning('⚠️ Número inválido! Deve conter apenas dígitos (10 a 15).');
        printDetail('📝 Exemplo: 5511999999999');
        return false;
      }
      return true;

    default:
      return true;
  }
}

// Graceful shutdown setup
function setupGracefulShutdown() {
  const shutdown = () => {
    console.log('\n');
    printWarning('🛑 Configuração cancelada pelo usuário.');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Install dependencies using npm install --no-optional --force --no-bin-links
async function installDependencies() {
  printSeparator();
  printMessage('📦 Instalando dependências...');

  try {
    await new Promise((resolve, reject) => {
      const npmProcess = exec('npm install --no-optional --force --no-bin-links', { shell: isWindows }, (error) =>
        error ? reject(error) : resolve()
      );

      const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
      let i = 0;
      const interval = setInterval(() => {
        process.stdout.write(`\r${spinner[i]} Instalando dependências...`);
        i = (i + 1) % spinner.length;
      }, 100);

      npmProcess.on('close', () => {
        clearInterval(interval);
        process.stdout.write('\r                                \r');
      });
    });

    printMessage('✅ Dependências instaladas com sucesso.');
  } catch (error) {
    printWarning(`❌ Erro ao instalar dependências: ${error.message}`);
    printInfo('📝 Tente executar manualmente: npm run config:install');
    process.exit(1);
  }
}

// Display startup header
async function displayHeader() {
  const header = [
    `${colors.bold}🚀 Configurador do Nazuna - Versão ${version}${colors.reset}`,
    `${colors.bold}👨‍💻 Criado por Hiudy${colors.reset}`,
  ];

  printSeparator();
  for (const line of header) {
    await new Promise((resolve) => {
      process.stdout.write(line + '\n');
      setTimeout(resolve, 100);
    });
  }
  printSeparator();
  console.log();
}

// Main configuration function
async function main() {
  try {
    setupGracefulShutdown();

    if (process.argv.includes('--install')) {
      await installDependencies();
      process.exit(0);
    }

    await displayHeader();

    const defaultConfig = {
      nomedono: '',
      numerodono: '',
      nomebot: '',
      prefixo: '!',
      aviso: false,
      debug: false,
      enablePanel: false,
    };

    let config = { ...defaultConfig };

    try {
      if (fsSync.existsSync(CONFIG_FILE)) {
        const existingConfig = JSON.parse(await fs.readFile(CONFIG_FILE, 'utf8'));
        config = { ...config, ...existingConfig };
        printInfo('📂 Configuração existente carregada.');
      }
    } catch (error) {
      printWarning(`⚠️ Erro ao ler config.json: ${error.message}`);
      printInfo('📝 Usando valores padrão.');
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    printInfo(`${colors.bold}${colors.underline}🔧 Configurações Básicas${colors.reset}`);
    config.nomedono = await promptInput(rl, '👤 Nome do dono do bot', config.nomedono);
    config.numerodono = await promptInput(rl, '📱 Número do dono (com DDD, apenas dígitos)', config.numerodono, 'numero');
    config.nomebot = await promptInput(rl, '🤖 Nome do bot', config.nomebot);
    config.prefixo = await promptInput(rl, '🔣 Prefixo do bot (1 caractere)', config.prefixo, 'prefixo');

    config.aviso = false;
    config.debug = false;
    config.enablePanel = false;

    try {
      const configDir = path.dirname(CONFIG_FILE);
      if (!fsSync.existsSync(configDir)) {
        await fs.mkdir(configDir, { recursive: true });
      }

      await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));

      console.log();
      printInfo('📋 Resumo da Configuração');
      printDetail(`👤 Nome do dono: ${config.nomedono}`);
      printDetail(`📱 Número do dono: ${config.numerodono}`);
      printDetail(`🤖 Nome do bot: ${config.nomebot}`);
      printDetail(`🔣 Prefixo: ${config.prefixo}`);

      printSeparator();
      printMessage('✅ Configuração salva com sucesso em config.json!');
      printSeparator();

      const installNow = await confirm(rl, '📦 Deseja instalar as dependências agora?', 's');

      if (installNow) {
        rl.close();
        await installDependencies();
      } else {
        printMessage('📝 Você pode instalar as dependências depois com: npm run config:install');
      }

      printSeparator();
      printMessage(`🎉 Nazuna configurado e pronto para uso! Versão: ${version}`);
      printSeparator();
    } catch (error) {
      printWarning(`❌ Erro ao salvar configuração: ${error.message}`);
    }

    rl.close();
  } catch (error) {
    printWarning(`❌ Erro inesperado: ${error.message}`);
    process.exit(1);
  }
}

// Prompt user for input with validation
async function promptInput(rl, prompt, defaultValue, field = null) {
  return new Promise((resolve) => {
    const displayPrompt = `${prompt} ${colors.dim}(atual: ${defaultValue})${colors.reset}: `;
    rl.question(displayPrompt, async (input) => {
      const value = input.trim() || defaultValue;

      if (field && !validateInput(value, field)) {
        return resolve(await promptInput(rl, prompt, defaultValue, field));
      }

      resolve(value);
    });
  });
}

// Prompt user for yes/no input
async function confirm(rl, prompt, defaultValue = 'n') {
  return new Promise((resolve) => {
    const defaultText = defaultValue.toLowerCase() === 's' ? 'S/n' : 's/N';
    rl.question(`${prompt} (${defaultText}): `, (input) => {
      const response = (input.trim() || defaultValue).toLowerCase();
      resolve(response === 's' || response === 'sim' || response === 'y' || response === 'yes');
    });
  });
}

// Execute main function
main().catch((error) => {
  printWarning(`❌ Erro fatal: ${error.message}`);
  process.exit(1);
});