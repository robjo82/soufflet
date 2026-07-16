import { Capacitor, registerPlugin } from '@capacitor/core';
import { isAndroidPreview } from './nativeApp';

export type AndroidDistributionChannel = 'github' | 'play' | 'web';

interface SouffletDistributionPlugin {
  getChannel(): Promise<{ channel: string }>;
}

const SouffletDistribution = registerPlugin<SouffletDistributionPlugin>('SouffletDistribution');

export function normalizeDistributionChannel(channel: string | null | undefined): AndroidDistributionChannel {
  if (channel === 'play') return 'play';
  if (channel === 'github') return 'github';
  return 'web';
}

export async function getAndroidDistributionChannel(): Promise<AndroidDistributionChannel> {
  if (isAndroidPreview()) {
    return new URLSearchParams(window.location.search).get('android-preview') === 'play' ? 'play' : 'github';
  }
  if (Capacitor.getPlatform() !== 'android') return 'web';
  try {
    const result = normalizeDistributionChannel((await SouffletDistribution.getChannel()).channel);
    return result === 'web' ? 'github' : result;
  } catch {
    // Android builds distributed before channels existed are GitHub builds.
    return 'github';
  }
}
