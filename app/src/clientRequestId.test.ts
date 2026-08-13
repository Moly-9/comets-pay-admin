import { describe, expect, it, vi } from 'vitest';
import { createClientRequestId } from './clientRequestId';

describe('client request ID', () => {
  it('uses native randomUUID when the page is a secure context', () => {
    const randomUUID = vi.fn(() => '11111111-2222-4333-8444-555555555555');
    const getRandomValues = vi.fn();

    expect(createClientRequestId({ randomUUID, getRandomValues } as unknown as Crypto)).toBe(
      '11111111-2222-4333-8444-555555555555',
    );
    expect(getRandomValues).not.toHaveBeenCalled();
  });

  it('creates a valid UUIDv4 when randomUUID is unavailable on LAN HTTP', () => {
    const getRandomValues = vi.fn((values: Uint8Array) => {
      values.set(Array.from({ length: 16 }, (_, index) => index));
      return values;
    });

    const id = createClientRequestId({ getRandomValues } as unknown as Crypto);

    expect(id).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f');
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
