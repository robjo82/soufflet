import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Clock3, Keyboard, Mic2, Pause, Piano, Play, Repeat2, RotateCcw, Target, Usb, X } from 'lucide-react';
import { usePitchDetector } from '../hooks/usePitchDetector';
import { useSynth } from '../hooks/useSynth';
import { frenchNote, isBlackKey, isPianoHit, PIANO_CHORDS, PIANO_EXERCISES, pianoRange, pianoScore, resumeTimeline, type PianoExercise } from '../pianoData';
import type { Page, PianoInput, PianoKeyboardSize, PracticeSessionInput, PracticeStats } from '../types';

interface PianoModeProps {
  keyboardSize: PianoKeyboardSize;
  input: PianoInput;
  onSessionUpdate: (session: PracticeSessionInput) => Promise<void>;
  view: 'home' | 'songs' | 'exercises';
  stats: PracticeStats | null;
  onNavigate: (page: Page) => void;
  onSessionActiveChange: (active: boolean) => void;
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

export function PianoMode({ keyboardSize, input, onSessionUpdate, view, stats, onNavigate, onSessionActiveChange }: PianoModeProps) {
  const [screen, setScreen] = useState<'home' | 'calibration' | 'prepare' | 'exercise' | 'chords'>('home');
  const [exercise, setExercise] = useState<PianoExercise>(PIANO_EXERCISES[0]);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
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
  const [playMode, setPlayMode] = useState<'learning' | 'game'>('learning');
  const [tempoPercent, setTempoPercent] = useState(80);
  const [songFilter, setSongFilter] = useState<'all' | 'right' | 'both'>('all');
  const startRef = useRef(0);
  const pauseStartedRef = useRef(0);
  const judgedRef = useRef(new Set<number>());
  const lastMicroRef = useRef({ midi: -1, at: 0 });
  const { playMidi } = useSynth();
  const detector = usePitchDetector();
  const beatMs = 60000 / (exercise.bpm * tempoPercent / 100);

  useEffect(() => {
    onSessionActiveChange(screen === 'exercise' && !result);
    return () => onSessionActiveChange(false);
  }, [onSessionActiveChange, result, screen]);

  const finish = useCallback((nextCorrect = correct, nextMissed = missed, nextTimings = timings) => {
    setPlaying(false);
    const score = pianoScore(nextCorrect, nextMissed, nextTimings);
    setResult(score);
    const now = new Date();
    void onSessionUpdate({ id: crypto.randomUUID(), songId: exercise.id, songTitle: exercise.title, mode: playMode === 'learning' ? 'wait' : 'guided', startedAt: new Date(now.getTime() - exercise.notes.at(-1)!.beat * beatMs).toISOString(), endedAt: now.toISOString(), activeSeconds: Math.max(1, Math.round(exercise.notes.at(-1)!.beat * beatMs / 1000)), correctCount: score.correct, earlyCount: nextTimings.filter((value) => value < -300).length, lateCount: nextTimings.filter((value) => value > 300).length, wrongCount: score.missed, completionPercent: 100, tempoPercent, flagged: false, instrumentType: 'piano' });
  }, [beatMs, correct, exercise, missed, onSessionUpdate, playMode, tempoPercent, timings]);

  const judge = useCallback((midi: number) => {
    setPlayed(midi); playMidi(midi, .7, .12, 'piano');
    if (!playing || result) return;
    if (playMode === 'learning') {
      const expectedMidi = exercise.notes[activeIndex].midi;
      if (midi !== expectedMidi) { setErrorKey(midi); window.setTimeout(() => setErrorKey(null), 350); return; }
      judgedRef.current.add(activeIndex); setCorrect((value) => value + 1); setTimings((values) => [...values, 0]);
      if (activeIndex === exercise.notes.length - 1) finish(correct + 1, missed, [...timings, 0]); else setActiveIndex(activeIndex + 1);
      return;
    }
    const elapsed = performance.now() - startRef.current;
    let closest = -1; let distance = Number.POSITIVE_INFINITY;
    exercise.notes.forEach((note, index) => { if (judgedRef.current.has(index)) return; const delta = elapsed - note.beat * beatMs; if (Math.abs(delta) < Math.abs(distance)) { distance = delta; closest = index; } });
    if (closest < 0 || !isPianoHit(exercise.notes[closest].midi, midi, distance)) { setErrorKey(midi); window.setTimeout(() => setErrorKey(null), 350); return; }
    judgedRef.current.add(closest); setCorrect((value) => value + 1); setTimings((values) => [...values, distance]); setActiveIndex(Math.min(closest + 1, exercise.notes.length - 1));
  }, [activeIndex, beatMs, correct, exercise.notes, finish, missed, playMidi, playMode, playing, result, timings]);

  useEffect(() => {
    if (!playing || playMode === 'learning') return;
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
  }, [beatMs, correct, exercise.notes, finish, missed, playMode, playing, timings]);

  useEffect(() => {
    if (input !== 'computer-keyboard' || screen !== 'exercise') return;
    const listener = (event: globalThis.KeyboardEvent) => { const midi = PC_KEYS[event.key.toLowerCase()]; if (midi !== undefined && !event.repeat) judge(midi); };
    window.addEventListener('keydown', listener); return () => window.removeEventListener('keydown', listener);
  }, [input, judge, screen]);

  useEffect(() => {
    if (input !== 'microphone' || detector.status !== 'listening' || !detector.reading || (screen !== 'exercise' && screen !== 'calibration')) return;
    const now = performance.now(); const midi = detector.reading.midi;
    if (detector.reading.confidence > .72 && (midi !== lastMicroRef.current.midi || now - lastMicroRef.current.at > 650)) { lastMicroRef.current = { midi, at: now }; if (screen === 'exercise') judge(midi); else { setPlayed(midi); playMidi(midi, .5, .08, 'piano'); } }
  }, [detector.reading, detector.status, input, judge, playMidi, screen]);

  useEffect(() => {
    if (input !== 'midi') return;
    const nav = navigator as NavigatorWithMidi;
    if (!nav.requestMIDIAccess) { setMidiStatus('unavailable'); return; }
    let active = true;
    nav.requestMIDIAccess().then((access) => { if (!active) return; const connect = () => { let count = 0; for (const device of access.inputs.values()) { count += 1; device.onmidimessage = (event) => { const data = event.data; if (!data) return; const command = data[0]; const midi = data[1]; const velocity = data[2]; if ((command & 0xf0) === 0x90 && velocity > 0) judge(midi); }; } setMidiStatus(count ? 'connected' : 'unavailable'); }; connect(); access.onstatechange = connect; }).catch(() => setMidiStatus('unavailable'));
    return () => { active = false; };
  }, [input, judge]);

  const start = () => { judgedRef.current.clear(); setCorrect(0); setMissed(0); setTimings([]); setResult(null); setActiveIndex(0); setPaused(false); setElapsedBeats(-.8 * 1000 / beatMs); startRef.current = performance.now() + 800; setPlaying(true); };
  const beginExercise = () => { setScreen('exercise'); start(); };
  const togglePause = () => {
    if (playing) { pauseStartedRef.current = performance.now(); setPlaying(false); setPaused(true); return; }
    if (paused) { startRef.current = resumeTimeline(startRef.current, pauseStartedRef.current, performance.now()); setPaused(false); setPlaying(true); }
  };
  const expected = screen === 'chords' ? PIANO_CHORDS[chordIndex].midis : screen === 'exercise' ? [exercise.notes[activeIndex].midi] : [];
  const inputMessage = input === 'midi' && midiStatus !== 'connected' ? 'Aucun clavier MIDI détecté : utilise le clavier PC ou le micro.' : input === 'microphone' && detector.status !== 'listening' ? 'Teste et autorise le micro avant de jouer.' : 'Entrée prête.';

  if (screen === 'home' && view === 'home') return <main className="page-content piano-page piano-dashboard">
    <header className="piano-hero"><span><Piano /></span><div><small>TON PARCOURS PIANO</small><h1>Reprends là où tu en étais</h1><p>Une suggestion courte, puis quelques minutes de pratique ciblée.</p></div><button type="button" onClick={() => { setExercise(PIANO_EXERCISES[0]); setScreen('prepare'); }}><Play /> Suggestion du jour</button></header>
    <section className="piano-dashboard-grid"><article className="daily-piano-card"><small>AUJOURD’HUI · TRÈS SIMPLE</small><h2>Trois petits pas</h2><p>Do, Ré et Mi à tempo calme pour retrouver tes repères.</p><button type="button" onClick={() => { setExercise(PIANO_EXERCISES[0]); setScreen('prepare'); }}>Commencer <ChevronRight /></button></article><article className="piano-recommendation"><Target /><div><small>CONSEIL PERSONNALISÉ</small><strong>{stats?.hasData ? 'Consolide les notes encore hésitantes' : 'Commence par les positions de la main droite'}</strong><p>{stats?.hasData ? 'Ralentis à 80 % et rejoue les passages marqués en rouge.' : 'Le premier exercice utilise seulement Do, Ré et Mi.'}</p></div></article></section>
    <section className="piano-stat-grid"><article><Clock3 /><strong>{Math.round((stats?.overview.weekSeconds ?? 0) / 60)} min</strong><span>cette semaine</span></article><article><Target /><strong>{stats?.overview.pitchAccuracy ?? '—'}{stats?.overview.pitchAccuracy !== null && stats?.overview.pitchAccuracy !== undefined ? ' %' : ''}</strong><span>notes justes</span></article><article><Repeat2 /><strong>{stats?.overview.timingAccuracy ?? '—'}{stats?.overview.timingAccuracy !== null && stats?.overview.timingAccuracy !== undefined ? ' %' : ''}</strong><span>précision rythmique</span></article></section>
    <section className="suggested-chords"><header><div><small>ACCORDS VISUELS</small><h2>Aujourd’hui : Do majeur et Sol majeur</h2></div><button type="button" onClick={() => setScreen('chords')}>Voir les accords <ChevronRight /></button></header><PianoKeyboard size={keyboardSize} expected={PIANO_CHORDS[0].midis} onPlay={judge} /></section>
    <section className="piano-worked"><header><h2>Morceaux les plus travaillés</h2><button type="button" onClick={() => onNavigate('piano-songs')}>Tous les morceaux</button></header>{stats?.favoriteSongs.length ? stats.favoriteSongs.slice(0, 3).map((song) => <article key={song.songId}><strong>{song.title}</strong><span>{song.sessions} séance{song.sessions > 1 ? 's' : ''}</span><em>{Math.round(song.activeSeconds / 60)} min</em></article>) : <p>Les morceaux que tu pratiques apparaîtront ici.</p>}</section>
  </main>;

  if (screen === 'home' && view === 'songs') return <main className="page-content piano-page"><header className="page-heading"><span className="eyebrow">Plaisir de jouer</span><h1>Morceaux</h1><p>Choisis un morceau adapté à la main que tu souhaites travailler.</p></header><div className="piano-song-filters" role="group" aria-label="Filtrer les morceaux"><button type="button" className={songFilter === 'all' ? 'is-active' : ''} onClick={() => setSongFilter('all')}>Tous les morceaux</button><button type="button" className={songFilter === 'right' ? 'is-active' : ''} onClick={() => setSongFilter('right')}>Main droite</button><button type="button" className={songFilter === 'both' ? 'is-active' : ''} onClick={() => setSongFilter('both')}>Deux mains</button></div><section className="piano-exercise-grid piano-song-list">{PIANO_EXERCISES.filter((item) => songFilter === 'all' || item.hand === songFilter).map((item) => <button type="button" key={item.id} onClick={() => { setExercise(item); setScreen('prepare'); }}><small>{item.level}</small><strong>{item.title}</strong><span>{item.notes.length} notes · {item.bpm} BPM · {item.hand === 'both' ? 'Deux mains' : 'Main droite'}</span><Play /></button>)}</section></main>;

  if (screen === 'home' && view === 'exercises') return <main className="page-content piano-page"><header className="page-heading"><span className="eyebrow">Technique</span><h1>Exercices</h1><p>Travaille une difficulté à la fois, sans portée musicale.</p></header><section className="piano-technique-grid">{[['Trouver la bonne note', 'Reconnais une touche éclairée.'], ['Jouer une suite de notes', 'Enchaîne Do, Ré, Mi sans perdre ta position.'], ['Travail du rythme', 'Joue régulièrement dans une fenêtre de ±300 ms.'], ['Intervalles simples', 'Repère les distances entre deux touches.'], ['Main droite', 'Travail mélodique corrigé.'], ['Main gauche', 'Repérage visuel, correction bientôt.'], ['Deux mains', 'Coordination visuelle, détection bientôt.']].map(([title, detail], index) => <button type="button" key={title} onClick={() => { setExercise(PIANO_EXERCISES[Math.min(index, 2)]); setScreen('prepare'); }}><span>{index + 1}</span><strong>{title}</strong><p>{detail}</p><ChevronRight /></button>)}</section></main>;

  if (screen === 'prepare') {
    const previous = stats?.recentSessions.filter((session) => session.songId === exercise.id).sort((left, right) => right.completionPercent - left.completionPercent)[0];
    const assessed = previous ? previous.correctCount + previous.earlyCount + previous.lateCount + previous.wrongCount : 0;
    const bestScore = previous && assessed ? Math.round((previous.correctCount + previous.earlyCount + previous.lateCount) / assessed * 100) : null;
    return <main className="page-content piano-page piano-preparation"><button className="piano-back" type="button" onClick={() => setScreen('home')}><ChevronLeft /> Retour</button><section><header><span><Piano /></span><div><small>{exercise.level} · {exercise.notes.length} notes</small><h1>{exercise.title}</h1><p>Prépare ta séance avant d’ouvrir le lecteur.</p></div></header><div className="preparation-score"><small>MEILLEUR SCORE</small><strong>{bestScore === null ? 'Premier essai' : `${bestScore} / 100`}</strong><span>{previous ? `${previous.tempoPercent} % du tempo · ${previous.mode === 'wait' ? 'Apprentissage' : 'Jeu'}` : 'Aucune séance enregistrée'}</span></div><div className="preparation-modes"><button type="button" className={playMode === 'learning' ? 'is-selected' : ''} onClick={() => setPlayMode('learning')}><Target /><span><strong>Apprentissage</strong><small>Le défilement attend chaque bonne note.</small></span>{playMode === 'learning' && <Check />}</button><button type="button" className={playMode === 'game' ? 'is-selected' : ''} onClick={() => setPlayMode('game')}><Play /><span><strong>Jeu</strong><small>Tempo continu, timing et score final.</small></span>{playMode === 'game' && <Check />}</button></div><label className="preparation-tempo"><span>Vitesse du morceau</span><strong>{tempoPercent} % · {Math.round(exercise.bpm * tempoPercent / 100)} BPM</strong><input type="range" min="50" max="100" step="10" value={tempoPercent} onChange={(event) => setTempoPercent(Number(event.target.value))} /></label><button type="button" className="primary-button preparation-start" onClick={beginExercise}><Play /> Lancer {playMode === 'learning' ? 'l’apprentissage' : 'le morceau'}</button></section></main>;
  }

  if (screen === 'calibration') return <main className="page-content piano-page"><button className="piano-back" type="button" onClick={() => { detector.stop(); setScreen('home'); }}><ChevronLeft /> Retour</button><section className="piano-calibration"><Mic2 /><small>TEST DE L’ENTRÉE</small><h1>Joue quelques notes</h1><p>{inputMessage}</p><strong>{input === 'microphone' ? detector.reading ? frenchNote(detector.reading.midi) : 'En attente…' : played !== null ? frenchNote(played) : 'En attente…'}</strong>{input === 'microphone' && detector.status !== 'listening' && <button type="button" className="primary-button" onClick={() => void detector.start()}><Mic2 /> Démarrer le micro</button>}<PianoKeyboard size={keyboardSize} played={played} onPlay={judge} /><p className="piano-limit">Le micro V1 reconnaît une seule note à la fois. Si le résultat oscille, choisis MIDI ou clavier PC.</p></section></main>;

  if (screen === 'chords') return <main className="page-content piano-page"><button className="piano-back" type="button" onClick={() => setScreen('home')}><ChevronLeft /> Retour</button><section className="chord-trainer"><small>ACCORDS · GUIDE VISUEL</small><h1>{PIANO_CHORDS[chordIndex].name}</h1><p>Joue ensemble les touches colorées, puis passe manuellement à l’accord suivant.</p><PianoKeyboard size={keyboardSize} expected={expected} onPlay={judge} /><footer><button type="button" disabled={chordIndex === 0} onClick={() => setChordIndex(chordIndex - 1)}><ChevronLeft /> Précédent</button><span>{chordIndex + 1} / {PIANO_CHORDS.length}</span><button type="button" disabled={chordIndex === PIANO_CHORDS.length - 1} onClick={() => setChordIndex(chordIndex + 1)}>Suivant <ChevronRight /></button></footer></section></main>;

  return <main className="piano-player">
    <header><button type="button" onClick={() => { setPlaying(false); setScreen('home'); }}><X /> Quitter</button><div><small>{exercise.level}</small><strong>{exercise.title}</strong></div><span>{correct} juste{correct > 1 ? 's' : ''} · {missed} ratée{missed > 1 ? 's' : ''}</span></header>
    {result ? <section className="piano-results"><Check /><h1>Exercice terminé</h1><div><article><strong>{result.correct}</strong><span>correctes</span></article><article><strong>{result.missed}</strong><span>ratées</span></article><article><strong>{result.averageDelay} ms</strong><span>retard moyen</span></article><article><strong>{result.rhythmAccuracy} %</strong><span>précision rythme</span></article></div><b>{result.global} / 100</b><p>{result.advice}</p><button type="button" className="primary-button" onClick={start}><RotateCcw /> Recommencer</button></section> : <>
      <section className="piano-roll"><div className="hit-line" />{exercise.notes.map((note, index) => { const elapsed = playMode === 'learning' ? exercise.notes[activeIndex].beat : playing ? (performance.now() - startRef.current) / beatMs : paused ? (pauseStartedRef.current - startRef.current) / beatMs : 0; return <i key={index} className={`${index === activeIndex ? 'is-active' : ''} ${judgedRef.current.has(index) ? 'is-judged' : ''}`} style={{ '--lane': note.midi - 60, '--duration': note.duration, top: 299 - 35 * note.duration, transform: `translateY(${(elapsed - note.beat) * 72}px)` } as React.CSSProperties}><span>{frenchNote(note.midi).replace(/\d$/, '')}</span></i>; })}</section>
      <PianoKeyboard size={keyboardSize} expected={expected} played={played} error={errorKey} onPlay={judge} />
      <footer><span>{input === 'midi' ? <Usb /> : input === 'microphone' ? <Mic2 /> : <Keyboard />} {paused ? 'Lecture en pause' : inputMessage}</span><button type="button" className="primary-button piano-pause" onClick={togglePause}>{playing ? <><Pause /> Pause</> : <><Play /> Reprendre</>}</button><progress value={activeIndex + 1} max={exercise.notes.length} /></footer>
    </>}
  </main>;
}
