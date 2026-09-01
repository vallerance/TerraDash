import { describe, expect, it } from 'vitest';
import { locationKindFor } from './locationSemantics';

describe('location semantic kinds', () => {
  it('carries authored water metadata into rendering semantics', () => {
    expect(locationKindFor({ kind: 'water' })).toBe('water');
  });

  it('carries authored land metadata into rendering semantics', () => {
    expect(locationKindFor({ kind: 'land' })).toBe('land');
  });
});
