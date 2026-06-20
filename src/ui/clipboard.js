/**
 * Clipboard utility.
 * Primary: navigator.clipboard.writeText (requires secure context).
 * Fallback: execCommand('copy') with hidden textarea.
 *
 * @param {string} text - The text to copy to the clipboard
 * @returns {Promise<boolean>} Whether the copy succeeded
 */
export async function copyToClipboard(text) {
  // Primary: Clipboard API
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to fallback
    }
  }

  // Fallback: execCommand
  return legacyCopy(text);
}

function legacyCopy(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "-9999px";
  textarea.setAttribute("readonly", "");
  document.body.appendChild(textarea);

  try {
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    const success = document.execCommand("copy");
    return success;
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

/**
 * Clears the clipboard by writing an empty string.
 * Graceful degradation — never throws.
 *
 * @returns {Promise<boolean>} Whether the clear succeeded
 */
export async function clearClipboard() {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText("");
      return true;
    } catch {
      // Fall through to fallback
    }
  }
  return legacyCopy("");
}
