import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { CheckCircle2, Download, ExternalLink, RefreshCw, ShieldCheck, Smartphone, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { fetchLatestAndroidRelease, formatFileSize, isAndroidUpdateAvailable, type AndroidRelease } from '../androidUpdate';
import { startAndroidUpdate } from '../androidUpdateInstaller';
import { getAndroidDistributionChannel } from '../androidDistribution';
import { isAndroidPreview } from '../nativeApp';

type PromptState = 'ready' | 'permission-required' | 'downloading' | 'error' | 'download-started';

const isUpdatePreview = () => isAndroidPreview() && new URLSearchParams(window.location.search).get('android-preview') === 'update';

export function AndroidUpdatePrompt() {
  const [release, setRelease] = useState<AndroidRelease | null>(null);
  const [state, setState] = useState<PromptState>('ready');
  const [message, setMessage] = useState('');
  const [dismissed, setDismissed] = useState(false);
  const installButtonRef = useRef<HTMLButtonElement>(null);
  const isAndroid = Capacitor.getPlatform() === 'android';
  const enabled = isAndroid || isUpdatePreview();

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const check = async () => {
      try {
        if (await getAndroidDistributionChannel() !== 'github') return;
        const [latest, appInfo] = await Promise.all([
          fetchLatestAndroidRelease(controller.signal),
          isAndroid ? CapacitorApp.getInfo() : Promise.resolve({ version: '0.0.0-preview' }),
        ]);
        if (controller.signal.aborted || !isAndroidUpdateAvailable(latest, appInfo.version)) return;
        setRelease(latest);
      } catch {
        // A failed background check must never block opening the application.
      }
    };
    void check();
    return () => controller.abort();
  }, [enabled, isAndroid]);

  useEffect(() => {
    if (!release || dismissed) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    installButtonRef.current?.focus();
    const close = (event: Event) => {
      if (state === 'downloading') return;
      event.preventDefault();
      setDismissed(true);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(event);
    };
    document.addEventListener('soufflet:native-back', close);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('soufflet:native-back', close);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [dismissed, release, state]);

  const install = async () => {
    if (!release) return;
    try {
      setState('downloading');
      setMessage('Préparation du téléchargement sécurisé…');
      const result = await startAndroidUpdate(release);
      if (result === 'permission-required') {
        setState('permission-required');
        setMessage('Autorise Soufflet à installer des applications, puis reviens ici et relance l’installation.');
        return;
      }
      setState('download-started');
      setMessage('Téléchargement lancé. Android ouvrira l’écran d’installation dès que le fichier sera prêt.');
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'La mise à jour n’a pas pu démarrer.');
    }
  };

  if (!release || dismissed) return null;
  const busy = state === 'downloading';
  const finished = state === 'download-started';

  return (
    <div className="update-prompt-backdrop" role="presentation">
      <section className="update-prompt" role="dialog" aria-modal="true" aria-labelledby="update-prompt-title" aria-describedby="update-prompt-description">
        <button type="button" className="update-prompt-close" aria-label="Installer plus tard" disabled={busy} onClick={() => setDismissed(true)}><X /></button>
        <div className="update-prompt-icon" aria-hidden="true"><Smartphone /><span><Download /></span></div>
        <span className="eyebrow">Mise à jour disponible</span>
        <h2 id="update-prompt-title">Soufflet {release.version} est prêt</h2>
        <p id="update-prompt-description">Installe la nouvelle version pour profiter des dernières améliorations. Tes morceaux, ton matériel et ta progression restent liés à ton compte.</p>
        <div className="update-prompt-trust"><ShieldCheck /> APK signé · {formatFileSize(release.size)} · publié sur GitHub</div>
        {message && <div className={`update-prompt-status is-${state}`} role="status" aria-live="polite">{finished ? <CheckCircle2 /> : state === 'error' ? <RefreshCw /> : <Download />}<span>{message}</span></div>}
        <div className="update-prompt-actions">
          {finished ? (
            <button type="button" className="primary-button" ref={installButtonRef} onClick={() => setDismissed(true)}>Continuer dans Soufflet</button>
          ) : (
            <button type="button" className="primary-button" ref={installButtonRef} disabled={busy} onClick={() => void install()}>
              {busy ? <RefreshCw className="is-spinning" /> : <Download />}
              {busy ? 'Préparation…' : state === 'permission-required' ? 'J’ai autorisé, installer' : state === 'error' ? 'Réessayer' : 'Installer maintenant'}
            </button>
          )}
          {!finished && <button type="button" className="secondary-button" disabled={busy} onClick={() => setDismissed(true)}>Plus tard</button>}
        </div>
        <a className="update-prompt-release" href={release.releaseUrl} target="_blank" rel="noreferrer">Voir les nouveautés <ExternalLink /></a>
      </section>
    </div>
  );
}
