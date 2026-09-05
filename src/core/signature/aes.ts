export async function aesCbcEncryptBase64(
  plaintext: string,
  keyHex: string,
  ivHex: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const keyBytes = hexToBytes(keyHex);
  const ivBytes = hexToBytes(ivHex);

  const keyBuf = keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer;
  const ivBuf = ivBytes.buffer.slice(ivBytes.byteOffset, ivBytes.byteOffset + ivBytes.byteLength) as ArrayBuffer;

  const key = await crypto.subtle.importKey(
    'raw',
    keyBuf,
    { name: 'AES-CBC' },
    false,
    ['encrypt'],
  );

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv: ivBuf },
    key,
    encoder.encode(plaintext),
  );

  return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}
