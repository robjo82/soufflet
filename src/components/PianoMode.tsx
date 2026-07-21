import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, BarChart3, Captions, Check, ChevronLeft, ChevronRight, Clock3, Hand, Mic2, Pause, Piano, Play, Repeat2, RotateCcw, Target, Volume2, X } from 'lucide-react';
import { usePitchDetector } from '../hooks/usePitchDetector';
import { useSynth } from '../hooks/useSynth';
import { classifyPianoAttempt, frenchNote, hasPianoNoteReachedHitLine, isPianoSessionCounted, PIANO_CHORDS, PIANO_CORRECT_TOLERANCE_PX, PIANO_PIXELS_PER_BEAT, PIANO_SONGS, PIANO_TECHNIQUE_EXERCISES, PIANO_TIMING_TOLERANCE_PX, pianoChordExerciseForSong, pianoExerciseEndBeat, pianoHandChoicesForMode, pianoKeyboardSizeForNotes, pianoKeyGeometry, pianoLyricCueAtBeat, pianoMeasureBeats, pianoNoteOffsetPx, pianoNotePlaybackTiming, pianoNotesForMode, pianoScore, pianoSessionCounts, resumeTimeline, type PianoChordExercise, type PianoExercise, type PianoPlayMode, type PianoPracticeHand, type PianoSong } from '../pianoData';
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
type NoteFeedback = 'correct' | 'timing' | 'wrong';
const PC_KEYS: Record<string, number> = { a: 60, z: 62, e: 64, r: 65, t: 67, y: 69, u: 71, i: 72 };
const PIANO_PLAYBACK_VOLUME = .1;
const PIANO_MICROPHONE_CONFIDENCE = .5;
const PIANO_LEAD_IN_MS = 3000;
const PIANO_HAND_LABELS: Record<PianoPracticeHand, string> = { right: 'Main droite', left: 'Main gauche', both: 'Deux mains' };
const PIANO_HAND_DETAILS: Record<PianoPracticeHand, string> = { right: 'Mélodie', left: 'Accompagnement', both: 'Coordination' };
const PIANO_SONG_IDS = new Set(PIANO_SONGS.flatMap((song) => song.levels.map((level) => level.id)));
const LEFT_HAND_FINGER_NAMES: Record<number, string> = { 1: 'Pouce', 2: 'Index', 3: 'Majeur', 4: 'Annulaire', 5: 'Auriculaire' };

function formatPianoDuration(seconds: number) {
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60 ? `${minutes % 60} min` : ''}`.trim();
}

function pianoSongHands(song: PianoSong) {
  const hasRight = song.levels.some((level) => level.hand === 'right');
  const hasBoth = song.levels.some((level) => level.hand === 'both');
  if (hasRight && hasBoth) return 'Main droite et deux mains';
  return hasBoth ? 'Deux mains' : 'Main droite';
}

function PianoKeyboard({ size, expected = [], confirmed = [], fingerings = {}, played, error, onPlay }: { size: PianoKeyboardSize; expected?: number[]; confirmed?: number[]; fingerings?: Record<number, number>; played?: number | null; error?: number | null; onPlay: (midi: number) => void }) {
  const keys = pianoKeyGeometry(size);
  return <div className={`piano-keyboard keys-${size}`} aria-label={`Clavier piano ${size} touches`}>
    {keys.map((key) => <button type="button" key={key.midi} className={`${key.black ? 'black-key' : 'white-key'} ${expected.includes(key.midi) ? 'is-expected' : ''} ${confirmed.includes(key.midi) ? 'is-confirmed' : ''} ${played === key.midi ? 'is-played' : ''} ${error === key.midi ? 'is-error' : ''}`} style={{ left: `${key.left}%`, width: `${key.width}%` }} onPointerDown={() => onPlay(key.midi)} aria-label={`${frenchNote(key.midi)}${fingerings[key.midi] ? `, doigt ${fingerings[key.midi]}` : ''}`}><span>{key.midi % 12 === 0 ? frenchNote(key.midi) : ''}</span>{fingerings[key.midi] && <b>{fingerings[key.midi]}</b>}</button>)}
  </div>;
}

export function PianoMode({ keyboardSize, input, onSessionUpdate, view, stats, onNavigate, onSessionActiveChange }: PianoModeProps) {
  const [screen, setScreen] = useState<'home' | 'calibration' | 'prepare' | 'exercise' | 'chords' | 'song-chords'>('home');
  const [exercise, setExercise] = useState<PianoExercise>(PIANO_TECHNIQUE_EXERCISES[0]);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [played, setPlayed] = useState<number | null>(null);
  const [errorKey, setErrorKey] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [missed, setMissed] = useState(0);
  const [timings, setTimings] = useState<number[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [noteFeedback, setNoteFeedback] = useState<Record<number, NoteFeedback>>({});
  const [elapsedBeats, setElapsedBeats] = useState(0);
  const [chordIndex, setChordIndex] = useState(0);
  const [midiStatus, setMidiStatus] = useState<'idle' | 'connected' | 'unavailable'>('idle');
  const [playMode, setPlayMode] = useState<PianoPlayMode>('learning');
  const [tempoPercent, setTempoPercent] = useState(80);
  const [songFilter, setSongFilter] = useState<'all' | 'right' | 'both'>('all');
  const [practiceHand, setPracticeHand] = useState<PianoPracticeHand>('both');
  const [showLyrics, setShowLyrics] = useState(true);
  const [songChordExercise, setSongChordExercise] = useState<PianoChordExercise | null>(null);
  const [songChordIndex, setSongChordIndex] = useState(0);
  const [songChordPlayed, setSongChordPlayed] = useState<number[]>([]);
  const startRef = useRef(0);
  const pauseStartedRef = useRef(0);
  const playedTimerRef = useRef<number | null>(null);
  const judgedRef = useRef(new Set<number>());
  const lineReachedRef = useRef(new Set<number>());
  const autoPlayedRef = useRef(new Set<number>());
  const lastMicroRef = useRef({ midi: -1, at: 0 });
  const { playMidi, prepareAudio, stopAll } = useSynth();
  const detector = usePitchDetector({ profile: 'piano' });
  const beatMs = 60000 / (exercise.bpm * tempoPercent / 100);
  const notes = useMemo(() => pianoNotesForMode(exercise, playMode, practiceHand), [exercise, playMode, practiceHand]);
  const requiredKeyboardSize = pianoKeyboardSizeForNotes(notes);
  const keyboardTooSmall = keyboardSize < requiredKeyboardSize;
  const noteRange = useMemo(() => ({
    lowest: Math.min(...notes.map((note) => note.midi)),
    highest: Math.max(...notes.map((note) => note.midi)),
  }), [notes]);
  const correctToleranceMs = PIANO_CORRECT_TOLERANCE_PX / PIANO_PIXELS_PER_BEAT * beatMs;
  const timingToleranceBeats = PIANO_TIMING_TOLERANCE_PX / PIANO_PIXELS_PER_BEAT;
  const exerciseEndBeat = pianoExerciseEndBeat(notes);
  const measureBeats = useMemo(() => pianoMeasureBeats(exerciseEndBeat, exercise.beatsPerMeasure, exercise.measureStartBeat), [exercise.beatsPerMeasure, exercise.measureStartBeat, exerciseEndBeat]);
  const rollBeat = playMode === 'learning' ? notes[activeIndex]?.beat ?? 0 : elapsedBeats;
  const activeSongChord = songChordExercise?.progression[songChordIndex];
  const lyricBeat = playMode === 'learning' ? notes[activeIndex]?.beat ?? 0 : elapsedBeats;
  const lyricCue = pianoLyricCueAtBeat(showLyrics ? exercise.lyrics ?? [] : [], lyricBeat);

  useEffect(() => {
    onSessionActiveChange(screen === 'exercise');
    return () => onSessionActiveChange(false);
  }, [onSessionActiveChange, result, screen]);

  const finish = useCallback((nextCorrect = correct, nextMissed = missed, nextTimings = timings) => {
    setPlaying(false);
    const score = pianoScore(nextCorrect, nextMissed, nextTimings, correctToleranceMs);
    setResult(score);
    const now = new Date();
    const counts = pianoSessionCounts(score.correct, nextTimings, correctToleranceMs);
    if (isPianoSessionCounted(playMode)) void onSessionUpdate({ id: crypto.randomUUID(), songId: exercise.id, songTitle: exercise.title, mode: playMode === 'learning' ? 'wait' : 'guided', startedAt: new Date(now.getTime() - exerciseEndBeat * beatMs).toISOString(), endedAt: now.toISOString(), activeSeconds: Math.max(1, Math.round(exerciseEndBeat * beatMs / 1000)), ...counts, wrongCount: score.missed, completionPercent: 100, tempoPercent, flagged: false, instrumentType: 'piano' });
  }, [beatMs, correct, correctToleranceMs, exercise, exerciseEndBeat, missed, onSessionUpdate, playMode, tempoPercent, timings]);

  const judge = useCallback((midi: number, audition = true) => {
    setPlayed(midi); if (playedTimerRef.current !== null) window.clearTimeout(playedTimerRef.current); playedTimerRef.current = window.setTimeout(() => setPlayed(null), 220); if (audition) playMidi(midi, .7, .12, 'piano');
    if (!playing || result) return;
    if (playMode === 'learning') {
      const activeBeat = notes[activeIndex].beat;
      const matchedIndex = notes.findIndex((note, index) => note.beat === activeBeat && note.midi === midi && !judgedRef.current.has(index));
      if (matchedIndex < 0) { setNoteFeedback((value) => ({ ...value, [activeIndex]: 'wrong' })); setErrorKey(midi); window.setTimeout(() => setErrorKey(null), 350); return; }
      setNoteFeedback((value) => ({ ...value, [matchedIndex]: 'correct' }));
      judgedRef.current.add(matchedIndex); setCorrect((value) => value + 1); setTimings((values) => [...values, 0]);
      const nextIndex = notes.findIndex((_, index) => !judgedRef.current.has(index));
      if (nextIndex < 0) finish(correct + 1, missed, [...timings, 0]); else setActiveIndex(nextIndex);
      return;
    }
    const elapsed = performance.now() - startRef.current;
    const candidates = notes.map((note, index) => ({ note, index, distance: elapsed - note.beat * beatMs })).filter(({ index }) => !judgedRef.current.has(index));
    const matchingCandidates = candidates.filter(({ note }) => note.midi === midi);
    const closest = (matchingCandidates.length ? matchingCandidates : candidates).reduce<(typeof candidates)[number] | null>((best, candidate) => !best || Math.abs(candidate.distance) < Math.abs(best.distance) ? candidate : best, null);
    if (!closest) return;
    const noteOffsetPx = pianoNoteOffsetPx(closest.note.beat, elapsed / beatMs);
    if (Math.abs(noteOffsetPx) > PIANO_TIMING_TOLERANCE_PX) { setErrorKey(midi); window.setTimeout(() => setErrorKey(null), 350); return; }
    const feedback = classifyPianoAttempt(closest.note.midi, midi, noteOffsetPx);
    judgedRef.current.add(closest.index); setNoteFeedback((value) => ({ ...value, [closest.index]: feedback })); setActiveIndex(Math.min(closest.index + 1, notes.length - 1));
    if (feedback === 'wrong') { setMissed((value) => value + 1); setErrorKey(midi); window.setTimeout(() => setErrorKey(null), 350); return; }
    setCorrect((value) => value + 1); setTimings((values) => [...values, closest.distance]);
  }, [activeIndex, beatMs, correct, finish, missed, notes, playMidi, playMode, playing, result, timings]);

  const judgeSongChord = useCallback((midi: number, audition = true) => {
    setPlayed(midi);
    if (playedTimerRef.current !== null) window.clearTimeout(playedTimerRef.current);
    playedTimerRef.current = window.setTimeout(() => setPlayed(null), 220);
    if (audition) playMidi(midi, .9, .12, 'piano');
    if (!activeSongChord) return;
    if (!activeSongChord.midis.includes(midi)) {
      setErrorKey(midi);
      window.setTimeout(() => setErrorKey(null), 350);
      return;
    }
    setSongChordPlayed((current) => current.includes(midi) ? current : [...current, midi]);
  }, [activeSongChord, playMidi]);

  const handlePianoInput = useCallback((midi: number, audition = true) => {
    if (screen === 'song-chords') judgeSongChord(midi, audition);
    else judge(midi, audition);
  }, [judge, judgeSongChord, screen]);

  useEffect(() => () => { if (playedTimerRef.current !== null) window.clearTimeout(playedTimerRef.current); }, []);

  useEffect(() => {
    if (!playing || playMode !== 'learning' || screen !== 'exercise') return;
    const activeBeat = notes[activeIndex].beat;
    notes.forEach((note, index) => {
      if (note.beat !== activeBeat || autoPlayedRef.current.has(index)) return;
      const timing = pianoNotePlaybackTiming(note, beatMs);
      autoPlayedRef.current.add(index);
      playMidi(note.midi, timing.durationSeconds, PIANO_PLAYBACK_VOLUME, 'piano');
    });
  }, [activeIndex, beatMs, notes, playMidi, playMode, playing, screen]);

  useEffect(() => {
    if (!playing || playMode === 'learning') return;
    const timer = window.setInterval(() => {
      const elapsed = performance.now() - startRef.current;
      setElapsedBeats(elapsed / beatMs);
      let newlyMissed = 0;
      const missedIndices: number[] = [];
      notes.forEach((note, index) => {
        const timing = pianoNotePlaybackTiming(note, beatMs);
        if (!autoPlayedRef.current.has(index) && elapsed >= timing.startMs) { autoPlayedRef.current.add(index); playMidi(note.midi, timing.durationSeconds, PIANO_PLAYBACK_VOLUME, 'piano'); }
        if (!lineReachedRef.current.has(index) && elapsed >= note.beat * beatMs) { lineReachedRef.current.add(index); setNoteFeedback((value) => value[index] ? value : { ...value, [index]: 'wrong' }); }
        if (!judgedRef.current.has(index) && elapsed > (note.beat + timingToleranceBeats) * beatMs) { judgedRef.current.add(index); missedIndices.push(index); newlyMissed += 1; }
      });
      if (missedIndices.length) setNoteFeedback((value) => ({ ...value, ...Object.fromEntries(missedIndices.map((index) => [index, 'wrong'])) }));
      if (newlyMissed) setMissed((value) => value + newlyMissed);
      const end = (exerciseEndBeat + timingToleranceBeats) * beatMs;
      if (elapsed >= end) finish(correct, missed + newlyMissed, timings);
      else setActiveIndex(Math.min(notes.findIndex((note) => (note.beat + timingToleranceBeats) * beatMs >= elapsed) < 0 ? notes.length - 1 : notes.findIndex((note) => (note.beat + timingToleranceBeats) * beatMs >= elapsed), notes.length - 1));
    }, 16);
    return () => window.clearInterval(timer);
  }, [beatMs, correct, exerciseEndBeat, finish, missed, notes, playMidi, playMode, playing, timingToleranceBeats, timings]);

  useEffect(() => {
    if (input !== 'computer-keyboard' || (screen !== 'exercise' && screen !== 'song-chords')) return;
    const listener = (event: globalThis.KeyboardEvent) => { const midi = PC_KEYS[event.key.toLowerCase()]; if (midi !== undefined && !event.repeat) handlePianoInput(midi); };
    window.addEventListener('keydown', listener); return () => window.removeEventListener('keydown', listener);
  }, [handlePianoInput, input, screen]);

  useEffect(() => {
    if (input !== 'microphone' || detector.status !== 'listening' || (screen !== 'exercise' && screen !== 'calibration' && screen !== 'song-chords')) return;
    if (!detector.reading) { lastMicroRef.current.midi = -1; return; }
    const now = performance.now(); const midi = detector.reading.midi;
    if (detector.reading.confidence >= PIANO_MICROPHONE_CONFIDENCE && (midi !== lastMicroRef.current.midi || now - lastMicroRef.current.at > 650)) { lastMicroRef.current = { midi, at: now }; if (screen === 'calibration') setPlayed(midi); else handlePianoInput(midi, false); }
  }, [detector.reading, detector.status, handlePianoInput, input, screen]);

  useEffect(() => {
    if (input !== 'midi') return;
    const nav = navigator as NavigatorWithMidi;
    if (!nav.requestMIDIAccess) { setMidiStatus('unavailable'); return; }
    let active = true;
    nav.requestMIDIAccess().then((access) => { if (!active) return; const connect = () => { let count = 0; for (const device of access.inputs.values()) { count += 1; device.onmidimessage = (event) => { const data = event.data; if (!data) return; const command = data[0]; const midi = data[1]; const velocity = data[2]; if ((command & 0xf0) === 0x90 && velocity > 0) handlePianoInput(midi); }; } setMidiStatus(count ? 'connected' : 'unavailable'); }; connect(); access.onstatechange = connect; }).catch(() => setMidiStatus('unavailable'));
    return () => { active = false; };
  }, [handlePianoInput, input]);

  const start = () => { prepareAudio(); judgedRef.current.clear(); lineReachedRef.current.clear(); autoPlayedRef.current.clear(); setCorrect(0); setMissed(0); setTimings([]); setNoteFeedback({}); setResult(null); setActiveIndex(0); setPaused(false); setElapsedBeats(-PIANO_LEAD_IN_MS / beatMs); startRef.current = performance.now() + PIANO_LEAD_IN_MS; setPlaying(true); };
  const beginExercise = async () => {
    if (input === 'microphone' && !await detector.start()) return;
    setScreen('exercise');
    start();
  };
  const togglePause = () => {
    if (playing) { pauseStartedRef.current = performance.now(); stopAll(); setPlaying(false); setPaused(true); return; }
    if (paused) { startRef.current = resumeTimeline(startRef.current, pauseStartedRef.current, performance.now()); setPaused(false); setPlaying(true); }
  };
  const restart = () => { stopAll(); start(); };
  const expected = screen === 'chords' ? PIANO_CHORDS[chordIndex].midis : screen === 'exercise' ? [notes[activeIndex].midi] : [];
  const keyGeometry = pianoKeyGeometry(keyboardSize);
  const inputMessage = input === 'midi' && midiStatus !== 'connected' ? 'Aucun clavier MIDI détecté : utilise le clavier PC ou le micro.' : input === 'microphone' && detector.status !== 'listening' ? 'Teste et autorise le micro avant de jouer.' : 'Entrée prête.';
  const openExercise = (nextExercise: PianoExercise) => { setExercise(nextExercise); setPracticeHand(nextExercise.hand === 'both' && playMode === 'game' ? 'both' : 'right'); setShowLyrics(Boolean(nextExercise.lyrics?.length)); setScreen('prepare'); window.scrollTo({ top: 0, behavior: 'auto' }); };
  const openSong = (song: PianoSong) => openExercise(song.levels[0]);
  const openSongChordExercise = async (nextExercise: PianoChordExercise) => {
    if (input === 'microphone' && !await detector.start()) return;
    stopAll();
    setSongChordExercise(nextExercise);
    setSongChordIndex(0);
    setSongChordPlayed([]);
    setErrorKey(null);
    setScreen('song-chords');
    window.scrollTo({ top: 0, behavior: 'auto' });
  };
  const selectSongChord = (index: number) => {
    stopAll();
    setSongChordIndex(index);
    setSongChordPlayed([]);
    setErrorKey(null);
  };
  const previewSongChord = () => {
    if (!activeSongChord) return;
    stopAll();
    prepareAudio();
    activeSongChord.midis.forEach((midi) => playMidi(midi, 1.2, .11, 'piano'));
  };
  const selectExerciseLevel = (nextExercise: PianoExercise) => {
    setExercise(nextExercise);
    setPracticeHand(nextExercise.hand === 'both' && playMode === 'game' ? 'both' : 'right');
  };
  const selectPlayMode = (mode: PianoPlayMode) => {
    setPlayMode(mode);
    setPracticeHand(exercise.hand === 'both' && mode === 'game' ? 'both' : 'right');
  };

  if (screen === 'home' && view === 'home') return <main className="page-content piano-page piano-dashboard">
    <header className="piano-hero"><span><Piano /></span><div><small>TON PARCOURS PIANO</small><h1>Reprends là où tu en étais</h1><p>Une suggestion courte, puis quelques minutes de pratique ciblée.</p></div><button type="button" onClick={() => openExercise(PIANO_TECHNIQUE_EXERCISES[0])}><Play /> Suggestion du jour</button></header>
    <section className="piano-dashboard-grid"><article className="daily-piano-card"><small>AUJOURD’HUI · MODÉRÉ</small><h2>Promenade du matin</h2><p>Travaille la régularité et les déplacements de la main droite.</p><button type="button" onClick={() => openExercise(PIANO_TECHNIQUE_EXERCISES[0])}>Commencer <ChevronRight /></button></article><article className="piano-recommendation"><Target /><div><small>CONSEIL PERSONNALISÉ</small><strong>{stats?.hasData ? 'Consolide les notes encore hésitantes' : 'Commence par les positions de la main droite'}</strong><p>{stats?.hasData ? 'Ralentis à 80 % et rejoue les passages marqués en rouge.' : 'Repère d’abord Do, Ré, Mi, Fa, Sol et La.'}</p></div></article></section>
    <section className="piano-stat-grid"><article><Clock3 /><strong>{Math.round((stats?.overview.weekSeconds ?? 0) / 60)} min</strong><span>cette semaine</span></article><article><Target /><strong>{stats?.overview.pitchAccuracy ?? '—'}{stats?.overview.pitchAccuracy !== null && stats?.overview.pitchAccuracy !== undefined ? ' %' : ''}</strong><span>notes justes</span></article><article><Repeat2 /><strong>{stats?.overview.timingAccuracy ?? '—'}{stats?.overview.timingAccuracy !== null && stats?.overview.timingAccuracy !== undefined ? ' %' : ''}</strong><span>précision rythmique</span></article></section>
    <section className="suggested-chords"><header><div><small>ACCORDS VISUELS</small><h2>Aujourd’hui : Do majeur et Sol majeur</h2></div><button type="button" onClick={() => setScreen('chords')}>Voir les accords <ChevronRight /></button></header><PianoKeyboard size={keyboardSize} expected={PIANO_CHORDS[0].midis} onPlay={judge} /></section>
    <section className="piano-worked"><header><h2>Morceaux les plus travaillés</h2><button type="button" onClick={() => onNavigate('piano-songs')}>Tous les morceaux</button></header>{stats?.favoriteSongs.some((song) => PIANO_SONG_IDS.has(song.songId)) ? stats.favoriteSongs.filter((song) => PIANO_SONG_IDS.has(song.songId)).slice(0, 3).map((song) => <article key={song.songId}><strong>{song.title}</strong><span>{song.sessions} séance{song.sessions > 1 ? 's' : ''}</span><em>{Math.round(song.activeSeconds / 60)} min</em></article>) : <p>Les morceaux que tu pratiques apparaîtront ici.</p>}</section>
  </main>;

  if (screen === 'home' && view === 'songs') return <main className="page-content piano-page">
    <header className="page-heading"><span className="eyebrow">Plaisir de jouer</span><h1>Morceaux</h1><p>Choisis d’abord un morceau. Tu sélectionneras ensuite son niveau et ton mode de jeu.</p></header>
    <div className="piano-song-filters" role="group" aria-label="Filtrer les morceaux"><button type="button" className={songFilter === 'all' ? 'is-active' : ''} onClick={() => setSongFilter('all')}>Tous les morceaux</button><button type="button" className={songFilter === 'right' ? 'is-active' : ''} onClick={() => setSongFilter('right')}>Main droite</button><button type="button" className={songFilter === 'both' ? 'is-active' : ''} onClick={() => setSongFilter('both')}>Deux mains</button></div>
    <section className="piano-exercise-grid piano-song-list">{PIANO_SONGS.filter((song) => songFilter === 'all' || song.levels.some((level) => level.hand === songFilter)).map((song) => <button type="button" key={`${song.title}-${song.artist ?? ''}`} onClick={() => openSong(song)}><small>{song.artist ?? 'Exercice original'}</small><strong>{song.title}</strong><span>{song.levels.length} niveau{song.levels.length > 1 ? 'x' : ''} · {pianoSongHands(song)}</span><em>{[...new Set(song.levels.map((level) => level.level))].join(' · ')}</em><ChevronRight /></button>)}</section>
  </main>;

  if (screen === 'home' && view === 'exercises') return <main className="page-content piano-page"><header className="page-heading"><span className="eyebrow">Technique</span><h1>Exercices</h1><p>Travaille une difficulté à la fois, sans portée musicale.</p></header><section className="piano-technique-grid">{PIANO_TECHNIQUE_EXERCISES.map((item, index) => <button type="button" key={item.id} onClick={() => openExercise(item)}><span>{index + 1}</span><strong>{item.title}</strong><p>{item.arrangement}</p><ChevronRight /></button>)}</section></main>;

  if (screen === 'prepare') {
    const song = PIANO_SONGS.find((item) => item.title === exercise.title && item.artist === exercise.artist);
    const chordExercise = pianoChordExerciseForSong(exercise.title, exercise.artist);
    const levels = song?.levels ?? [exercise];
    const levelStats = (stats?.songStats ?? []).find((item) => item.songId === exercise.id);
    const allLevelStats = (stats?.songStats ?? []).filter((item) => levels.some((level) => level.id === item.songId));
    const totalSessions = allLevelStats.reduce((sum, item) => sum + item.sessions, 0);
    const totalSeconds = allLevelStats.reduce((sum, item) => sum + item.activeSeconds, 0);
    const lastPracticedAt = allLevelStats.map((item) => item.lastPracticedAt).sort().at(-1);
    const handChoices = pianoHandChoicesForMode(exercise, playMode);
    return <main className="page-content piano-page piano-preparation">
      <button className="piano-back" type="button" onClick={() => setScreen('home')}><ChevronLeft /> Retour</button>
      <section role="dialog" aria-labelledby="piano-song-title">
        <header><span><Piano /></span><div><small>{exercise.artist ?? 'Exercice original'} · {levels.length} niveau{levels.length > 1 ? 'x' : ''}</small><h1 id="piano-song-title">{exercise.title}</h1><p>Choisis ton niveau, puis la façon dont tu veux le travailler.</p></div></header>
        <fieldset className="preparation-level-choice"><legend>Niveau du morceau</legend><div>{levels.map((level) => <button type="button" key={level.id} className={exercise.id === level.id ? 'is-selected' : ''} aria-pressed={exercise.id === level.id} onClick={() => selectExerciseLevel(level)}><small>{level.level}</small><strong>{level.arrangement?.replace(/^Niveau \d+ · /, '') ?? level.title}</strong><span>{level.notes.length} notes · {level.bpm} BPM · {level.hand === 'both' ? 'Deux mains' : 'Main droite'}</span>{exercise.id === level.id && <Check />}</button>)}</div></fieldset>
        <section className="preparation-statistics" aria-label="Statistiques du morceau">
          <header><div><BarChart3 /><span><small>TES STATISTIQUES</small><strong>{exercise.level}</strong></span></div><em>Les entraînements ne sont pas comptabilisés.</em></header>
          <div><article><strong>{totalSessions}</strong><span>séance{totalSessions > 1 ? 's' : ''} sur ce morceau</span></article><article><strong>{formatPianoDuration(totalSeconds)}</strong><span>temps pratiqué</span></article><article><strong>{levelStats?.bestScore === null || levelStats?.bestScore === undefined ? '—' : `${levelStats.bestScore} / 100`}</strong><span>meilleur score à ce niveau</span></article><article><strong>{levelStats?.accuracy === null || levelStats?.accuracy === undefined ? '—' : `${levelStats.accuracy} %`}</strong><span>notes justes à ce niveau</span></article></div>
          <p>{lastPracticedAt ? `Dernière séance le ${new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(lastPracticedAt))}.` : 'Aucune séance comptabilisée pour le moment.'}</p>
        </section>
        {chordExercise && <aside className="preparation-chord-callout"><span><Hand /></span><div><small>MAIN GAUCHE · DOIGTÉS</small><strong>Les accords de {exercise.title}</strong><p>{new Set(chordExercise.progression.map((step) => step.name)).size} positions à apprendre, dans l’ordre complet du morceau.</p></div><button type="button" onClick={() => void openSongChordExercise(chordExercise)}>Travailler les accords <ChevronRight /></button></aside>}
        <div className="preparation-modes"><button type="button" className={playMode === 'learning' ? 'is-selected' : ''} onClick={() => selectPlayMode('learning')}><Target /><span><strong>Apprentissage</strong><small>Le défilement attend chaque bonne note.</small></span>{playMode === 'learning' && <Check />}</button><button type="button" className={playMode === 'practice' ? 'is-selected' : ''} onClick={() => selectPlayMode('practice')}><Repeat2 /><span><strong>Entraînement</strong><small>Tempo réel, une seule main, sans score.</small></span>{playMode === 'practice' && <Check />}</button><button type="button" className={playMode === 'game' ? 'is-selected' : ''} onClick={() => selectPlayMode('game')}><Play /><span><strong>Jeu</strong><small>Tempo continu et score comptabilisé.</small></span>{playMode === 'game' && <Check />}</button></div>
        {handChoices.length > 1 && <fieldset className="preparation-hand-choice"><legend>{playMode === 'practice' ? 'Main à entraîner' : 'Main à apprendre'}</legend><div>{handChoices.map((hand) => <button type="button" key={hand} className={practiceHand === hand ? 'is-selected' : ''} aria-pressed={practiceHand === hand} onClick={() => setPracticeHand(hand)}><span><strong>{PIANO_HAND_LABELS[hand]}</strong><small>{PIANO_HAND_DETAILS[hand]}</small></span>{practiceHand === hand && <Check />}</button>)}</div></fieldset>}
        {playMode === 'practice' && handChoices.length === 1 && <p className="preparation-practice-note"><Repeat2 /> Ce niveau se travaille en temps réel avec la main droite uniquement. La séance ne modifiera pas tes statistiques.</p>}
        {keyboardTooSmall && <p className="preparation-keyboard-warning"><AlertTriangle /><span><strong>{requiredKeyboardSize} touches nécessaires</strong>Les notes vont de {frenchNote(noteRange.lowest)} à {frenchNote(noteRange.highest)} pour cette sélection. Ton piano est configuré sur {keyboardSize} touches : modifie-le dans Mon profil, ou choisis une autre main ou un autre niveau.</span></p>}
        {exercise.lyrics?.length && <label className={`preparation-lyrics-toggle ${showLyrics ? 'is-checked' : ''}`}><input type="checkbox" checked={showLyrics} onChange={(event) => setShowLyrics(event.target.checked)} /><span className="preparation-lyrics-icon"><Captions /></span><span><strong>Paroles synchronisées</strong><small>Afficher la phrase actuelle et la suivante pendant le morceau.</small></span><i aria-hidden="true"><span /></i></label>}
        <label className="preparation-tempo"><span>Vitesse du morceau</span><strong>{tempoPercent} % · {Math.round(exercise.bpm * tempoPercent / 100)} BPM</strong><input type="range" min="50" max="100" step="10" value={tempoPercent} onChange={(event) => setTempoPercent(Number(event.target.value))} /></label>
        {input === 'microphone' && (detector.status === 'denied' || detector.status === 'error') && <div className="account-message is-error"><AlertTriangle /><span>{detector.error}</span></div>}
        <button type="button" className="primary-button preparation-start" disabled={detector.status === 'requesting' || keyboardTooSmall} onClick={() => void beginExercise()}>{detector.status === 'requesting' ? <><Mic2 /> Autorisation du microphone…</> : keyboardTooSmall ? <><AlertTriangle /> {requiredKeyboardSize} touches nécessaires</> : <><Play /> {playMode === 'learning' ? 'Lancer l’apprentissage' : playMode === 'practice' ? 'Lancer l’entraînement' : 'Lancer le morceau'}</>}</button>
      </section>
    </main>;
  }

  if (screen === 'calibration') return <main className="page-content piano-page"><button className="piano-back" type="button" onClick={() => { detector.stop(); setScreen('home'); }}><ChevronLeft /> Retour</button><section className="piano-calibration"><Mic2 /><small>TEST DE L’ENTRÉE</small><h1>Joue quelques notes</h1><p>{inputMessage}</p><strong>{input === 'microphone' ? detector.reading ? frenchNote(detector.reading.midi) : 'En attente…' : played !== null ? frenchNote(played) : 'En attente…'}</strong>{input === 'microphone' && detector.status !== 'listening' && <button type="button" className="primary-button" onClick={() => void detector.start()}><Mic2 /> Démarrer le micro</button>}<PianoKeyboard size={keyboardSize} played={played} onPlay={judge} /><p className="piano-limit">Le micro V1 reconnaît une seule note à la fois. Si le résultat oscille, choisis MIDI ou clavier PC.</p></section></main>;

  if (screen === 'song-chords' && songChordExercise && activeSongChord) {
    const fingerings = Object.fromEntries(activeSongChord.midis.map((midi, index) => [midi, activeSongChord.fingers[index]]));
    const complete = activeSongChord.midis.every((midi) => songChordPlayed.includes(midi));
    const lastChord = songChordIndex === songChordExercise.progression.length - 1;
    return <main className="page-content piano-page song-chord-page">
      <button className="piano-back" type="button" onClick={() => { detector.stop(); stopAll(); setScreen('prepare'); }}><ChevronLeft /> Retour au morceau</button>
      <section className="song-chord-exercise">
        <header><span><Hand /></span><div><small>EXERCICE · ACCORDS MAIN GAUCHE</small><h1>{songChordExercise.songTitle}</h1><p>Apprends les positions et les changements d’accords utilisés dans le morceau.</p></div></header>
        <div className="song-chord-overview"><strong>{new Set(songChordExercise.progression.map((step) => step.name)).size} positions</strong><span>{songChordExercise.progression.length} changements dans la progression complète</span></div>
        <div className="song-chord-sequence" role="group" aria-label="Progression des accords">{songChordExercise.progression.map((step, index) => <button type="button" key={`${step.beat}-${step.name}`} className={`${index === songChordIndex ? 'is-active' : ''} ${index < songChordIndex ? 'is-passed' : ''}`} aria-pressed={index === songChordIndex} aria-label={`Accord ${index + 1}, ${step.name}`} onClick={() => selectSongChord(index)}><span>{index + 1}</span><strong>{step.name}</strong></button>)}</div>
        <article className={`song-chord-position ${complete ? 'is-complete' : ''}`}>
          <header><div><small>ACCORD {songChordIndex + 1} SUR {songChordExercise.progression.length}</small><h2>{activeSongChord.name}</h2><p>Place les doigts indiqués, puis joue toutes les touches colorées.</p></div><button type="button" onClick={previewSongChord}><Volume2 /> Écouter</button></header>
          <div className="song-chord-fingers">{activeSongChord.midis.map((midi, index) => <div key={midi} className={songChordPlayed.includes(midi) ? 'is-confirmed' : ''}><b>{activeSongChord.fingers[index]}</b><span><strong>{frenchNote(midi)}</strong><small>{LEFT_HAND_FINGER_NAMES[activeSongChord.fingers[index]]}</small></span>{songChordPlayed.includes(midi) && <Check />}</div>)}</div>
          <PianoKeyboard size={keyboardSize} expected={activeSongChord.midis} confirmed={songChordPlayed} fingerings={fingerings} played={played} error={errorKey} onPlay={judgeSongChord} />
          <div className={`song-chord-feedback ${complete ? 'is-complete' : ''}`}>{complete ? <><Check /><span><strong>Accord reconnu</strong>La position est correcte. Tu peux passer au changement suivant.</span></> : <><Target /><span><strong>{songChordPlayed.length} / {activeSongChord.midis.length} notes trouvées</strong>{input === 'microphone' ? 'Avec le micro, joue les notes l’une après l’autre.' : 'Tu peux jouer les notes ensemble ou l’une après l’autre.'}</span></>}</div>
        </article>
        <footer><button type="button" className="secondary-button" disabled={songChordIndex === 0} onClick={() => selectSongChord(songChordIndex - 1)}><ChevronLeft /> Accord précédent</button><button type="button" className="primary-button" onClick={() => { if (lastChord) { detector.stop(); stopAll(); setScreen('prepare'); } else selectSongChord(songChordIndex + 1); }}>{lastChord ? 'Terminer l’exercice' : 'Accord suivant'} {!lastChord && <ChevronRight />}</button></footer>
      </section>
    </main>;
  }

  if (screen === 'chords') return <main className="page-content piano-page"><button className="piano-back" type="button" onClick={() => setScreen('home')}><ChevronLeft /> Retour</button><section className="chord-trainer"><small>ACCORDS · GUIDE VISUEL</small><h1>{PIANO_CHORDS[chordIndex].name}</h1><p>Joue ensemble les touches colorées, puis passe manuellement à l’accord suivant.</p><PianoKeyboard size={keyboardSize} expected={expected} onPlay={judge} /><footer><button type="button" disabled={chordIndex === 0} onClick={() => setChordIndex(chordIndex - 1)}><ChevronLeft /> Précédent</button><span>{chordIndex + 1} / {PIANO_CHORDS.length}</span><button type="button" disabled={chordIndex === PIANO_CHORDS.length - 1} onClick={() => setChordIndex(chordIndex + 1)}>Suivant <ChevronRight /></button></footer></section></main>;

  return <main className="piano-player">
    <header><button type="button" className="piano-player-close" aria-label="Quitter le morceau" title="Quitter" onClick={() => { detector.stop(); stopAll(); setPlaying(false); setScreen('home'); }}><X /></button><div className="piano-player-title"><small>{exercise.artist ? `${exercise.artist} · ` : ''}{exercise.level}{exercise.hand === 'both' && playMode !== 'game' ? ` · ${PIANO_HAND_LABELS[practiceHand]}` : playMode === 'practice' ? ' · Main droite' : ''}</small><strong>{exercise.title}</strong></div><div className="piano-player-controls">{!result && <><button type="button" className="piano-player-pause" onClick={togglePause}>{playing ? <><Pause /> Pause</> : <><Play /> Reprendre</>}</button><button type="button" className="piano-player-restart" onClick={restart}><RotateCcw /> Recommencer</button>{exercise.lyrics?.length && <button type="button" className={`piano-player-lyrics-toggle ${showLyrics ? 'is-active' : ''}`} aria-pressed={showLyrics} onClick={() => setShowLyrics((value) => !value)}><Captions /> Paroles</button>}</>}<span>{playMode === 'practice' ? 'Entraînement · non comptabilisé · ' : ''}{correct} juste{correct > 1 ? 's' : ''} · {missed} ratée{missed > 1 ? 's' : ''}</span><progress value={activeIndex + 1} max={notes.length} /></div></header>
    {result ? <section className={`piano-results ${playMode === 'practice' ? 'is-practice' : ''}`}><Check /><h1>{playMode === 'practice' ? 'Entraînement terminé' : 'Exercice terminé'}</h1><div><article><strong>{result.correct}</strong><span>correctes</span></article><article><strong>{result.missed}</strong><span>ratées</span></article><article><strong>{result.averageDelay} ms</strong><span>retard moyen</span></article><article><strong>{result.rhythmAccuracy} %</strong><span>précision rythme</span></article></div>{playMode === 'practice' ? <p>Cette séance d’entraînement n’a pas modifié ton meilleur score ni tes statistiques.</p> : <><b>{result.global} / 100</b><p>{result.advice}</p></>}<button type="button" className="primary-button" onClick={start}><RotateCcw /> Recommencer</button></section> : <>
      <section className="piano-roll"><div className="piano-roll-lanes">{keyGeometry.filter((key) => !key.black).map((key) => <span key={key.midi} style={{ left: `${key.left}%`, width: `${key.width}%` }} />)}</div><div className="piano-measure-lines" aria-hidden="true">{measureBeats.map((beat) => <span key={beat} style={{ '--measure-offset': `${pianoNoteOffsetPx(beat, rollBeat)}px` } as React.CSSProperties} />)}</div>{(lyricCue.current || lyricCue.next) && <div className="piano-player-lyrics" role="status" aria-live="polite" aria-atomic="true"><small>{(lyricCue.current ?? lyricCue.next)?.section} · PAROLES</small><strong>{lyricCue.current?.text ?? 'Prépare-toi…'}</strong>{lyricCue.next && <span><b>Ensuite</b> {lyricCue.next.text}</span>}</div>}<div className="hit-line" />{notes.map((note, index) => { const learning = playMode === 'learning'; const offset = pianoNoteOffsetPx(note.beat, rollBeat); const key = keyGeometry.find((item) => item.midi === note.midi); const visibleFeedback = hasPianoNoteReachedHitLine(offset) ? noteFeedback[index] : undefined; if (!key) return null; const noteName = frenchNote(note.midi); return <i key={index} className={visibleFeedback ? `is-${visibleFeedback}` : ''} aria-label={learning ? `${noteName}, doigt ${note.finger ?? '?'}` : noteName} style={{ '--duration': note.duration, '--note-left': `${key.left}%`, '--note-width': `${key.width}%`, '--note-offset': `${offset}px` } as React.CSSProperties}><span>{learning ? <><b>{note.finger}</b><small>{noteName.replace(/\d$/, '')}</small></> : noteName.replace(/\d$/, '')}</span></i>; })}</section>
      <PianoKeyboard size={keyboardSize} played={played} error={errorKey} onPlay={judge} />
    </>}
  </main>;
}
