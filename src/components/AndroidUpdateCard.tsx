import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { AlertCircle, CheckCircle2, Download, ExternalLink, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchLatestAndroidRelease, formatFileSize, isAndroidUpdateAvailable, type AndroidRelease } from '../androidUpdate';
import { startAndroidUpdate } from '../androidUpdateInstaller';

const RELEASES_URL = 'https://github.com/robjo82/soufflet/releases/latest';

type UpdateState = 'loading' | 'ready' | 'downloading' | 'error';

export function AndroidUpdateCard() {
  const isAndroid = Capacitor.getPlatform() === 'android';
  const [state, setState] = useState<UpdateState>('loading');
  const [release, setRelease] = useState<AndroidRelease | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [message, setMessage] = useState('Recherche de la dernière version…');

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const [latest, appInfo] = await Promise.all([
          fetchLatestAndroidRelease(controller.signal),
          isAndroid ? CapacitorApp.getInfo() : Promise.resolve(null),
        ]);
        setCurrentVersion(appInfo?.version ?? null);
        setRelease(latest);
        setState('ready');
        if (!latest) setMessage('L’APK Android sera disponible avec la prochaine release.');
        else if (!appInfo) setMessage(`Version ${latest.version} prête à installer.`);
        else if (isAndroidUpdateAvailable(latest, appInfo.version)) setMessage(`La version ${latest.version} est disponible.`);
        else setMessage('Tu utilises déjà la dernière version.');
      } catch (error) {
        if (controller.signal.aborted) return;
        setState('error');
        setMessage(error instanceof Error ? error.message : 'Vérification impossible.');
      }
    };
    void load();
    return () => controller.abort();
  }, [isAndroid]);

  const install = async () => {
    if (!release) return;
    if (!isAndroid) {
      window.location.assign(release.downloadUrl);
      return;
    }
    try {
      const result = await startAndroidUpdate(release);
      if (result === 'permission-required') {
        setMessage('Autorise Soufflet à installer cette mise à jour, puis appuie à nouveau sur le bouton.');
        return;
      }
      setState('downloading');
      setMessage('Téléchargement lancé. Android proposera l’installation dès qu’il sera terminé.');
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'La mise à jour n’a pas pu démarrer.');
    }
  };

  const updateAvailable = isAndroidUpdateAvailable(release, currentVersion);
  return (
    <div className="android-update-card">
      <span className="android-app-icon"><Smartphone /></span>
      <div className="android-update-copy">
        <span className="eyebrow">Application mobile officielle</span>
        <h3>Soufflet pour Android</h3>
        <p>{message}</p>
        <div className="android-version-line">
          {currentVersion && <span><Smartphone /> Installée : {currentVersion}</span>}
          {release && <span><ShieldCheck /> GitHub : {release.version} · {formatFileSize(release.size)}</span>}
          {state === 'ready' && currentVersion && !updateAvailable && release && <span className="android-up-to-date"><CheckCircle2 /> À jour</span>}
        </div>
      </div>
      <div className="android-update-actions">
        <button type="button" className="primary-button" disabled={!release || state === 'loading' || state === 'downloading'} onClick={() => void install()}>
          {state === 'loading' || state === 'downloading' ? <RefreshCw className="is-spinning" /> : state === 'error' ? <AlertCircle /> : <Download />}
          {state === 'downloading' ? 'Téléchargement…' : !release ? 'Indisponible' : isAndroid && updateAvailable ? 'Mettre à jour' : isAndroid ? 'Réinstaller' : 'Télécharger l’APK'}
        </button>
        <a href={release?.releaseUrl ?? RELEASES_URL} target="_blank" rel="noreferrer">Voir la release <ExternalLink /></a>
      </div>
    </div>
  );
}
