/**
 * Crack-time estimator.
 *
 * Models time-to-crack assuming an attacker capable of 10^10 guesses per second
 * (modern GPU rig). Formula: 0.5 * 2^bits / 1e10 seconds.
 *
 * Pure function — no DOM, no side effects.
 */

const GUESSES_PER_SECOND = 1e10;

const UNITS = [
  { label: "seconds", seconds: 1 },
  { label: "minutes", seconds: 60 },
  { label: "hours", seconds: 3600 },
  { label: "days", seconds: 86400 },
  { label: "years", seconds: 31557600 },
  { label: "centuries", seconds: 3155760000 },
];

/**
 * Formats entropy bits into a human-readable crack-time string.
 *
 * @param {number} bits - Entropy in bits (≥ 0)
 * @returns {string} Human-readable crack time
 */
export function formatCrackTime(bits) {
  if (bits < 0 || !Number.isFinite(bits)) return "unknown";

  const seconds = 0.5 * Math.pow(2, bits) / GUESSES_PER_SECOND;

  if (seconds < 1) return "instant";

  // Find the largest unit that gives a value ≥ 1
  let value = seconds;
  let label = "seconds";

  for (let i = UNITS.length - 1; i >= 0; i--) {
    const candidate = seconds / UNITS[i].seconds;
    if (candidate >= 1) {
      value = candidate;
      label = UNITS[i].label;
      break;
    }
  }

  // Check for millennium+ (1000+ years)
  if (label === "years" && value >= 1000) {
    return "millennium+";
  }

  if (label === "centuries" && value >= 10) {
    return "millennium+";
  }

  // Round to reasonable precision
  const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;

  return `~${rounded} ${label}`;
}
