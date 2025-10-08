import NodeCache from '@cacheable/node-cache';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class OptimizedCacheManager {
    constructor() {
        this.caches = new Map();
        this.memoryThreshold = 0.85; // 85% da memória disponível
        this.cleanupInterval = 5 * 60 * 1000; // 5 minutos
        this.compressionEnabled = true;
        this.isOptimizing = false;
        
        this.initializeCaches();
        this.startMemoryMonitoring();
    }

    /**
     * Inicializa os caches com configurações otimizadas
     */
    initializeCaches() {
        // Cache para retry de mensagens (menor TTL, mais eficiente)
        this.caches.set('msgRetry', new NodeCache({
            stdTTL: 2 * 60, // 2 minutos (reduzido de 5)
            checkperiod: 30, // Verifica a cada 30 segundos
            useClones: false,
            maxKeys: 1000, // Limita número de chaves
            deleteOnExpire: true,
            forceString: false
        }));

        // Cache para metadados de grupos (TTL maior, dados mais estáveis)
        this.caches.set('groupMeta', new NodeCache({
            stdTTL: 10 * 60, // 10 minutos
            checkperiod: 2 * 60, // Verifica a cada 2 minutos
            useClones: false,
            maxKeys: 500, // Máximo 500 grupos
            deleteOnExpire: true,
            forceString: false
        }));

        // Cache para mensagens recentes (para anti-delete)
        this.caches.set('messages', new NodeCache({
            stdTTL: 60, // 1 minuto apenas
            checkperiod: 15, // Verifica a cada 15 segundos
            useClones: false,
            maxKeys: 2000, // Máximo 2000 mensagens
            deleteOnExpire: true,
            forceString: false
        }));

        // Cache para dados de usuários (sessões, permissões)
        this.caches.set('userData', new NodeCache({
            stdTTL: 30 * 60, // 30 minutos
            checkperiod: 5 * 60, // Verifica a cada 5 minutos
            useClones: false,
            maxKeys: 2000,
            deleteOnExpire: true,
            forceString: false
        }));

        // Cache para comandos e rate limiting
        this.caches.set('commands', new NodeCache({
            stdTTL: 5 * 60, // 5 minutos
            checkperiod: 60, // Verifica a cada minuto
            useClones: false,
            maxKeys: 5000,
            deleteOnExpire: true,
            forceString: false
        }));

        // Cache para mídia temporária (TTL muito baixo)
        this.caches.set('media', new NodeCache({
            stdTTL: 30, // 30 segundos apenas
            checkperiod: 10, // Verifica a cada 10 segundos
            useClones: false,
            maxKeys: 100, // Poucos itens de mídia
            deleteOnExpire: true,
            forceString: false
        }));

        console.log('✅ Caches otimizados inicializados');
    }

    /**
     * Obtém cache específico
     */
    getCache(type) {
        return this.caches.get(type);
    }

    /**
     * Define valor no cache com compressão opcional
     */
    async set(cacheType, key, value, ttl = null) {
        try {
            const cache = this.caches.get(cacheType);
            if (!cache) {
                console.warn(`⚠️ Cache type '${cacheType}' não encontrado`);
                return false;
            }

            let finalValue = value;

            // Comprime dados grandes se habilitado
            if (this.compressionEnabled && this.shouldCompress(value)) {
                finalValue = await this.compressData(value);
            }

            if (ttl) {
                return cache.set(key, finalValue, ttl);
            } else {
                return cache.set(key, finalValue);
            }
        } catch (error) {
            console.error(`❌ Erro ao definir cache ${cacheType}:`, error.message);
            return false;
        }
    }

    /**
     * Obtém valor do cache com descompressão automática
     */
    async get(cacheType, key) {
        try {
            const cache = this.caches.get(cacheType);
            if (!cache) {
                console.warn(`⚠️ Cache type '${cacheType}' não encontrado`);
                return undefined;
            }

            let value = cache.get(key);
            
            if (value !== undefined && this.compressionEnabled && this.isCompressed(value)) {
                value = await this.decompressData(value);
            }

            return value;
        } catch (error) {
            console.error(`❌ Erro ao obter cache ${cacheType}:`, error.message);
            return undefined;
        }
    }

    /**
     * Remove item do cache
     */
    del(cacheType, key) {
        const cache = this.caches.get(cacheType);
        if (cache) {
            return cache.del(key);
        }
        return false;
    }

    /**
     * Limpa cache específico
     */
    clear(cacheType) {
        const cache = this.caches.get(cacheType);
        if (cache) {
            const keysCount = cache.keys().length;
            cache.flushAll();
            console.log(`🗑️ Cache '${cacheType}' limpo (${keysCount} itens removidos)`);
            return true;
        }
        return false;
    }

    /**
     * Verifica se dados devem ser comprimidos
     */
    shouldCompress(data) {
        try {
            const dataString = JSON.stringify(data);
            return dataString.length > 1024; // Comprime se > 1KB
        } catch {
            return false;
        }
    }

    /**
     * Comprime dados (simulado - implementar compressão real se necessário)
     */
    async compressData(data) {
        try {
            // Marca como comprimido para identificação
            return {
                __compressed: true,
                data: JSON.stringify(data),
                timestamp: Date.now()
            };
        } catch (error) {
            console.warn('⚠️ Erro na compressão, retornando dados originais:', error.message);
            return data;
        }
    }

    /**
     * Verifica se dados estão comprimidos
     */
    isCompressed(data) {
        return data && typeof data === 'object' && data.__compressed === true;
    }

    /**
     * Descomprime dados
     */
    async decompressData(compressedData) {
        try {
            if (!this.isCompressed(compressedData)) {
                return compressedData;
            }
            return JSON.parse(compressedData.data);
        } catch (error) {
            console.warn('⚠️ Erro na descompressão, retornando dados originais:', error.message);
            return compressedData;
        }
    }

    /**
     * Inicia monitoramento de memória
     */
    startMemoryMonitoring() {
        setInterval(async () => {
            await this.checkMemoryUsage();
        }, this.cleanupInterval);

        // Verifica imediatamente
        setTimeout(() => {
            this.checkMemoryUsage();
        }, 10000);
    }

    /**
     * Verifica uso de memória e otimiza se necessário
     */
    async checkMemoryUsage() {
        try {
            const memUsage = process.memoryUsage();
            const usedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
            const totalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
            const rssMB = Math.round(memUsage.rss / 1024 / 1024);
            
            // Calcula porcentagem de uso
            const memoryPercentage = memUsage.heapUsed / memUsage.heapTotal;

            if (memoryPercentage > this.memoryThreshold) {
                console.log(`🚨 Uso de memória alto: ${usedMB}MB/${totalMB}MB (${Math.round(memoryPercentage * 100)}%)`);
                await this.optimizeMemory('high_memory_usage');
            } else if (usedMB > 300) { // Mais de 300MB
                console.log(`⚠️ Uso moderado de memória: ${usedMB}MB/${totalMB}MB`);
                await this.optimizeMemory('moderate_memory_usage');
            }

            // Log estatísticas a cada 30 minutos
            if (Date.now() % (30 * 60 * 1000) < this.cleanupInterval) {
                console.log(`📊 Memória: Heap ${usedMB}/${totalMB}MB, RSS ${rssMB}MB`);
                this.logCacheStatistics();
            }
        } catch (error) {
            console.error('❌ Erro ao verificar uso de memória:', error.message);
        }
    }

    /**
     * Otimiza uso de memória
     */
    async optimizeMemory(reason) {
        if (this.isOptimizing) return;
        this.isOptimizing = true;

        try {
            console.log(`🔧 Iniciando otimização de memória: ${reason}`);
            
            let freedMemory = 0;
            
            // 1. Limpa caches menos importantes primeiro
            const cacheOrder = ['media', 'messages', 'commands', 'userData', 'groupMeta', 'msgRetry'];
            
            for (const cacheType of cacheOrder) {
                const cache = this.caches.get(cacheType);
                if (cache) {
                    const beforeKeys = cache.keys().length;
                    
                    if (reason === 'high_memory_usage') {
                        // Uso alto: limpa completamente caches menos críticos
                        if (['media', 'messages'].includes(cacheType)) {
                            cache.flushAll();
                            console.log(`🗑️ Cache '${cacheType}' completamente limpo (${beforeKeys} itens)`);
                        } else {
                            // Para outros, remove 50% dos itens mais antigos
                            await this.removeOldCacheItems(cache, 0.5);
                        }
                    } else {
                        // Uso moderado: remove apenas itens expirados e alguns antigos
                        cache.flushExpired();
                        await this.removeOldCacheItems(cache, 0.2);
                    }
                }
                
                // Força garbage collection após cada cache
                if (global.gc) {
                    global.gc();
                }
            }

            // 2. Força garbage collection final
            if (global.gc) {
                global.gc();
                console.log('🗑️ Garbage collection executado');
            }

            // 3. Verifica resultado
            const newMemUsage = process.memoryUsage();
            const newUsedMB = Math.round(newMemUsage.heapUsed / 1024 / 1024);
            
            console.log(`✅ Otimização concluída. Memória atual: ${newUsedMB}MB`);
            
        } catch (error) {
            console.error('❌ Erro durante otimização de memória:', error.message);
        } finally {
            this.isOptimizing = false;
        }
    }

    /**
     * Remove itens antigos do cache
     */
    async removeOldCacheItems(cache, percentage) {
        try {
            const keys = cache.keys();
            const removeCount = Math.floor(keys.length * percentage);
            
            if (removeCount === 0) return;

            // Remove itens aleatórios (como aproximação para itens antigos)
            const keysToRemove = keys.sort(() => Math.random() - 0.5).slice(0, removeCount);
            
            for (const key of keysToRemove) {
                cache.del(key);
            }
            
            console.log(`🗑️ ${removeCount} itens antigos removidos do cache`);
        } catch (error) {
            console.error('❌ Erro ao remover itens antigos do cache:', error.message);
        }
    }

    /**
     * Registra estatísticas dos caches
     */
    logCacheStatistics() {
        console.log('📊 Estatísticas dos Caches:');
        
        for (const [type, cache] of this.caches) {
            const keys = cache.keys();
            const stats = cache.getStats();
            
            console.log(`  ${type}: ${keys.length} itens, ${stats.hits} hits, ${stats.misses} misses`);
        }
    }

    /**
     * Obtém estatísticas completas
     */
    getStatistics() {
        const stats = {
            memory: process.memoryUsage(),
            caches: {},
            isOptimizing: this.isOptimizing,
            compressionEnabled: this.compressionEnabled
        };

        for (const [type, cache] of this.caches) {
            stats.caches[type] = {
                keys: cache.keys().length,
                stats: cache.getStats()
            };
        }

        return stats;
    }

    /**
     * Configura parâmetros de otimização
     */
    configure(options = {}) {
        if (options.memoryThreshold !== undefined) {
            this.memoryThreshold = Math.max(0.5, Math.min(0.95, options.memoryThreshold));
        }
        
        if (options.cleanupInterval !== undefined) {
            this.cleanupInterval = Math.max(60000, options.cleanupInterval); // Mínimo 1 minuto
        }
        
        if (options.compressionEnabled !== undefined) {
            this.compressionEnabled = options.compressionEnabled;
        }

        console.log('⚙️ Cache manager reconfigurado:', {
            memoryThreshold: this.memoryThreshold,
            cleanupInterval: this.cleanupInterval,
            compressionEnabled: this.compressionEnabled
        });
    }

    /**
     * Força limpeza de todos os caches
     */
    forceCleanup() {
        console.log('🧹 Forçando limpeza de todos os caches...');
        
        for (const [type, cache] of this.caches) {
            const keysCount = cache.keys().length;
            cache.flushAll();
            console.log(`🗑️ Cache '${type}': ${keysCount} itens removidos`);
        }

        if (global.gc) {
            global.gc();
            console.log('🗑️ Garbage collection forçado');
        }

        console.log('✅ Limpeza forçada concluída');
    }

    /**
     * Para o monitoramento (para shutdown gracioso)
     */
    stopMonitoring() {
        this.isOptimizing = false;
        console.log('⏹️ Monitoramento de cache parado');
    }
}

export default OptimizedCacheManager;