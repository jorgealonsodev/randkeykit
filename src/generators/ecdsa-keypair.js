import { exportKeyPairToPem } from "../crypto/pem.js";

const VALID_CURVES = new Set(["P-256", "P-384", "P-521"]);

export async function generateECDSAKeypair(params = {}) {
  const curve = params.curve ?? "P-256";

  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto API (crypto.subtle) is not available. RandKeyKit requires a secure context (HTTPS or localhost).");
  }

  if (!VALID_CURVES.has(curve)) {
    throw new Error(`ECDSA curve must be P-256, P-384, or P-521, got ${curve}`);
  }

  const keyPair = await globalThis.crypto.subtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: curve,
    },
    true,
    ["sign", "verify"],
  );

  return exportKeyPairToPem(keyPair);
}
