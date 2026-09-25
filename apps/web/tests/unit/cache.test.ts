/**
 * Cache Module Unit Tests
 * Validates correctness, LRU eviction, and TTL expiry of the LRUCache.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LRUCache } from "../../lib/cache";

describe("LRUCache", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("stores and retrieves a value", () => {
    const cache = new LRUCache<string, number>(3);
    cache.set("a", 1);
    expect(cache.get("a")).toBe(1);
  });

  it("returns undefined for missing keys", () => {
    const cache = new LRUCache<string, number>(3);
    expect(cache.get("missing")).toBeUndefined();
  });

  it("evicts the least recently used entry when at capacity", () => {
    const cache = new LRUCache<string, number>(3);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    // Access 'a' and 'b' so 'c' stays LRU
    cache.get("a");
    cache.get("b");
    // Insert a 4th item — 'c' should be evicted
    cache.set("d", 4);
    expect(cache.get("c")).toBeUndefined();
    expect(cache.get("a")).toBe(1);
    expect(cache.get("b")).toBe(2);
    expect(cache.get("d")).toBe(4);
  });

  it("returns undefined for expired entries", () => {
    const cache = new LRUCache<string, number>(10, 1_000); // 1 s TTL
    cache.set("x", 42);
    vi.advanceTimersByTime(1_001);
    expect(cache.get("x")).toBeUndefined();
  });

  it("resets expiry on overwrite", () => {
    const cache = new LRUCache<string, number>(10, 1_000);
    cache.set("x", 1);
    vi.advanceTimersByTime(500);
    cache.set("x", 2); // overwrite resets TTL
    vi.advanceTimersByTime(600); // total 1100 ms but reset happened at 500
    expect(cache.get("x")).toBe(2); // still alive (only 600 ms since reset)
  });

  it("correctly tracks size", () => {
    const cache = new LRUCache<string, number>(10);
    expect(cache.size).toBe(0);
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.size).toBe(2);
    cache.delete("a");
    expect(cache.size).toBe(1);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it("has() respects TTL", () => {
    const cache = new LRUCache<string, string>(5, 500);
    cache.set("k", "v");
    expect(cache.has("k")).toBe(true);
    vi.advanceTimersByTime(600);
    expect(cache.has("k")).toBe(false);
  });

  it("handles O(1) lookups efficiently across many entries", () => {
    const cache = new LRUCache<number, number>(1_000);
    for (let i = 0; i < 1_000; i++) cache.set(i, i * 2);
    const start = performance.now();
    for (let i = 0; i < 1_000; i++) cache.get(i);
    const elapsed = performance.now() - start;
    // 1000 cache lookups must complete in well under 50 ms
    expect(elapsed).toBeLessThan(50);
  });
});
