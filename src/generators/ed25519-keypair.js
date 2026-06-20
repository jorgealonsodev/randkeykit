import { exportKeyPairToPem } from "../crypto/pem.js";

function isNotSupportedError(error) {
  return error?.name === "NotSupportedError"
    || error?.name === "OperationError"
    || /not supported|unsupported/i.test(error?.message || "");
}

export async function isEd25519Supported(subtle = globalThis.crypto?.subtle) {
  if (!subtle?.generateKey) {
    return false;
  }

  try {
    await subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
    return true;
  } catch (error) {
    if (isNotSupportedError(error)) {
      return false;
    }
    throw error;
  }
}

export async function generateEd25519Keypair() {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto API (crypto.subtle) is not available. RandKeyKit requires a secure context (HTTPS or localhost).");
  }

  const supported = await isEd25519Supported(globalThis.crypto.subtle);
  if (!supported) {
    throw new Error("Ed25519 is not supported in this browser.");
  }

  const keyPair = await globalThis.crypto.subtle.generateKey(
    { name: "Ed25519" },
    true,
    ["sign", "verify"],
  );

  return exportKeyPairToPem(keyPair);
}
