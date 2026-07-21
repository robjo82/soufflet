import { useRef, useState } from 'react';
import { AlertCircle, ArrowRight, Check, FileAudio, FileMusic, FileText, Link2, LoaderCircle, Music2, Sparkles, Upload, X, Youtube } from 'lucide-react';
import type { AccordionConfig, Song, TranscriptionResult } from '../types';

type ImportKind = 'file' | 'youtube' | 'spotify' | 'tablature';

interface ImportModalProps {
  accordion: AccordionConfig;
  apiKey: string;
  onClose: () => void;
  onImported: (song: Song) => void;
}

const STEPS = ['Identifier la version', 'Chercher partitions et tablatures', 'Analyser toute la vidéo', 'Construire les deux mains', 'Contrôler la couverture'];

function youtubeId(url: string) {
  return url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{11})/)?.[1];
}

function mapTranscription(result: TranscriptionResult, accordion: AccordionConfig, sourceType: Song['sourceType'], sourceUrl?: string): Song {
  const events = result.events.map((event, index) => {
    const candidates = accordion.buttons.flatMap((button) => [
      { button, direction: 'push' as const, midi: button.pushMidi },
      { button, direction: 'pull' as const, midi: button.pullMidi },
    ]).filter((candidate) => candidate.midi === event.midi);
    const candidate = candidates[0];
    return {
      id: `import-${Date.now()}-${index}`,
      beat: event.beat,
      duration: event.duration,
      midi: event.midi,
      note: event.note,
      buttonId: candidate?.button.id ?? 'unmapped',
      direction: candidate?.direction ?? 'push',
      finger: candidate?.button.finger ?? 2,
      confidence: candidate ? event.confidence : Math.min(event.confidence, 0.45),
    };
  });
  const accompaniment = result.accompaniment?.map((event, index) => ({
    id: `import-left-${Date.now()}-${index}`,
    beat: event.beat,
    duration: event.duration,
    rootMidi: event.rootMidi,
    midi: event.midi,
    note: event.note,
    chord: event.chord,
    role: event.role,
    buttonId: '',
    direction: 'push' as const,
    confidence: event.confidence,
  }));
  const beats = Math.max(1, ...events.map((event) => event.beat + event.duration), ...(accompaniment ?? []).map((event) => event.beat + event.duration));
  const coverageNeedsReview = Boolean(result.coverage && result.coverage.sourceDurationSeconds > 20 && result.coverage.ratio < .85);
  return {
    id: `song-${Date.now()}`,
    title: result.method === 'verified-library' && sourceType === 'youtube' ? `${result.title} — vidéo reconnue` : result.title || 'Morceau importé',
    artist: result.artist || 'Artiste inconnu',
    sourceType,
    sourceUrl,
    bpm: result.bpm,
    timeSignature: result.timeSignature,
    key: result.key,
    duration: Math.round(beats * 60 / result.bpm),
    difficulty: 2,
    status: result.confidence < 0.75 || coverageNeedsReview || events.some((event) => (event.confidence ?? 0) < 0.65) ? 'needs-review' : 'ready',
    confidence: result.confidence,
    uncertainBeats: events.filter((event) => (event.confidence ?? 0) < 0.65).map((event) => event.beat),
    transcriptionMethod: result.method,
    transcriptionWarnings: result.warnings,
    transcriptionSources: result.sources,
    transcriptionCoverage: result.coverage,
    events,
    ...(accompaniment?.length ? { accompaniment } : {}),
  };
}

export function ImportModal({ accordion, apiKey, onClose, onImported }: ImportModalProps) {
  const [kind, setKind] = useState<ImportKind>('file');
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [tabText, setTabText] = useState('');
  const [state, setState] = useState<'input' | 'processing' | 'error'>('input');
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const processImport = async () => {
    if (kind === 'spotify') {
      const song: Song = {
        id: `spotify-${Date.now()}`, title: 'Lien Spotify', artist: 'Référence externe', sourceType: 'spotify', sourceUrl: url,
        bpm: 100, timeSignature: [4, 4], key: 'À analyser', duration: 0, difficulty: 0, status: 'reference-only', events: [],
      };
      onImported(song); onClose(); return;
    }
    setState('processing'); setError('');
    const ticker = window.setInterval(() => setActiveStep((step) => Math.min(STEPS.length - 1, step + 1)), 2200);
    try {
      let response: Response;
      const headers: Record<string, string> = {};
      if (apiKey) headers['x-gemini-key'] = apiKey;
      if (kind === 'youtube') {
        response = await fetch('/api/transcriptions/youtube', {
          method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, accordionId: accordion.id }),
        });
      } else {
        const form = new FormData();
        if (file) form.append('file', file);
        if (kind === 'tablature') form.append('tablature', tabText);
        form.append('accordionId', accordion.id);
        response = await fetch('/api/transcriptions', { method: 'POST', headers, body: form });
      }
      const payload = await response.json() as { result?: TranscriptionResult; error?: string };
      if (!response.ok || !payload.result) throw new Error(payload.error ?? 'Analyse impossible.');
      const sourceType = kind === 'youtube' ? 'youtube' : kind === 'tablature' ? 'tablature' : 'audio';
      onImported(mapTranscription(payload.result, accordion, sourceType, kind === 'youtube' ? url : undefined));
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Une erreur est survenue pendant l’analyse.');
      setState('error');
    } finally {
      clearInterval(ticker);
    }
  };

  const ready = kind === 'file' ? Boolean(file) : kind === 'tablature' ? tabText.trim().length > 3 : url.startsWith('http');

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && state !== 'processing' && onClose()}>
      <div className="import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title">
        <header><div><span className="eyebrow"><Sparkles size={14} /> Studio d’import</span><h2 id="import-title">Transformer un morceau en leçon</h2><p>Tu gardes toujours la main avant de valider la transcription.</p></div><button type="button" className="icon-button" onClick={onClose} disabled={state === 'processing'}><X /></button></header>

        {state === 'processing' ? (
          <div className="processing-view">
            <div className="analysis-orb"><LoaderCircle /><Music2 /></div>
            <h3>Soufflet enquête, écoute et vérifie…</h3>
            <p>La vidéo entière est comparée aux partitions, tablatures ou fichiers musicaux publics trouvés. Cela peut prendre quelques minutes.</p>
            <div className="analysis-steps">{STEPS.map((step, index) => <span key={step} className={index < activeStep ? 'is-done' : index === activeStep ? 'is-active' : ''}>{index < activeStep ? <Check /> : <i>{index + 1}</i>}<strong>{step}</strong>{index === activeStep && <small>En cours…</small>}</span>)}</div>
          </div>
        ) : (
          <>
            <div className="import-tabs">
              {([
                ['file', FileAudio, 'Audio ou partition'], ['youtube', Youtube, 'YouTube'], ['spotify', Music2, 'Spotify'], ['tablature', FileText, 'Tablature texte'],
              ] as const).map(([id, Icon, label]) => <button type="button" key={id} className={kind === id ? 'is-active' : ''} onClick={() => { setKind(id); setError(''); }}><Icon />{label}</button>)}
            </div>

            <div className="import-body">
              {kind === 'file' && <div className={`drop-zone ${file ? 'has-file' : ''}`} onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); setFile(event.dataTransfer.files[0] ?? null); }}><input ref={inputRef} type="file" accept="audio/*,video/*,.pdf,.png,.jpg,.jpeg,.musicxml,.mxl,.mid,.midi" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><span>{file ? <FileMusic /> : <Upload />}</span><strong>{file ? file.name : 'Dépose ton fichier ici'}</strong><p>{file ? `${(file.size / 1024 / 1024).toFixed(1)} Mo · prêt pour l’analyse` : 'Audio, vidéo, PDF, photo, MusicXML ou MIDI · 25 Mo maximum'}</p><button type="button" className="secondary-button">{file ? 'Choisir un autre fichier' : 'Parcourir mes fichiers'}</button></div>}
              {kind === 'youtube' && <div className="link-import"><Youtube /><h3>Vidéo YouTube publique</h3><p>Soufflet analyse toute la vidéo, recherche des sources musicales, puis confronte mélodie et main gauche à ce qui est réellement joué. Chaque estimation reste signalée.</p><label><span>Adresse de la vidéo</span><div><Link2 /><input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://youtube.com/watch?v=…" /></div></label>{url && !youtubeId(url) && <small className="field-error">Cette adresse ne ressemble pas à une vidéo YouTube.</small>}</div>}
              {kind === 'spotify' && <div className="link-import spotify-import"><Music2 /><h3>Lien Spotify</h3><p>Spotify interdit l’analyse et la synchronisation de ses enregistrements par des apps tierces. Le lien sera ajouté comme référence ; importe ensuite un fichier audio que tu as le droit d’utiliser.</p><label><span>Adresse Spotify</span><div><Link2 /><input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://open.spotify.com/track/…" /></div></label><div className="legal-note"><AlertCircle /> Aucun audio Spotify n’est téléchargé, copié ou envoyé à une IA.</div></div>}
              {kind === 'tablature' && <div className="text-import"><FileText /><h3>Coller une tablature</h3><p>Formats simples acceptés : <code>4P 4T 5P</code>, noms de notes, ou texte libre. L’éditeur permettra de tout corriger.</p><textarea value={tabText} onChange={(event) => setTabText(event.target.value)} placeholder={'Titre: Ma mélodie\nTempo: 90\n\n4P 4T 5P 5T | 6P — 5T 4P'} rows={8} /></div>}
              {state === 'error' && <div className="error-banner"><AlertCircle /><span><strong>Import interrompu</strong>{error}</span></div>}
            </div>

            <footer><div className="privacy-inline"><span><Check /></span><p><strong>Clé protégée côté serveur</strong><small>Les fichiers ne sont pas conservés après l’analyse.</small></p></div><button type="button" className="primary-button" disabled={!ready || (kind === 'youtube' && !youtubeId(url))} onClick={() => void processImport()}>{kind === 'spotify' ? 'Ajouter la référence' : 'Analyser le morceau'} <ArrowRight /></button></footer>
          </>
        )}
      </div>
    </div>
  );
}
