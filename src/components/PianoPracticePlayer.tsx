import { ArrowLeft, Hand, Keyboard, Mic2, Pause, Piano, Play, RotateCcw, SlidersHorizontal, Usb } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { eventsForHand, matchesPianoEvent, pianoArrangementFor, pianoNoteLabel, pianoRange } from '../piano';
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
  const detector = usePitchDetector();
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
  const keyboardMidis = useMemo(() => pianoRange(piano.keyboardSize), [piano.keyboardSize]);

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
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      if (event.code === 'Space') { event.preventDefault(); setPlaying((value) => !value); return; }
      if (event.key.toLowerCase() === 'r') { reset(); return; }
      const index = COMPUTER_KEYS.indexOf(event.key.toLowerCase());
      if (index >= 0) hitMidi(60 + index);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hitMidi, reset]);

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

  const togglePlayback = async () => {
    if (beat >= totalBeats || waitIndex >= groups.length) reset();
    if (playing) { setPlaying(false); return; }
    if (mode !== 'demo' && detector.status === 'idle' && piano.input === 'microphone') void detector.start();
    if (countIn && beat === 0 && mode !== 'wait') {
      for (let value = song.timeSignature[0]; value >= 1; value -= 1) {
        setCountdown(value); click(value === song.timeSignature[0]);
        await new Promise((resolve) => window.setTimeout(resolve, 600));
      }
      setCountdown(null);
    }
    setPlaying(true);
  };

  const close = () => {
    detector.stop();
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

  if (!arrangement) return <main className="piano-player piano-empty"><button type="button" onClick={close}><ArrowLeft /> Retour</button><Piano /><h1>Arrangement piano indisponible</h1><p>Ce morceau doit d’abord être vérifié dans le Studio.</p></main>;
  const expected = mode === 'wait' ? remainingMidis : events.filter((event) => event.beat <= beat + .35 && event.beat + event.duration >= beat).flatMap((event) => event.midis);
  const progress = mode === 'wait' ? waitIndex / Math.max(1, groups.length) : beat / totalBeats;

  return <main className="piano-player">
    <header className="piano-player-head"><button type="button" className="icon-button" onClick={close}><ArrowLeft /></button><div><span className="eyebrow">Piano · {MODE_LABELS[mode]}</span><h1>{song.title}</h1><p>{song.artist} · {song.bpm} BPM</p></div><div className="piano-score"><strong>{correct}</strong><span>justes</span><small>{wrong} à reprendre</small></div></header>
    <div className="piano-progress"><i style={{ width: `${Math.min(100, progress * 100)}%` }} /></div>
    <section className="piano-workspace">
      <aside className="piano-controls">
        <label>Mode<select value={mode} onChange={(event) => setMode(event.target.value as PrimaryPracticeMode)}>{Object.entries(MODE_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <div><span>Travailler</span><div className="segmented-control">{(['right', 'left', 'both'] as const).map((value) => <button type="button" className={hand === value ? 'is-active' : ''} onClick={() => setHand(value)} key={value}><Hand />{value === 'right' ? 'Droite' : value === 'left' ? 'Gauche' : 'Deux mains'}</button>)}</div></div>
        <label>Tempo <strong>{tempo}%</strong><input type="range" min="40" max="120" value={tempo} onChange={(event) => setTempo(Number(event.target.value))} /></label>
        <div className="piano-inputs"><button type="button" className={midiStatus === 'ready' ? 'is-ready' : ''} onClick={() => void connectMidi()}><Usb />{midiStatus === 'ready' ? 'MIDI connecté' : 'Connecter MIDI'}</button><button type="button" className={detector.status === 'listening' ? 'is-ready' : ''} onClick={() => detector.status === 'listening' ? detector.stop() : void detector.start()}><Mic2 />{detector.status === 'listening' ? 'Micro actif' : 'Utiliser le micro'}</button></div>
        <p className="piano-input-help"><Keyboard /> Clavier d’ordinateur : A à ]. Le micro évalue une note à la fois ; le MIDI est recommandé pour les accords.</p>
      </aside>
      <div className="piano-stage">
        <div className="piano-next"><span>{mode === 'wait' ? 'À toi de jouer' : playing ? 'En cours' : 'Prêt'}</span><strong>{expected.length ? [...new Set(expected)].map((midi) => pianoNoteLabel(midi, piano.notation)).join(' + ') : waitIndex >= groups.length ? 'Terminé !' : '—'}</strong><small>{activeGroup?.items.map((event) => event.fingers?.length ? `doigt ${event.fingers.join('-')}` : '').filter(Boolean).join(' · ')}</small></div>
        <PianoFallingStage midis={keyboardMidis} events={events} beat={beat} expected={expected} active={hitMidis} notation={piano.notation} onHit={hitMidi} />
      </div>
    </section>
    <footer className="piano-transport"><button type="button" onClick={reset}><RotateCcw /> Recommencer <kbd>R</kbd></button><button type="button" className="primary-button" onClick={() => void togglePlayback()}>{playing ? <Pause /> : <Play fill="currentColor" />}{playing ? 'Pause' : mode === 'wait' ? 'Commencer à jouer' : 'Commencer'} <kbd>Espace</kbd></button><span><SlidersHorizontal /> {piano.name}</span>{countdown !== null && <div className="piano-countdown">{countdown}</div>}</footer>
  </main>;
}
