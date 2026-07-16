import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor, SystemBars, SystemBarsStyle, SystemBarType } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { SplashScreen } from '@capacitor/splash-screen';

let initialized = false;

export const isAndroidPreview = () => ['localhost', '127.0.0.1'].includes(window.location.hostname) && new URLSearchParams(window.location.search).has('android-preview');
export const isAndroidOnboardingPreview = () => isAndroidPreview() && new URLSearchParams(window.location.search).get('android-preview') === 'onboarding';
export const isAndroidApp = () => Capacitor.getPlatform() === 'android' || isAndroidPreview();

export function initializeNativeApp() {
  if (!isAndroidApp() || initialized) return;
  initialized = true;
  document.documentElement.classList.add('native-android');

  if (isAndroidPreview()) {
    document.documentElement.style.setProperty('--safe-area-inset-top', '24px');
    document.documentElement.style.setProperty('--safe-area-inset-right', '0px');
    document.documentElement.style.setProperty('--safe-area-inset-bottom', '24px');
    document.documentElement.style.setProperty('--safe-area-inset-left', '0px');
    return;
  }

  void SystemBars.setStyle({ style: SystemBarsStyle.Light });
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
  if (active) await SystemBars.hide({ bar: SystemBarType.StatusBar });
  else {
    await SystemBars.show({ bar: SystemBarType.StatusBar });
    await SystemBars.setStyle({ style: SystemBarsStyle.Light });
  }
}
