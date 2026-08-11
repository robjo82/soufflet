import { Captions, Check, Hand, Keyboard, Maximize2, Mic2, Minimize2, Pause, Piano, Play, RotateCcw, SlidersHorizontal, Usb, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { eventsForHand, matchesPianoEvent, pianoArrangementFor, pianoLyricCueAtBeat, pianoNoteLabel, pianoRange } from '../piano';
import { usePitchDetector } from '../hooks/usePitchDetector';
import { useSynth } from '../hooks/useSynth';
import type { InstrumentArrangementEvent, PianoConfig, PracticeSessionInput, PrimaryPracticeMode, Song } from '../types';
import { PianoFallingStage } from './PianoKeyboard';

interface PianoPracticePlayerProps {
  song: Song;
  piano: PianoConfig;
  countIn: boolean;
  onSessionUpdate: (session: PracticeSessionInput) => void;
  onClose: () => void;
}

const COMPUTER_KEYS = ['a', 'z', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']'];
const MODE_LABELS: Record<PrimaryPracticeMode, string> = {
  demo: 'Démonstration', guided: 'Lecture guidée', wait: 'Attendre les notes', performance: 'Performance',
};

interface MidiMessageLike { data: ArrayLike<number> }
interface MidiInputLike { onmidimessage: ((event: MidiMessageLike) => void) | null }
interface MidiAccessLike { inputs: Map<unknown, MidiInputLike>; onstatechange: (() => void) | null }

function eventGroups(events: InstrumentArrangementEvent[]) {
  const groups = new Map<number, InstrumentArrangementEvent[]>();
  for (const event of events) groups.set(event.beat, [...(groups.get(event.beat) ?? []), event]);
  return [...groups.entries()].sort(([a], [b]) => a - b).map(([beat, items]) => ({ beat, items }));
}

export function PianoPracticePlayer({ song, piano, countIn, onSessionUpdate, onClose }: PianoPracticePlayerProps) {
  const arrangement = pianoArrangementFor(song);
  const [mode, setMode] = useState<PrimaryPracticeMode>('guided');
  const [hand, setHand] = useState<'right' | 'left' | 'both'>('right');
  const [playing, setPlaying] = useState(false);
  const [tempo, setTempo] = useState(80);
  const [beat, setBeat] = useState(0);
  const [waitIndex, setWaitIndex] = useState(0);
  const [remainingMidis, setRemainingMidis] = useState<number[]>([]);
  const [hitMidis, setHitMidis] = useState<Set<number>>(new Set());
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [midiStatus, setMidiStatus] = useState<'idle' | 'ready' | 'unavailable'>('idle');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showLyrics, setShowLyrics] = useState(Boolean(song.lyrics?.length));
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement));
  const detector = usePitchDetector();
  const startDetector = detector.start;
  const stopDetector = detector.stop;
  const { playPianoMidi, click } = useSynth();
  const playedEvents = useRef(new Set<string>());
  const lastHit = useRef({ midi: -1, at: 0 });
  const startedAt = useRef(new Date().toISOString());
  const activeStartedAt = useRef(performance.now());
  const lastFrame = useRef<number | null>(null);
  const events = useMemo(() => arrangement ? eventsForHand(arrangement, hand) : [], [arrangement, hand]);
  const groups = useMemo(() => eventGroups(events), [events]);
  const totalBeats = useMemo(() => Math.max(1, ...events.map((event) => event.beat + event.duration)), [events]);
  const activeGroup = groups[waitIndex];
  // Keep the configured instrument proportions. Cropping to the notes used by
  // a song made a 61-key piano look like a magnified 25-key keyboard.
  const keyboardMidis = useMemo(() => pianoRange(piano.keyboardSize), [piano.keyboardSize]);
  const lyricCue = useMemo(() => pianoLyricCueAtBeat(showLyrics ? song.lyrics ?? [] : [], beat, totalBeats), [beat, showLyrics, song.lyrics, totalBeats]);

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen?.();
  }, []);

  useEffect(() => {
    const update = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);

  const reset = useCallback(() => {
    setPlaying(false); setBeat(0); setWaitIndex(0); setRemainingMidis([]); setHitMidis(new Set());
    setCorrect(0); setWrong(0); setCountdown(null); playedEvents.current.clear(); lastFrame.current = null;
    lastHit.current = { midi: -1, at: 0 };
    startedAt.current = new Date().toISOString(); activeStartedAt.current = performance.now();
  }, []);

  useEffect(() => { reset(); }, [hand, mode, reset]);

  useEffect(() => {
    if (!activeGroup || mode !== 'wait') { setRemainingMidis([]); return; }
    setBeat(activeGroup.beat);
    setRemainingMidis([...new Set(activeGroup.items.flatMap((event) => event.midis))]);
  }, [activeGroup, mode]);

  const hitMidi = useCallback((midi: number, audible = true) => {
    const now = performance.now();
    if (lastHit.current.midi === midi && now - lastHit.current.at < 350) return;
    lastHit.current = { midi, at: now };
    if (audible) playPianoMidi(midi);
    setHitMidis((current) => new Set(current).add(midi));
    window.setTimeout(() => setHitMidis((current) => { const next = new Set(current); next.delete(midi); return next; }), 220);
    if (mode === 'wait' && activeGroup) {
      if (!activeGroup.items.some((event) => matchesPianoEvent(event, midi))) { setWrong((value) => value + 1); return; }
      if (!remainingMidis.includes(midi)) return;
      const next = remainingMidis.filter((expected) => expected !== midi);
      setRemainingMidis(next);
      setCorrect((value) => value + 1);
      if (next.length === 0) window.setTimeout(() => setWaitIndex((index) => Math.min(groups.length, index + 1)), 110);
      return;
    }
    if (mode === 'guided' || mode === 'performance') {
      const candidate = events.find((event) => Math.abs(event.beat - beat) <= .55 && event.midis.includes(midi));
      if (candidate) setCorrect((value) => value + 1); else setWrong((value) => value + 1);
    }
  }, [activeGroup, beat, events, groups.length, mode, playPianoMidi, remainingMidis]);

  useEffect(() => {
    if (detector.reading && mode !== 'demo') hitMidi(detector.reading.midi, false);
  }, [detector.reading, hitMidi, mode]);

  const connectMidi = useCallback(async () => {
    const request = (navigator as Navigator & { requestMIDIAccess?: () => Promise<MidiAccessLike> }).requestMIDIAccess;
    if (!request) { setMidiStatus('unavailable'); return; }
    try {
      const access = await request.call(navigator);
      const bind = () => access.inputs.forEach((input) => { input.onmidimessage = (message) => {
        const [command = 0, midi = 0, velocity = 0] = Array.from(message.data);
        if ((command & 0xf0) === 0x90 && velocity > 0) hitMidi(midi, false);
      }; });
      bind(); access.onstatechange = bind; setMidiStatus('ready');
    } catch { setMidiStatus('unavailable'); }
  }, [hitMidi]);

  useEffect(() => {
    if (!playing || mode === 'wait') return;
    let frame = 0;
    const animate = (timestamp: number) => {
      const previous = lastFrame.current ?? timestamp;
      lastFrame.current = timestamp;
      setBeat((current) => {
        const next = current + (timestamp - previous) / 1000 * song.bpm * (tempo / 100) / 60;
        if (next >= totalBeats) { setPlaying(false); return totalBeats; }
        return next;
      });
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(frame); lastFrame.current = null; };
  }, [mode, playing, song.bpm, tempo, totalBeats]);

  useEffect(() => {
    if (!playing || (mode !== 'demo' && mode !== 'guided')) return;
    for (const event of events) {
      if (event.beat > beat + .08 || event.beat < beat - .16 || playedEvents.current.has(event.id)) continue;
      playedEvents.current.add(event.id);
      event.midis.forEach((midi) => playPianoMidi(midi, Math.max(.18, event.duration * 60 / song.bpm * 100 / tempo)));
    }
  }, [beat, events, mode, playPianoMidi, playing, song.bpm, tempo]);

  useEffect(() => {
    if (mode === 'demo') stopDetector();
  }, [mode, stopDetector]);

  const togglePlayback = useCallback(async () => {
    if (beat >= totalBeats || waitIndex >= groups.length) reset();
    if (playing) { setPlaying(false); return; }
    if (mode !== 'demo' && detector.status === 'idle' && piano.input === 'microphone') void startDetector();
    if (countIn && beat === 0 && mode !== 'wait') {
      for (let value = song.timeSignature[0]; value >= 1; value -= 1) {
        setCountdown(value); click(value === song.timeSignature[0]);
        await new Promise((resolve) => window.setTimeout(resolve, 600));
      }
      setCountdown(null);
    }
    setPlaying(true);
  }, [beat, click, countIn, detector.status, groups.length, mode, piano.input, playing, reset, song.timeSignature, startDetector, totalBeats, waitIndex]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      if (event.code === 'Space') { event.preventDefault(); void togglePlayback(); return; }
      if (event.key.toLowerCase() === 'r') { reset(); return; }
      if (event.key.toLowerCase() === 'p' && song.lyrics?.length) { setShowLyrics((value) => !value); return; }
      if (event.key.toLowerCase() === 's') { setSettingsOpen((value) => !value); return; }
      if (event.key.toLowerCase() === 'f') { void toggleFullscreen(); return; }
      const index = COMPUTER_KEYS.indexOf(event.key.toLowerCase());
      if (index >= 0) hitMidi(60 + index);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hitMidi, reset, song.lyrics?.length, toggleFullscreen, togglePlayback]);

  const close = () => {
    stopDetector();
    if (document.fullscreenElement) void document.exitFullscreen();
    onSessionUpdate({
      id: crypto.randomUUID(), songId: song.id, songTitle: song.title, mode, hand,
      instrumentType: 'piano', startedAt: startedAt.current, endedAt: new Date().toISOString(),
      activeSeconds: Math.max(1, Math.round((performance.now() - activeStartedAt.current) / 1000)),
      correctCount: correct, earlyCount: 0, lateCount: 0, wrongCount: wrong,
      completionPercent: Math.min(100, Math.round((mode === 'wait' ? waitIndex / Math.max(1, groups.length) : beat / totalBeats) * 100)),
      tempoPercent: tempo, flagged: false,
    });
    onClose();
  };

  if (!arrangement) return <main className="piano-player piano-empty"><button type="button" onClick={close}><X /> Retour</button><Piano /><h1>Arrangement piano indisponible</h1><p>Ce morceau doit d’abord être vérifié dans le Studio.</p></main>;
  const expected = mode === 'wait' ? remainingMidis : events.filter((event) => event.beat <= beat + .35 && event.beat + event.duration >= beat).flatMap((event) => event.midis);
  const progress = mode === 'wait' ? waitIndex / Math.max(1, groups.length) : beat / totalBeats;
  const finished = mode === 'wait' ? waitIndex >= groups.length : beat >= totalBeats;
  const currentNotes = expected.length ? [...new Set(expected)].map((midi) => pianoNoteLabel(midi, piano.notation)).join(' + ') : finished ? 'Terminé !' : '—';
  const handLabel = hand === 'right' ? 'Main droite' : hand === 'left' ? 'Main gauche' : 'Deux mains';
  const inputLabel = midiStatus === 'ready' ? 'MIDI connecté' : detector.status === 'listening' ? 'Micro actif' : piano.input === 'midi' ? 'MIDI prêt à connecter' : 'Écoute disponible';
  const registerLabel = keyboardMidis.length ? `${pianoNoteLabel(keyboardMidis[0], piano.notation)}–${pianoNoteLabel(keyboardMidis.at(-1)!, piano.notation)}` : '';
  const stageOverlay = finished ? <div className="piano-finish-overlay"><span><Check /></span><small>SÉANCE TERMINÉE</small><strong>{correct} note{correct > 1 ? 's' : ''} juste{correct > 1 ? 's' : ''}</strong><p>{wrong ? `${wrong} passage${wrong > 1 ? 's' : ''} à reprendre tranquillement.` : 'Le morceau est prêt à être rejoué un peu plus vite.'}</p><button type="button" onClick={reset}><RotateCcw /> Recommencer</button></div> : showLyrics && (lyricCue.current || lyricCue.next) ? <div className="piano-session-lyrics" role="status" aria-live="polite" aria-atomic="true"><small><Captions /> {(lyricCue.current ?? lyricCue.next)?.section ?? 'Paroles'}</small>{lyricCue.current ? <strong aria-label={lyricCue.current.text}>{lyricCue.words.map((word, index) => <span key={`${word}-${index}`} className={index < lyricCue.activeWord ? 'is-past' : index === lyricCue.activeWord ? 'is-active' : ''}>{word}</span>)}</strong> : <strong><span className="is-active">Prépare-toi…</span></strong>}{lyricCue.next && <p><b>ENSUITE</b>{lyricCue.next.text}</p>}</div> : null;

  return <main className="piano-player piano-performance-window">
    <header className="piano-session-header">
      <button type="button" className="piano-session-icon" onClick={close} aria-label="Quitter le morceau"><X /></button>
      <div className="piano-session-title"><small>{song.artist} · {MODE_LABELS[mode]} · {Math.round(song.bpm * tempo / 100)} BPM</small><strong>{song.title}</strong></div>
      <div className="piano-session-actions">
        <span className="piano-session-score"><b>{correct}</b> justes <i>{wrong} à revoir</i></span>
        {song.lyrics?.length ? <button type="button" className={showLyrics ? 'is-active' : ''} onClick={() => setShowLyrics((value) => !value)} aria-pressed={showLyrics} title="Paroles (P)"><Captions /><span>Paroles</span></button> : null}
        <button type="button" onClick={() => void toggleFullscreen()} title="Plein écran (F)">{fullscreen ? <Minimize2 /> : <Maximize2 />}<span>{fullscreen ? 'Réduire' : 'Plein écran'}</span></button>
        <button type="button" className={settingsOpen ? 'is-active' : ''} onClick={() => setSettingsOpen((value) => !value)} aria-expanded={settingsOpen} title="Réglages (S)"><SlidersHorizontal /><span>Réglages</span></button>
      </div>
    </header>

    <div className="piano-session-progress"><i style={{ width: `${Math.min(100, progress * 100)}%` }} /></div>

    {settingsOpen && <aside className="piano-session-settings" aria-label="Réglages de la séance">
      <header><div><small>ADAPTER LA SÉANCE</small><strong>Réglages piano</strong></div><button type="button" onClick={() => setSettingsOpen(false)} aria-label="Fermer les réglages"><X /></button></header>
      <fieldset><legend>Mode de jeu</legend><div className="piano-mode-grid">{(Object.entries(MODE_LABELS) as Array<[PrimaryPracticeMode, string]>).map(([id, label]) => <button type="button" key={id} className={mode === id ? 'is-selected' : ''} onClick={() => setMode(id)}><span>{label}</span>{mode === id && <Check />}</button>)}</div></fieldset>
      <fieldset><legend>Partie travaillée</legend><div className="piano-hand-grid">{(['right', 'left', 'both'] as const).map((value) => <button type="button" className={hand === value ? 'is-selected' : ''} onClick={() => setHand(value)} key={value}><Hand /><span>{value === 'right' ? 'Droite' : value === 'left' ? 'Gauche' : 'Deux mains'}</span></button>)}</div></fieldset>
      <label className="piano-tempo-setting"><span>Vitesse <strong>{tempo}% · {Math.round(song.bpm * tempo / 100)} BPM</strong></span><input type="range" min="40" max="120" value={tempo} onChange={(event) => setTempo(Number(event.target.value))} /></label>
      <div className="piano-session-inputs"><button type="button" className={midiStatus === 'ready' ? 'is-ready' : ''} onClick={() => void connectMidi()}><Usb />{midiStatus === 'ready' ? 'MIDI connecté' : 'Connecter MIDI'}</button><button type="button" disabled={mode === 'demo'} className={detector.status === 'listening' ? 'is-ready' : ''} onClick={() => detector.status === 'listening' ? stopDetector() : void detector.start()}><Mic2 />{mode === 'demo' ? 'Micro inutile en démo' : detector.status === 'listening' ? 'Micro actif' : 'Utiliser le micro'}</button></div>
      <p><Keyboard /> A à ] joue une octave · espace lance ou met en pause · R recommence · P affiche les paroles.</p>
    </aside>}

    <section className="piano-performance-canvas">
      <div className="piano-session-hud"><div><span className={playing ? 'is-playing' : ''}><i />{finished ? 'Terminé' : mode === 'wait' ? 'À toi de jouer' : playing ? 'En cours' : 'Prêt'}</span><strong>{currentNotes}</strong></div><div><span>{handLabel}</span><span>{inputLabel}</span><span>Zone {registerLabel}</span></div></div>
      <PianoFallingStage midis={keyboardMidis} events={events} beat={beat} expected={expected} active={hitMidis} notation={piano.notation} onHit={hitMidi} overlay={stageOverlay} className="is-performance" />
    </section>

    <footer className="piano-transport">
      <button type="button" onClick={reset}><RotateCcw /> <span>Recommencer</span><kbd>R</kbd></button>
      <div><span>{Math.round(progress * 100)} %</span><progress value={progress} max={1} /><small>{handLabel}</small></div>
      <button type="button" className="piano-main-transport" onClick={() => void togglePlayback()}>{playing ? <Pause /> : <Play fill="currentColor" />}<span>{playing ? 'Pause' : finished ? 'Rejouer' : mode === 'wait' ? 'Je suis prêt' : 'Commencer'}</span><kbd>Espace</kbd></button>
      <span className="piano-device-state"><i className={midiStatus === 'ready' || detector.status === 'listening' ? 'is-ready' : ''} />{piano.name}</span>
      {countdown !== null && <div className="piano-countdown">{countdown}</div>}
    </footer>
  </main>;
}
