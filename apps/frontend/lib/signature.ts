/**
 * Wallets return message signatures in different encodings (Freighter: base64,
 * Albedo: hex, some providers: raw bytes). The backend verifies a hex-encoded
 * ed25519 signature, so every signature is normalised here before sending.
 */
export function toHexSignature(signature: string | Uint8Array | ArrayBuffer | null | undefined): string {
  if (signature == null) {
    throw new Error('Wallet did not return a signature.');
  }

  if (typeof signature !== 'string') {
    const bytes = signature instanceof Uint8Array ? signature : new Uint8Array(signature);
    return bytesToHex(bytes);
  }

  const trimmed = signature.trim();
  if (!trimmed) {
    throw new Error('Wallet did not return a signature.');
  }

  // An ed25519 signature is 64 bytes: 128 hex chars. Treat other strings as base64.
  if (/^[0-9a-fA-F]{128}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  try {
    const binary = atob(trimmed.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return bytesToHex(bytes);
  } catch {
    throw new Error('Wallet returned a signature in an unrecognised format.');
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
