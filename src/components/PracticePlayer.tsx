import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AudioLines, ChevronDown, CircleGauge, Expand, Flag, Gauge,
  Hand, Keyboard, Minimize, Music2, Pause, Play, Redo2, Repeat2, Settings2, SlidersHorizontal, TimerReset, Volume2, X,
} from 'lucide-react';
import { AccordionView } from './AccordionView';
import { ScoreStrip } from './ScoreStrip';
import { usePitchDetector } from '../hooks/usePitchDetector';
import { useSynth } from '../hooks/useSynth';
import type {
  AccordionConfig, Hand as HandFocus, Notation, PracticeSessionInput, PracticeSettings,
  PrimaryPracticeMode, Song, SupplementalPracticeMode,
} from '../types';
import { HAND_FOCUS_OPTIONS, PRACTICE_MODES, PRIMARY_PRACTICE_MODES, SUPPLEMENTAL_PRACTICE_MODES } from '../practiceModes';
import { getCountInSequence, getPlaybackStartIndex, getWaitAdvance } from '../practiceProgress';
import { midiMatches } from '../audioTraining';
import { createPracticeTimeline } from '../practiceTimeline';

interface PracticePlayerProps {
  song: Song;
  accordion: AccordionConfig;
  onClose: () => void;
  notation: Notation;
  countIn: boolean;
  onNotationChange: (notation: Notation) => void;
  onSessionUpdate: (session: PracticeSessionInput) => Promise<void>;
}

function accompanimentIndexAt(song: Song, beat: number) {
  let index = 0;
  for (let current = 0; current < (song.accompaniment?.length ?? 0); current += 1) {
    if (song.accompaniment![current].beat > beat) break;
    index = current;
  }
  return index;
}

export function PracticePlayer({ song, accordion, onClose, notation, countIn, onNotationChange, onSessionUpdate }: PracticePlayerProps) {
  const [settings, setSettings] = useState<PracticeSettings>({
    mode: 'guided', hand: 'right', tempo: 80, countIn, metronome: false, loop: false,
    loopStart: 0, loopEnd: song.events.length - 1, notation,
  });
  const [playing, setPlaying] = useState(false);
  const [countInBeat, setCountInBeat] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeAccompanimentIndex, setActiveAccompanimentIndex] = useState(0);
  const [modeOpen, setModeOpen] = useState(false);
  const [showScore, setShowScore] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [tempoOpen, setTempoOpen] = useState(false);
  const [flagged, setFlagged] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const [sessionFinished, setSessionFinished] = useState(false);
  const [shortcutsVisible, setShortcutsVisible] = useState(false);
  const [results, setResults] = useState({ correct: 0, early: 0, late: 0, wrong: 0 });
  const [feedback, setFeedback] = useState<{ kind: 'good' | 'hint' | 'neutral'; title: string; detail: string }>({
    kind: 'neutral', title: 'Prêt quand tu l’es', detail: 'Regarde la direction du soufflet, puis appuie sur Lecture.',
  });
  const startedAtRef = useRef(0);
  const startBeatRef = useRef(0);
  const rafRef = useRef(0);
  const lastPlayedRef = useRef(-1);
  const lastCorrectIndexRef = useRef(-1);
  const lastAccompanimentIndexRef = useRef(-1);
  const lastAccompanimentPlayedRef = useRef(-1);
  const waitForReleaseRef = useRef<number | null>(null);
  const ignoreMicrophoneUntilRef = useRef(0);
  const waitAdvanceTimerRef = useRef(0);
  const waitReleaseTimerRef = useRef(0);
  const countInTimersRef = useRef<number[]>([]);
  const assessedRef = useRef(new Set<number>());
  const wrongRef = useRef(new Set<number>());
  const resultsRef = useRef(results);
  const settingsRef = useRef(settings);
  const maxIndexRef = useRef(0);
  const flaggedRef = useRef(false);
  const sessionIdRef = useRef(crypto.randomUUID());
  const sessionStartedAtRef = useRef<string | null>(null);
  const activeSegmentStartedAtRef = useRef<number | null>(null);
  const accumulatedActiveMsRef = useRef(0);
  const sessionCompletedRef = useRef(false);
  const { playMidi, playLeftHand, click } = useSynth();
  const { reading: detectedReading, status: detectorStatus, start: startDetector, stop: stopDetector } = usePitchDetector();
  const practiceEvents = useMemo(() => createPracticeTimeline(song, settings.hand), [settings.hand, song]);
  const scoreSong = useMemo(() => settings.hand === 'left' ? { ...song, events: practiceEvents, accompaniment: undefined } : song, [practiceEvents, settings.hand, song]);
  const currentEvent = practiceEvents[activeIndex];
  const currentAccompaniment = song.accompaniment?.[activeAccompanimentIndex];
  const displayedEvent = useMemo(() => settings.hand === 'both' && currentEvent && currentAccompaniment ? {
    ...currentEvent,
    bassButtonId: currentAccompaniment.buttonId,
    bassLabel: currentAccompaniment.chord,
  } : currentEvent, [currentAccompaniment, currentEvent, settings.hand]);
  const actualBpm = song.bpm * settings.tempo / 100;
  const beatMs = 60000 / actualBpm;
  const countInSequence = useMemo(() => getCountInSequence(song.timeSignature[0]), [song.timeSignature]);
  const practiceWithMic = settings.mode !== 'demo';

  useEffect(() => { window.scrollTo({ top: 0 }); }, []);

  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { maxIndexRef.current = Math.max(maxIndexRef.current, activeIndex); }, [activeIndex]);
  useEffect(() => { flaggedRef.current = flagged; }, [flagged]);

  const resetSessionTracking = useCallback(() => {
    sessionIdRef.current = crypto.randomUUID();
    sessionStartedAtRef.current = null;
    activeSegmentStartedAtRef.current = null;
    accumulatedActiveMsRef.current = 0;
    sessionCompletedRef.current = false;
    setSessionFinished(false);
    maxIndexRef.current = 0;
    resultsRef.current = { correct: 0, early: 0, late: 0, wrong: 0 };
  }, []);

  const finishActiveSegment = useCallback(() => {
    if (activeSegmentStartedAtRef.current === null) return;
    accumulatedActiveMsRef.current += performance.now() - activeSegmentStartedAtRef.current;
    activeSegmentStartedAtRef.current = null;
  }, []);

  const activeMilliseconds = useCallback(() => accumulatedActiveMsRef.current + (
    activeSegmentStartedAtRef.current === null ? 0 : performance.now() - activeSegmentStartedAtRef.current
  ), []);

  const persistSession = useCallback((completed = false) => {
    const startedAt = sessionStartedAtRef.current;
    if (!startedAt) return Promise.resolve();
    const activeSeconds = Math.floor(activeMilliseconds() / 1000);
    if (activeSeconds < 1) return Promise.resolve();
    const latestResults = resultsRef.current;
    return onSessionUpdate({
      id: sessionIdRef.current,
      songId: song.id,
      songTitle: song.title,
      mode: settingsRef.current.mode,
      hand: settingsRef.current.hand,
      startedAt,
      endedAt: new Date().toISOString(),
      activeSeconds,
      correctCount: latestResults.correct,
      earlyCount: latestResults.early,
      lateCount: latestResults.late,
      wrongCount: latestResults.wrong,
      completionPercent: completed ? 100 : Math.min(100, Math.round((maxIndexRef.current + 1) / Math.max(1, practiceEvents.length) * 100)),
      tempoPercent: settingsRef.current.tempo,
      flagged: flaggedRef.current,
    });
  }, [activeMilliseconds, onSessionUpdate, practiceEvents.length, song.id, song.title]);

  const resetResults = useCallback(() => {
    const empty = { correct: 0, early: 0, late: 0, wrong: 0 };
    resultsRef.current = empty;
    setResults(empty);
  }, []);

  const incrementResult = useCallback((kind: keyof typeof results) => {
    const value = resultsRef.current;
    const next = { ...value, [kind]: value[kind] + 1 };
    resultsRef.current = next;
    setResults(next);
  }, []);

  useEffect(() => () => {
    window.clearTimeout(waitAdvanceTimerRef.current);
    window.clearTimeout(waitReleaseTimerRef.current);
    countInTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    finishActiveSegment();
    void persistSession(sessionCompletedRef.current);
  }, [finishActiveSegment, persistSession]);

  useEffect(() => {
    if (!playing) return;
    const interval = window.setInterval(() => { void persistSession(false); }, 30_000);
    return () => window.clearInterval(interval);
  }, [persistSession, playing]);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) await document.exitFullscreen?.();
    else await document.documentElement.requestFullscreen?.();
  }, []);

  const clearCountIn = useCallback(() => {
    countInTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    countInTimersRef.current = [];
    setCountInBeat(null);
  }, []);

  const selectIndex = useCallback((index: number) => {
    clearCountIn();
    finishActiveSegment();
    void persistSession(false);
    resetSessionTracking();
    setActiveIndex(index);
    setActiveAccompanimentIndex(accompanimentIndexAt(song, practiceEvents[index]?.beat ?? 0));
    lastPlayedRef.current = -1;
    lastCorrectIndexRef.current = -1;
    lastAccompanimentIndexRef.current = -1;
    lastAccompanimentPlayedRef.current = -1;
    waitForReleaseRef.current = null;
    ignoreMicrophoneUntilRef.current = 0;
    assessedRef.current.clear();
    wrongRef.current.clear();
    resetResults();
    setPlaying(false);
  }, [clearCountIn, finishActiveSegment, persistSession, practiceEvents, resetResults, resetSessionTracking, song]);

  const stop = useCallback(() => {
    clearCountIn();
    finishActiveSegment();
    void persistSession(false);
    setPlaying(false);
    cancelAnimationFrame(rafRef.current);
    window.clearTimeout(waitAdvanceTimerRef.current);
  }, [clearCountIn, finishActiveSegment, persistSession]);

  const restart = useCallback(() => {
    stop();
    resetSessionTracking();
    const nextIndex = settings.loop ? settings.loopStart : 0;
    setActiveIndex(nextIndex);
    setActiveAccompanimentIndex(accompanimentIndexAt(song, practiceEvents[nextIndex]?.beat ?? 0));
    lastPlayedRef.current = -1;
    lastCorrectIndexRef.current = -1;
    lastAccompanimentIndexRef.current = -1;
    lastAccompanimentPlayedRef.current = -1;
    waitForReleaseRef.current = null;
    ignoreMicrophoneUntilRef.current = 0;
    assessedRef.current.clear();
    wrongRef.current.clear();
    resetResults();
    setFeedback({ kind: 'neutral', title: 'On reprend calmement', detail: 'Inspire, prépare le doigt et regarde la direction.' });
  }, [practiceEvents, resetResults, resetSessionTracking, settings.loop, settings.loopStart, song, stop]);

  const changeHand = useCallback((hand: HandFocus) => {
    const nextEvents = createPracticeTimeline(song, hand);
    if (!nextEvents.length) return;
    stop();
    resetSessionTracking();
    resetResults();
    setModeOpen(false);
    setSettings((value) => ({ ...value, hand, loopStart: 0, loopEnd: nextEvents.length - 1 }));
    setActiveIndex(0);
    setActiveAccompanimentIndex(accompanimentIndexAt(song, nextEvents[0]?.beat ?? 0));
    lastPlayedRef.current = -1;
    lastCorrectIndexRef.current = -1;
    lastAccompanimentIndexRef.current = -1;
    lastAccompanimentPlayedRef.current = -1;
    waitForReleaseRef.current = null;
    ignoreMicrophoneUntilRef.current = 0;
    assessedRef.current.clear();
    wrongRef.current.clear();
    setFeedback({
      kind: 'neutral',
      title: hand === 'right' ? 'Mélodie seule' : hand === 'left' ? 'Basses et accords seuls' : 'Les deux mains ensemble',
      detail: hand === 'both'
        ? 'Le microphone évalue la mélodie pendant que la main gauche reste guidée visuellement.'
        : hand === 'left'
          ? 'Les basses et les accords suivent maintenant leur propre frise.'
          : 'Concentre-toi sur les boutons de la main droite.',
    });
  }, [resetResults, resetSessionTracking, song, stop]);

  const selectMode = useCallback((mode: PrimaryPracticeMode | SupplementalPracticeMode) => {
    stop();
    resetSessionTracking();
    resetResults();
    setModeOpen(false);
    setSettings((value) => ({ ...value, mode }));
    lastCorrectIndexRef.current = -1;
    waitForReleaseRef.current = null;
    ignoreMicrophoneUntilRef.current = 0;
    if (mode === 'wait') {
      setFeedback({ kind: 'neutral', title: 'La lecture t’attend', detail: 'Appuie sur Commencer, puis joue le geste éclairé. Chaque réussite affiche immédiatement le suivant.' });
    }
  }, [resetResults, resetSessionTracking, stop]);

  const startPlayback = useCallback((startIndex = activeIndex) => {
    clearCountIn();
    setActiveIndex(startIndex);
    setActiveAccompanimentIndex(accompanimentIndexAt(song, practiceEvents[startIndex]?.beat ?? 0));
    if (!sessionStartedAtRef.current) sessionStartedAtRef.current = new Date().toISOString();
    activeSegmentStartedAtRef.current = performance.now();
    startedAtRef.current = performance.now();
    startBeatRef.current = practiceEvents[startIndex]?.beat ?? 0;
    lastPlayedRef.current = -1;
    lastCorrectIndexRef.current = -1;
    lastAccompanimentIndexRef.current = -1;
    lastAccompanimentPlayedRef.current = -1;
    waitForReleaseRef.current = null;
    ignoreMicrophoneUntilRef.current = 0;
    setPlaying(true);
  }, [activeIndex, clearCountIn, practiceEvents, song]);

  const begin = useCallback(() => {
    if (playing || countInBeat !== null) { stop(); return; }
    const startIndex = getPlaybackStartIndex(activeIndex, sessionCompletedRef.current, settings.loop, settings.loopStart);
    if (sessionCompletedRef.current) {
      resetSessionTracking();
      resetResults();
      setActiveIndex(startIndex);
      setActiveAccompanimentIndex(accompanimentIndexAt(song, practiceEvents[startIndex]?.beat ?? 0));
      setFeedback({ kind: 'neutral', title: 'Nouveau départ', detail: 'Le morceau repart du début avec les mêmes réglages.' });
    }
    if (!settings.countIn || sessionStartedAtRef.current) {
      startPlayback(startIndex);
      return;
    }
    setCountInBeat(countInSequence[0]);
    if (soundEnabled) click(true);
    countInSequence.slice(1).forEach((remaining, index) => {
      countInTimersRef.current.push(window.setTimeout(() => {
        setCountInBeat(remaining);
        if (soundEnabled) click(false);
      }, (index + 1) * beatMs));
    });
    countInTimersRef.current.push(window.setTimeout(() => startPlayback(startIndex), countInSequence.length * beatMs));
  }, [activeIndex, beatMs, click, countInBeat, countInSequence, playing, practiceEvents, resetResults, resetSessionTracking, settings.countIn, settings.loop, settings.loopStart, song, soundEnabled, startPlayback, stop]);

  useEffect(() => {
    if (!practiceWithMic && detectorStatus !== 'idle') stopDetector();
  }, [detectorStatus, practiceWithMic, stopDetector]);

  useEffect(() => {
    if (playing && practiceWithMic && detectorStatus === 'idle') void startDetector();
  }, [detectorStatus, playing, practiceWithMic, startDetector]);

  useEffect(() => {
    if (sessionFinished && detectorStatus !== 'idle') stopDetector();
  }, [detectorStatus, sessionFinished, stopDetector]);

  useEffect(() => {
    if (!playing) return;
    if (settings.mode === 'wait') return;
    const animate = (now: number) => {
      const elapsedBeats = (now - startedAtRef.current) / beatMs;
      const beat = startBeatRef.current + elapsedBeats;
      let nextIndex = activeIndex;
      for (let i = activeIndex; i < practiceEvents.length; i += 1) {
        if (practiceEvents[i].beat <= beat + 0.02) nextIndex = i;
        else break;
      }
      if (nextIndex !== activeIndex) setActiveIndex(nextIndex);
      const event = practiceEvents[nextIndex];
      if (event && lastPlayedRef.current !== nextIndex) {
        lastPlayedRef.current = nextIndex;
        if (soundEnabled && settings.mode === 'demo' && settings.hand !== 'left') {
          playMidi(event.midi, event.duration * beatMs / 1000 * 0.92);
        }
        if (soundEnabled && settings.metronome) click(event.beat % song.timeSignature[0] === 0);
      }
      const nextAccompanimentIndex = accompanimentIndexAt(song, beat);
      if (song.accompaniment?.length && lastAccompanimentIndexRef.current !== nextAccompanimentIndex) {
        lastAccompanimentIndexRef.current = nextAccompanimentIndex;
        setActiveAccompanimentIndex(nextAccompanimentIndex);
      }
      const accompaniment = song.accompaniment?.[nextAccompanimentIndex];
      if (soundEnabled && settings.mode === 'demo' && settings.hand !== 'right' && accompaniment && lastAccompanimentPlayedRef.current !== nextAccompanimentIndex) {
        lastAccompanimentPlayedRef.current = nextAccompanimentIndex;
        playLeftHand(accompaniment.midi, accompaniment.role, accompaniment.chord, accompaniment.duration * beatMs / 1000);
      }
      const boundary = settings.loop ? settings.loopEnd : practiceEvents.length - 1;
      const endEvent = practiceEvents[boundary];
      if (nextIndex >= boundary && beat >= endEvent.beat + endEvent.duration) {
        if (settings.loop) {
          const loopEvent = practiceEvents[settings.loopStart];
          setActiveIndex(settings.loopStart);
          startedAtRef.current = now;
          startBeatRef.current = loopEvent.beat;
          lastPlayedRef.current = -1;
          lastAccompanimentIndexRef.current = -1;
          lastAccompanimentPlayedRef.current = -1;
        } else {
          finishActiveSegment();
          sessionCompletedRef.current = true;
          setSessionFinished(true);
          void persistSession(true);
          setPlaying(false);
          setFeedback({ kind: 'good', title: 'Bravo, passage terminé !', detail: 'Tu as gardé le fil jusqu’au bout. Rejoue à 90 % quand tu te sens prêt.' });
          return;
        }
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [activeIndex, beatMs, click, finishActiveSegment, persistSession, playLeftHand, playMidi, playing, practiceEvents, settings.hand, settings.loop, settings.loopEnd, settings.loopStart, settings.metronome, settings.mode, song, soundEnabled]);

  const assessPitch = useCallback((midi: number, note: string, confidence: number, direction?: 'push' | 'pull', fromMicrophone = false) => {
    if (!practiceWithMic || !currentEvent || confidence <= .7) return;
    if (settings.mode === 'wait' && fromMicrophone && performance.now() < ignoreMicrophoneUntilRef.current) return;
    if (settings.mode === 'wait' && !fromMicrophone) ignoreMicrophoneUntilRef.current = performance.now() + 1200;
    if (settings.mode === 'wait' && fromMicrophone && waitForReleaseRef.current !== null) {
      if (waitForReleaseRef.current === midi) return;
      waitForReleaseRef.current = null;
    }
    if (direction && direction !== currentEvent.direction) {
      setFeedback({ kind: 'hint', title: 'Bon bouton, autre direction', detail: `Ici, il faut ${currentEvent.direction === 'pull' ? 'ouvrir et tirer' : 'fermer et pousser'} le soufflet.` });
      return;
    }
    const delta = midi - currentEvent.midi;
    const pitchMatches = currentEvent.hand === 'left' ? midiMatches(currentEvent.midi, midi) : delta === 0;
    if (pitchMatches) {
      const targetTime = startedAtRef.current + (currentEvent.beat - startBeatRef.current) * beatMs;
      const timingDelta = settings.mode === 'wait' ? 0 : performance.now() - targetTime;
      if (!assessedRef.current.has(activeIndex)) {
        assessedRef.current.add(activeIndex);
        const timingKind = timingDelta < -120 ? 'early' : timingDelta > 180 ? 'late' : 'correct';
        incrementResult(timingKind);
      }
      if (timingDelta < -120) setFeedback({ kind: 'hint', title: 'Bonne note, mais un peu trop tôt', detail: 'Attends que le repère arrive au centre avant d’attaquer la note.' });
      else if (timingDelta > 180) setFeedback({ kind: 'hint', title: 'Bonne note, mais un peu trop tard', detail: 'Prépare ton doigt pendant la note précédente pour partir sur le temps.' });
      else setFeedback({ kind: 'good', title: 'Bonne note, au bon moment', detail: 'La hauteur et l’attaque sont justes. Garde le son jusqu’au prochain repère.' });
      if (settings.mode === 'wait' && playing) {
        if (lastCorrectIndexRef.current === activeIndex) return;
        lastCorrectIndexRef.current = activeIndex;
        waitForReleaseRef.current = midi;
        const advance = getWaitAdvance(activeIndex, practiceEvents.length, settings.loop, settings.loopStart, settings.loopEnd);
        if (advance.finished) {
          finishActiveSegment();
          sessionCompletedRef.current = true;
          setSessionFinished(true);
          void persistSession(true);
          setPlaying(false);
          setFeedback({ kind: 'good', title: 'Exercice terminé !', detail: 'Tu as trouvé toutes les notes sans limite de temps.' });
        } else {
          window.clearTimeout(waitAdvanceTimerRef.current);
          setFeedback({ kind: 'good', title: 'Bonne note, on avance', detail: `Le geste ${advance.nextIndex + 1} sur ${practiceEvents.length} arrive maintenant.` });
          waitAdvanceTimerRef.current = window.setTimeout(() => {
            if (advance.looped) {
              assessedRef.current.clear();
              wrongRef.current.clear();
            }
            setActiveIndex(advance.nextIndex);
            setActiveAccompanimentIndex(accompanimentIndexAt(song, practiceEvents[advance.nextIndex]?.beat ?? 0));
            setFeedback({
              kind: 'neutral',
              title: advance.looped ? 'La boucle recommence' : 'À la note suivante',
              detail: advance.looped ? 'Reprends depuis le début du passage.' : `Joue le geste ${advance.nextIndex + 1} sur ${practiceEvents.length}.`,
            });
          }, 180);
        }
      }
    } else if (confidence > .72) {
      if (!wrongRef.current.has(activeIndex)) {
        wrongRef.current.add(activeIndex);
        incrementResult('wrong');
      }
      setFeedback({
        kind: 'hint',
        title: delta < 0 ? 'Un peu trop grave' : 'Un peu trop aigu',
        detail: `Tu joues ${note}. Cherche le bouton éclairé sans changer la direction du soufflet.`,
      });
    }
  }, [activeIndex, beatMs, currentEvent, finishActiveSegment, incrementResult, persistSession, playing, practiceEvents, practiceWithMic, settings.loop, settings.loopEnd, settings.loopStart, settings.mode, song]);

  useEffect(() => {
    const reading = detectedReading;
    if (!reading) {
      if (settings.mode === 'wait' && waitForReleaseRef.current !== null) {
        window.clearTimeout(waitReleaseTimerRef.current);
        waitReleaseTimerRef.current = window.setTimeout(() => { waitForReleaseRef.current = null; }, 140);
      }
      return;
    }
    window.clearTimeout(waitReleaseTimerRef.current);
    assessPitch(reading.midi, reading.note, reading.confidence, undefined, true);
  }, [assessPitch, detectedReading, settings.mode]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Control') {
        setShortcutsVisible(true);
        return;
      }
      if (event.key === 'Escape' && tempoOpen) {
        setTempoOpen(false);
        return;
      }
      const target = event.target as HTMLElement | null;
      const isEditable = target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '');
      if (isEditable || event.ctrlKey || event.metaKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (shortcutsVisible) {
        if (event.key === 'Escape' || key === '?') setShortcutsVisible(false);
        return;
      }
      if (event.code === 'Space') { event.preventDefault(); begin(); }
      else if (key === 'r') restart();
      else if (key === 'l') setSettings((value) => ({ ...value, loop: !value.loop }));
      else if (key === 'm') setSettings((value) => ({ ...value, metronome: !value.metronome }));
      else if (key === 's') setSoundEnabled((value) => !value);
      else if (key === 'p') setShowScore((value) => !value);
      else if (key === 'f') void toggleFullscreen();
      else if (key === '?') setShortcutsVisible((value) => !value);
      else if (!playing && countInBeat === null && event.key === 'ArrowLeft') {
        event.preventDefault();
        selectIndex(Math.max(0, activeIndex - 1));
      } else if (!playing && countInBeat === null && event.key === 'ArrowRight') {
        event.preventDefault();
        selectIndex(Math.min(practiceEvents.length - 1, activeIndex + 1));
      } else if (['1', '2', '3', '4'].includes(event.key)) {
        selectMode(PRIMARY_PRACTICE_MODES[Number(event.key) - 1].id);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Control') setShortcutsVisible(false);
    };
    const onBlur = () => setShortcutsVisible(false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [activeIndex, begin, countInBeat, playing, practiceEvents.length, restart, selectIndex, selectMode, shortcutsVisible, tempoOpen, toggleFullscreen]);

  const closePractice = useCallback(() => {
    finishActiveSegment();
    void persistSession(sessionCompletedRef.current);
    onClose();
  }, [finishActiveSegment, onClose, persistSession]);

  const progress = useMemo(() => ((activeIndex + 1) / Math.max(1, practiceEvents.length)) * 100, [activeIndex, practiceEvents.length]);

  return (
    <div className="practice-page">
      <header className="practice-header">
        <button type="button" className="brand-mini" onClick={closePractice} aria-label="Retour à l’accueil">
          <span className="brand-mark"><i /><i /><i /></span><strong>soufflet</strong>
        </button>
        <div className="song-heading">
          <button type="button" className="crumb" onClick={closePractice}>Séance du jour</button>
          <span>/</span><strong>{song.title}</strong>
        </div>
        <div className="practice-meta">
          <span><CircleGauge size={15} /> {Math.round(actualBpm)} BPM</span>
          <span>{song.key}</span>
          <button type="button" className="shortcut-hint" onClick={() => setShortcutsVisible(true)} title="Afficher les raccourcis clavier">
            <Keyboard size={15} /><kbd>Ctrl</kbd><span>Raccourcis</span>
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => void toggleFullscreen()}
            aria-label={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
            title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
          >
            {isFullscreen ? <Minimize size={19} /> : <Expand size={19} />}
          </button>
        </div>
      </header>

      <div className="session-progress"><i style={{ width: `${progress}%` }} /></div>

      <main className="practice-main">
        <div className="practice-toolbar">
          <div className="mode-picker">
            <button type="button" className="mode-trigger" onClick={() => setModeOpen(!modeOpen)}>
              <span><small>MODE D’ENTRAÎNEMENT</small><strong>{PRACTICE_MODES.find((mode) => mode.id === settings.mode)?.label}</strong></span>
              <ChevronDown size={18} />
            </button>
            {modeOpen && (
              <div className="mode-menu">
                <small className="mode-group-label">MODES PRINCIPAUX</small>
                {PRIMARY_PRACTICE_MODES.map((mode) => (
                  <button type="button" key={mode.id} className={settings.mode === mode.id ? 'is-selected' : ''} onClick={() => selectMode(mode.id)}>
                    <span>{mode.label}</span><small>{mode.short}</small>
                  </button>
                ))}
                <small className="mode-group-label is-supplemental">ATELIERS CIBLÉS</small>
                {SUPPLEMENTAL_PRACTICE_MODES.map((mode) => (
                  <button type="button" key={mode.id} className={settings.mode === mode.id ? 'is-selected' : ''} onClick={() => selectMode(mode.id)}>
                    <span>{mode.label}</span><small>{mode.short}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="hand-focus-switch" aria-label="Partie de l’accordéon travaillée">
            <span>JE TRAVAILLE</span>
            <div>
              {HAND_FOCUS_OPTIONS.map((option) => {
                const unavailable = option.id !== 'right' && !song.accompaniment?.length;
                return <button type="button" key={option.id} disabled={unavailable} className={settings.hand === option.id ? 'is-active' : ''} title={unavailable ? 'Ce morceau ne contient pas encore de main gauche.' : option.short} onClick={() => changeHand(option.id)}>{option.id === 'right' ? <Music2 /> : <Hand />}<b>{option.label}</b></button>;
              })}
            </div>
          </div>
          <div className="notation-switch" aria-label="Convention de notation">
            {(['french', 'english', 'tablature'] as Notation[]).map((item) => (
              <button type="button" key={item} className={notation === item ? 'is-active' : ''} onClick={() => onNotationChange(item)}>
                {item === 'french' ? 'Do Ré' : item === 'english' ? 'A B C' : '1P / 1T'}
              </button>
            ))}
          </div>
          <button type="button" className={`tool-toggle ${settings.loop ? 'is-active' : ''}`} onClick={() => setSettings((value) => ({ ...value, loop: !value.loop }))}>
            <Repeat2 size={17} /> Boucler
          </button>
          <button type="button" className={`tool-toggle ${!showScore ? 'is-active' : ''}`} onClick={() => setShowScore(!showScore)}><SlidersHorizontal size={17} /> {showScore ? 'Masquer la partition' : 'Afficher la partition'}</button>
        </div>

        <section className="instrument-stage">
          {countInBeat !== null && <div className="count-in-overlay" aria-live="assertive"><small>PRÉPARE TON ACCORDÉON</small><strong>{countInBeat}</strong><p>Le morceau démarre après le dernier temps.</p><span>{countInSequence.map((beat) => <i key={beat} className={beat >= countInBeat ? 'is-counted' : ''} />)}</span></div>}
          {settings.mode !== 'performance' && (
            <AccordionView
              config={accordion}
              activeEvent={sessionFinished ? undefined : displayedEvent}
              direction={currentEvent?.direction}
              notation={notation}
              detectedMidi={detectedReading?.midi}
              depressActive={playing && countInBeat === null && !sessionFinished}
              onButtonPress={(buttonId, direction) => {
                if (direction !== currentEvent?.direction) {
                  setFeedback({ kind: 'hint', title: 'Bon bouton, autre direction', detail: `Ici, il faut ${currentEvent?.direction === 'pull' ? 'ouvrir et tirer' : 'fermer et pousser'} le soufflet.` });
                  return;
                }
                if (settings.mode === 'wait' && playing) {
                  const button = [...accordion.buttons, ...accordion.basses].find((item) => item.id === buttonId);
                  if (!button) return;
                  const midi = direction === 'push' ? button.pushMidi : button.pullMidi;
                  const note = direction === 'push' ? button.push : button.pull;
                  assessPitch(midi, note, 1, direction);
                }
              }}
            />
          )}
        </section>

        {settings.mode !== 'performance' && showScore && (
          <ScoreStrip song={scoreSong} activeIndex={activeIndex} notation={notation} hand={settings.hand} completed={sessionFinished} onSelect={(_, index) => selectIndex(index)} />
        )}

        {shortcutsVisible && (
          <div className="shortcut-overlay" role="dialog" aria-modal="true" aria-labelledby="shortcut-title" onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShortcutsVisible(false);
          }}>
            <section className="shortcut-card">
              <header>
                <span><Keyboard size={22} /></span>
                <div><small>JOUER SANS LÂCHER L’ACCORDÉON</small><h2 id="shortcut-title">Raccourcis clavier</h2></div>
                <button type="button" className="icon-button" onClick={() => setShortcutsVisible(false)} aria-label="Fermer les raccourcis"><X /></button>
              </header>
              <div className="shortcut-grid">
                <span><kbd>Espace</kbd><b>Lecture / pause</b></span>
                <span><kbd>R</kbd><b>Recommencer</b></span>
                <span><kbd>L</kbd><b>Boucle</b></span>
                <span><kbd>M</kbd><b>Métronome</b></span>
                <span><kbd>S</kbd><b>Son de l’app</b></span>
                <span><kbd>P</kbd><b>Partition</b></span>
                <span><kbd>F</kbd><b>Plein écran</b></span>
                <span><kbd>← →</kbd><b>Parcourir les notes</b></span>
                <span><kbd>1—4</kbd><b>Choisir un mode</b></span>
                <span><kbd>?</kbd><b>Afficher ce rappel</b></span>
              </div>
              <p>Maintiens <kbd>Ctrl</kbd> à tout moment pour retrouver ce rappel.</p>
            </section>
          </div>
        )}

        <section className={`coach-feedback feedback-${feedback.kind}`} aria-live="polite">
          <div className="coach-avatar"><AudioLines size={22} /></div>
          <div><small>CONSEIL EN DIRECT</small><strong>{feedback.title}</strong><p>{feedback.detail}</p></div>
          {practiceWithMic && (
            <div className="mic-status">
              <span className={detectorStatus === 'listening' ? 'mic-live' : ''} />
              {detectorStatus === 'listening' ? (detectedReading ? `${detectedReading.note} · ${Math.round(detectedReading.confidence * 100)} %` : 'Écoute…') : 'Micro en attente'}
            </div>
          )}
          {practiceWithMic && <div className="live-results" title="Évaluation automatique"><span><b>{results.correct}</b> justes</span><span><b>{results.early + results.late}</b> décalées</span><span><b>{results.wrong}</b> à corriger</span></div>}
          <button type="button" className="explain-button" onClick={() => setFeedback({ kind: 'neutral', title: 'Ce que j’écoute', detail: 'Je compare la hauteur, le moment de l’attaque et la durée. La direction du soufflet est déduite du bouton attendu : un capteur de mouvement pourra la confirmer plus tard.' })}>Pourquoi ?</button>
        </section>
      </main>

      <footer className="transport-bar">
        <div className="transport-side">
          <button type="button" className="transport-tool" onClick={restart}><Redo2 /> <span>Recommencer<kbd>R</kbd></span></button>
          <button type="button" className={`transport-tool ${settings.loop ? 'is-active' : ''}`} onClick={() => setSettings((value) => ({ ...value, loop: !value.loop }))}><Repeat2 /> <span>Boucle<kbd>L</kbd></span></button>
        </div>
        <button type="button" className="primary-play" onClick={() => { setTempoOpen(false); begin(); }}>{playing || countInBeat !== null ? <Pause /> : <Play fill="currentColor" />}<span>{countInBeat !== null ? `Départ dans ${countInBeat}` : playing ? 'Pause' : 'Commencer'}</span><kbd>Espace</kbd></button>
        <div className="transport-side align-right">
          <label className="tempo-control"><Gauge size={19} /><span>Tempo <strong>{settings.tempo} %</strong></span><input type="range" min="40" max="120" step="5" value={settings.tempo} onChange={(event) => setSettings((value) => ({ ...value, tempo: Number(event.target.value) }))} /></label>
          <button
            type="button"
            className={`mobile-tempo-trigger ${tempoOpen ? 'is-active' : ''}`}
            aria-label={`Régler le tempo, actuellement ${settings.tempo} pour cent`}
            aria-expanded={tempoOpen}
            aria-controls="mobile-tempo-panel"
            onClick={() => setTempoOpen((value) => !value)}
          >
            <Gauge aria-hidden="true" />
            <strong>{settings.tempo}%</strong>
          </button>
          {tempoOpen && (
            <section id="mobile-tempo-panel" className="mobile-tempo-panel" role="dialog" aria-label="Réglage du tempo">
              <header>
                <div><small>TEMPO</small><strong>{settings.tempo} % · {Math.round(actualBpm)} BPM</strong></div>
                <button type="button" aria-label="Fermer le réglage du tempo" onClick={() => setTempoOpen(false)}><X /></button>
              </header>
              <div className="mobile-tempo-adjuster">
                <button type="button" aria-label="Ralentir de 5 pour cent" disabled={settings.tempo <= 40} onClick={() => setSettings((value) => ({ ...value, tempo: Math.max(40, value.tempo - 5) }))}>−</button>
                <input aria-label="Tempo en pourcentage" type="range" min="40" max="120" step="5" value={settings.tempo} onChange={(event) => setSettings((value) => ({ ...value, tempo: Number(event.target.value) }))} />
                <button type="button" aria-label="Accélérer de 5 pour cent" disabled={settings.tempo >= 120} onClick={() => setSettings((value) => ({ ...value, tempo: Math.min(120, value.tempo + 5) }))}>+</button>
              </div>
              <p>Commence lentement, puis accélère quand le geste reste régulier.</p>
            </section>
          )}
          <button
            type="button"
            className={`transport-tool transport-metronome ${settings.metronome ? 'is-active' : ''}`}
            aria-label={settings.metronome ? 'Désactiver le métronome' : 'Activer le métronome'}
            aria-pressed={settings.metronome}
            title={settings.metronome ? 'Désactiver le métronome' : 'Activer le métronome'}
            onClick={() => setSettings((value) => ({ ...value, metronome: !value.metronome }))}
          >
            <TimerReset /><span>Métronome</span>
          </button>
          <button type="button" className={`icon-button ${soundEnabled ? '' : 'is-active'}`} onClick={() => setSoundEnabled(!soundEnabled)} title={soundEnabled ? 'Couper le son de l’application' : 'Activer le son'}><Volume2 /></button>
          <button type="button" className="icon-button" onClick={() => setModeOpen(true)} title="Réglages du mode"><Settings2 /></button>
          <button type="button" className={`icon-button ${flagged ? 'is-active' : ''}`} title="Marquer ce passage difficile" onClick={() => { const next = !flagged; flaggedRef.current = next; setFlagged(next); setFeedback({ kind: 'neutral', title: flagged ? 'Marque retirée' : 'Passage marqué pour révision', detail: flagged ? 'Ce passage ne reviendra plus en priorité.' : 'Il sera proposé plus tôt dans une prochaine séance.' }); }}><Flag fill={flagged ? 'currentColor' : 'none'} /></button>
        </div>
      </footer>
    </div>
  );
}
