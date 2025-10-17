import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuração de caminhos para o ambiente ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execAsync = promisify(exec);

class MediaCompressor {
    constructor() {
        this.tempDir = path.join(__dirname, '../../../temp/compression');
        this.compressionQueue = [];
        this.isProcessing = false;
        this.maxConcurrentCompressions = 2;
        this.activeCompressions = 0;
        
        this.settings = {
            image: {
                quality: 80,
                maxWidth: 1920,
                maxHeight: 1920,
                format: 'auto', // auto, jpg, webp, png
                stripMetadata: true
            },
            video: {
                quality: 28, // CRF value (lower = better quality)
                maxWidth: 1280,
                maxHeight: 720,
                fps: 30,
                audioBitrate: '128k',
                codec: 'h264' // h264, h265, vp9
            },
            audio: {
                bitrate: '128k',
                format: 'mp3', // mp3, aac, ogg
                normalize: true
            },
            general: {
                autoCompress: true,
                sizeThreshold: 5 * 1024 * 1024, // 5MB
                compressionRatio: 0.7, // Mínimo 30% de redução
                keepOriginal: false
            }
        };

        this.supportedFormats = {
            image: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'],
            video: ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv'],
            audio: ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a']
        };

        this.init();
    }

    /**
     * Inicializa o compressor
     */
    async init() {
        try {
            await this.ensureTempDirectory();
            await this.checkDependencies();
            this.startQueueProcessor();
        } catch (error) {
            console.error('❌ Erro ao inicializar compressor:', error.message);
        }
    }

    /**
     * Garante que o diretório temporário existe
     */
    async ensureTempDirectory() {
        try {
            await fs.access(this.tempDir);
        } catch {
            await fs.mkdir(this.tempDir, { recursive: true });
        }
    }

    /**
     * Verifica dependências necessárias
     */
    async checkDependencies() {
        const dependencies = [
            { cmd: 'ffmpeg -version', name: 'FFmpeg' },
            { cmd: 'convert -version', name: 'ImageMagick' }
        ];

        for (const dep of dependencies) {
            try {
                await execAsync(dep.cmd, { timeout: 5000 });
            } catch (error) {
                console.warn(`⚠️ ${dep.name} não disponível:`, error.message);
            }
        }
    }

    /**
     * Adiciona arquivo à fila de compressão
     */
    async compressFile(filePath, options = {}) {
        try {
            const stats = await fs.stat(filePath);
            const fileExt = path.extname(filePath).toLowerCase();
            const mediaType = this.getMediaType(fileExt);

            if (!mediaType) {
                return { success: false, error: 'Formato não suportado' };
            }

            // Verifica se precisa comprimir
            if (!this.shouldCompress(stats.size, options)) {
                return { success: false, error: 'Arquivo não precisa de compressão' };
            }

            const compressionTask = {
                id: this.generateTaskId(),
                filePath,
                mediaType,
                originalSize: stats.size,
                options: { ...this.settings[mediaType], ...options },
                timestamp: Date.now(),
                retries: 0,
                maxRetries: 2
            };

            this.compressionQueue.push(compressionTask);
            
            return {
                success: true,
                taskId: compressionTask.id,
                queuePosition: this.compressionQueue.length,
                estimatedWait: this.estimateWaitTime()
            };
        } catch (error) {
            console.error('❌ Erro ao adicionar arquivo à compressão:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Verifica se arquivo deve ser comprimido
     */
    shouldCompress(fileSize, options = {}) {
        const threshold = options.sizeThreshold || this.settings.general.sizeThreshold;
        return fileSize > threshold;
    }

    /**
     * Determina tipo de mídia baseado na extensão
     */
    getMediaType(extension) {
        for (const [type, extensions] of Object.entries(this.supportedFormats)) {
            if (extensions.includes(extension)) {
                return type;
            }
        }
        return null;
    }

    /**
     * Inicia processador de fila
     */
    startQueueProcessor() {
        setInterval(async () => {
            await this.processQueue();
        }, 1000);
    }

    /**
     * Processa fila de compressão
     */
    async processQueue() {
        if (this.compressionQueue.length === 0 || 
            this.activeCompressions >= this.maxConcurrentCompressions) {
            return;
        }

        const task = this.compressionQueue.shift();
        this.activeCompressions++;

        try {
            const result = await this.processCompressionTask(task);
        } catch (error) {
            console.error(`❌ Erro na compressão de ${path.basename(task.filePath)}:`, error.message);
            
            if (task.retries < task.maxRetries) {
                task.retries++;
                this.compressionQueue.unshift(task);
            }
        } finally {
            this.activeCompressions--;
        }
    }

    /**
     * Processa uma tarefa de compressão
     */
    async processCompressionTask(task) {
        const { filePath, mediaType, originalSize, options } = task;
        const outputPath = await this.generateOutputPath(filePath, mediaType);

        let result;
        switch (mediaType) {
            case 'image':
                result = await this.compressImage(filePath, outputPath, options);
                break;
            case 'video':
                result = await this.compressVideo(filePath, outputPath, options);
                break;
            case 'audio':
                result = await this.compressAudio(filePath, outputPath, options);
                break;
            default:
                throw new Error(`Tipo de mídia não suportado: ${mediaType}`);
        }

        // Verifica se a compressão foi efetiva
        const compressionRatio = 1 - (result.newSize / originalSize);
        if (compressionRatio < (options.compressionRatio || this.settings.general.compressionRatio)) {
            // Compressão não foi efetiva, remove arquivo comprimido
            await fs.unlink(outputPath);
            throw new Error('Compressão não atingiu redução mínima');
        }

        // Substitui arquivo original se configurado
        if (!this.settings.general.keepOriginal) {
            await fs.unlink(filePath);
            await fs.rename(outputPath, filePath);
            result.outputPath = filePath;
        }

        return {
            ...result,
            originalSize,
            compressionRatio: Math.round(compressionRatio * 100)
        };
    }

    /**
     * Comprime imagem
     */
    async compressImage(inputPath, outputPath, options) {
        try {
            const { quality, maxWidth, maxHeight, format, stripMetadata } = options;
            
            // Tenta usar ImageMagick primeiro
            try {
                let cmd = `convert "${inputPath}"`;
                
                if (stripMetadata) {
                    cmd += ' -strip';
                }
                
                cmd += ` -resize ${maxWidth}x${maxHeight}>`;
                cmd += ` -quality ${quality}`;
                
                if (format !== 'auto') {
                    cmd += ` -format ${format}`;
                }
                
                cmd += ` "${outputPath}"`;
                
                await execAsync(cmd, { timeout: 30000 });
            } catch (imageMagickError) {
                // Fallback para FFmpeg
                let cmd = `ffmpeg -i "${inputPath}"`;
                cmd += ` -vf "scale=min(${maxWidth}\\,iw):min(${maxHeight}\\,ih):force_original_aspect_ratio=decrease"`;
                cmd += ` -q:v ${Math.round(quality / 10)}`;
                cmd += ` -y "${outputPath}"`;
                
                await execAsync(cmd, { timeout: 30000 });
            }

            const stats = await fs.stat(outputPath);
            return {
                success: true,
                outputPath,
                newSize: stats.size,
                method: 'image_compression'
            };
        } catch (error) {
            throw new Error(`Erro na compressão de imagem: ${error.message}`);
        }
    }

    /**
     * Comprime vídeo
     */
    async compressVideo(inputPath, outputPath, options) {
        try {
            const { quality, maxWidth, maxHeight, fps, audioBitrate, codec } = options;
            
            let cmd = `ffmpeg -i "${inputPath}"`;
            
            // Configurações de vídeo
            if (codec === 'h265') {
                cmd += ` -c:v libx265 -crf ${quality}`;
            } else if (codec === 'vp9') {
                cmd += ` -c:v libvpx-vp9 -crf ${quality}`;
            } else {
                cmd += ` -c:v libx264 -crf ${quality}`;
            }
            
            // Redimensionamento
            cmd += ` -vf "scale=min(${maxWidth}\\,iw):min(${maxHeight}\\,ih):force_original_aspect_ratio=decrease"`;
            
            // FPS
            cmd += ` -r ${fps}`;
            
            // Configurações de áudio
            cmd += ` -c:a aac -b:a ${audioBitrate}`;
            
            // Otimizações
            cmd += ` -preset fast -movflags +faststart`;
            
            cmd += ` -y "${outputPath}"`;
            
            await execAsync(cmd, { timeout: 300000 }); // 5 minutos timeout

            const stats = await fs.stat(outputPath);
            return {
                success: true,
                outputPath,
                newSize: stats.size,
                method: 'video_compression'
            };
        } catch (error) {
            throw new Error(`Erro na compressão de vídeo: ${error.message}`);
        }
    }

    /**
     * Comprime áudio
     */
    async compressAudio(inputPath, outputPath, options) {
        try {
            const { bitrate, format, normalize } = options;
            
            let cmd = `ffmpeg -i "${inputPath}"`;
            
            if (normalize) {
                cmd += ` -filter:a "volume=0.5"`;
            }
            
            cmd += ` -c:a ${format === 'mp3' ? 'libmp3lame' : 'aac'}`;
            cmd += ` -b:a ${bitrate}`;
            cmd += ` -y "${outputPath}"`;
            
            await execAsync(cmd, { timeout: 120000 }); // 2 minutos timeout

            const stats = await fs.stat(outputPath);
            return {
                success: true,
                outputPath,
                newSize: stats.size,
                method: 'audio_compression'
            };
        } catch (error) {
            throw new Error(`Erro na compressão de áudio: ${error.message}`);
        }
    }

    /**
     * Gera caminho de saída para arquivo comprimido
     */
    async generateOutputPath(inputPath, mediaType) {
        const parsedPath = path.parse(inputPath);
        const timestamp = Date.now();
        const outputName = `${parsedPath.name}_compressed_${timestamp}${parsedPath.ext}`;
        return path.join(this.tempDir, outputName);
    }

    /**
     * Compressão em lote para múltiplos arquivos
     */
    async compressBatch(filePaths, options = {}) {
        const results = [];
        
        for (const filePath of filePaths) {
            try {
                const result = await this.compressFile(filePath, options);
                results.push({ filePath, result });
            } catch (error) {
                console.error(`❌ Erro na compressão de ${filePath}:`, error.message);
                results.push({ filePath, result: { success: false, error: error.message } });
            }
        }
        
        const successful = results.filter(r => r.result.success).length;
        
        return results;
    }

    /**
     * Compressão automática baseada em tamanho
     */
    async autoCompress(filePath) {
        if (!this.settings.general.autoCompress) {
            return { success: false, reason: 'Auto-compressão desabilitada' };
        }

        try {
            const stats = await fs.stat(filePath);
            
            if (!this.shouldCompress(stats.size)) {
                return { success: false, reason: 'Arquivo abaixo do limite de tamanho' };
            }

            return await this.compressFile(filePath);
        } catch (error) {
            console.error('❌ Erro na auto-compressão:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Obtém informações de um arquivo de mídia
     */
    async getMediaInfo(filePath) {
        try {
            const stats = await fs.stat(filePath);
            const fileExt = path.extname(filePath).toLowerCase();
            const mediaType = this.getMediaType(fileExt);

            if (!mediaType) {
                return { error: 'Formato não suportado' };
            }

            // Usa ffprobe para obter informações detalhadas
            const { stdout } = await execAsync(
                `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`,
                { timeout: 10000 }
            );

            const info = JSON.parse(stdout);
            
            return {
                filePath,
                size: stats.size,
                sizeFormatted: this.formatBytes(stats.size),
                mediaType,
                duration: info.format?.duration,
                bitrate: info.format?.bit_rate,
                streams: info.streams?.length || 0,
                needsCompression: this.shouldCompress(stats.size)
            };
        } catch (error) {
            console.error('❌ Erro ao obter informações da mídia:', error.message);
            return { error: error.message };
        }
    }

    /**
     * Gera ID único para tarefa
     */
    generateTaskId() {
        return `compress_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Estima tempo de espera na fila
     */
    estimateWaitTime() {
        // Estima baseado no número de tarefas na fila
        const avgCompressionTime = 30000; // 30 segundos por arquivo
        return this.compressionQueue.length * avgCompressionTime;
    }

    /**
     * Formata bytes para leitura humana
     */
    formatBytes(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Obtém estatísticas do compressor
     */
    getStatistics() {
        return {
            queueSize: this.compressionQueue.length,
            activeCompressions: this.activeCompressions,
            maxConcurrent: this.maxConcurrentCompressions,
            settings: this.settings,
            supportedFormats: this.supportedFormats
        };
    }

    /**
     * Atualiza configurações de compressão
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
    }

    /**
     * Limpa arquivos temporários
     */
    async cleanupTemp() {
        try {
            const files = await fs.readdir(this.tempDir);
            let cleanedCount = 0;

            for (const file of files) {
                const filePath = path.join(this.tempDir, file);
                const stats = await fs.stat(filePath);
                
                // Remove arquivos com mais de 1 hora
                if (Date.now() - stats.mtime.getTime() > 60 * 60 * 1000) {
                    await fs.unlink(filePath);
                    cleanedCount++;
                }
            }

            if (cleanedCount > 0) {
            }
        } catch (error) {
            console.error('❌ Erro na limpeza de arquivos temporários:', error.message);
        }
    }

    /**
     * Para o compressor e limpa recursos
     */
    async stop() {
        
        // Aguarda compressões ativas terminarem
        while (this.activeCompressions > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Limpa arquivos temporários
        await this.cleanupTemp();
        
    }
}

export default MediaCompressor;