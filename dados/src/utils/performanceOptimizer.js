import SystemMonitor from './systemMonitor.js';
import MediaCleaner from './mediaCleaner.js';
import AutoRestarter from './autoRestarter.js';
import OptimizedCacheManager from './optimizedCache.js';
import MediaCompressor from './mediaCompressor.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PerformanceOptimizer {
    constructor() {
        this.modules = {};
        this.isInitialized = false;
        this.stats = {
            startTime: Date.now(),
            uptimeOptimized: 0,
            totalOptimizations: 0,
            memoryFreed: 0,
            diskFreed: 0,
            restartCount: 0
        };
        
        this.config = {
            enableSystemMonitor: true,
            enableMediaCleaner: true,
            enableAutoRestarter: true,
            enableOptimizedCache: true,
            enableMediaCompressor: true,
            
            // Configurações de limpeza
            cleanupInterval: 10 * 60 * 1000, // 10 minutos
            optimizationInterval: 5 * 60 * 1000, // 5 minutos
            reportingInterval: 60 * 60 * 1000, // 1 hora
            
            // Configurações de sistema
            memoryThreshold: 85, // 85% da memória
            diskThreshold: 90, // 90% do disco
            
            // Configurações de cache
            cacheOptimizationInterval: 15 * 60 * 1000, // 15 minutos
            maxCacheSize: 500 * 1024 * 1024, // 500MB
            
            // Configurações de mídia
            maxMediaSize: 50 * 1024 * 1024, // 50MB
            compressImages: true,
            compressVideos: true,
            compressAudio: false
        };
        
        this.timers = {};
    }

    async initialize() {
        console.log('🔧 Inicializando sistema de otimização...');
        
        try {
            // Inicializa módulos essenciais
            await this.initializeModules();
            
            // Inicia timers de otimização
            this.startAutoOptimization();
            this.startPerformanceReporting();
            
            this.isInitialized = true;
            console.log('✅ Sistema de otimização inicializado com sucesso!');
            
            return true;
        } catch (error) {
            console.error('❌ Erro ao inicializar sistema de otimização:', error.message);
            this.isInitialized = false;
            return false;
        }
    }

    async initializeModules() {
        const modulesToInit = [
            { name: 'systemMonitor', class: SystemMonitor, enabled: this.config.enableSystemMonitor },
            { name: 'mediaCleaner', class: MediaCleaner, enabled: this.config.enableMediaCleaner },
            { name: 'autoRestarter', class: AutoRestarter, enabled: this.config.enableAutoRestarter },
            { name: 'cacheManager', class: OptimizedCacheManager, enabled: this.config.enableOptimizedCache },
            { name: 'mediaCompressor', class: MediaCompressor, enabled: this.config.enableMediaCompressor }
        ];

        for (const module of modulesToInit) {
            if (module.enabled) {
                try {
                    this.modules[module.name] = new module.class();
                    
                    // Inicializa módulo se tem método initialize
                    if (typeof this.modules[module.name].initialize === 'function') {
                        await this.modules[module.name].initialize();
                    }
                    
                    console.log(`✅ Módulo ${module.name} inicializado`);
                } catch (error) {
                    console.error(`❌ Erro ao inicializar ${module.name}:`, error.message);
                    this.modules[module.name] = null;
                }
            }
        }
    }

    startAutoOptimization() {
        // Timer de otimização automática
        this.timers.optimization = setInterval(async () => {
            await this.performAutoOptimization();
        }, this.config.optimizationInterval);

        // Timer de limpeza de cache
        this.timers.cacheOptimization = setInterval(async () => {
            await this.optimizeCaches();
        }, this.config.cacheOptimizationInterval);

        console.log('🔄 Sistema de otimização automática iniciado');
    }

    async performAutoOptimization() {
        if (!this.isInitialized) return;

        try {
            const startTime = Date.now();
            
            // Verifica status do sistema
            const systemStatus = await this.getSystemStatus();
            
            // Otimizações baseadas no status
            if (systemStatus.memoryUsage > this.config.memoryThreshold) {
                await this.freeMemory();
            }
            
            if (systemStatus.diskUsage > this.config.diskThreshold) {
                await this.freeDiskSpace();
            }
            
            // Força garbage collection se necessário
            if (this.shouldForceGarbageCollection()) {
                this.forceGarbageCollection();
            }
            
            const duration = Date.now() - startTime;
            this.stats.totalOptimizations++;
            
            console.log(`🚀 Otimização automática concluída em ${duration}ms`);
            
        } catch (error) {
            console.error('❌ Erro na otimização automática:', error.message);
        }
    }

    async getSystemStatus() {
        const status = {
            memoryUsage: 0,
            diskUsage: 0,
            uptime: Date.now() - this.stats.startTime,
            isHealthy: true
        };

        try {
            if (this.modules.systemMonitor) {
                const memory = await this.modules.systemMonitor.getMemoryUsage();
                const disk = await this.modules.systemMonitor.getDiskUsage();
                
                status.memoryUsage = memory.percentage || 0;
                status.diskUsage = disk.percentage || 0;
                status.isHealthy = memory.percentage < 90 && disk.percentage < 95;
            }
        } catch (error) {
            console.warn('⚠️ Erro ao obter status do sistema:', error.message);
        }

        return status;
    }

    shouldForceGarbageCollection() {
        // Força GC a cada 5 otimizações ou se memória alta
        return this.stats.totalOptimizations % 5 === 0 || 
               process.memoryUsage().heapUsed > 100 * 1024 * 1024; // > 100MB
    }

    forceGarbageCollection() {
        if (global.gc) {
            const before = process.memoryUsage().heapUsed;
            global.gc();
            const after = process.memoryUsage().heapUsed;
            const freed = before - after;
            
            if (freed > 0) {
                this.stats.memoryFreed += freed;
                console.log(`🧹 Garbage collection: ${Math.round(freed / 1024 / 1024)}MB liberados`);
            }
        }
    }

    startPerformanceReporting() {
        this.timers.reporting = setInterval(() => {
            this.generatePerformanceReport();
        }, this.config.reportingInterval);
    }

    generatePerformanceReport() {
        const uptime = Date.now() - this.stats.startTime;
        const uptimeHours = Math.round(uptime / (1000 * 60 * 60) * 100) / 100;
        
        const report = {
            uptime: `${uptimeHours}h`,
            optimizations: this.stats.totalOptimizations,
            memoryFreed: `${Math.round(this.stats.memoryFreed / 1024 / 1024)}MB`,
            diskFreed: `${Math.round(this.stats.diskFreed / 1024 / 1024)}MB`,
            restarts: this.stats.restartCount,
            modulesActive: Object.keys(this.modules).filter(k => this.modules[k] !== null).length
        };
        
        console.log('📊 Relatório de Performance:', report);
        return report;
    }

    async freeMemory() {
        try {
            // Otimiza caches
            await this.optimizeCaches();
            
            // Força garbage collection
            this.forceGarbageCollection();
            
            console.log('💾 Memória otimizada');
        } catch (error) {
            console.error('❌ Erro ao liberar memória:', error.message);
        }
    }

    async freeDiskSpace() {
        try {
            if (this.modules.mediaCleaner) {
                const cleaned = await this.modules.mediaCleaner.performEmergencyCleanup();
                this.stats.diskFreed += cleaned.totalSize || 0;
                console.log(`💽 Espaço em disco liberado: ${Math.round(cleaned.totalSize / 1024 / 1024)}MB`);
            }
        } catch (error) {
            console.error('❌ Erro ao liberar espaço em disco:', error.message);
        }
    }

    async optimizeCaches() {
        try {
            if (this.modules.cacheManager) {
                await this.modules.cacheManager.optimizeMemory();
                console.log('🗄️ Caches otimizados');
            }
        } catch (error) {
            console.error('❌ Erro ao otimizar caches:', error.message);
        }
    }

    async compressMedia(filePath, options = {}) {
        try {
            if (this.modules.mediaCompressor) {
                return await this.modules.mediaCompressor.compressFile(filePath, options);
            }
            return null;
        } catch (error) {
            console.error('❌ Erro na compressão de mídia:', error.message);
            return null;
        }
    }

    async cacheGet(type, key) {
        try {
            if (this.modules.cacheManager) {
                return await this.modules.cacheManager.get(`${type}:${key}`);
            }
            return null;
        } catch (error) {
            console.error('❌ Erro ao acessar cache:', error.message);
            return null;
        }
    }

    async cacheSet(type, key, value, ttl = null) {
        try {
            if (this.modules.cacheManager) {
                const fullKey = `${type}:${key}`;
                const options = ttl ? { ttl } : {};
                return await this.modules.cacheManager.set(fullKey, value, options);
            }
            return false;
        } catch (error) {
            console.error('❌ Erro ao definir cache:', error.message);
            return false;
        }
    }

    async forceRestart(reason = 'Reinicialização manual') {
        try {
            if (this.modules.autoRestarter) {
                this.stats.restartCount++;
                return await this.modules.autoRestarter.restartProcess(reason);
            }
            return false;
        } catch (error) {
            console.error('❌ Erro ao forçar reinicialização:', error.message);
            return false;
        }
    }

    async emergencyCleanup() {
        console.log('🚨 Iniciando limpeza de emergência...');
        
        try {
            const tasks = [];
            
            // Limpeza de mídia
            if (this.modules.mediaCleaner) {
                tasks.push(this.modules.mediaCleaner.performEmergencyCleanup());
            }
            
            // Otimização de cache
            if (this.modules.cacheManager) {
                tasks.push(this.modules.cacheManager.clearAll());
            }
            
            // Executa todas as tarefas em paralelo
            const results = await Promise.allSettled(tasks);
            
            // Força garbage collection
            this.forceGarbageCollection();
            
            console.log('✅ Limpeza de emergência concluída');
            
            return results;
        } catch (error) {
            console.error('❌ Erro na limpeza de emergência:', error.message);
            throw error;
        }
    }

    getFullStatistics() {
        const uptime = Date.now() - this.stats.startTime;
        
        return {
            optimizer: {
                initialized: this.isInitialized,
                startTime: this.stats.startTime,
                uptime: uptime,
                uptimeFormatted: `${Math.round(uptime / (1000 * 60 * 60) * 100) / 100}h`
            },
            stats: { ...this.stats },
            modules: Object.keys(this.modules).reduce((acc, key) => {
                acc[key] = this.modules[key] !== null ? 'active' : 'inactive';
                return acc;
            }, {}),
            config: this.config
        };
    }

    async shutdown() {
        console.log('🛑 Parando sistema de otimização...');
        
        // Para todos os timers
        Object.values(this.timers).forEach(timer => {
            if (timer) clearInterval(timer);
        });
        
        // Para módulos que têm método shutdown
        for (const [name, module] of Object.entries(this.modules)) {
            if (module && typeof module.shutdown === 'function') {
                try {
                    await module.shutdown();
                    console.log(`✅ Módulo ${name} parado`);
                } catch (error) {
                    console.error(`❌ Erro ao parar módulo ${name}:`, error.message);
                }
            }
        }
        
        this.isInitialized = false;
        console.log('✅ Sistema de otimização parado');
    }
}

export default PerformanceOptimizer;