import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

let initialized = false;

export const isAndroidPreview = () => ['localhost', '127.0.0.1'].includes(window.location.hostname) && new URLSearchParams(window.location.search).has('android-preview');
export const isAndroidApp = () => Capacitor.getPlatform() === 'android' || isAndroidPreview();

export function initializeNativeApp() {
  if (!isAndroidApp() || initialized) return;
  initialized = true;
  document.documentElement.classList.add('native-android');

  if (isAndroidPreview()) return;

  void StatusBar.setStyle({ style: Style.Dark });
  void StatusBar.setBackgroundColor({ color: '#F7F4EC' });
  void SplashScreen.hide();

  void CapacitorApp.addListener('backButton', () => {
    const event = new Event('soufflet:native-back', { cancelable: true });
    if (document.dispatchEvent(event)) void CapacitorApp.minimizeApp();
  });

  document.addEventListener('click', (event) => {
    const anchor = (event.target as Element | null)?.closest('a[href]') as HTMLAnchorElement | null;
    if (!anchor) return;
    const target = new URL(anchor.href, window.location.href);
    if (target.protocol === 'https:' && target.origin !== window.location.origin) {
      event.preventDefault();
      void Browser.open({ url: target.href });
    }
  }, true);

  document.addEventListener('pointerup', (event) => {
    const target = (event.target as Element | null)?.closest('button, [role="button"]');
    if (target) void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
  }, { passive: true });
}

export async function setNativePracticeMode(active: boolean) {
  if (!isAndroidApp()) return;
  document.documentElement.classList.toggle('native-practice', active);
  if (isAndroidPreview()) return;
  if (active) await StatusBar.hide();
  else {
    await StatusBar.show();
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#F7F4EC' });
  }
}
