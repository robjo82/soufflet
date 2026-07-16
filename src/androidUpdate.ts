export const GITHUB_RELEASE_API = 'https://api.github.com/repos/robjo82/soufflet/releases/latest';

export interface GithubReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
  content_type: string;
}

export interface GithubRelease {
  tag_name: string;
  html_url: string;
  published_at: string;
  body: string | null;
  assets: GithubReleaseAsset[];
}

export interface AndroidRelease {
  version: string;
  releaseUrl: string;
  downloadUrl: string;
  assetName: string;
  size: number;
  publishedAt: string;
}

export async function fetchLatestAndroidRelease(signal?: AbortSignal) {
  const response = await fetch(GITHUB_RELEASE_API, {
    signal,
    cache: 'no-store',
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!response.ok) throw new Error('Release GitHub indisponible');
  return findAndroidRelease(await response.json() as GithubRelease);
}

export function normalizeVersion(version: string) {
  return version.trim().replace(/^v/i, '').split('-')[0];
}

export function compareVersions(left: string, right: string) {
  const a = normalizeVersion(left).split('.').map((part) => Number(part) || 0);
  const b = normalizeVersion(right).split('.').map((part) => Number(part) || 0);
  const length = Math.max(a.length, b.length, 3);
  for (let index = 0; index < length; index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return difference > 0 ? 1 : -1;
  }
  return 0;
}

export function isAndroidUpdateAvailable(release: AndroidRelease | null, currentVersion: string | null) {
  return Boolean(release && currentVersion && compareVersions(release.version, currentVersion) > 0);
}

export function findAndroidRelease(release: GithubRelease): AndroidRelease | null {
  const asset = release.assets.find((item) => /^soufflet-android-v?\d+\.\d+\.\d+\.apk$/i.test(item.name));
  if (!asset) return null;
  return {
    version: normalizeVersion(release.tag_name),
    releaseUrl: release.html_url,
    downloadUrl: asset.browser_download_url,
    assetName: asset.name,
    size: asset.size,
    publishedAt: release.published_at,
  };
}

export function formatFileSize(bytes: number) {
  return `${Math.max(0.1, bytes / 1_048_576).toFixed(1)} Mo`;
}
