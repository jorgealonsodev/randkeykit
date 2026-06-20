import { exportKeyPairToPem } from "../crypto/pem.js";

const VALID_ALGORITHMS = new Set(["RSA-OAEP", "RSA-PSS"]);
const VALID_BITS = new Set([2048, 3072, 4096]);
const PUBLIC_EXPONENT = new Uint8Array([1, 0, 1]);

export async function generateRSAKeypair(params = {}) {
  const algorithm = params.algorithm ?? "RSA-OAEP";
  const bits = params.bits ?? 3072;

  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto API (crypto.subtle) is not available. RandKeyKit requires a secure context (HTTPS or localhost).");
  }

  if (!VALID_ALGORITHMS.has(algorithm)) {
    throw new Error(`RSA algorithm must be RSA-OAEP or RSA-PSS, got ${algorithm}`);
  }

  if (!VALID_BITS.has(bits)) {
    throw new Error(`RSA key size must be 2048, 3072, or 4096, got ${bits}`);
  }

  const keyUsages = algorithm === "RSA-OAEP" ? ["encrypt", "decrypt"] : ["sign", "verify"];
  const keyPair = await globalThis.crypto.subtle.generateKey(
    {
      name: algorithm,
      modulusLength: bits,
      publicExponent: PUBLIC_EXPONENT,
      hash: "SHA-256",
    },
    true,
    keyUsages,
  );

  return exportKeyPairToPem(keyPair);
}
