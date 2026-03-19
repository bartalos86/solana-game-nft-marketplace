export declare function cachePath(env: string, cacheName: string, cPath?: string, legacy?: boolean): string;
export declare function loadCache(cacheName: string, env: string, cPath?: string, legacy?: boolean): any;
export declare function saveCache(cacheName: string, env: string, cacheContent: any, cPath?: string): void;
