import { Capacitor, registerPlugin } from '@capacitor/core';
import type { AndroidRelease } from './androidUpdate';

interface SouffletUpdaterPlugin {
  canInstallPackages(): Promise<{ allowed: boolean }>;
  openInstallSettings(): Promise<void>;
  downloadAndInstall(options: { url: string; fileName: string }): Promise<{ downloadId: number }>;
}

export type AndroidInstallStatus = 'browser-download-started' | 'permission-required' | 'download-started';

const SouffletUpdater = registerPlugin<SouffletUpdaterPlugin>('SouffletUpdater');

export async function startAndroidUpdate(release: AndroidRelease): Promise<AndroidInstallStatus> {
  if (Capacitor.getPlatform() !== 'android') {
    window.location.assign(release.downloadUrl);
    return 'browser-download-started';
  }

  const permission = await SouffletUpdater.canInstallPackages();
  if (!permission.allowed) {
    await SouffletUpdater.openInstallSettings();
    return 'permission-required';
  }

  await SouffletUpdater.downloadAndInstall({ url: release.downloadUrl, fileName: release.assetName });
  return 'download-started';
}
