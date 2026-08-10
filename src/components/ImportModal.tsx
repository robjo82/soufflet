import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, Bot, Check, FileAudio, FileMusic, FileText, Link2, LoaderCircle, MessageCircle, Music2, Send, Sparkles, Upload, UserRound, X, Youtube } from 'lucide-react';
import type { AccordionConfig, InstrumentType, Song, TranscriptionResult } from '../types';

type ImportKind = 'discover' | 'file' | 'youtube' | 'spotify' | 'tablature';

interface DiscoveryMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  error?: boolean;
}

interface ImportModalProps {
  accordion: AccordionConfig;
  instrumentType: InstrumentType;
  apiKey: string;
  onClose: () => void;
  onImported: (song: Song) => Promise<void>;
}

const STEPS = ['Identifier la version', 'Chercher des sources musicales', 'Analyser toute la vidéo', 'Construire mélodie et accompagnement', 'Contrôler la couverture'];
const DISCOVERY_SUGGESTIONS = ['Complète l’accompagnement', 'Simplifie pour débutant', 'Vérifie le rythme et les reprises'];

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
    lyrics: result.lyrics,
    rightsStatus: result.rightsStatus,
    rightsNote: result.rightsNote,
    events,
    ...(accompaniment?.length ? { accompaniment } : {}),
  };
}

export function ImportModal({ accordion, instrumentType, apiKey, onClose, onImported }: ImportModalProps) {
  const [kind, setKind] = useState<ImportKind>('discover');
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [tabText, setTabText] = useState('');
  const [state, setState] = useState<'input' | 'processing' | 'error'>('input');
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState('');
  const [discoveryDraft, setDiscoveryDraft] = useState('');
  const [discoveryPending, setDiscoveryPending] = useState(false);
  const [discoveryResult, setDiscoveryResult] = useState<TranscriptionResult | null>(null);
  const [discoveryMessages, setDiscoveryMessages] = useState<DiscoveryMessage[]>([{
    id: 'discovery-welcome',
    role: 'assistant',
    content: instrumentType === 'accordion'
      ? 'Donne-moi simplement le titre du morceau. Tu peux préciser l’interprète, la région, la version ou ton objectif, par exemple : « La Valse à Ollu, complète, avec une main gauche simple ».'
      : instrumentType === 'piano'
        ? 'Donne-moi simplement le titre du morceau. Tu peux préciser l’interprète, la version ou ton objectif, par exemple : « Au clair de la lune, arrangement piano très facile, avec les deux mains ».'
        : 'Donne-moi simplement le titre du morceau. Tu peux préciser l’interprète, la version ou ton objectif, par exemple : « Au clair de la lune, arrangement guitare très facile ».',
  }]);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const importTabs = ([
    ['discover', MessageCircle, 'Trouver avec l’IA'],
    ['file', FileAudio, 'Audio ou partition'],
    ['youtube', Youtube, 'YouTube'],
    ['spotify', Music2, 'Spotify'],
    ...(instrumentType === 'accordion' ? [['tablature', FileText, 'Tablature texte'] as const] : []),
  ] as const);

  useEffect(() => {
    if (kind === 'discover' && chatRef.current) chatRef.current.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [discoveryMessages, discoveryPending, kind]);

  const sendDiscovery = async (request = discoveryDraft) => {
    const content = request.trim();
    if (!content || discoveryPending) return;
    const userMessage: DiscoveryMessage = { id: `discovery-user-${Date.now()}`, role: 'user', content };
    const nextMessages = [...discoveryMessages, userMessage];
    setDiscoveryMessages(nextMessages);
    setDiscoveryDraft('');
    setDiscoveryPending(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) headers['x-gemini-key'] = apiKey;
      const response = await fetch('/api/transcriptions/discover', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          request: content,
          accordionId: accordion.id,
          history: nextMessages.slice(-20).map(({ role, content: messageContent }) => ({ role, content: messageContent })),
          ...(discoveryResult ? { previousResult: discoveryResult } : {}),
        }),
      });
      const payload = await response.json() as { result?: TranscriptionResult; assistantMessage?: string; error?: string };
      if (!response.ok || !payload.result) throw new Error(payload.error ?? 'La recherche n’a pas produit de tablature exploitable.');
      setDiscoveryResult(payload.result);
      setDiscoveryMessages((messages) => [...messages, {
        id: `discovery-assistant-${Date.now()}`,
        role: 'assistant',
        content: payload.assistantMessage ?? 'J’ai préparé une proposition. Vérifie les sources et demande-moi un ajustement si nécessaire.',
      }]);
    } catch (reason) {
      setDiscoveryMessages((messages) => [...messages, {
        id: `discovery-error-${Date.now()}`,
        role: 'assistant',
        content: reason instanceof Error ? reason.message : 'La recherche musicale a échoué. Reformule ta demande ou ajoute une source.',
        error: true,
      }]);
    } finally {
      setDiscoveryPending(false);
    }
  };

  const importDiscovery = async () => {
    if (!discoveryResult) return;
    const sourceUrl = discoveryResult.sources?.[0]?.url;
    await onImported(mapTranscription(discoveryResult, accordion, 'tablature', sourceUrl));
    onClose();
  };

  const processImport = async () => {
    if (kind === 'spotify') {
      const song: Song = {
        id: `spotify-${Date.now()}`, title: 'Lien Spotify', artist: 'Référence externe', sourceType: 'spotify', sourceUrl: url,
        bpm: 100, timeSignature: [4, 4], key: 'À analyser', duration: 0, difficulty: 0, status: 'reference-only', events: [],
      };
      await onImported(song); onClose(); return;
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
      await onImported(mapTranscription(payload.result, accordion, sourceType, kind === 'youtube' ? url : undefined));
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Une erreur est survenue pendant l’analyse.');
      setState('error');
    } finally {
      clearInterval(ticker);
    }
  };

  const ready = kind === 'file' ? Boolean(file) : kind === 'tablature' ? tabText.trim().length > 3 : kind === 'discover' ? Boolean(discoveryResult) : url.startsWith('http');
  const busy = state === 'processing' || discoveryPending;

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <div className="import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title">
        <header><div><span className="eyebrow"><Sparkles size={14} /> Studio d’import</span><h2 id="import-title">Transformer un morceau en leçon</h2><p>Tu gardes toujours la main avant de valider la transcription.</p></div><button type="button" className="icon-button" onClick={onClose} disabled={busy}><X /></button></header>

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
              {importTabs.map(([id, Icon, label]) => <button type="button" key={id} className={kind === id ? 'is-active' : ''} onClick={() => { setKind(id); setError(''); }}><Icon />{label}</button>)}
            </div>

            <div className="import-body">
              {kind === 'discover' && <div className="discovery-import">
                <div className="discovery-chat" ref={chatRef} aria-live="polite">
                  {discoveryMessages.map((message) => <div key={message.id} className={`discovery-message is-${message.role}${message.error ? ' is-error' : ''}`}><span>{message.role === 'assistant' ? <Bot /> : <UserRound />}</span><p>{message.content}</p></div>)}
                  {discoveryPending && <div className="discovery-message is-assistant is-thinking"><span><LoaderCircle /></span><p><strong>Je cherche et je compare les éditions…</strong><small>PDF, tablatures, ABC, MusicXML et sources de référence</small></p></div>}
                  {discoveryResult && !discoveryPending && <article className="discovery-result-card">
                    <div><span className="eyebrow">Brouillon actuel</span><h3>{discoveryResult.title}</h3><p>{discoveryResult.artist} · {discoveryResult.bpm} BPM · {discoveryResult.key}</p></div>
                    <div className="discovery-result-metrics"><span><strong>{discoveryResult.events.length}</strong><small>notes</small></span><span><strong>{discoveryResult.accompaniment?.length ?? 0}</strong><small>éléments d’accompagnement</small></span><span><strong>{Math.round(discoveryResult.confidence * 100)} %</strong><small>confiance</small></span></div>
                    <div className="discovery-result-sources">{discoveryResult.sources?.slice(0, 4).map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer"><FileText /><span><b>{source.title}</b><small>{source.kind.toUpperCase()} · {Math.round(source.reliability * 100)} %</small></span></a>)}</div>
                  </article>}
                </div>
                {discoveryResult && !discoveryPending && <div className="discovery-suggestions">{DISCOVERY_SUGGESTIONS.map((suggestion) => <button type="button" key={suggestion} onClick={() => void sendDiscovery(suggestion)}>{suggestion}</button>)}</div>}
                <form className="discovery-composer" onSubmit={(event) => { event.preventDefault(); void sendDiscovery(); }}><textarea value={discoveryDraft} onChange={(event) => setDiscoveryDraft(event.target.value)} placeholder={discoveryResult ? 'Demande un ajustement…' : 'Ex. Le 31 du mois d’août, version complète et facile'} rows={2} disabled={discoveryPending} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendDiscovery(); } }} /><button type="submit" disabled={!discoveryDraft.trim() || discoveryPending} aria-label="Envoyer la demande">{discoveryPending ? <LoaderCircle /> : <Send />}</button></form>
                <p className="discovery-caution"><AlertCircle /> L’IA ne valide jamais seule une partition : les passages incertains restent signalés dans le studio.</p>
              </div>}
              {kind === 'file' && <div className={`drop-zone ${file ? 'has-file' : ''}`} onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); setFile(event.dataTransfer.files[0] ?? null); }}><input ref={inputRef} type="file" accept="audio/*,video/*,.pdf,.png,.jpg,.jpeg,.musicxml,.mxl,.mid,.midi" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><span>{file ? <FileMusic /> : <Upload />}</span><strong>{file ? file.name : 'Dépose ton fichier ici'}</strong><p>{file ? `${(file.size / 1024 / 1024).toFixed(1)} Mo · prêt pour l’analyse` : 'Audio, vidéo, PDF, photo, MusicXML ou MIDI · 25 Mo maximum'}</p><button type="button" className="secondary-button">{file ? 'Choisir un autre fichier' : 'Parcourir mes fichiers'}</button></div>}
              {kind === 'youtube' && <div className="link-import"><Youtube /><h3>Vidéo YouTube publique</h3><p>Soufflet analyse toute la vidéo, recherche des sources musicales, puis confronte mélodie et accompagnement à ce qui est réellement joué. Chaque estimation reste signalée.</p><label><span>Adresse de la vidéo</span><div><Link2 /><input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://youtube.com/watch?v=…" /></div></label>{url && !youtubeId(url) && <small className="field-error">Cette adresse ne ressemble pas à une vidéo YouTube.</small>}</div>}
              {kind === 'spotify' && <div className="link-import spotify-import"><Music2 /><h3>Lien Spotify</h3><p>Spotify interdit l’analyse et la synchronisation de ses enregistrements par des apps tierces. Le lien sera ajouté comme référence ; importe ensuite un fichier audio que tu as le droit d’utiliser.</p><label><span>Adresse Spotify</span><div><Link2 /><input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://open.spotify.com/track/…" /></div></label><div className="legal-note"><AlertCircle /> Aucun audio Spotify n’est téléchargé, copié ou envoyé à une IA.</div></div>}
              {kind === 'tablature' && <div className="text-import"><FileText /><h3>Coller une tablature</h3><p>Formats simples acceptés : <code>4P 4T 5P</code>, noms de notes, ou texte libre. L’éditeur permettra de tout corriger.</p><textarea value={tabText} onChange={(event) => setTabText(event.target.value)} placeholder={'Titre: Ma mélodie\nTempo: 90\n\n4P 4T 5P 5T | 6P — 5T 4P'} rows={8} /></div>}
              {state === 'error' && <div className="error-banner"><AlertCircle /><span><strong>Import interrompu</strong>{error}</span></div>}
            </div>

            <footer><div className="privacy-inline"><span><Check /></span><p><strong>{kind === 'discover' ? 'Sources visibles et vérifiables' : 'Clé protégée côté serveur'}</strong><small>{kind === 'discover' ? 'Le brouillon reste modifiable avant l’enregistrement.' : 'Les fichiers ne sont pas conservés après l’analyse.'}</small></p></div><button type="button" className="primary-button" disabled={!ready || busy || (kind === 'youtube' && !youtubeId(url))} onClick={() => kind === 'discover' ? void importDiscovery() : void processImport()}>{kind === 'discover' ? 'Ouvrir dans le studio' : kind === 'spotify' ? 'Ajouter la référence' : 'Analyser le morceau'} <ArrowRight /></button></footer>
          </>
        )}
      </div>
    </div>
  );
}
