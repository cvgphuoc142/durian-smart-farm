import { createHash, randomBytes } from 'node:crypto';

import { Sha256, sha256Hex } from './sha256';

const reference = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

describe('Sha256', () => {
  it('matches the known vectors', () => {
    expect(sha256Hex(new Uint8Array())).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    expect(sha256Hex(new TextEncoder().encode('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it.each([1, 55, 56, 63, 64, 65, 119, 120, 1000, 100_003])('matches node for %i bytes', (n) => {
    const data = randomBytes(n);
    expect(sha256Hex(data)).toBe(reference(data));
  });

  it('gives the same hash however the input is cut into chunks', () => {
    const data = randomBytes(10_000);
    for (const size of [1, 7, 64, 100, 4096]) {
      const h = new Sha256();
      for (let i = 0; i < data.length; i += size) h.update(data.subarray(i, i + size));
      expect(h.digest()).toBe(reference(data));
    }
  });
});
