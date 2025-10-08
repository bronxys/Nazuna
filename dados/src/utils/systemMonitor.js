import fs from 'fs/promises';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SystemMonitor {
    constructor() {
        this.tempDir = path.join(__dirname, '../../temp');
        this.mediaDir = path.join(__dirname, '../../midias');
        this.maxDiskUsage = 90; // Porcentagem máxima de uso do disco
        this.cleanupInterval = 5 * 60 * 1000; // 5 minutos
        this.fileAgeLimit = 24 * 60 * 60 * 1000; // 24 horas
        this.isMonitoring = false;
        this.mediaCache = new Map();
        this.maxCacheSize = 100; // Máximo de arquivos no cache
    }

    /**
     * Obtém informações de uso do disco
     */
    async getDiskUsage() {
        try {
            const stdout = execSync('df -h / | tail -1', { encoding: 'utf8' });
            const parts = stdout.trim().split(/\s+/);
            const used = parts[4].replace('%', '');
            return {
                used: parseInt(used),
                available: parts[3],
                total: parts[1]
            };
        } catch (error) {
            console.error('❌ Erro ao obter uso do disco:', error.message);
            return { used: 0, available: '0', total: '0' };
        }
    }

    /**
     * Obtém informações de uso de memória
     */
    async getMemoryUsage() {
        try {
            const memInfo = await fs.readFile('/proc/meminfo', 'utf8');
            const lines = memInfo.split('\n');
            
            const getMemValue = (key) => {
                const line = lines.find(l => l.startsWith(key));
                return line ? parseInt(line.match(/\d+/)[0]) : 0;
            };

            const memTotal = getMemValue('MemTotal');
            const memFree = getMemValue('MemFree');
            const memBuffers = getMemValue('Buffers');
            const memCached = getMemValue('Cached');
            
            const memUsed = memTotal - memFree - memBuffers - memCached;
            const memUsedPercent = Math.round((memUsed / memTotal) * 100);

            return {
                total: Math.round(memTotal / 1024), // MB
                used: Math.round(memUsed / 1024), // MB
                free: Math.round((memTotal - memUsed) / 1024), // MB
                usedPercent: memUsedPercent
            };
        } catch (error) {
            console.error('❌ Erro ao obter uso de memória:', error.message);
            return { total: 0, used: 0, free: 0, usedPercent: 0 };
        }
    }

    /**
     * Limpa arquivos temporários antigos
     */
    async cleanTempFiles() {
        try {
            await this.ensureDirectoryExists(this.tempDir);
            const files = await fs.readdir(this.tempDir);
            let deletedCount = 0;
            let freedSpace = 0;

            for (const file of files) {
                const filePath = path.join(this.tempDir, file);
                try {
                    const stats = await fs.stat(filePath);
                    const age = Date.now() - stats.mtime.getTime();
                    
                    if (age > this.fileAgeLimit) {
                        freedSpace += stats.size;
                        await fs.unlink(filePath);
                        deletedCount++;
                    }
                } catch (error) {
                    console.warn(`⚠️ Erro ao processar arquivo ${file}:`, error.message);
                }
            }

            if (deletedCount > 0) {
                const freedMB = Math.round(freedSpace / (1024 * 1024));
                console.log(`🧹 Limpeza automática: ${deletedCount} arquivos removidos, ${freedMB}MB liberados`);
            }

            return { deletedCount, freedSpace };
        } catch (error) {
            console.error('❌ Erro na limpeza de arquivos temporários:', error.message);
            return { deletedCount: 0, freedSpace: 0 };
        }
    }

    /**
     * Limpa cache de mídia antigo
     */
    async cleanMediaCache() {
        try {
            if (this.mediaCache.size <= this.maxCacheSize) return { cleared: 0 };

            const entries = Array.from(this.mediaCache.entries());
            entries.sort((a, b) => a[1].lastAccess - b[1].lastAccess);
            
            const toRemove = entries.slice(0, entries.length - this.maxCacheSize);
            let freedMemory = 0;

            for (const [key, value] of toRemove) {
                if (value.buffer) {
                    freedMemory += value.buffer.length;
                }
                this.mediaCache.delete(key);
            }

            console.log(`🗃️ Cache de mídia limpo: ${toRemove.length} itens removidos, ~${Math.round(freedMemory / (1024 * 1024))}MB liberados`);
            
            return { cleared: toRemove.length, freedMemory };
        } catch (error) {
            console.error('❌ Erro na limpeza do cache de mídia:', error.message);
            return { cleared: 0, freedMemory: 0 };
        }
    }

    /**
     * Comprime arquivos de mídia grandes
     */
    async compressLargeFiles() {
        try {
            await this.ensureDirectoryExists(this.mediaDir);
            const files = await fs.readdir(this.mediaDir);
            let compressedCount = 0;
            let spaceSaved = 0;

            for (const file of files) {
                const filePath = path.join(this.mediaDir, file);
                try {
                    const stats = await fs.stat(filePath);
                    const sizeMB = stats.size / (1024 * 1024);
                    
                    // Comprimir arquivos maiores que 10MB
                    if (sizeMB > 10) {
                        const originalSize = stats.size;
                        const compressed = await this.compressFile(filePath);
                        
                        if (compressed.success) {
                            spaceSaved += (originalSize - compressed.newSize);
                            compressedCount++;
                        }
                    }
                } catch (error) {
                    console.warn(`⚠️ Erro ao processar arquivo ${file}:`, error.message);
                }
            }

            if (compressedCount > 0) {
                const savedMB = Math.round(spaceSaved / (1024 * 1024));
                console.log(`📦 Compressão automática: ${compressedCount} arquivos comprimidos, ${savedMB}MB economizados`);
            }

            return { compressedCount, spaceSaved };
        } catch (error) {
            console.error('❌ Erro na compressão de arquivos:', error.message);
            return { compressedCount: 0, spaceSaved: 0 };
        }
    }

    /**
     * Força garbage collection manual
     */
    forceGarbageCollection() {
        try {
            if (global.gc) {
                global.gc();
                console.log('🗑️ Garbage collection executado manualmente');
            } else {
                console.warn('⚠️ Garbage collection não disponível (execute com --expose-gc)');
            }
        } catch (error) {
            console.error('❌ Erro no garbage collection:', error.message);
        }
    }

    /**
     * Verifica se o sistema precisa de limpeza emergencial
     */
    async needsEmergencyCleanup() {
        const diskUsage = await this.getDiskUsage();
        const memUsage = await this.getMemoryUsage();
        
        return {
            disk: diskUsage.used >= this.maxDiskUsage,
            memory: memUsage.usedPercent >= 85,
            critical: diskUsage.used >= 95 || memUsage.usedPercent >= 95
        };
    }

    /**
     * Executa limpeza emergencial
     */
    async performEmergencyCleanup() {
        console.log('🚨 Iniciando limpeza emergencial do sistema...');
        
        const results = {
            tempFiles: await this.cleanTempFiles(),
            mediaCache: await this.cleanMediaCache(),
            mediaCompression: await this.compressLargeFiles()
        };

        // Força garbage collection
        this.forceGarbageCollection();

        // Remove arquivos de log antigos
        await this.cleanOldLogs();

        const totalFreed = results.tempFiles.freedSpace + results.mediaCompression.spaceSaved;
        const totalFreedMB = Math.round(totalFreed / (1024 * 1024));

        console.log(`✅ Limpeza emergencial concluída: ${totalFreedMB}MB liberados`);
        
        return results;
    }

    /**
     * Remove logs antigos
     */
    async cleanOldLogs() {
        try {
            const logPaths = [
                path.join(__dirname, '../../logs'),
                '/tmp/nazuna-logs',
                './logs'
            ];

            let deletedLogs = 0;
            
            for (const logPath of logPaths) {
                try {
                    await this.ensureDirectoryExists(logPath);
                    const files = await fs.readdir(logPath);
                    
                    for (const file of files) {
                        if (file.endsWith('.log') || file.endsWith('.txt')) {
                            const filePath = path.join(logPath, file);
                            const stats = await fs.stat(filePath);
                            const age = Date.now() - stats.mtime.getTime();
                            
                            // Remove logs com mais de 7 dias
                            if (age > 7 * 24 * 60 * 60 * 1000) {
                                await fs.unlink(filePath);
                                deletedLogs++;
                            }
                        }
                    }
                } catch (error) {
                    // Ignora erros de diretórios que não existem
                }
            }

            if (deletedLogs > 0) {
                console.log(`📜 ${deletedLogs} arquivos de log antigos removidos`);
            }
        } catch (error) {
            console.error('❌ Erro na limpeza de logs:', error.message);
        }
    }

    /**
     * Inicia monitoramento contínuo
     */
    startMonitoring() {
        if (this.isMonitoring) return;
        
        this.isMonitoring = true;
        console.log('👁️ Sistema de monitoramento iniciado');

        const monitor = async () => {
            try {
                const needsCleanup = await this.needsEmergencyCleanup();
                
                if (needsCleanup.critical) {
                    console.log('🚨 CRÍTICO: Sistema com recursos muito baixos!');
                    await this.performEmergencyCleanup();
                } else if (needsCleanup.disk || needsCleanup.memory) {
                    console.log('⚠️ Recursos do sistema baixos, executando limpeza...');
                    await this.cleanTempFiles();
                    await this.cleanMediaCache();
                    this.forceGarbageCollection();
                }
            } catch (error) {
                console.error('❌ Erro no monitoramento do sistema:', error.message);
            }
        };

        // Monitora a cada intervalo definido
        setInterval(monitor, this.cleanupInterval);
        
        // Executa uma verificação inicial
        setTimeout(monitor, 5000);
    }

    /**
     * Para o monitoramento
     */
    stopMonitoring() {
        this.isMonitoring = false;
        console.log('👁️ Sistema de monitoramento parado');
    }

    /**
     * Garante que um diretório existe
     */
    async ensureDirectoryExists(dirPath) {
        try {
            await fs.access(dirPath);
        } catch {
            await fs.mkdir(dirPath, { recursive: true });
        }
    }

    /**
     * Comprime um arquivo (placeholder - implementar compressão real)
     */
    async compressFile(filePath) {
        try {
            // Implementar compressão real aqui (ffmpeg para vídeos, sharp para imagens, etc.)
            const stats = await fs.stat(filePath);
            return {
                success: false, // Por enquanto retorna false até implementar compressão real
                originalSize: stats.size,
                newSize: stats.size
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Obtém estatísticas do sistema
     */
    async getSystemStats() {
        const disk = await this.getDiskUsage();
        const memory = await this.getMemoryUsage();
        
        return {
            disk,
            memory,
            cacheSize: this.mediaCache.size,
            isMonitoring: this.isMonitoring,
            timestamp: new Date().toISOString()
        };
    }
}

export default SystemMonitor;