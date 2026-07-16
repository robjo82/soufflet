import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Keyboard, Mic2, Piano, Play, RotateCcw, Usb, X } from 'lucide-react';
import { usePitchDetector } from '../hooks/usePitchDetector';
import { useSynth } from '../hooks/useSynth';
import { frenchNote, isBlackKey, PIANO_CHORDS, PIANO_EXERCISES, pianoRange, pianoScore, type PianoExercise } from '../pianoData';
import type { PianoInput, PianoKeyboardSize, PracticeSessionInput } from '../types';

interface PianoModeProps {
  keyboardSize: PianoKeyboardSize;
  input: PianoInput;
  onPreferencesChange: (size: PianoKeyboardSize, input: PianoInput) => void;
  onSessionUpdate: (session: PracticeSessionInput) => Promise<void>;
}

interface MidiMessageLike { data: Uint8Array }
interface MidiInputLike { onmidimessage: ((event: MidiMessageLike) => void) | null }
interface MidiAccessLike { inputs: { values(): IterableIterator<MidiInputLike> }; onstatechange: (() => void) | null }
type NavigatorWithMidi = Navigator & { requestMIDIAccess?: () => Promise<MidiAccessLike> };
type Result = ReturnType<typeof pianoScore>;
const PC_KEYS: Record<string, number> = { a: 60, z: 62, e: 64, r: 65, t: 67, y: 69, u: 71, i: 72 };

function PianoKeyboard({ size, expected = [], played, error, onPlay }: { size: PianoKeyboardSize; expected?: number[]; played?: number | null; error?: number | null; onPlay: (midi: number) => void }) {
  const keys = pianoRange(size);
  return <div className={`piano-keyboard keys-${size}`} aria-label={`Clavier piano ${size} touches`}>
    {keys.map((midi) => <button type="button" key={midi} className={`${isBlackKey(midi) ? 'black-key' : 'white-key'} ${expected.includes(midi) ? 'is-expected' : ''} ${played === midi ? 'is-played' : ''} ${error === midi ? 'is-error' : ''}`} onPointerDown={() => onPlay(midi)} aria-label={frenchNote(midi)}><span>{midi % 12 === 0 ? frenchNote(midi) : ''}</span></button>)}
  </div>;
}

export function PianoMode({ keyboardSize, input, onPreferencesChange, onSessionUpdate }: PianoModeProps) {
  const [screen, setScreen] = useState<'home' | 'calibration' | 'exercise' | 'chords'>('home');
  const [exercise, setExercise] = useState<PianoExercise>(PIANO_EXERCISES[0]);
  const [playing, setPlaying] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [played, setPlayed] = useState<number | null>(null);
  const [errorKey, setErrorKey] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [missed, setMissed] = useState(0);
  const [timings, setTimings] = useState<number[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [, setElapsedBeats] = useState(0);
  const [chordIndex, setChordIndex] = useState(0);
  const [midiStatus, setMidiStatus] = useState<'idle' | 'connected' | 'unavailable'>('idle');
  const startRef = useRef(0);
  const judgedRef = useRef(new Set<number>());
  const lastMicroRef = useRef({ midi: -1, at: 0 });
  const { playMidi } = useSynth();
  const detector = usePitchDetector();
  const beatMs = 60000 / exercise.bpm;

  const finish = useCallback((nextCorrect = correct, nextMissed = missed, nextTimings = timings) => {
    setPlaying(false);
    const score = pianoScore(nextCorrect, nextMissed, nextTimings);
    setResult(score);
    const now = new Date();
    void onSessionUpdate({ id: crypto.randomUUID(), songId: exercise.id, songTitle: exercise.title, mode: 'guided', startedAt: new Date(now.getTime() - exercise.notes.at(-1)!.beat * beatMs).toISOString(), endedAt: now.toISOString(), activeSeconds: Math.max(1, Math.round(exercise.notes.at(-1)!.beat * beatMs / 1000)), correctCount: score.correct, earlyCount: nextTimings.filter((value) => value < -300).length, lateCount: nextTimings.filter((value) => value > 300).length, wrongCount: score.missed, completionPercent: 100, tempoPercent: 100, flagged: false, instrumentType: 'piano' });
  }, [beatMs, correct, exercise, missed, onSessionUpdate, timings]);

  const judge = useCallback((midi: number) => {
    setPlayed(midi); playMidi(midi, .35, .08);
    if (!playing || result) return;
    const elapsed = performance.now() - startRef.current;
    let closest = -1; let distance = Number.POSITIVE_INFINITY;
    exercise.notes.forEach((note, index) => { if (judgedRef.current.has(index)) return; const delta = elapsed - note.beat * beatMs; if (Math.abs(delta) < Math.abs(distance)) { distance = delta; closest = index; } });
    if (closest < 0 || Math.abs(distance) > 300 || exercise.notes[closest].midi !== midi) { setErrorKey(midi); window.setTimeout(() => setErrorKey(null), 350); return; }
    judgedRef.current.add(closest); setCorrect((value) => value + 1); setTimings((values) => [...values, distance]); setActiveIndex(Math.min(closest + 1, exercise.notes.length - 1));
  }, [beatMs, exercise.notes, playMidi, playing, result]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      const elapsed = performance.now() - startRef.current;
      setElapsedBeats(elapsed / beatMs);
      let newlyMissed = 0;
      exercise.notes.forEach((note, index) => { if (!judgedRef.current.has(index) && elapsed > note.beat * beatMs + 300) { judgedRef.current.add(index); newlyMissed += 1; } });
      if (newlyMissed) setMissed((value) => value + newlyMissed);
      const end = (exercise.notes.at(-1)!.beat + exercise.notes.at(-1)!.duration) * beatMs + 350;
      if (elapsed >= end) finish(correct, missed + newlyMissed, timings);
      else setActiveIndex(Math.min(exercise.notes.findIndex((note) => note.beat * beatMs + 300 >= elapsed) < 0 ? exercise.notes.length - 1 : exercise.notes.findIndex((note) => note.beat * beatMs + 300 >= elapsed), exercise.notes.length - 1));
    }, 50);
    return () => window.clearInterval(timer);
  }, [beatMs, correct, exercise.notes, finish, missed, playing, timings]);

  useEffect(() => {
    if (input !== 'computer-keyboard' || screen !== 'exercise') return;
    const listener = (event: globalThis.KeyboardEvent) => { const midi = PC_KEYS[event.key.toLowerCase()]; if (midi !== undefined && !event.repeat) judge(midi); };
    window.addEventListener('keydown', listener); return () => window.removeEventListener('keydown', listener);
  }, [input, judge, screen]);

  useEffect(() => {
    if (input !== 'microphone' || detector.status !== 'listening' || !detector.reading || (screen !== 'exercise' && screen !== 'calibration')) return;
    const now = performance.now(); const midi = detector.reading.midi;
    if (detector.reading.confidence > .72 && (midi !== lastMicroRef.current.midi || now - lastMicroRef.current.at > 650)) { lastMicroRef.current = { midi, at: now }; if (screen === 'exercise') judge(midi); else { setPlayed(midi); playMidi(midi, .2, .05); } }
  }, [detector.reading, detector.status, input, judge, playMidi, screen]);

  useEffect(() => {
    if (input !== 'midi') return;
    const nav = navigator as NavigatorWithMidi;
    if (!nav.requestMIDIAccess) { setMidiStatus('unavailable'); return; }
    let active = true;
    nav.requestMIDIAccess().then((access) => { if (!active) return; const connect = () => { let count = 0; for (const device of access.inputs.values()) { count += 1; device.onmidimessage = (event) => { const data = event.data; if (!data) return; const command = data[0]; const midi = data[1]; const velocity = data[2]; if ((command & 0xf0) === 0x90 && velocity > 0) judge(midi); }; } setMidiStatus(count ? 'connected' : 'unavailable'); }; connect(); access.onstatechange = connect; }).catch(() => setMidiStatus('unavailable'));
    return () => { active = false; };
  }, [input, judge]);

  const start = () => { judgedRef.current.clear(); setCorrect(0); setMissed(0); setTimings([]); setResult(null); setActiveIndex(0); setElapsedBeats(-.8 * 1000 / beatMs); startRef.current = performance.now() + 800; setPlaying(true); };
  const expected = screen === 'chords' ? PIANO_CHORDS[chordIndex].midis : screen === 'exercise' ? [exercise.notes[activeIndex].midi] : [];
  const inputMessage = input === 'midi' && midiStatus !== 'connected' ? 'Aucun clavier MIDI détecté : utilise le clavier PC ou le micro.' : input === 'microphone' && detector.status !== 'listening' ? 'Teste et autorise le micro avant de jouer.' : 'Entrée prête.';

  if (screen === 'home') return <main className="page-content piano-page"><header className="piano-hero"><span><Piano /></span><div><small>MODE PIANO · MONOPHONIQUE</small><h1>Une touche à la fois</h1><p>Choisis un exercice, regarde les notes descendre et joue-les dans une fenêtre de ±300 ms.</p></div></header><section className="piano-setup"><label>Format du clavier<select value={keyboardSize} onChange={(event) => onPreferencesChange(Number(event.target.value) as PianoKeyboardSize, input)}>{[25, 32, 49, 61, 76, 88].map((size) => <option key={size} value={size}>{size} touches</option>)}</select></label><label>Méthode d’entrée<select value={input} onChange={(event) => onPreferencesChange(keyboardSize, event.target.value as PianoInput)}><option value="midi">MIDI</option><option value="microphone">Micro</option><option value="computer-keyboard">Clavier PC</option></select></label><button className="secondary-button" type="button" onClick={() => setScreen('calibration')}><Mic2 /> Tester mon entrée</button></section><PianoKeyboard size={keyboardSize} onPlay={judge} /><section className="piano-exercise-grid">{PIANO_EXERCISES.map((item) => <button type="button" key={item.id} onClick={() => { setExercise(item); setScreen('exercise'); }}><small>{item.level}</small><strong>{item.title}</strong><span>{item.notes.length} notes · {item.bpm} BPM</span><Play /></button>)}</section><button className="piano-chord-entry" type="button" onClick={() => setScreen('chords')}><span><Keyboard /></span><div><strong>Accords visuels</strong><p>Découvre cinq accords, sans détection automatique.</p></div><ChevronRight /></button></main>;

  if (screen === 'calibration') return <main className="page-content piano-page"><button className="piano-back" type="button" onClick={() => { detector.stop(); setScreen('home'); }}><ChevronLeft /> Retour</button><section className="piano-calibration"><Mic2 /><small>TEST DE L’ENTRÉE</small><h1>Joue quelques notes</h1><p>{inputMessage}</p><strong>{input === 'microphone' ? detector.reading ? frenchNote(detector.reading.midi) : 'En attente…' : played !== null ? frenchNote(played) : 'En attente…'}</strong>{input === 'microphone' && detector.status !== 'listening' && <button type="button" className="primary-button" onClick={() => void detector.start()}><Mic2 /> Démarrer le micro</button>}<PianoKeyboard size={keyboardSize} played={played} onPlay={judge} /><p className="piano-limit">Le micro V1 reconnaît une seule note à la fois. Si le résultat oscille, choisis MIDI ou clavier PC.</p></section></main>;

  if (screen === 'chords') return <main className="page-content piano-page"><button className="piano-back" type="button" onClick={() => setScreen('home')}><ChevronLeft /> Retour</button><section className="chord-trainer"><small>ACCORDS · GUIDE VISUEL</small><h1>{PIANO_CHORDS[chordIndex].name}</h1><p>Joue ensemble les touches colorées, puis passe manuellement à l’accord suivant.</p><PianoKeyboard size={keyboardSize} expected={expected} onPlay={judge} /><footer><button type="button" disabled={chordIndex === 0} onClick={() => setChordIndex(chordIndex - 1)}><ChevronLeft /> Précédent</button><span>{chordIndex + 1} / {PIANO_CHORDS.length}</span><button type="button" disabled={chordIndex === PIANO_CHORDS.length - 1} onClick={() => setChordIndex(chordIndex + 1)}>Suivant <ChevronRight /></button></footer></section></main>;

  return <main className="piano-player"><header><button type="button" onClick={() => { setPlaying(false); setScreen('home'); }}><X /> Quitter</button><div><small>{exercise.level}</small><strong>{exercise.title}</strong></div><span>{correct} juste{correct > 1 ? 's' : ''} · {missed} ratée{missed > 1 ? 's' : ''}</span></header>{result ? <section className="piano-results"><Check /><h1>Exercice terminé</h1><div><article><strong>{result.correct}</strong><span>correctes</span></article><article><strong>{result.missed}</strong><span>ratées</span></article><article><strong>{result.averageDelay} ms</strong><span>retard moyen</span></article><article><strong>{result.rhythmAccuracy} %</strong><span>précision rythme</span></article></div><b>{result.global} / 100</b><p>{result.advice}</p><button type="button" className="primary-button" onClick={start}><RotateCcw /> Recommencer</button></section> : <><section className="piano-roll"><div className="hit-line" />{exercise.notes.map((note, index) => <i key={index} className={`${index === activeIndex ? 'is-active' : ''} ${judgedRef.current.has(index) ? 'is-judged' : ''}`} style={{ '--beat': note.beat, '--lane': note.midi - 60, '--duration': note.duration, '--elapsed': playing ? (performance.now() - startRef.current) / beatMs : 0 } as React.CSSProperties}><span>{frenchNote(note.midi).replace(/\d$/, '')}</span></i>)}</section><PianoKeyboard size={keyboardSize} expected={expected} played={played} error={errorKey} onPlay={judge} /><footer><span>{input === 'midi' ? <Usb /> : input === 'microphone' ? <Mic2 /> : <Keyboard />} {inputMessage}</span><button type="button" className="primary-button" disabled={playing} onClick={start}><Play /> {playing ? 'En cours…' : 'Démarrer'}</button><progress value={activeIndex + 1} max={exercise.notes.length} /></footer></>}</main>;
}
