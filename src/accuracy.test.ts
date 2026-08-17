import { describe, expect, it } from 'vitest';
import { formatAccuracy } from './accuracy';

describe('formatAccuracy', () => {
  it('preserves two decimal places at scoring granularity', () => {
    expect(formatAccuracy(0)).toBe('0.00%');
    expect(formatAccuracy(0.25)).toBe('25.00%');
    expect(formatAccuracy(1 / 3)).toBe('33.33%');
    expect(formatAccuracy(0.5)).toBe('50.00%');
    expect(formatAccuracy(1)).toBe('100.00%');
  });
});
