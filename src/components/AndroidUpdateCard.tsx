import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { AlertCircle, CheckCircle2, Download, ExternalLink, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { compareVersions, findAndroidRelease, formatFileSize, GITHUB_RELEASE_API, type AndroidRelease, type GithubRelease } from '../androidUpdate';

interface SouffletUpdaterPlugin {
  canInstallPackages(): Promise<{ allowed: boolean }>;
  openInstallSettings(): Promise<void>;
  downloadAndInstall(options: { url: string; fileName: string }): Promise<{ downloadId: number }>;
}

const SouffletUpdater = registerPlugin<SouffletUpdaterPlugin>('SouffletUpdater');
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
        const [response, appInfo] = await Promise.all([
          fetch(GITHUB_RELEASE_API, { signal: controller.signal, cache: 'no-store', headers: { Accept: 'application/vnd.github+json' } }),
          isAndroid ? CapacitorApp.getInfo() : Promise.resolve(null),
        ]);
        if (!response.ok) throw new Error('Release GitHub indisponible');
        const latest = findAndroidRelease(await response.json() as GithubRelease);
        setCurrentVersion(appInfo?.version ?? null);
        setRelease(latest);
        setState('ready');
        if (!latest) setMessage('L’APK Android sera disponible avec la prochaine release.');
        else if (!appInfo) setMessage(`Version ${latest.version} prête à installer.`);
        else if (compareVersions(latest.version, appInfo.version) > 0) setMessage(`La version ${latest.version} est disponible.`);
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
      const permission = await SouffletUpdater.canInstallPackages();
      if (!permission.allowed) {
        await SouffletUpdater.openInstallSettings();
        setMessage('Autorise Soufflet à installer cette mise à jour, puis appuie à nouveau sur le bouton.');
        return;
      }
      setState('downloading');
      await SouffletUpdater.downloadAndInstall({ url: release.downloadUrl, fileName: release.assetName });
      setMessage('Téléchargement lancé. Android proposera l’installation dès qu’il sera terminé.');
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'La mise à jour n’a pas pu démarrer.');
    }
  };

  const updateAvailable = Boolean(release && currentVersion && compareVersions(release.version, currentVersion) > 0);
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
