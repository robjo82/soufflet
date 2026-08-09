import { ArrowLeft, Guitar, Mic2, Pause, Play, RotateCcw, Volume2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { adaptGuitarEvent, guitarEventsForPart, guitarNoteLabel } from '../guitar';
import { analyzeLeftHandFrames, chordLabelPitchClass } from '../leftHandAnalysis';
import { usePitchDetector } from '../hooks/usePitchDetector';
import { useSynth } from '../hooks/useSynth';
import type { AudioFeatureFrame } from '../audioTraining';
import type { GuitarConfig, InstrumentArrangementEvent, PracticeSessionInput, PrimaryPracticeMode, Song } from '../types';

interface Props { song: Song; guitar: GuitarConfig; countIn: boolean; onSessionUpdate: (session: PracticeSessionInput) => void; onClose: () => void }
type GuitarPart = 'melody' | 'accompaniment' | 'both';
const MODES: Record<PrimaryPracticeMode, string> = { demo: 'Démonstration', guided: 'Lecture guidée', wait: 'Attendre le bon geste', performance: 'Performance' };

function groupEvents(events: InstrumentArrangementEvent[]) {
  const map = new Map<number, InstrumentArrangementEvent[]>();
  events.forEach((event) => map.set(event.beat, [...(map.get(event.beat) ?? []), event]));
  return [...map.entries()].sort(([a], [b]) => a - b).map(([beat, items]) => ({ beat, items }));
}

export function GuitarPracticePlayer({ song, guitar, countIn, onSessionUpdate, onClose }: Props) {
  const arrangement = song.arrangements?.guitar;
  const [mode, setMode] = useState<PrimaryPracticeMode>('guided');
  const [part, setPart] = useState<GuitarPart>('melody');
  const [playing, setPlaying] = useState(false);
  const [beat, setBeat] = useState(0);
  const [tempo, setTempo] = useState(80);
  const [waitIndex, setWaitIndex] = useState(0);
  const [remainingIds, setRemainingIds] = useState<string[]>([]);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [activeMidis, setActiveMidis] = useState<number[]>([]);
  const detector = usePitchDetector();
  const stopDetector = detector.stop;
  const { playGuitarMidi, click } = useSynth();
  const played = useRef(new Set<string>());
  const lastFrame = useRef<number | null>(null);
  const lastHit = useRef({ midi: -1, at: 0 });
  const audioFrames = useRef<AudioFeatureFrame[]>([]);
  const startedAt = useRef(new Date().toISOString());
  const activeStartedAt = useRef(performance.now());
  const events = useMemo(() => arrangement ? guitarEventsForPart(arrangement, part).map((event) => adaptGuitarEvent(event, guitar)) : [], [arrangement, guitar, part]);
  const groups = useMemo(() => groupEvents(events), [events]);
  const activeGroup = groups[waitIndex];
  const totalBeats = Math.max(1, ...events.map((event) => event.beat + event.duration));

  const reset = useCallback(() => {
    setPlaying(false); setBeat(0); setWaitIndex(0); setRemainingIds([]); setCorrect(0); setWrong(0); setActiveMidis([]);
    played.current.clear(); lastFrame.current = null; lastHit.current = { midi: -1, at: 0 };
    startedAt.current = new Date().toISOString(); activeStartedAt.current = performance.now();
  }, []);
  useEffect(() => { reset(); }, [mode, part, reset]);
  useEffect(() => {
    if (mode !== 'wait' || !activeGroup) { setRemainingIds([]); return; }
    setBeat(activeGroup.beat); setRemainingIds(activeGroup.items.map((event) => event.id));
  }, [activeGroup, mode]);

  const markEvent = useCallback((event: InstrumentArrangementEvent) => {
    if (mode === 'wait') {
      if (!remainingIds.includes(event.id)) return;
      const next = remainingIds.filter((id) => id !== event.id);
      setRemainingIds(next); setCorrect((value) => value + 1);
      if (!next.length) window.setTimeout(() => setWaitIndex((index) => Math.min(groups.length, index + 1)), 160);
    } else setCorrect((value) => value + 1);
  }, [groups.length, mode, remainingIds]);

  const hitMidi = useCallback((midi: number, audible = true) => {
    const now = performance.now();
    if (lastHit.current.midi === midi && now - lastHit.current.at < 320) return;
    lastHit.current = { midi, at: now };
    if (audible) playGuitarMidi(midi);
    setActiveMidis([midi]); window.setTimeout(() => setActiveMidis([]), 240);
    const candidates = mode === 'wait' ? activeGroup?.items ?? [] : events.filter((event) => Math.abs(event.beat - beat) <= .6);
    const match = candidates.find((event) => event.part === 'melody' && event.midis.includes(midi));
    if (match) markEvent(match); else if (mode !== 'demo') setWrong((value) => value + 1);
  }, [activeGroup, beat, events, markEvent, mode, playGuitarMidi]);

  const hitChord = useCallback((label: string) => {
    const candidates = mode === 'wait' ? activeGroup?.items ?? [] : events.filter((event) => Math.abs(event.beat - beat) <= .75);
    const expected = chordLabelPitchClass(label);
    const match = candidates.find((event) => {
      const candidate = chordLabelPitchClass(event.label);
      return event.part === 'accompaniment' && candidate?.root === expected?.root && candidate?.quality === expected?.quality;
    });
    if (match) markEvent(match); else setWrong((value) => value + 1);
  }, [activeGroup, beat, events, markEvent, mode]);

  useEffect(() => { if (detector.reading && mode !== 'demo') hitMidi(detector.reading.midi, false); }, [detector.reading, hitMidi, mode]);
  useEffect(() => {
    if (!detector.audioFrame) return;
    audioFrames.current = [...audioFrames.current.slice(-17), detector.audioFrame];
  }, [detector.audioFrame]);
  useEffect(() => {
    if (!detector.onset || part === 'melody' || mode === 'demo') return;
    window.setTimeout(() => {
      const analysis = analyzeLeftHandFrames(audioFrames.current.slice(-14), 'chord');
      if (analysis && analysis.confidence >= .48) hitChord(`${['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][analysis.rootPitchClass]}${analysis.chordQuality === 'minor' ? 'm' : ''}`);
    }, 180);
  }, [detector.onset, hitChord, mode, part]);

  useEffect(() => {
    if (!playing || mode === 'wait') return;
    let animation = 0;
    const animate = (timestamp: number) => {
      const previous = lastFrame.current ?? timestamp; lastFrame.current = timestamp;
      setBeat((current) => { const next = current + (timestamp - previous) / 1000 * song.bpm * tempo / 100 / 60; if (next >= totalBeats) { setPlaying(false); return totalBeats; } return next; });
      animation = requestAnimationFrame(animate);
    };
    animation = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(animation); lastFrame.current = null; };
  }, [mode, playing, song.bpm, tempo, totalBeats]);
  useEffect(() => {
    if (!playing || (mode !== 'demo' && mode !== 'guided')) return;
    events.forEach((event) => {
      if (event.beat > beat + .08 || event.beat < beat - .17 || played.current.has(event.id)) return;
      played.current.add(event.id); setActiveMidis(event.midis);
      event.midis.forEach((midi, index) => window.setTimeout(() => playGuitarMidi(midi, Math.max(.25, event.duration * 60 / song.bpm * 100 / tempo), event.part === 'accompaniment' ? .07 : .12), index * 18));
    });
  }, [beat, events, mode, playGuitarMidi, playing, song.bpm, tempo]);
  useEffect(() => { if (mode === 'demo') stopDetector(); }, [mode, stopDetector]);

  const toggle = async () => {
    if (beat >= totalBeats || waitIndex >= groups.length) reset();
    if (playing) { setPlaying(false); return; }
    if (mode !== 'demo' && guitar.input === 'microphone' && detector.status === 'idle') void detector.start();
    if (countIn && beat === 0 && mode !== 'wait') for (let value = song.timeSignature[0]; value > 0; value -= 1) { click(value === song.timeSignature[0]); await new Promise((resolve) => window.setTimeout(resolve, 500)); }
    setPlaying(true);
  };
  const close = () => {
    detector.stop();
    onSessionUpdate({ id: crypto.randomUUID(), songId: song.id, songTitle: song.title, mode, hand: 'both', instrumentType: 'guitar', startedAt: startedAt.current, endedAt: new Date().toISOString(), activeSeconds: Math.max(1, Math.round((performance.now() - activeStartedAt.current) / 1000)), correctCount: correct, earlyCount: 0, lateCount: 0, wrongCount: wrong, completionPercent: Math.min(100, Math.round((mode === 'wait' ? waitIndex / Math.max(1, groups.length) : beat / totalBeats) * 100)), tempoPercent: tempo, flagged: false });
    onClose();
  };
  if (!arrangement) return <main className="guitar-player guitar-empty"><button type="button" onClick={close}><ArrowLeft /> Retour</button><Guitar /><h1>Tablature guitare indisponible</h1><p>Ce morceau doit d’abord être vérifié dans le Studio.</p></main>;
  const currentEvents = mode === 'wait' ? activeGroup?.items ?? [] : events.filter((event) => event.beat <= beat + .3 && event.beat + event.duration >= beat);
  const currentPositions = currentEvents.flatMap((event) => adaptGuitarEvent(event, guitar).positions ?? []);
  const progress = mode === 'wait' ? waitIndex / Math.max(1, groups.length) : beat / totalBeats;
  return <main className="guitar-player"><header><button type="button" className="icon-button" onClick={close}><ArrowLeft /></button><div><span className="eyebrow">Guitare · {MODES[mode]}</span><h1>{song.title}</h1><p>{song.artist} · {song.bpm} BPM</p></div><div className="guitar-player-score"><strong>{correct}</strong> juste{correct > 1 ? 's' : ''}<small>{wrong} à reprendre</small></div></header><div className="guitar-player-progress"><i style={{ width: `${Math.min(100, progress * 100)}%` }} /></div>
    <section className="guitar-player-layout"><aside><label>Mode<select value={mode} onChange={(event) => setMode(event.target.value as PrimaryPracticeMode)}>{Object.entries(MODES).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label><div><span>Contenu</span>{(['melody','accompaniment','both'] as const).map((value) => <button type="button" key={value} className={part === value ? 'is-active' : ''} onClick={() => setPart(value)}>{value === 'melody' ? 'Mélodie' : value === 'accompaniment' ? 'Accords' : 'Mélodie + accords'}</button>)}</div><label>Tempo <strong>{tempo}%</strong><input type="range" min="40" max="120" value={tempo} onChange={(event) => setTempo(Number(event.target.value))} /></label><button type="button" className={detector.status === 'listening' ? 'is-active' : ''} onClick={() => detector.status === 'listening' ? detector.stop() : void detector.start()}><Mic2 />{detector.status === 'listening' ? 'Micro actif' : 'Écouter la guitare'}</button><p>Le micro reconnaît les notes et estime les accords. Étouffe les cordes inutiles pour une lecture plus fiable.</p></aside><div className="guitar-stage"><div className="guitar-current"><span>{mode === 'wait' ? 'À toi de jouer' : playing ? 'En cours' : 'Prêt'}</span><strong>{currentEvents.map((event) => event.label).filter(Boolean).join(' + ') || '—'}</strong><small>{currentPositions.map((position) => `corde ${position.string} · case ${position.fret}`).join(' · ')}</small>{currentEvents.some((event) => event.part === 'accompaniment') && <button type="button" onClick={() => { const chord = currentEvents.find((event) => event.part === 'accompaniment'); if (!chord) return; chord.midis.forEach((midi,index) => window.setTimeout(() => playGuitarMidi(midi), index * 25)); hitChord(chord.label ?? 'C'); }}><Volume2 /> Jouer l’accord</button>}</div><div className="guitar-timeline">{events.filter((event) => event.beat >= beat - 1 && event.beat <= beat + 8).map((event) => <i key={event.id} className={`is-${event.part}`} style={{ left: `${Math.max(0,(event.beat - beat + 1) / 9 * 100)}%`, width: `${Math.max(2,event.duration / 9 * 100)}%` }}><span>{event.label}</span></i>)}<b /></div><GuitarFretboard guitar={guitar} positions={currentPositions} activeMidis={activeMidis} onHit={hitMidi} /></div></section><footer className="guitar-transport"><button type="button" onClick={reset}><RotateCcw /> Recommencer</button><button type="button" className="primary-button" onClick={() => void toggle()}>{playing ? <Pause /> : <Play fill="currentColor" />}{playing ? 'Pause' : mode === 'wait' ? 'Commencer à jouer' : 'Commencer'}</button><span><Guitar /> {guitar.name}</span></footer></main>;
}

function GuitarFretboard({ guitar, positions, activeMidis, onHit }: { guitar: GuitarConfig; positions: Array<{ string: number; fret: number; finger?: number }>; activeMidis: number[]; onHit: (midi: number) => void }) {
  const frets = Array.from({ length: Math.min(13, guitar.fretCount + 1) }, (_, index) => index);
  return <div className={`guitar-fretboard is-${guitar.handedness}`}>{guitar.strings.map((string) => <div className="guitar-fretboard-string" key={string.number}><span>{string.number} · {string.note}</span><div>{frets.map((fret) => { const midi = string.midi + guitar.capo + fret; const expected = positions.some((position) => position.string === string.number && position.fret === fret); return <button type="button" key={fret} className={`${expected ? 'is-expected' : ''} ${activeMidis.includes(midi) ? 'is-active' : ''}`} onPointerDown={() => onHit(midi)} aria-label={`Corde ${string.number}, case ${fret}, ${guitarNoteLabel(midi)}`}><i style={{ height: `${Math.max(1, 7 - string.number)}px` }} />{expected && <b>{positions.find((position) => position.string === string.number && position.fret === fret)?.finger || '0'}</b>}<small>{fret}</small></button>; })}</div></div>)}</div>;
}
