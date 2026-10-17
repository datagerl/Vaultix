import { toHexSignature } from './signature';

const HEX = 'ab'.repeat(64);
const BYTES = new Uint8Array(64).fill(0xab);
const BASE64 = btoa(String.fromCharCode(...BYTES));

describe('toHexSignature', () => {
  it('passes a 64-byte hex signature through (lower-cased)', () => {
    expect(toHexSignature(HEX.toUpperCase())).toBe(HEX);
  });

  it('decodes base64 signatures (Freighter)', () => {
    expect(toHexSignature(BASE64)).toBe(HEX);
  });

  it('decodes base64url signatures', () => {
    const url = BASE64.replace(/\+/g, '-').replace(/\//g, '_');
    expect(toHexSignature(url)).toBe(HEX);
  });

  it('encodes raw bytes', () => {
    expect(toHexSignature(BYTES)).toBe(HEX);
    expect(toHexSignature(BYTES.buffer)).toBe(HEX);
  });

  it.each([null, undefined, '', '   '])('rejects a missing signature (%p)', (value) => {
    expect(() => toHexSignature(value as any)).toThrow('did not return a signature');
  });

  it('rejects strings that are neither hex nor base64', () => {
    expect(() => toHexSignature('not a signature!')).toThrow('unrecognised format');
  });
});
