import { safeReturnTo } from './return-to';

describe('safeReturnTo', () => {
  it.each([
    ['/dashboard', '/dashboard'],
    ['/escrow/abc?tab=terms', '/escrow/abc?tab=terms'],
    ['%2Fescrow%2Fcreate', '/escrow/create'],
  ])('keeps in-app path %s', (raw, expected) => {
    expect(safeReturnTo(raw)).toBe(expected);
  });

  it.each([
    [null],
    [''],
    ['https://evil.example/phish'],
    ['//evil.example'],
    ['%2F%2Fevil.example'],
    ['/\\evil.example'],
    ['javascript:alert(1)'],
    ['%E0%A4%A'],
  ])('falls back for unsafe or invalid value %p', (raw) => {
    expect(safeReturnTo(raw)).toBe('/dashboard');
  });

  it('honours a custom fallback', () => {
    expect(safeReturnTo(null, '/')).toBe('/');
  });
});
