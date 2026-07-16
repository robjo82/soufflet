import { describe, expect, it } from 'vitest';
import { compareVersions, findAndroidRelease, formatFileSize, isAndroidUpdateAvailable, normalizeVersion } from './androidUpdate';

describe('Android releases', () => {
  it('normalizes and compares semantic versions', () => {
    expect(normalizeVersion('v1.6.0')).toBe('1.6.0');
    expect(compareVersions('1.7.0', '1.6.9')).toBe(1);
    expect(compareVersions('v1.6.0', '1.6')).toBe(0);
    expect(compareVersions('1.5.9', '1.6.0')).toBe(-1);
  });

  it('selects only the signed Android APK naming convention', () => {
    expect(findAndroidRelease({
      tag_name: 'v1.6.0', html_url: 'https://github.com/release', published_at: '2026-07-16T00:00:00Z', body: null,
      assets: [
        { name: 'source.zip', browser_download_url: 'https://example.com/source.zip', size: 1, content_type: 'application/zip' },
        { name: 'soufflet-android-v1.6.0.apk', browser_download_url: 'https://github.com/app.apk', size: 12_000_000, content_type: 'application/vnd.android.package-archive' },
      ],
    })?.downloadUrl).toBe('https://github.com/app.apk');
  });

  it('formats an APK size for the update card', () => {
    expect(formatFileSize(10_485_760)).toBe('10.0 Mo');
  });

  it('only proposes a release newer than the installed application', () => {
    const release = findAndroidRelease({
      tag_name: 'v1.7.0', html_url: 'https://github.com/release', published_at: '2026-07-16T00:00:00Z', body: null,
      assets: [{ name: 'soufflet-android-v1.7.0.apk', browser_download_url: 'https://github.com/app.apk', size: 12_000_000, content_type: 'application/vnd.android.package-archive' }],
    });
    expect(isAndroidUpdateAvailable(release, '1.6.1')).toBe(true);
    expect(isAndroidUpdateAvailable(release, '1.7.0')).toBe(false);
    expect(isAndroidUpdateAvailable(release, '1.8.0')).toBe(false);
    expect(isAndroidUpdateAvailable(null, '1.6.1')).toBe(false);
  });
});
