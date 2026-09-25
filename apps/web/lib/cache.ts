/**
 * Murdock LRU Cache — O(1) read/write in-memory cache with TTL support.
 * Used to deduplicate identical AI requests and reduce redundant I/O.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class LRUCache<K, V> {
  private readonly capacity: number;
  private readonly ttlMs: number;
  private readonly map = new Map<K, CacheEntry<V>>();

  constructor(capacity: number, ttlMs = 60_000) {
    this.capacity = capacity;
    this.ttlMs = ttlMs;
  }

  get(key: K): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return undefined;
    }
    // Refresh access order (LRU move-to-front)
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    else if (this.map.size >= this.capacity) {
      // Evict least recently used (first inserted)
      this.map.delete(this.map.keys().next().value as K);
    }
    this.map.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  has(key: K): boolean {
    const entry = this.map.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return false;
    }
    return true;
  }

  delete(key: K): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}

/** Shared singleton caches for the Murdock server process */
export const documentCache = new LRUCache<string, object>(200, 15 * 60_000); // 15 min TTL
export const aiResponseCache = new LRUCache<string, string>(100, 5 * 60_000);  // 5 min TTL
