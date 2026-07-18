import { Capacitor, registerPlugin } from '@capacitor/core';

type NativePermissionState = 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied';

interface SouffletMicrophonePlugin {
  checkPermissions(): Promise<{ microphone: NativePermissionState }>;
  requestPermissions(options: { permissions: ['microphone'] }): Promise<{ microphone: NativePermissionState }>;
  openAppSettings(): Promise<void>;
}

const SouffletMicrophone = registerPlugin<SouffletMicrophonePlugin>('SouffletMicrophone');

export const canManageNativeMicrophone = () => Capacitor.getPlatform() === 'android'
  && Capacitor.isPluginAvailable('SouffletMicrophone');

export async function requestNativeMicrophonePermission(): Promise<NativePermissionState | 'unavailable'> {
  if (!canManageNativeMicrophone()) return 'unavailable';
  const current = await SouffletMicrophone.checkPermissions();
  if (current.microphone === 'granted') return 'granted';
  const requested = await SouffletMicrophone.requestPermissions({ permissions: ['microphone'] });
  return requested.microphone;
}

export async function openNativeMicrophoneSettings() {
  if (!canManageNativeMicrophone()) return;
  await SouffletMicrophone.openAppSettings();
}
