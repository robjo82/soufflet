import { describe, expect, it } from 'vitest';
import { REVALIDATED_MODEL_CACHE_CONTROL, staticAssetCacheControl } from './staticAssets.js';

describe('static asset caching', () => {
  it.each([
    '/srv/dist/models/hohner-club-i.glb',
    String.raw`C:\app\dist\models\hohner-club-i.manifest.json`,
  ])('forces model revalidation for %s', (filePath) => {
    expect(staticAssetCacheControl(filePath)).toBe(REVALIDATED_MODEL_CACHE_CONTROL);
  });

  it('keeps hashed application assets on the immutable policy', () => {
    expect(staticAssetCacheControl('/srv/dist/assets/index-a1b2c3.js')).toBeUndefined();
  });
});
