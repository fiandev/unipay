import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import {
  hmacSha512Hex,
  hmacSha256Hex,
  rsaSha256Sign,
  aesCbcEncryptBase64,
  basicAuthHeader,
  sha512Hex,
  iso8601Timestamp,
} from '../../../src/core/signature/index.js';
import * as crypto from 'node:crypto';

describe('hmacSha512Hex', () => {
  it('produces correct HMAC-SHA512 for known test vector', async () => {
    const payload = 'test-message';
    const secret = 'my-secret-key';
    const expected = crypto.createHmac('sha512', secret).update(payload).digest('hex');
    const result = await hmacSha512Hex(payload, secret);
    expect(result).toBe(expected);
  });
});

describe('hmacSha256Hex', () => {
  it('produces correct HMAC-SHA256 for known test vector', async () => {
    const payload = 'test-message';
    const secret = 'my-secret-key';
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const result = await hmacSha256Hex(payload, secret);
    expect(result).toBe(expected);
  });
});

describe('rsaSha256Sign', () => {
  let keyPair: { privateKey: string; publicKey: string };

  beforeAll(() => {
    keyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
  });

  it('produces a signature verifiable by node:crypto.verify', async () => {
    const payload = 'client-id|2026-07-17T12:00:00Z';
    const signature = await rsaSha256Sign(payload, keyPair.privateKey);
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(payload);
    verifier.end();
    const isValid = verifier.verify(keyPair.publicKey, Buffer.from(signature, 'base64'));
    expect(isValid).toBe(true);
  });

  it('produces a non-empty base64 string', async () => {
    const signature = await rsaSha256Sign('test', keyPair.privateKey);
    expect(signature).toBeTruthy();
    expect(typeof signature).toBe('string');
    expect(signature.length).toBeGreaterThan(0);
  });
});

describe('aesCbcEncryptBase64', () => {
  it('produces ciphertext decryptable by node:crypto (AES-256-CBC)', async () => {
    const keyHex = crypto.randomBytes(32).toString('hex');
    const ivHex = crypto.randomBytes(16).toString('hex');
    const plaintext = 'sensitive-card-data';

    const encryptedBase64 = await aesCbcEncryptBase64(plaintext, keyHex, ivHex);
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(keyHex, 'hex'),
      Buffer.from(ivHex, 'hex'),
    );
    let decrypted = decipher.update(Buffer.from(encryptedBase64, 'base64'));
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    expect(decrypted.toString('utf-8')).toBe(plaintext);
  });
});

describe('basicAuthHeader', () => {
  it('matches node:crypto Buffer encoding', () => {
    const secret = 'sk_test_xnd123';
    const expected = 'Basic ' + Buffer.from(secret + ':').toString('base64');
    expect(basicAuthHeader(secret)).toBe(expected);
  });
});

describe('sha512Hex', () => {
  it('produces correct SHA-512 for known test vector', async () => {
    const payload = 'hello';
    const expected = crypto.createHash('sha512').update(payload).digest('hex');
    const result = await sha512Hex(payload);
    expect(result).toBe(expected);
  });
});

describe('iso8601Timestamp', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-07-17T12:00:00.000Z') });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('defaults to UTC Z suffix', () => {
    const result = iso8601Timestamp();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(result).toBe('2026-07-17T12:00:00.000Z');
  });

  it('returns Z suffix when offsetTz is Z', () => {
    const result = iso8601Timestamp('Z');
    expect(result.endsWith('Z')).toBe(true);
    expect(result).toBe('2026-07-17T12:00:00.000Z');
  });

  it('formats time with +07:00 offset', () => {
    const result = iso8601Timestamp('+07:00');
    expect(result).toMatch(/T19:00:00\.000\+07:00$/);
  });

  it('formats time with -03:00 offset', () => {
    const result = iso8601Timestamp('-03:00');
    expect(result).toMatch(/T09:00:00\.000-03:00$/);
  });

  it('throws for invalid timezone offset format', () => {
    expect(() => iso8601Timestamp('invalid')).toThrow('Invalid timezone offset format');
  });
});
