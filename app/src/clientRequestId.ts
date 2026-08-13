type ClientCrypto = Pick<Crypto, 'getRandomValues'> & Partial<Pick<Crypto, 'randomUUID'>>;

const byteToHex = (value: number) => value.toString(16).padStart(2, '0');

/**
 * Generates a session-only UUIDv4 in both secure contexts and LAN HTTP pages.
 * Formal entity IDs must still come from the future backend UUIDv7 service.
 */
export const createClientRequestId = (
  cryptoSource: ClientCrypto = globalThis.crypto,
) => {
  if (typeof cryptoSource?.randomUUID === 'function') {
    return cryptoSource.randomUUID();
  }
  if (typeof cryptoSource?.getRandomValues !== 'function') {
    throw new Error('当前浏览器不支持安全的本地请求 ID，请升级浏览器后重试。');
  }

  const bytes = cryptoSource.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byteToHex);

  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
};
