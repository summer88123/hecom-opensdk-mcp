import HClient, { ObjectMeta } from 'hecom-openapi';

// 定义 ObjectDescription 接口
interface ObjectDescription {
    name: string;
    label: string;
    description?: string;
    fields?: any[];
    bizTypes?: any[];
    // 可能还有其他属性
}

// 带时间戳的缓存项接口
interface CachedItem<T> {
    data: T;
    timestamp: number;
}

export default class HecomClient {

    private client: HClient;
    private objectsCache: CachedItem<ObjectMeta[]> | null = null;
    private objectDescCache: Map<string, CachedItem<ObjectDescription>> = new Map();
    private cacheExpirationMs: number;

    constructor(options: {
        clientId: string;
        clientSecret: string;
        username: string;
        apiHost: string;
    }) {
        const { clientId, clientSecret, username, apiHost } = options;
        this.client = new HClient({
            clientId,
            clientSecret,
            username,
            apiHost,
        });

        // 从环境变量获取缓存过期时间，默认为5分钟（300000毫秒）
        const cacheExpirationMinutes = process.env.HECOM_CACHE_EXPIRATION_MINUTES ?
            parseInt(process.env.HECOM_CACHE_EXPIRATION_MINUTES, 10) : 5;
        this.cacheExpirationMs = cacheExpirationMinutes * 60 * 1000;
    }

    /**
     * 检查缓存是否过期
     * @param timestamp 缓存创建的时间戳
     * @returns 是否过期
     */
    private isCacheExpired(timestamp: number): boolean {
        const now = Date.now();
        return (now - timestamp) > this.cacheExpirationMs;
    }

    /**
     * 获取所有对象列表，有缓存
     */
    async getObjects(): Promise<ObjectMeta[]> {
        // 如果有缓存且未过期，直接返回缓存的数据
        if (this.objectsCache && !this.isCacheExpired(this.objectsCache.timestamp)) {
            return this.objectsCache.data;
        }

        // 没有缓存或缓存已过期，调用 API 获取
        const objects = await this.client.getObjects();

        // 缓存结果
        if (objects && objects.length > 0) {
            this.objectsCache = {
                data: objects,
                timestamp: Date.now()
            };
        }

        return objects || [];
    }

    /**
     * 获取对象描述信息，有缓存
     * @param name 对象名称
     */
    async getObjectDescription(name: string): Promise<ObjectDescription | null> {
        // 如果有缓存且未过期，直接返回缓存的数据
        const cached = this.objectDescCache.get(name);
        if (cached && !this.isCacheExpired(cached.timestamp)) {
            return cached.data;
        }

        // 没有缓存或缓存已过期，调用 API 获取
        const objectDesc = await this.client.getObjectDescription(name);

        // 缓存结果
        if (objectDesc) {
            this.objectDescCache.set(name, {
                data: objectDesc,
                timestamp: Date.now()
            });
        }

        return objectDesc;
    }

    /**
     * 清除缓存
     */
    clearCache(): void {
        this.objectsCache = null;
        this.objectDescCache.clear();
    }

    /**
     * 清除特定对象的描述缓存
     * @param name 对象名称
     */
    clearObjectDescriptionCache(name: string): void {
        this.objectDescCache.delete(name);
    }

    /**
     * 设置缓存过期时间（毫秒）
     * @param milliseconds 过期时间（毫秒）
     */
    setCacheExpirationTime(milliseconds: number): void {
        this.cacheExpirationMs = milliseconds;
    }

    /**
     * 根据name和label在缓存的对象列表中查找匹配的对象
     * @param objects 要查找的对象数组，包含name和label
     * @returns 匹配到的对象数组
     */
    markObjects(objects: { name: string; label: string; }[]): ObjectMeta[] {
        if (!this.objectsCache || !this.objectsCache.data || this.objectsCache.data.length === 0) {
            return [];
        }

        const result: ObjectMeta[] = [];
        
        // 遍历要查找的对象
        for (const obj of objects) {
            // 在缓存中查找匹配的对象
            const matched = this.objectsCache.data.filter(cachedObj => 
                cachedObj.name === obj.name || cachedObj.label === obj.label
            );
            
            // 将找到的对象添加到结果中
            result.push(...matched);
        }

        return result;
    }
}