import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readProjectFile = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('configuration Android native', () => {
  it('déclare toutes les autorisations exigées par la capture audio WebView', () => {
    const manifest = readProjectFile('android/app/src/main/AndroidManifest.xml');
    expect(manifest).toContain('android.permission.RECORD_AUDIO');
    expect(manifest).toContain('android.permission.MODIFY_AUDIO_SETTINGS');
  });

  it.each(['github', 'play'])('enregistre le contrôle du microphone pour la variante %s', (flavor) => {
    const activity = readProjectFile(`android/app/src/${flavor}/java/fr/robinjoseph/soufflet/MainActivity.java`);
    expect(activity).toContain('registerPlugin(SouffletMicrophonePlugin.class)');
  });

  it('conserve un téléchargement GitHub si Android recrée l’activité', () => {
    const updater = readProjectFile('android/app/src/github/java/fr/robinjoseph/soufflet/SouffletUpdaterPlugin.java');
    expect(updater).toContain('putLong(PENDING_DOWNLOAD, downloadId)');
    expect(updater).toContain('getLong(PENDING_DOWNLOAD, -1)');
    expect(updater).toContain('openCompletedDownload(pendingDownloadId)');
    expect(updater).toContain('ContextCompat.RECEIVER_EXPORTED');
  });
});
