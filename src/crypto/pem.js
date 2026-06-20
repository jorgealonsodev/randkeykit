function toBase64(bytes) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return globalThis.btoa(binary);
}

export function arrayBufferToPem(buffer, label) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const base64 = toBase64(bytes);
  const lines = base64.match(/.{1,64}/g) || [];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----`;
}

export async function exportKeyPairToPem(keyPair) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto API (crypto.subtle) is not available. RandKeyKit requires a secure context (HTTPS or localhost).");
  }

  const [publicKeyBuffer, privateKeyBuffer] = await Promise.all([
    globalThis.crypto.subtle.exportKey("spki", keyPair.publicKey),
    globalThis.crypto.subtle.exportKey("pkcs8", keyPair.privateKey),
  ]);

  const publicKeyPem = arrayBufferToPem(publicKeyBuffer, "PUBLIC KEY");
  const privateKeyPem = arrayBufferToPem(privateKeyBuffer, "PRIVATE KEY");

  return {
    publicKeyPem,
    privateKeyPem,
    outputs: [
      { label: "Public Key", value: publicKeyPem },
      { label: "Private Key", value: privateKeyPem },
    ],
    value: `${publicKeyPem}\n\n${privateKeyPem}`,
  };
}
