import ls from "localstorage-slim";

/**
 * TTL configuration for localStorage items (24 hours in milliseconds)
 */
const TTL_24_HOURS = 24 * 60 * 60 * 1000;

/**
 * Sets a value in localStorage with a 24-hour TTL
 * @param key - The storage key
 * @param value - The value to store
 */
export function setWithTTL(key: string, value: string): void {
  try {
    // Wrap value in object to prevent JSON.parse from converting large numbers to scientific notation
    ls.set(key, value, { ttl: TTL_24_HOURS });
  } catch (error) {
    console.warn(`[setWithTTL] Error storing ${key}:`, error);
    // Fallback to regular localStorage if localstorage-slim fails
    localStorage.setItem(key, value);
  }
}

/**
 * Gets a value from localStorage, automatically handling TTL expiration
 * @param key - The storage key
 * @returns The stored value or null if expired/not found
 */
export function getWithTTL(key: string): string | null {
  try {
    // Get wrapped value to prevent JSON.parse from converting large numbers to scientific notation
    const storedData = ls.get(key);
    return storedData ? String(storedData) : null;
  } catch (error) {
    console.warn(`[getWithTTL] Error retrieving ${key}:`, error);
    // Fallback to regular localStorage if localstorage-slim fails
    return localStorage.getItem(key);
  }
}

/**
 * Removes a value from localStorage
 * @param key - The storage key
 */
export function removeWithTTL(key: string): void {
  try {
    ls.remove(key);
  } catch (error) {
    console.warn(`[removeWithTTL] Error removing ${key}:`, error);
    // Fallback to regular localStorage if localstorage-slim fails
    localStorage.removeItem(key);
  }
}

/**
 * Checks if a key exists in localStorage and is not expired
 * @param key - The storage key
 * @returns True if the key exists and is not expired
 */
export function hasWithTTL(key: string): boolean {
  try {
    const storedData = ls.get(key);
    return Boolean(storedData);
  } catch (error) {
    console.warn(`[hasWithTTL] Error checking ${key}:`, error);
    return localStorage.getItem(key) !== null;
  }
}

/**
 * Clears all items from localStorage
 */
export function clearWithTTL(): void {
  try {
    ls.clear();
  } catch (error) {
    console.warn(`[clearWithTTL] Error clearing storage:`, error);
    // Fallback to regular localStorage if localstorage-slim fails
    localStorage.clear();
  }
}
