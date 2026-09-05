export async function rsaSha256Sign(
  payload: string,
  privateKeyPem: string,
): Promise<string> {
  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const pemContents = privateKeyPem
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\s/g, '');
  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  const derBuf = binaryDer.buffer.slice(binaryDer.byteOffset, binaryDer.byteOffset + binaryDer.byteLength) as ArrayBuffer;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    derBuf,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    encoder.encode(payload),
  );

  const bytes = new Uint8Array(signature);
  return btoa(String.fromCharCode(...bytes));
}
