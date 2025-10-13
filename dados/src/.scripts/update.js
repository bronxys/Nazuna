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
    // Validate backup directory path
    if (!BACKUP_DIR || BACKUP_DIR.includes('..')) {
      throw new Error('Caminho de backup inválido');
    }

    await fs.mkdir(path.join(BACKUP_DIR, 'dados', 'database'), { recursive: true });
    await fs.mkdir(path.join(BACKUP_DIR, 'dados', 'src'), { recursive: true });
    await fs.mkdir(path.join(BACKUP_DIR, 'dados', 'midias'), { recursive: true });

    const databaseDir = path.join(process.cwd(), 'dados', 'database');
    if (fsSync.existsSync(databaseDir)) {
      printDetail('📂 Copiando diretório de banco de dados...');
      
      // Verify database directory is accessible
      try {
        await fs.access(databaseDir);
        await fs.cp(databaseDir, path.join(BACKUP_DIR, 'dados', 'database'), { recursive: true });
      } catch (accessError) {
        printWarning(`⚠️ Não foi possível acessar o diretório de banco de dados: ${accessError.message}`);
        throw new Error('Falha ao acessar diretório de dados para backup');
      }
    }

    const configFile = path.join(process.cwd(), 'dados', 'src', 'config.json');
    if (fsSync.existsSync(configFile)) {
      printDetail('📝 Copiando arquivo de configuração...');
      try {
        await fs.access(configFile, fsSync.constants.R_OK);
        await fs.copyFile(configFile, path.join(BACKUP_DIR, 'dados', 'src', 'config.json'));
      } catch (accessError) {
        printWarning(`⚠️ Não foi possível acessar o arquivo de configuração: ${accessError.message}`);
        throw new Error('Falha ao acessar arquivo de configuração para backup');
      }
    }

    const midiasDir = path.join(process.cwd(), 'dados', 'midias');
    if (fsSync.existsSync(midiasDir)) {
      printDetail('🖼️ Copiando diretório de mídias...');
      try {
        await fs.access(midiasDir);
        await fs.cp(midiasDir, path.join(BACKUP_DIR, 'dados', 'midias'), { recursive: true });
      } catch (accessError) {
        printWarning(`⚠️ Não foi possível acessar o diretório de mídias: ${accessError.message}`);
        throw new Error('Falha ao acessar diretório de mídias para backup');
      }
    }

    // Verify backup was created successfully
    const backupDatabaseDir = path.join(BACKUP_DIR, 'dados', 'database');
    const backupConfigFile = path.join(BACKUP_DIR, 'dados', 'src', 'config.json');
    const backupMidiasDir = path.join(BACKUP_DIR, 'dados', 'midias');

    const backupSuccess = (
      (fsSync.existsSync(backupDatabaseDir) || !fsSync.existsSync(databaseDir)) &&
      (fsSync.existsSync(backupConfigFile) || !fsSync.existsSync(configFile)) &&
      (fsSync.existsSync(backupMidiasDir) || !fsSync.existsSync(midiasDir))
    );

    if (!backupSuccess) {
      throw new Error('Backup incompleto - alguns arquivos não foram copiados');
    }

    printMessage(`✅ Backup salvo em: ${BACKUP_DIR}`);
  } catch (error) {
    printWarning(`❌ Erro ao criar backup: ${error.message}`);
    printInfo('📝 A atualização será cancelada para evitar perda de dados.');
    throw error;
  }
}

async function downloadUpdate() {
  printMessage('📥 Baixando a versão mais recente do Nazuna...');

  try {
    // Validate temp directory path
    if (!TEMP_DIR || TEMP_DIR.includes('..')) {
      throw new Error('Caminho de diretório temporário inválido');
    }

    if (fsSync.existsSync(TEMP_DIR)) {
      printDetail('🔄 Removendo diretório temporário existente...');
      try {
        await fs.rm(TEMP_DIR, { recursive: true, force: true });
      } catch (rmError) {
        printWarning(`⚠️ Não foi possível remover diretório temporário existente: ${rmError.message}`);
        throw new Error('Falha ao limpar diretório temporário');
      }
    }

    printDetail('🔄 Clonando repositório...');
    let gitProcess;
    try {
      gitProcess = exec(`git clone --depth 1 ${REPO_URL} "${TEMP_DIR}"`, (error) => {
        if (error) {
          printWarning(`❌ Falha ao clonar repositório: ${error.message}`);
          reject(error);
        }
      });
    } catch (execError) {
      printWarning(`❌ Falha ao iniciar processo Git: ${execError.message}`);
      throw new Error('Falha ao iniciar processo de download');
    }

    const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    const interval = setInterval(() => {
      process.stdout.write(`\r${spinner[i]} Baixando...`);
      i = (i + 1) % spinner.length;
    }, 100);

    return new Promise((resolve, reject) => {
      gitProcess.on('close', async (code) => {
        clearInterval(interval);
        process.stdout.write('\r                 \r');
        
        if (code !== 0) {
          printWarning(`❌ Git falhou com código de saída ${code}`);
          reject(new Error(`Git clone failed with exit code ${code}`));
          return;
        }

        // Verify the clone was successful
        if (!fsSync.existsSync(TEMP_DIR)) {
          reject(new Error('Diretório temporário não foi criado após o clone'));
          return;
        }

        // Check if it's a valid git repository
        const gitDir = path.join(TEMP_DIR, '.git');
        if (!fsSync.existsSync(gitDir)) {
          reject(new Error('Clone do repositório Git inválido'));
          return;
        }

        // Remove README.md as in the original code
        try {
          const readmePath = path.join(TEMP_DIR, 'README.md');
          if (fsSync.existsSync(readmePath)) {
            await fs.unlink(readmePath);
          }
        } catch (unlinkError) {
          printWarning(`⚠️ Não foi possível remover README.md: ${unlinkError.message}`);
          // Don't fail the entire process for this
        }

        printMessage('✅ Download concluído com sucesso.');
        resolve();
      });

      gitProcess.on('error', (error) => {
        clearInterval(interval);
        process.stdout.write('\r                 \r');
        printWarning(`❌ Erro no processo Git: ${error.message}`);
        reject(error);
      });
    });
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
      printDetail('📂 Preservando diretório de dados...');
      
      // Only remove specific files that need updating, not the entire dados directory
      const filesToClean = [
        'src/config.json',  // This will be restored from backup
        'src/.scripts',     // Old scripts that will be replaced
      ];
      
      for (const fileToClean of filesToClean) {
        const filePath = path.join(dadosDir, fileToClean);
        if (fsSync.existsSync(filePath)) {
          printDetail(`📂 Removendo arquivo antigo: ${fileToClean}...`);
          if (fsSync.statSync(filePath).isDirectory()) {
            await fs.rm(filePath, { recursive: true, force: true });
          } else {
            await fs.unlink(filePath);
          }
        }
      }
      
      printDetail('✅ Diretório de dados preservado com sucesso.');
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
      return 'MISSING_PACKAGE_JSON';
    }
    
    const currentPackage = JSON.parse(await fs.readFile(currentPackageJsonPath, 'utf8'));
    const newPackage = JSON.parse(await fs.readFile(newPackageJsonPath, 'utf8'));
    
    // Check for version compatibility
    if (currentPackage.version && newPackage.version && currentPackage.version !== newPackage.version) {
      printDetail(`📦 Versão alterada de ${currentPackage.version} para ${newPackage.version}`);
    }
    
    // Check Node.js version requirements
    if (newPackage.engines && newPackage.engines.node) {
      const currentNodeVersion = process.version;
      const requiredNodeVersion = newPackage.engines.node;
      
      if (!satisfiesNodeVersion(currentNodeVersion, requiredNodeVersion)) {
        printWarning(`⚠️ Versão do Node.js não compatível. Requer: ${requiredNodeVersion}, Atual: ${currentNodeVersion}`);
        return 'NODE_VERSION_MISMATCH';
      }
    }
    
    // Check main dependencies
    const currentDeps = JSON.stringify(currentPackage.dependencies || {});
    const newDeps = JSON.stringify(newPackage.dependencies || {});
    
    // Check dev dependencies
    const currentDevDeps = JSON.stringify(currentPackage.devDependencies || {});
    const newDevDeps = JSON.stringify(newPackage.devDependencies || {});
    
    // Check optional dependencies
    const currentOptDeps = JSON.stringify(currentPackage.optionalDependencies || {});
    const newOptDeps = JSON.stringify(newPackage.optionalDependencies || {});
    
    // Check npm scripts
    const currentScripts = JSON.stringify(currentPackage.scripts || {});
    const newScripts = JSON.stringify(newPackage.scripts || {});
    
    // Check for package.json structure changes
    const currentStructure = JSON.stringify({
      version: currentPackage.version,
      main: currentPackage.main,
      engines: currentPackage.engines,
      dependencies: currentPackage.dependencies,
      devDependencies: currentPackage.devDependencies,
      optionalDependencies: currentPackage.optionalDependencies,
      scripts: currentPackage.scripts
    });
    
    const newStructure = JSON.stringify({
      version: newPackage.version,
      main: newPackage.main,
      engines: newPackage.engines,
      dependencies: newPackage.dependencies,
      devDependencies: newPackage.devDependencies,
      optionalDependencies: newPackage.optionalDependencies,
      scripts: newPackage.scripts
    });
    
    if (currentDeps !== newDeps ||
        currentDevDeps !== newDevDeps ||
        currentOptDeps !== newOptDeps ||
        currentScripts !== newScripts ||
        currentStructure !== newStructure) {
      printDetail('📦 Configurações alteradas, reinstalação necessária');
      return 'DEPENDENCIES_CHANGED';
    }
    
    const nodeModulesPath = path.join(process.cwd(), 'node_modules');
    if (!fsSync.existsSync(nodeModulesPath)) {
      printDetail('📦 Diretório node_modules não encontrado, instalação necessária');
      return 'MISSING_NODE_MODULES';
    }
    
    // Verify all dependencies in package.json are installed
    const allDeps = {
      ...currentPackage.dependencies,
      ...currentPackage.devDependencies,
      ...currentPackage.optionalDependencies
    };
    
    for (const [depName, depVersion] of Object.entries(allDeps)) {
      const depPath = path.join(nodeModulesPath, depName);
      if (!fsSync.existsSync(depPath)) {
        printDetail(`📦 Dependência não encontrada: ${depName}`);
        return 'MISSING_DEPENDENCIES';
      }
    }
    
    printDetail('✅ Dependências inalteradas, reinstalação não necessária');
    return 'NO_CHANGES';
  } catch (error) {
    printWarning(`❌ Erro ao verificar dependências: ${error.message}`);
    return 'ERROR';
  }
}

// Helper function to check Node.js version compatibility
function satisfiesNodeVersion(currentVersion, requiredVersion) {
  // Simple version comparison - in a real implementation, you might want to use a proper semver library
  const current = currentVersion.replace('v', '').split('.').map(Number);
  const required = requiredVersion.replace('v', '').split('.').map(Number);
  
  for (let i = 0; i < Math.max(current.length, required.length); i++) {
    const currentPart = current[i] || 0;
    const requiredPart = required[i] || 0;
    
    if (currentPart > requiredPart) return true;
    if (currentPart < requiredPart) return false;
  }
  
  return true; // Versions are equal or current satisfies requirement
}

async function installDependencies() {
  const checkResult = await checkDependencyChanges();
  
  // Handle different check results
  if (checkResult === 'NO_CHANGES') {
    printMessage('⚡ Dependências já estão atualizadas, pulando instalação');
    return;
  }
  
  // Provide specific feedback based on the check result
  if (checkResult === 'MISSING_PACKAGE_JSON') {
    printWarning('❌ Arquivo package.json não encontrado. Instalação necessária.');
  } else if (checkResult === 'NODE_VERSION_MISMATCH') {
    printWarning('❌ Versão do Node.js não compatível. Instalação necessária.');
  } else if (checkResult === 'DEPENDENCIES_CHANGED') {
    printMessage('📦 Configurações de dependências alteradas, iniciando instalação...');
  } else if (checkResult === 'MISSING_NODE_MODULES') {
    printMessage('📦 Diretório node_modules não encontrado, iniciando instalação...');
  } else if (checkResult === 'MISSING_DEPENDENCIES') {
    printMessage('📦 Dependências ausentes detectadas, iniciando instalação...');
  } else if (checkResult === 'ERROR') {
    printWarning('❌ Erro ao verificar dependências. Tentando instalação como medida de segurança...');
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

      npmProcess.on('close', (code) => {
        clearInterval(interval);
        process.stdout.write('\r                                \r');
        
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`NPM install failed with exit code ${code}`));
        }
      });
    });

    // Verify installation was successful
    const nodeModulesPath = path.join(process.cwd(), 'node_modules');
    if (!fsSync.existsSync(nodeModulesPath)) {
      throw new Error('Diretório node_modules não foi criado após a instalação');
    }

    printMessage('✅ Dependências instaladas com sucesso.');
  } catch (error) {
    printWarning(`❌ Falha ao instalar dependências: ${error.message}`);
    printInfo('📝 Tente executar manualmente: npm run config:install');
    
    // Provide more specific guidance based on the error
    if (error.message.includes('EACCES')) {
      printInfo('🔒 Permissão negada. Tente executar como administrador/sudo.');
    } else if (error.message.includes('ENOTFOUND')) {
      printInfo('🌐 Rede não encontrada. Verifique sua conexão com a internet.');
    } else if (error.message.includes('npm ERR!')) {
      printInfo('📦 Erro no NPM. Verifique sua instalação do Node.js e NPM.');
    }
    
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
  let downloadSuccessful = false;
  let updateApplied = false;
  
  try {
    setupGracefulShutdown();
    await displayHeader();

    const steps = [
      { name: 'Verificando requisitos do sistema', func: checkRequirements },
      { name: 'Confirmando atualização', func: confirmUpdate },
      { name: 'Criando backup', func: async () => {
        await createBackup();
        backupCreated = true;
        // Verify backup was actually created before proceeding
        if (!fsSync.existsSync(BACKUP_DIR)) {
          throw new Error('Falha ao criar diretório de backup');
        }
      } },
      { name: 'Baixando a versão mais recente', func: async () => {
        await downloadUpdate();
        downloadSuccessful = true;
        // Verify download was successful before proceeding
        if (!fsSync.existsSync(TEMP_DIR)) {
          throw new Error('Falha ao baixar atualização');
        }
      } },
      { name: 'Limpando arquivos antigos', func: cleanOldFiles },
      { name: 'Aplicando atualização', func: async () => {
        await applyUpdate();
        updateApplied = true;
        // Verify update was applied successfully
        const newPackageJson = path.join(process.cwd(), 'package.json');
        if (!fsSync.existsSync(newPackageJson)) {
          throw new Error('Falha ao aplicar atualização - package.json ausente');
        }
      } },
      { name: 'Restaurando backup', func: restoreBackup },
      { name: 'Instalando dependências', func: installDependencies },
      { name: 'Finalizando e limpando', func: cleanup },
    ];

    let completedSteps = 0;
    const totalSteps = steps.length;

    for (const step of steps) {
      try {
        await step.func();
        completedSteps++;
        printDetail(`📊 Progresso: ${completedSteps}/${totalSteps} etapas concluídas.`);
      } catch (stepError) {
        printWarning(`❌ Falha na etapa "${step.name}": ${stepError.message}`);
        
        // If backup was created but update failed, try to restore
        if (backupCreated && !updateApplied && step.name !== 'Restaurando backup') {
          printInfo('🔄 Tentando restaurar backup devido a falha na atualização...');
          try {
            await restoreBackup();
            printInfo('✅ Backup restaurado com sucesso.');
          } catch (restoreError) {
            printWarning(`❌ Falha ao restaurar backup: ${restoreError.message}`);
          }
        }
        
        throw stepError; // Re-throw to be caught by the outer try-catch
      }
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
    
    // Enhanced error recovery
    if (backupCreated && !updateApplied) {
      try {
        await restoreBackup();
        printInfo('📂 Backup da versão antiga restaurado automaticamente.');
      } catch (restoreError) {
        printWarning(`❌ Falha ao restaurar backup automaticamente: ${restoreError.message}`);
      }
    } else if (backupCreated && downloadSuccessful && !updateApplied) {
      printWarning('⚠️ Download concluído, mas atualização não foi aplicada.');
      printInfo('🔄 Você pode tentar aplicar a atualização manualmente do diretório temporário.');
    } else if (!backupCreated) {
      printWarning('⚠️ Nenhum backup foi criado. Se houve falha, seus dados podem estar corrompidos.');
    }
    
    printWarning(`📂 Backup disponível em: ${BACKUP_DIR || 'Indisponível'}`);
    printInfo('📝 Para restaurar manualmente, copie os arquivos do backup para os diretórios correspondentes.');
    printInfo('📩 Em caso de dúvidas, contate o desenvolvedor.');
    
    // Exit with error code
    process.exit(1);
  }
}

main();