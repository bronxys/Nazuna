#!/usr/bin/env node

import fs from 'fs/promises';
import * as fsSync from 'fs';
import path from 'path';
import { execSync, exec } from 'child_process';
import readline from 'readline';
import os from 'os';
import { promisify } from 'util';
const execAsync = promisify(exec);

const REPO_URL = 'https://github.com/hiudyy/nazuna.git';
const BACKUP_DIR = path.join(process.cwd(), `backup_${new Date().toISOString().replace(/[:.]/g, '_').replace(/T/, '_')}`);
const TEMP_DIR = path.join(process.cwd(), 'temp_nazuna');
const isWindows = os.platform() === 'win32';

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

function setupGracefulShutdown() {
  const shutdown = () => {
    console.log('\n');
    printWarning('🛑 Atualização cancelada pelo usuário.');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

async function displayHeader() {
  const header = [
    `${colors.bold}🚀 Nazuna - Atualizador${colors.reset}`,
    `${colors.bold}👨‍💻 Criado por Hiudy${colors.reset}`,
  ];

  printSeparator();
  for (const line of header) {
    process.stdout.write(line + '\n');
  }
  printSeparator();
  console.log();
}

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

async function createBackup() {
  printMessage('📁 Criando backup dos arquivos...');

  try {
    await fs.mkdir(path.join(BACKUP_DIR, 'dados', 'database'), { recursive: true });
    await fs.mkdir(path.join(BACKUP_DIR, 'dados', 'src'), { recursive: true });
    await fs.mkdir(path.join(BACKUP_DIR, 'dados', 'midias'), { recursive: true });

    const databaseDir = path.join(process.cwd(), 'dados', 'database');
    if (fsSync.existsSync(databaseDir)) {
      printDetail('📂 Copiando diretório de banco de dados...');
      await fs.cp(databaseDir, path.join(BACKUP_DIR, 'dados', 'database'), { recursive: true });
    }

    const configFile = path.join(process.cwd(), 'dados', 'src', 'config.json');
    if (fsSync.existsSync(configFile)) {
      printDetail('📝 Copiando arquivo de configuração...');
      await fs.copyFile(configFile, path.join(BACKUP_DIR, 'dados', 'src', 'config.json'));
    }

    const midiasDir = path.join(process.cwd(), 'dados', 'midias');
    if (fsSync.existsSync(midiasDir)) {
      printDetail('🖼️ Copiando diretório de mídias...');
      await fs.cp(midiasDir, path.join(BACKUP_DIR, 'dados', 'midias'), { recursive: true });
    }

    printMessage(`✅ Backup salvo em: ${BACKUP_DIR}`);
  } catch (error) {
    printWarning(`❌ Erro ao criar backup: ${error.message}`);
    throw error;
  }
}

async function downloadUpdate() {
  printMessage('📥 Baixando a versão mais recente do Nazuna...');

  try {
    if (fsSync.existsSync(TEMP_DIR)) {
      await fs.rm(TEMP_DIR, { recursive: true, force: true });
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
      await execAsync(isWindows ? 'ping github.com -n 1' : 'ping -c 1 github.com');
      printWarning('⚠️ Verifique permissões ou configuração do Git.');
    } catch {
      printWarning('⚠️ Sem conexão com a internet. Verifique sua rede.');
    }
    throw error;
  }
}

async function cleanOldFiles() {
  printMessage('🧹 Limpando arquivos antigos...');

  try {
    const itemsToDelete = [
      { path: path.join(process.cwd(), '.git'), type: 'dir', name: '.git' },
      { path: path.join(process.cwd(), '.github'), type: 'dir', name: '.github' },
      { path: path.join(process.cwd(), '.npm'), type: 'dir', name: '.npm' },
      { path: path.join(process.cwd(), 'node_modules'), type: 'dir', name: 'node_modules' },
      { path: path.join(process.cwd(), 'package.json'), type: 'file', name: 'package.json' },
      { path: path.join(process.cwd(), 'package-lock.json'), type: 'file', name: 'package-lock.json' },
      { path: path.join(process.cwd(), 'README.md'), type: 'file', name: 'README.md' },
    ];

    for (const item of itemsToDelete) {
      if (fsSync.existsSync(item.path)) {
        printDetail(`📂 Removendo ${item.name}...`);
        if (item.type === 'dir') {
          await fs.rm(item.path, { recursive: true, force: true });
        } else {
          await fs.unlink(item.path);
        }
      }
    }

    const dadosDir = path.join(process.cwd(), 'dados');
    if (fsSync.existsSync(dadosDir)) {
      printDetail('📂 Limpando diretório de dados...');
      const files = await fs.readdir(dadosDir);
      for (const file of files) {
        const filePath = path.join(dadosDir, file);
        const stats = await fs.stat(filePath);
        if (stats.isDirectory()) {
          await fs.rm(filePath, { recursive: true, force: true });
        } else {
          await fs.unlink(filePath);
        }
      }
    }

    printMessage('✅ Limpeza concluída com sucesso.');
  } catch (error) {
    printWarning(`❌ Erro ao limpar arquivos antigos: ${error.message}`);
    throw error;
  }
}

async function applyUpdate() {
  printMessage('🚀 Aplicando atualização...');

  try {
    await fs.cp(TEMP_DIR, process.cwd(), { recursive: true });

    await fs.rm(TEMP_DIR, { recursive: true, force: true });

    printMessage('✅ Atualização aplicada com sucesso.');
  } catch (error) {
    printWarning(`❌ Erro ao aplicar atualização: ${error.message}`);
    throw error;
  }
}

async function restoreBackup() {
  printMessage('📂 Restaurando backup...');

  try {
    await fs.mkdir(path.join(process.cwd(), 'dados', 'database'), { recursive: true });
    await fs.mkdir(path.join(process.cwd(), 'dados', 'src'), { recursive: true });
    await fs.mkdir(path.join(process.cwd(), 'dados', 'midias'), { recursive: true });

    const backupDatabaseDir = path.join(BACKUP_DIR, 'dados', 'database');
    if (fsSync.existsSync(backupDatabaseDir)) {
      printDetail('📂 Restaurando banco de dados...');
      await fs.cp(backupDatabaseDir, path.join(process.cwd(), 'dados', 'database'), { recursive: true });
    }

    const backupConfigFile = path.join(BACKUP_DIR, 'dados', 'src', 'config.json');
    if (fsSync.existsSync(backupConfigFile)) {
      printDetail('📝 Restaurando arquivo de configuração...');
      await fs.copyFile(backupConfigFile, path.join(process.cwd(), 'dados', 'src', 'config.json'));
    }

    const backupMidiasDir = path.join(BACKUP_DIR, 'dados', 'midias');
    if (fsSync.existsSync(backupMidiasDir)) {
      printDetail('🖼️ Restaurando diretório de mídias...');
      await fs.cp(backupMidiasDir, path.join(process.cwd(), 'dados', 'midias'), { recursive: true });
    }

    printMessage('✅ Backup restaurado com sucesso.');
  } catch (error) {
    printWarning(`❌ Erro ao restaurar backup: ${error.message}`);
    throw error;
  }
}

async function checkDependencyChanges() {
  printInfo('🔍 Verificando mudanças nas dependências...');
  
  try {
    const currentPackageJsonPath = path.join(process.cwd(), 'package.json');
    const newPackageJsonPath = path.join(TEMP_DIR, 'package.json');
    
    if (!fsSync.existsSync(currentPackageJsonPath) || !fsSync.existsSync(newPackageJsonPath)) {
      printDetail('📦 Arquivo package.json não encontrado, instalação será necessária');
      return true;
    }
    
    const currentPackage = JSON.parse(await fs.readFile(currentPackageJsonPath, 'utf8'));
    const newPackage = JSON.parse(await fs.readFile(newPackageJsonPath, 'utf8'));
    
    const currentDeps = JSON.stringify(currentPackage.dependencies || {});
    const newDeps = JSON.stringify(newPackage.dependencies || {});
    
    const currentDevDeps = JSON.stringify(currentPackage.devDependencies || {});
    const newDevDeps = JSON.stringify(newPackage.devDependencies || {});
    
    if (currentDeps !== newDeps || currentDevDeps !== newDevDeps) {
      printDetail('📦 Dependências foram alteradas, reinstalação necessária');
      return true;
    }
    
    const nodeModulesPath = path.join(process.cwd(), 'node_modules');
    if (!fsSync.existsSync(nodeModulesPath)) {
      printDetail('📦 Diretório node_modules não encontrado, instalação necessária');
      return true;
    }
    
    printDetail('✅ Dependências inalteradas, reinstalação não necessária');
    return false;
  } catch (error) {
    printWarning(`❌ Erro ao verificar dependências: ${error.message}`);
    return true;
  }
}

async function installDependencies() {
  const needsInstall = await checkDependencyChanges();
  
  if (!needsInstall) {
    printMessage('⚡ Dependências já estão atualizadas, pulando instalação');
    return;
  }
  
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

async function cleanup() {
  printMessage('🧹 Finalizando e limpando arquivos temporários...');

  try {
    if (fsSync.existsSync(BACKUP_DIR)) {
      printDetail('📂 Removendo diretório de backup...');
      await fs.rm(BACKUP_DIR, { recursive: true, force: true });
      printDetail('✅ Backup removido.');
    }
  } catch (error) {
    printWarning(`❌ Erro ao limpar arquivos temporários: ${error.message}`);
  }
}

async function main() {
  let backupCreated = false;
  try {
    setupGracefulShutdown();
    await displayHeader();

    const steps = [
      { name: 'Verificando requisitos do sistema', func: checkRequirements },
      { name: 'Confirmando atualização', func: confirmUpdate },
      { name: 'Criando backup', func: async () => { await createBackup(); backupCreated = true; } },
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

    const jsonUp = { total: Number(NumberUp) || 0 };
    await fs.writeFile(path.join(process.cwd(), 'dados', 'database', 'updateSave.json'), JSON.stringify(jsonUp));

    printSeparator();
    printMessage('🎉 Atualização concluída com sucesso!');
    printMessage('🚀 Inicie o bot com: npm start');
    printSeparator();
  } catch (error) {
    printSeparator();
    printWarning(`❌ Erro durante a atualização: ${error.message}`);
    if (backupCreated) {
      try {
        await restoreBackup();
        printInfo('📂 Backup da versão antiga restaurado automaticamente.');
      } catch (restoreError) {
        printWarning(`❌ Falha ao restaurar backup automaticamente: ${restoreError.message}`);
      }
    }
    printWarning(`📂 Backup disponível em: ${BACKUP_DIR}`);
    printInfo('📝 Para restaurar manualmente, copie os arquivos do backup para os diretórios correspondentes.');
    printInfo('📩 Em caso de dúvidas, contate o desenvolvedor.');
    process.exit(1);
  }
}

main();