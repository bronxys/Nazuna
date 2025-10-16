import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

// Configuração de caminhos para o ambiente ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execAsync = promisify(exec);

class MediaCleaner {
    constructor() {
        this.baseDir = path.join(__dirname, '../../../');
        this.mediaDirs = [
            path.join(this.baseDir, 'dados/midias'),
            path.join(this.baseDir, 'temp'),
            '/tmp/nazuna-media',
            '/tmp/baileys_media_cache'
        ];
        this.tempPrefixes = ['tmp_', 'temp_', 'download_', 'media_', 'baileys_'];
        this.maxFileAge = 2 * 60 * 60 * 1000; // 2 horas para arquivos temporários
        this.maxMediaAge = 24 * 60 * 60 * 1000; // 24 horas para mídia em geral
        this.maxDirSize = 500 * 1024 * 1024; // 500MB por diretório
        this.allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.webm', '.mp3', '.ogg', '.webp', '.pdf'];
    }

    /**
     * Inicia limpeza automática de mídia
     */
    async startMediaCleaning() {
        console.log('🧹 Iniciando limpeza automática de mídia...');
        
        try {
            // Cria diretórios necessários
            await this.ensureDirectories();
            
            // Limpa cada diretório de mídia
            for (const dir of this.mediaDirs) {
                await this.cleanDirectory(dir);
            }
            
            // Limpa cache do Baileys
            await this.cleanBaileysCache();
            
            // Limpa downloads antigos
            await this.cleanOldDownloads();
            
            console.log('✅ Limpeza automática de mídia concluída');
        } catch (error) {
            console.error('❌ Erro na limpeza automática de mídia:', error.message);
        }
    }

    /**
     * Garante que os diretórios necessários existem
     */
    async ensureDirectories() {
        for (const dir of this.mediaDirs) {
            try {
                await fs.access(dir);
            } catch {
                try {
                    await fs.mkdir(dir, { recursive: true });
                    console.log(`📁 Diretório criado: ${dir}`);
                } catch (error) {
                    console.warn(`⚠️ Não foi possível criar diretório ${dir}:`, error.message);
                }
            }
        }
    }

    /**
     * Limpa um diretório específico
     */
    async cleanDirectory(dirPath) {
        try {
            const exists = await fs.access(dirPath).then(() => true).catch(() => false);
            if (!exists) {
                console.log(`📁 Diretório não existe: ${dirPath}`);
                return { deletedFiles: 0, freedSpace: 0 };
            }

            const files = await fs.readdir(dirPath);
            let deletedFiles = 0;
            let freedSpace = 0;

            console.log(`🔍 Analisando diretório: ${dirPath} (${files.length} arquivos)`);

            for (const file of files) {
                const filePath = path.join(dirPath, file);
                
                try {
                    const stats = await fs.stat(filePath);
                    
                    // Pula diretórios
                    if (stats.isDirectory()) continue;
                    
                    const shouldDelete = await this.shouldDeleteFile(filePath, stats);
                    
                    if (shouldDelete) {
                        freedSpace += stats.size;
                        await fs.unlink(filePath);
                        deletedFiles++;
                        console.log(`🗑️ Arquivo removido: ${file} (${this.formatBytes(stats.size)})`);
                    }
                } catch (error) {
                    console.warn(`⚠️ Erro ao processar arquivo ${file}:`, error.message);
                }
            }

            if (deletedFiles > 0) {
                console.log(`✅ ${dirPath}: ${deletedFiles} arquivos removidos, ${this.formatBytes(freedSpace)} liberados`);
            }

            return { deletedFiles, freedSpace };
        } catch (error) {
            console.error(`❌ Erro ao limpar diretório ${dirPath}:`, error.message);
            return { deletedFiles: 0, freedSpace: 0 };
        }
    }

    /**
     * Determina se um arquivo deve ser deletado
     */
    async shouldDeleteFile(filePath, stats) {
        const fileName = path.basename(filePath);
        const fileExt = path.extname(filePath).toLowerCase();
        const fileAge = Date.now() - stats.mtime.getTime();
        
        // Remove arquivos com extensões não permitidas
        if (!this.allowedExtensions.includes(fileExt) && fileExt !== '') {
            return true;
        }
        
        // Remove arquivos temporários antigos
        const isTemp = this.tempPrefixes.some(prefix => fileName.startsWith(prefix));
        if (isTemp && fileAge > this.maxFileAge) {
            return true;
        }
        
        // Remove mídia muito antiga
        if (fileAge > this.maxMediaAge) {
            return true;
        }
        
        // Remove arquivos muito grandes (>50MB)
        if (stats.size > 50 * 1024 * 1024) {
            return true;
        }
        
        // Remove arquivos corrompidos ou ilegíveis
        if (await this.isFileCorrupted(filePath)) {
            return true;
        }
        
        return false;
    }

    /**
     * Verifica se um arquivo está corrompido
     */
    async isFileCorrupted(filePath) {
        try {
            const fileExt = path.extname(filePath).toLowerCase();
            
            // Verifica imagens
            if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(fileExt)) {
                try {
                    await execAsync(`identify "${filePath}"`, { timeout: 5000 });
                    return false;
                } catch {
                    return true;
                }
            }
            
            // Verifica vídeos
            if (['.mp4', '.webm', '.avi', '.mkv'].includes(fileExt)) {
                try {
                    await execAsync(`ffprobe -v quiet -print_format json -show_format "${filePath}"`, { timeout: 10000 });
                    return false;
                } catch {
                    return true;
                }
            }
            
            // Para outros tipos, verifica se é legível
            const stats = await fs.stat(filePath);
            return stats.size === 0;
        } catch {
            return true;
        }
    }

    /**
     * Limpa cache específico do Baileys
     */
    async cleanBaileysCache() {
        const cacheLocations = [
            '/tmp/baileys_media_cache',
            path.join(this.baseDir, 'node_modules/@cognima/walib/cache'),
            path.join(this.baseDir, 'dados/database/baileys_cache')
        ];

        for (const location of cacheLocations) {
            try {
                const exists = await fs.access(location).then(() => true).catch(() => false);
                if (exists) {
                    await this.cleanDirectory(location);
                }
            } catch (error) {
                console.warn(`⚠️ Erro ao limpar cache Baileys em ${location}:`, error.message);
            }
        }
    }

    /**
     * Limpa downloads antigos
     */
    async cleanOldDownloads() {
        const downloadPaths = [
            path.join(process.env.HOME || '/tmp', 'Downloads/nazuna_*'),
            '/tmp/nazuna_downloads',
            path.join(this.baseDir, 'downloads')
        ];

        for (const downloadPath of downloadPaths) {
            try {
                if (downloadPath.includes('*')) {
                    // Usa glob pattern
                    const { stdout } = await execAsync(`find ${path.dirname(downloadPath)} -name "${path.basename(downloadPath)}" -type f 2>/dev/null || true`);
                    const files = stdout.trim().split('\n').filter(f => f);
                    
                    for (const file of files) {
                        try {
                            const stats = await fs.stat(file);
                            const age = Date.now() - stats.mtime.getTime();
                            
                            if (age > this.maxMediaAge) {
                                await fs.unlink(file);
                                console.log(`🗑️ Download antigo removido: ${path.basename(file)}`);
                            }
                        } catch (error) {
                            console.warn(`⚠️ Erro ao processar download ${file}:`, error.message);
                        }
                    }
                } else {
                    const exists = await fs.access(downloadPath).then(() => true).catch(() => false);
                    if (exists) {
                        await this.cleanDirectory(downloadPath);
                    }
                }
            } catch (error) {
                console.warn(`⚠️ Erro ao limpar downloads em ${downloadPath}:`, error.message);
            }
        }
    }

    /**
     * Verifica se o diretório excede o tamanho máximo
     */
    async getDirectorySize(dirPath) {
        try {
            const { stdout } = await execAsync(`du -sb "${dirPath}" 2>/dev/null || echo "0"`);
            return parseInt(stdout.split('\t')[0]) || 0;
        } catch {
            return 0;
        }
    }

    /**
     * Remove arquivos mais antigos até atingir o tamanho limite
     */
    async enforceDirectoryLimit(dirPath) {
        try {
            const currentSize = await this.getDirectorySize(dirPath);
            
            if (currentSize <= this.maxDirSize) {
                return { success: true, freedSpace: 0 };
            }

            console.log(`📏 Diretório ${dirPath} excede limite (${this.formatBytes(currentSize)}/${this.formatBytes(this.maxDirSize)})`);

            const files = await fs.readdir(dirPath);
            const fileStats = [];

            for (const file of files) {
                const filePath = path.join(dirPath, file);
                try {
                    const stats = await fs.stat(filePath);
                    if (!stats.isDirectory()) {
                        fileStats.push({
                            path: filePath,
                            name: file,
                            size: stats.size,
                            mtime: stats.mtime.getTime()
                        });
                    }
                } catch (error) {
                    console.warn(`⚠️ Erro ao obter stats do arquivo ${file}:`, error.message);
                }
            }

            // Ordena por data de modificação (mais antigos primeiro)
            fileStats.sort((a, b) => a.mtime - b.mtime);

            let deletedFiles = 0;
            let freedSpace = 0;
            let remainingSize = currentSize;

            for (const file of fileStats) {
                if (remainingSize <= this.maxDirSize) break;

                try {
                    await fs.unlink(file.path);
                    remainingSize -= file.size;
                    freedSpace += file.size;
                    deletedFiles++;
                    console.log(`🗑️ Arquivo antigo removido por limite: ${file.name} (${this.formatBytes(file.size)})`);
                } catch (error) {
                    console.warn(`⚠️ Erro ao remover arquivo ${file.name}:`, error.message);
                }
            }

            console.log(`✅ Limite aplicado: ${deletedFiles} arquivos removidos, ${this.formatBytes(freedSpace)} liberados`);
            
            return { success: true, deletedFiles, freedSpace };
        } catch (error) {
            console.error(`❌ Erro ao aplicar limite do diretório ${dirPath}:`, error.message);
            return { success: false };
        }
    }

    /**
     * Comprime mídia grande
     */
    async compressLargeMedia() {
        console.log('📦 Iniciando compressão de mídia grande...');
        
        for (const dir of this.mediaDirs) {
            try {
                const exists = await fs.access(dir).then(() => true).catch(() => false);
                if (!exists) continue;

                await this.compressMediaInDirectory(dir);
            } catch (error) {
                console.warn(`⚠️ Erro ao comprimir mídia em ${dir}:`, error.message);
            }
        }
    }

    /**
     * Comprime mídia em um diretório específico
     */
    async compressMediaInDirectory(dirPath) {
        try {
            const files = await fs.readdir(dirPath);
            let compressedCount = 0;
            let spaceSaved = 0;

            for (const file of files) {
                const filePath = path.join(dirPath, file);
                const fileExt = path.extname(file).toLowerCase();
                
                try {
                    const stats = await fs.stat(filePath);
                    if (stats.isDirectory()) continue;

                    // Comprimir imagens grandes (>2MB)
                    if (['.jpg', '.jpeg', '.png'].includes(fileExt) && stats.size > 2 * 1024 * 1024) {
                        const result = await this.compressImage(filePath);
                        if (result.success) {
                            spaceSaved += result.spaceSaved;
                            compressedCount++;
                        }
                    }
                    
                    // Comprimir vídeos grandes (>10MB)
                    if (['.mp4', '.webm'].includes(fileExt) && stats.size > 10 * 1024 * 1024) {
                        const result = await this.compressVideo(filePath);
                        if (result.success) {
                            spaceSaved += result.spaceSaved;
                            compressedCount++;
                        }
                    }
                } catch (error) {
                    console.warn(`⚠️ Erro ao comprimir ${file}:`, error.message);
                }
            }

            if (compressedCount > 0) {
                console.log(`📦 ${dirPath}: ${compressedCount} arquivos comprimidos, ${this.formatBytes(spaceSaved)} economizados`);
            }
        } catch (error) {
            console.error(`❌ Erro na compressão do diretório ${dirPath}:`, error.message);
        }
    }

    /**
     * Comprime uma imagem
     */
    async compressImage(filePath) {
        try {
            const originalStats = await fs.stat(filePath);
            const tempPath = filePath + '.compressed';
            
            // Usa ImageMagick para comprimir (se disponível)
            try {
                await execAsync(`convert "${filePath}" -quality 75 -resize 1920x1920> "${tempPath}"`, { timeout: 30000 });
                
                const compressedStats = await fs.stat(tempPath);
                
                // Só substitui se a compressão foi significativa (>20% de economia)
                if (compressedStats.size < originalStats.size * 0.8) {
                    await fs.rename(tempPath, filePath);
                    return {
                        success: true,
                        spaceSaved: originalStats.size - compressedStats.size
                    };
                } else {
                    await fs.unlink(tempPath);
                    return { success: false };
                }
            } catch {
                // Se ImageMagick não estiver disponível, tenta com ffmpeg
                await execAsync(`ffmpeg -i "${filePath}" -q:v 8 -y "${tempPath}"`, { timeout: 30000 });
                
                const compressedStats = await fs.stat(tempPath);
                
                if (compressedStats.size < originalStats.size * 0.8) {
                    await fs.rename(tempPath, filePath);
                    return {
                        success: true,
                        spaceSaved: originalStats.size - compressedStats.size
                    };
                } else {
                    await fs.unlink(tempPath);
                    return { success: false };
                }
            }
        } catch (error) {
            console.warn(`⚠️ Erro ao comprimir imagem ${filePath}:`, error.message);
            return { success: false };
        }
    }

    /**
     * Comprime um vídeo
     */
    async compressVideo(filePath) {
        try {
            const originalStats = await fs.stat(filePath);
            const tempPath = filePath + '.compressed.mp4';
            
            // Comprime vídeo com ffmpeg
            await execAsync(`ffmpeg -i "${filePath}" -c:v libx264 -preset fast -crf 28 -c:a aac -b:a 128k -y "${tempPath}"`, { timeout: 60000 });
            
            const compressedStats = await fs.stat(tempPath);
            
            // Só substitui se a compressão foi significativa
            if (compressedStats.size < originalStats.size * 0.7) {
                await fs.unlink(filePath);
                await fs.rename(tempPath, filePath);
                return {
                    success: true,
                    spaceSaved: originalStats.size - compressedStats.size
                };
            } else {
                await fs.unlink(tempPath);
                return { success: false };
            }
        } catch (error) {
            console.warn(`⚠️ Erro ao comprimir vídeo ${filePath}:`, error.message);
            return { success: false };
        }
    }

    /**
     * Formata bytes para formato legível
     */
    formatBytes(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Inicia limpeza programada
     */
    startScheduledCleaning() {
        console.log('⏰ Iniciando limpeza programada de mídia...');
        
        // Limpeza rápida a cada 10 minutos
        setInterval(async () => {
            await this.startMediaCleaning();
        }, 10 * 60 * 1000);

        // Limpeza profunda a cada hora
        setInterval(async () => {
            await this.compressLargeMedia();
            for (const dir of this.mediaDirs) {
                await this.enforceDirectoryLimit(dir);
            }
        }, 60 * 60 * 1000);

        // Executa limpeza inicial após 30 segundos
        setTimeout(() => {
            this.startMediaCleaning();
        }, 30000);
    }
}

export default MediaCleaner;