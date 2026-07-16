import { describe, expect, it } from 'vitest';
import { normalizeDistributionChannel } from './androidDistribution';

describe('Android distribution channels', () => {
  it('accepts only the two signed distribution channels', () => {
    expect(normalizeDistributionChannel('github')).toBe('github');
    expect(normalizeDistributionChannel('play')).toBe('play');
    expect(normalizeDistributionChannel('unknown')).toBe('web');
    expect(normalizeDistributionChannel(null)).toBe('web');
  });
});
