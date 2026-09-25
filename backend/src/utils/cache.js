import { pubClient } from "../socket/index.js";

/**
 * Safely get a cached key from Redis.
 * If Redis is unavailable or throws, returns null without breaking the request (fail-open).
 */
export const safeGet = async (key) => {
  try {
    if (!pubClient?.isOpen) return null;
    return await pubClient.get(key);
  } catch (err) {
    console.warn(`[Redis Cache] safeGet failed for key "${key}":`, err.message);
    return null;
  }
};

/**
 * Safely set a cached key in Redis with TTL in seconds.
 * Fails gracefully without breaking request execution if Redis is down.
 */
export const safeSet = async (key, ttlSeconds, value) => {
  try {
    if (!pubClient?.isOpen) return;
    await pubClient.setEx(key, ttlSeconds, value);
  } catch (err) {
    console.warn(`[Redis Cache] safeSet failed for key "${key}":`, err.message);
  }
};

/**
 * Safely delete a key from Redis.
 * Fails gracefully without breaking request execution if Redis is down.
 */
export const safeDel = async (key) => {
  try {
    if (!pubClient?.isOpen) return;
    await pubClient.del(key);
  } catch (err) {
    console.warn(`[Redis Cache] safeDel failed for key "${key}":`, err.message);
  }
};
