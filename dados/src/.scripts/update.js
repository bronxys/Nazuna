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
const REPO_URL = 'https://github.com/hiudyy/nazuna.git';
const BACKUP_DIR = path.join(process.cwd(), `backup_${new Date().toISOString().replace(/[:.]/g, '_').replace(/T/, '_')}`);
const TEMP_DIR = path.join(process.cwd(), 'temp_nazuna');
const isWindows = os.platform() === 'win32';

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

// Graceful shutdown setup
function setupGracefulShutdown() {
  const shutdown = () => {
    console.log('\n');
    printWarning('🛑 Atualização cancelada pelo usuário.');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Display startup header
async function displayHeader() {
  const header = [
    `${colors.bold}🚀 Nazuna - Atualizador${colors.reset}`,
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

// Check system requirements (git and npm)
async function checkRequirements() {
  printInfo('🔍 Verificando requisitos do sistema...');

  try {
    await execAsync('git --version');
    printDetail('✅ Git encontrado.');
  } catch (error) {
    printWarning('⚠️ Git não encontrado! É necessário para atualizar o Nazuna.');
    if (isWindows) {
      printInfo('📥 Instale o Git em: https://git-scm.com/download/win');
    } else if (os.platform() === 'darwin') {
      printInfo('📥 Instale o Git com: brew install git');
    } else {
      printInfo('📥 Instale o Git com: sudo apt-get install git (Ubuntu/Debian) ou equivalente.');
    }
    process.exit(1);
  }

  try {
    await execAsync('npm --version');
    printDetail('✅ NPM encontrado.');
  } catch (error) {
    printWarning('⚠️ NPM não encontrado! É necessário para instalar dependências.');
    printInfo('📥 Instale o Node.js e NPM em: https://nodejs.org');
    process.exit(1);
  }

  printDetail('✅ Todos os requisitos atendidos.');
}

// Confirm update with countdown
async function confirmUpdate() {
  printWarning('⚠️ Atenção: A atualização sobrescreverá arquivos existentes, exceto configurações e dados salvos.');
  printInfo('📂 Um backup será criado automaticamente.');
  printWarning('🛑 Pressione Ctrl+C para cancelar a qualquer momento.');

  return new Promise((resolve) => {
    let countdown = 5;
    const timer = setInterval(() => {
      process.stdout.write(`\r⏳ Iniciando em ${countdown} segundos...${' '.repeat(20)}`);
      countdown--;

      if (countdown < 0) {
        clearInterval(timer);
        process.stdout.write('\r                                  \n');
        printMessage('🚀 Prosseguindo com a atualização...');
        resolve();
      }
    }, 1000);
  });
}

// Create backup of critical files
async function createBackup() {
  printMessage('📁 Criando backup dos arquivos...');

  try {
    await fs.mkdir(path.join(BACKUP_DIR, 'dados', 'database'), { recursive: true });
    await fs.mkdir(path.join(BACKUP_DIR, 'dados', 'src'), { recursive: true });
    await fs.mkdir(path.join(BACKUP_DIR, 'dados', 'midias'), { recursive: true });

    const databaseDir = path.join(process.cwd(), 'dados', 'database');
    if (fsSync.existsSync(databaseDir)) {
      printDetail('📂 Copiando diretório de banco de dados...');
      await copyDirectoryAsync(databaseDir, path.join(BACKUP_DIR, 'dados', 'database'));
    }

    const configFile = path.join(process.cwd(), 'dados', 'src', 'config.json');
    if (fsSync.existsSync(configFile)) {
      printDetail('📝 Copiando arquivo de configuração...');
      await fs.copyFile(configFile, path.join(BACKUP_DIR, 'dados', 'src', 'config.json'));
    }

    const midiasDir = path.join(process.cwd(), 'dados', 'midias');
    if (fsSync.existsSync(midiasDir)) {
      printDetail('🖼️ Copiando diretório de mídias...');
      await copyDirectoryAsync(midiasDir, path.join(BACKUP_DIR, 'dados', 'midias'));
    }

    printMessage(`✅ Backup salvo em: ${BACKUP_DIR}`);
  } catch (error) {
    printWarning(`❌ Erro ao criar backup: ${error.message}`);
    throw error;
  }
}

// Recursively copy directory
async function copyDirectoryAsync(source, destination) {
  if (!fsSync.existsSync(destination)) {
    await fs.mkdir(destination, { recursive: true });
  }

  const files = await fs.readdir(source);

  for (const file of files) {
    const sourcePath = path.join(source, file);
    const destPath = path.join(destination, file);

    const stats = await fs.stat(sourcePath);

    if (stats.isDirectory()) {
      await copyDirectoryAsync(sourcePath, destPath);
    } else {
      await fs.copyFile(sourcePath, destPath);
    }
  }
}

// Download latest version from GitHub
async function downloadUpdate() {
  printMessage('📥 Baixando a versão mais recente do Nazuna...');

  try {
    if (fsSync.existsSync(TEMP_DIR)) {
      if (isWindows) {
        execSync(`rmdir /s /q "${TEMP_DIR}"`, { stdio: 'ignore' });
      } else {
        await fs.rm(TEMP_DIR, { recursive: true, force: true });
      }
    }

    printDetail('🔄 Clonando repositório...');
    await new Promise((resolve, reject) => {
      const gitProcess = exec(`git clone --depth 1 ${REPO_URL} "${TEMP_DIR}"`, (error) =>
        error ? reject(error) : resolve()
      );

      const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
      let i = 0;
      const interval = setInterval(() => {
        process.stdout.write(`\r${spinner[i]} Baixando...`);
        i = (i + 1) % spinner.length;
      }, 100);

      gitProcess.on('close', () => {
        clearInterval(interval);
        process.stdout.write('\r                 \r');
        resolve();
      });
    });

    const readmePath = path.join(TEMP_DIR, 'README.md');
    if (fsSync.existsSync(readmePath)) {
      await fs.unlink(readmePath);
    }

    printMessage('✅ Download concluído com sucesso.');
  } catch (error) {
    printWarning(`❌ Falha ao baixar a atualização: ${error.message}`);
    printInfo('🔍 Verificando conectividade com o GitHub...');
    try {
      if (isWindows) {
        await execAsync('ping github.com -n 1');
      } else {
        await execAsync('ping -c 1 github.com');
      }
      printWarning('⚠️ Verifique permissões ou configuração do Git.');
    } catch {
      printWarning('⚠️ Sem conexão com a internet. Verifique sua rede.');
    }
    throw error;
  }
}

// Clean old files
async function cleanOldFiles() {
  printMessage('🧹 Limpando arquivos antigos...');

  try {
    const gitDir = path.join(process.cwd(), '.git');
    if (fsSync.existsSync(gitDir)) {
      printDetail('📂 Removendo diretório .git...');
      if (isWindows) {
        execSync(`rmdir /s /q "${gitDir}"`, { stdio: 'ignore' });
      } else {
        await fs.rm(gitDir, { recursive: true, force: true });
      }
    }

    const packageJson = path.join(process.cwd(), 'package.json');
    if (fsSync.existsSync(packageJson)) {
      printDetail('📝 Removendo package.json...');
      await fs.unlink(packageJson);
    }

    const packageLockJson = path.join(process.cwd(), 'package-lock.json');
    if (fsSync.existsSync(packageLockJson)) {
      printDetail('📝 Removendo package-lock.json...');
      await fs.unlink(packageLockJson);
    }

    const dadosDir = path.join(process.cwd(), 'dados');
    if (fsSync.existsSync(dadosDir)) {
      printDetail('📂 Limpando diretório de dados...');
      await cleanDirectoryAsync(dadosDir, BACKUP_DIR);
    }

    printMessage('✅ Limpeza concluída com sucesso.');
  } catch (error) {
    printWarning(`❌ Erro ao limpar arquivos antigos: ${error.message}`);
    throw error;
  }
}

// Clean directory while preserving backup
async function cleanDirectoryAsync(directory, excludeDir) {
  const files = await fs.readdir(directory);

  for (const file of files) {
    const filePath = path.join(directory, file);

    if (filePath === excludeDir) {
      continue;
    }

    const stats = await fs.stat(filePath);
    if (stats.isDirectory()) {
      if (isWindows) {
        execSync(`rmdir /s /q "${filePath}"`, { stdio: 'ignore' });
      } else {
        await fs.rm(filePath, { recursive: true, force: true });
      }
    } else {
      await fs.unlink(filePath);
    }
  }
}

// Apply update by copying new files
async function applyUpdate() {
  printMessage('🚀 Aplicando atualização...');

  try {
    const tempFiles = await fs.readdir(TEMP_DIR);
    let filesCopied = 0;

    for (const file of tempFiles) {
      const sourcePath = path.join(TEMP_DIR, file);
      const destPath = path.join(process.cwd(), file);

      const stats = await fs.stat(sourcePath);

      if (stats.isDirectory()) {
        printDetail(`📂 Copiando diretório ${file}...`);
        await copyDirectoryAsync(sourcePath, destPath);
      } else {
        await fs.copyFile(sourcePath, destPath);
      }

      filesCopied++;
      if (filesCopied % 5 === 0) {
        printDetail(`📊 ${filesCopied} de ${tempFiles.length} arquivos copiados.`);
      }
    }

    if (fsSync.existsSync(TEMP_DIR)) {
      if (isWindows) {
        execSync(`rmdir /s /q "${TEMP_DIR}"`, { stdio: 'ignore' });
      } else {
        await fs.rm(TEMP_DIR, { recursive: true, force: true });
      }
    }

    printMessage('✅ Atualização aplicada com sucesso.');
  } catch (error) {
    printWarning(`❌ Erro ao aplicar atualização: ${error.message}`);
    throw error;
  }
}

// Restore backup files
async function restoreBackup() {
  printMessage('📂 Restaurando backup...');

  try {
    await fs.mkdir(path.join(process.cwd(), 'dados', 'database'), { recursive: true });
    await fs.mkdir(path.join(process.cwd(), 'dados', 'src'), { recursive: true });
    await fs.mkdir(path.join(process.cwd(), 'dados', 'midias'), { recursive: true });

    const backupDatabaseDir = path.join(BACKUP_DIR, 'dados', 'database');
    if (fsSync.existsSync(backupDatabaseDir)) {
      printDetail('📂 Restaurando banco de dados...');
      await copyDirectoryAsync(backupDatabaseDir, path.join(process.cwd(), 'dados', 'database'));
    }

    const backupConfigFile = path.join(BACKUP_DIR, 'dados', 'src', 'config.json');
    if (fsSync.existsSync(backupConfigFile)) {
      printDetail('📝 Restaurando arquivo de configuração...');
      await fs.copyFile(backupConfigFile, path.join(process.cwd(), 'dados', 'src', 'config.json'));
    }

    const backupMidiasDir = path.join(BACKUP_DIR, 'dados', 'midias');
    if (fsSync.existsSync(backupMidiasDir)) {
      printDetail('🖼️ Restaurando diretório de mídias...');
      await copyDirectoryAsync(backupMidiasDir, path.join(process.cwd(), 'dados', 'midias'));
    }

    printMessage('✅ Backup restaurado com sucesso.');
  } catch (error) {
    printWarning(`❌ Erro ao restaurar backup: ${error.message}`);
    throw error;
  }
}

// Install dependencies using npm run config:install
async function installDependencies() {
  printMessage('📦 Instalando dependências...');

  try {
    await new Promise((resolve, reject) => {
      const npmProcess = exec('npm run config:install', { shell: isWindows }, (error) =>
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
    printWarning(`❌ Falha ao instalar dependências: ${error.message}`);
    printInfo('📝 Tente executar manualmente: npm run config:install');
    throw error;
  }
}

// Cleanup temporary files
async function cleanup() {
  printMessage('🧹 Finalizando e limpando arquivos temporários...');

  try {
    if (fsSync.existsSync(BACKUP_DIR)) {
      printDetail('📂 Removendo diretório de backup...');
      if (isWindows) {
        execSync(`rmdir /s /q "${BACKUP_DIR}"`, { stdio: 'ignore' });
      } else {
        await fs.rm(BACKUP_DIR, { recursive: true, force: true });
      }
      printDetail('✅ Backup removido.');
    }
  } catch (error) {
    printWarning(`❌ Erro ao limpar arquivos temporários: ${error.message}`);
  }
}

// Prompt user for yes/no input
async function promptYesNo(question, defaultAnswer = 'n') {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    const defaultText = defaultAnswer.toLowerCase() === 's' ? 'S/n' : 's/N';
    rl.question(`${question} (${defaultText}): `, (answer) => {
      rl.close();
      const response = (answer.trim() || defaultAnswer).toLowerCase();
      resolve(response === 's' || response === 'sim' || response === 'y' || response === 'yes');
    });
  });
}

// Main function to execute update process
async function main() {
  try {
    setupGracefulShutdown();
    await displayHeader();

    const steps = [
      { name: 'Verificando requisitos do sistema', func: checkRequirements },
      { name: 'Confirmando atualização', func: confirmUpdate },
      { name: 'Criando backup', func: createBackup },
      { name: 'Baixando a versão mais recente', func: downloadUpdate },
      { name: 'Limpando arquivos antigos', func: cleanOldFiles },
      { name: 'Aplicando atualização', func: applyUpdate },
      { name: 'Restaurando backup', func: restoreBackup },
      { name: 'Instalando dependências', func: installDependencies },
      { name: 'Finalizando e limpando', func: cleanup },
    ];

    let completedSteps = 0;
    const totalSteps = steps.length;

    for (const step of steps) {
      await step.func();
      completedSteps++;
      printDetail(`📊 Progresso: ${completedSteps}/${totalSteps} etapas concluídas.`);
    }

    printMessage('🔄 Buscando informações do último commit...');
    const response = await fetch('https://api.github.com/repos/hiudyy/nazuna/commits?per_page=1', {
      headers: { Accept: 'application/vnd.github+json' },
    });

    if (!response.ok) {
      throw new Error(`Erro ao buscar commits: ${response.status} ${response.statusText}`);
    }

    const linkHeader = response.headers.get('link');
    const NumberUp = linkHeader?.match(/page=(\d+)>;\s*rel="last"/)?.[1];

    const jsonUp = { total: NumberUp };
    await fs.writeFile(path.join(__dirname, '..', '..', 'database', 'updateSave.json'), JSON.stringify(jsonUp));

    printSeparator();
    printMessage('🎉 Atualização concluída com sucesso!');
    printMessage('🚀 Inicie o bot com: npm start');
    printSeparator();
  } catch (error) {
    printSeparator();
    printWarning(`❌ Erro durante a atualização: ${error.message}`);
    printWarning(`📂 Backup disponível em: ${BACKUP_DIR}`);
    printInfo('📝 Para restaurar manualmente, copie os arquivos do backup para os diretórios correspondentes.');
    printInfo('📩 Em caso de dúvidas, contate o desenvolvedor.');
    process.exit(1);
  }
}

// Execute main function
main();