import { describe, expect, it } from 'vitest';
import { countryNameKey } from './countryName';

describe('countryNameKey', () => {
  it.each([
    ['Côte', 'cote'],
    ['Co\u0302te', 'cote'],
    ['SÃO', 'sao'],
    ['Türkiye', 'turkiye'],
    ['a\u0301\u0308', 'a'],
    ["Cote d'Ivoire", 'cote divoire'],
    ['Cote d’Ivoire', 'cote divoire'],
    ['Timor-Leste', 'timorleste'],
    ['Timor—Leste', 'timorleste'],
    ['U.S.A.', 'usa'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(countryNameKey(input)).toBe(expected);
  });

  it('preserves spaces, non-Latin marks, and standalone Latin letters', () => {
    expect(countryNameKey('Timor-Leste')).not.toBe(
      countryNameKey('Timor Leste'),
    );
    expect(countryNameKey('مُصر')).toBe('مُصر');
    expect(countryNameKey('ø ł ß')).toBe('ø ł ß');
  });
});
