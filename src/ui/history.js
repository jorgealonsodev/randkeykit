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
export function formatPreview(value, count = 1) {
  const firstValue = String(value ?? "").split("\n")[0] ?? "";
  let preview = "";

  if (!firstValue || firstValue.length <= 6) {
    preview = "•".repeat(firstValue ? firstValue.length : 0);
  } else {
    preview = firstValue.slice(0, 4) + "…" + firstValue.slice(-2);
  }

  return count > 1 ? `Batch(${count}): ${preview}` : preview;
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
     * @param {{ value: string, timestamp: Date, source: string, count?: number }} entry
     */
    push(entry) {
      if (entries.length >= maxSize) {
        entries.shift();
      }
      entries.push({ ...entry, count: entry.count ?? 1 });
    },

    /**
     * Returns all entries newest-first.
     * @returns {Array<{ value: string, timestamp: Date, source: string, count: number }>}
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
