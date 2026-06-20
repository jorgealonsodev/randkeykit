/**
 * Ephemeral session history store.
 *
 * In-memory FIFO of copy operations. Max 20 entries.
 * NO persistence — no localStorage, sessionStorage, IndexedDB, or cookies.
 * History vanishes on page reload.
 */

/**
 * Formats a value preview: first 4 chars + "…" + last 2 chars.
 * Values of 6 characters or fewer are fully masked with "•".
 *
 * @param {string} value
 * @returns {string}
 */
export function formatPreview(value) {
  if (!value || value.length <= 6) {
    return "•".repeat(value ? value.length : 0);
  }
  return value.slice(0, 4) + "…" + value.slice(-2);
}

/**
 * Creates an in-memory history store.
 *
 * @param {number} [maxSize=20] - Maximum entries before FIFO eviction
 * @returns {{ push: Function, getAll: Function, clear: Function, size: number }}
 */
export function createHistoryStore(maxSize = 20) {
  const entries = [];

  return {
    /**
     * Push a new entry. Evicts oldest if at capacity.
     * @param {{ value: string, timestamp: Date, source: string }} entry
     */
    push(entry) {
      if (entries.length >= maxSize) {
        entries.shift();
      }
      entries.push(entry);
    },

    /**
     * Returns all entries newest-first.
     * @returns {Array<{ value: string, timestamp: Date, source: string }>}
     */
    getAll() {
      return [...entries].reverse();
    },

    /** Removes all entries. */
    clear() {
      entries.length = 0;
    },

    /** Current entry count. */
    get size() {
      return entries.length;
    },
  };
}
