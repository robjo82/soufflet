import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AudioLines, ChevronDown, CircleGauge, Expand, Flag, Gauge,
  Hand, Keyboard, Minimize, Music2, Pause, Play, Redo2, Repeat2, Settings2, SlidersHorizontal, TimerReset, Volume2, X,
  Wind,
} from 'lucide-react';
import { AccordionInstrument } from './AccordionInstrument';
import { FingeringGuide } from './FingeringGuide';
import { ScoreStrip } from './ScoreStrip';
import { usePitchDetector } from '../hooks/usePitchDetector';
import { useSynth } from '../hooks/useSynth';
import type {
  AccordionConfig, AccompanimentEvent, BellowsStyle, Hand as HandFocus, LeftHandAcousticProfile, Notation,
  PracticeAssessmentBreakdown, PracticeDimensionResults, PracticeSessionInput, PracticeSettings, PrimaryPracticeMode,
  Song, SupplementalPracticeMode,
} from '../types';
import { HAND_FOCUS_OPTIONS, PRACTICE_MODES, PRIMARY_PRACTICE_MODES, SUPPLEMENTAL_PRACTICE_MODES } from '../practiceModes';
import { getCountInSequence, getPlaybackStartIndex, getWaitAdvance } from '../practiceProgress';
import { createPracticeTimeline } from '../practiceTimeline';
import { adaptSongToAccordion } from '../data';
import { BELLOWS_STYLE_OPTIONS, bellowsAmountLabel, bellowsStepAt } from '../bellowsStrategy';
import { canAcceptWaitPitch, selectPitchAssessmentIndex } from '../practicePitchAssessment';
import { planMelodyFingering } from '../fingeringGuide';
import { accompanimentAttackAtBeat, accompanimentContainsPitch, classifyHandCoordination, detectPracticeLeftHand } from '../practiceHandDetection';
import type { AudioFeatureFrame } from '../audioTraining';

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

const emptyDimension = (): PracticeDimensionResults => ({ correct: 0, early: 0, late: 0, wrong: 0 });
const emptyBreakdown = (): PracticeAssessmentBreakdown => ({
  right: emptyDimension(), left: emptyDimension(), coordination: emptyDimension(),
});

type HandMonitorStatus = 'waiting' | 'listening' | 'correct' | 'wrong' | 'uncertain';
interface HandMonitor {
  status: HandMonitorStatus;
  label: string;
  confidence?: number;
  source?: 'personal-profile' | 'harmonic-model';
}

interface LeftCapture {
  onsetId: number;
  onsetAt: number;
  target: AccompanimentEvent;
  targetIndex: number;
  frames: AudioFeatureFrame[];
  handled: boolean;
}

export function PracticePlayer({ song: sourceSong, accordion, onClose, notation, countIn, onNotationChange, onSessionUpdate }: PracticePlayerProps) {
  const [settings, setSettings] = useState<PracticeSettings>({
    mode: 'guided', hand: 'right', tempo: 80, countIn, metronome: false, loop: false,
    loopStart: 0, loopEnd: sourceSong.events.length - 1, notation, bellowsStyle: 'balanced',
  });
  const song = useMemo(() => {
    const adapted = adaptSongToAccordion(sourceSong, accordion, settings.bellowsStyle);
    return { ...adapted, events: planMelodyFingering(adapted.events, accordion) };
  }, [accordion, settings.bellowsStyle, sourceSong]);
  const [playing, setPlaying] = useState(false);
  const [countInBeat, setCountInBeat] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeAccompanimentIndex, setActiveAccompanimentIndex] = useState(0);
  const [modeOpen, setModeOpen] = useState(false);
  const [showScore, setShowScore] = useState(true);
  const [showFingering, setShowFingering] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [tempoOpen, setTempoOpen] = useState(false);
  const [flagged, setFlagged] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const [sessionFinished, setSessionFinished] = useState(false);
  const [shortcutsVisible, setShortcutsVisible] = useState(false);
  const [results, setResults] = useState({ correct: 0, early: 0, late: 0, wrong: 0 });
  const [assessmentBreakdown, setAssessmentBreakdown] = useState<PracticeAssessmentBreakdown>(emptyBreakdown);
  const [leftHandProfile, setLeftHandProfile] = useState<LeftHandAcousticProfile | null>(null);
  const [handMonitor, setHandMonitor] = useState<{ right: HandMonitor; left: HandMonitor }>({
    right: { status: 'waiting', label: 'En attente' },
    left: { status: 'waiting', label: 'En attente' },
  });
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
  const lastDetectedOnsetAtRef = useRef(0);
  const countInTimersRef = useRef<number[]>([]);
  const assessedRef = useRef(new Set<number>());
  const wrongRef = useRef(new Set<number>());
  const leftAssessedRef = useRef(new Set<number>());
  const leftWrongRef = useRef(new Set<number>());
  const assessmentBreakdownRef = useRef(assessmentBreakdown);
  const waitSatisfiedRef = useRef({ right: false, left: false });
  const leftCaptureRef = useRef<LeftCapture | null>(null);
  const rightAttacksRef = useRef(new Map<string, number>());
  const leftAttacksRef = useRef(new Map<string, number>());
  const coordinationAssessedRef = useRef(new Set<string>());
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
  const {
    reading: detectedReading, audioFrame, onset: detectedOnset, status: detectorStatus,
    start: startDetector, stop: stopDetector,
  } = usePitchDetector();
  const practiceEvents = useMemo(() => createPracticeTimeline(song, settings.hand), [settings.hand, song]);
  const scoreSong = useMemo(() => settings.hand === 'left' ? { ...song, events: practiceEvents, accompaniment: undefined } : song, [practiceEvents, settings.hand, song]);
  const currentEvent = practiceEvents[activeIndex];
  const currentBellowsStep = bellowsStepAt(song, currentEvent);
  const bellowsAmount = currentBellowsStep
    ? playing && countInBeat === null ? currentBellowsStep.afterAmount : currentBellowsStep.beforeAmount
    : song.bellowsPlan?.startAmount ?? .38;
  const currentAccompaniment = song.accompaniment?.[activeAccompanimentIndex];
  const waitLeftTarget = settings.hand === 'left'
    ? song.accompaniment?.[activeIndex]
    : settings.hand === 'both' && currentEvent
      ? accompanimentAttackAtBeat(song.accompaniment, currentEvent.beat)
      : undefined;
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

  useEffect(() => {
    const controller = new AbortController();
    setLeftHandProfile(null);
    void fetch('/api/audio-profiles/left-hand', { signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<{ profiles: LeftHandAcousticProfile[] }> : Promise.reject())
      .then(({ profiles }) => setLeftHandProfile(profiles.find((profile) => profile.accordionId === accordion.id) ?? null))
      .catch(() => undefined);
    return () => controller.abort();
  }, [accordion.id]);

  const resetSessionTracking = useCallback(() => {
    sessionIdRef.current = crypto.randomUUID();
    sessionStartedAtRef.current = null;
    activeSegmentStartedAtRef.current = null;
    accumulatedActiveMsRef.current = 0;
    sessionCompletedRef.current = false;
    setSessionFinished(false);
    maxIndexRef.current = 0;
    resultsRef.current = { correct: 0, early: 0, late: 0, wrong: 0 };
    const breakdown = emptyBreakdown();
    assessmentBreakdownRef.current = breakdown;
    setAssessmentBreakdown(breakdown);
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
      assessmentBreakdown: assessmentBreakdownRef.current,
    });
  }, [activeMilliseconds, onSessionUpdate, practiceEvents.length, song.id, song.title]);

  const resetResults = useCallback(() => {
    const empty = { correct: 0, early: 0, late: 0, wrong: 0 };
    resultsRef.current = empty;
    setResults(empty);
    const breakdown = emptyBreakdown();
    assessmentBreakdownRef.current = breakdown;
    setAssessmentBreakdown(breakdown);
    setHandMonitor({
      right: { status: 'waiting', label: 'En attente' },
      left: { status: 'waiting', label: 'En attente' },
    });
  }, []);

  const incrementResult = useCallback((kind: keyof typeof results) => {
    const value = resultsRef.current;
    const next = { ...value, [kind]: value[kind] + 1 };
    resultsRef.current = next;
    setResults(next);
  }, []);

  const incrementAssessment = useCallback((dimension: keyof PracticeAssessmentBreakdown, kind: keyof PracticeDimensionResults) => {
    const value = assessmentBreakdownRef.current;
    const next = { ...value, [dimension]: { ...value[dimension], [kind]: value[dimension][kind] + 1 } };
    assessmentBreakdownRef.current = next;
    setAssessmentBreakdown(next);
  }, []);

  const resetDetectionTracking = useCallback(() => {
    leftAssessedRef.current.clear();
    leftWrongRef.current.clear();
    waitSatisfiedRef.current = { right: false, left: false };
    leftCaptureRef.current = null;
    rightAttacksRef.current.clear();
    leftAttacksRef.current.clear();
    coordinationAssessedRef.current.clear();
    setHandMonitor({
      right: { status: 'waiting', label: 'En attente' },
      left: { status: 'waiting', label: 'En attente' },
    });
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
    resetDetectionTracking();
    resetResults();
    setPlaying(false);
  }, [clearCountIn, finishActiveSegment, persistSession, practiceEvents, resetDetectionTracking, resetResults, resetSessionTracking, song]);

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
    resetDetectionTracking();
    resetResults();
    setFeedback({ kind: 'neutral', title: 'On reprend calmement', detail: 'Inspire, prépare le doigt et regarde la direction.' });
  }, [practiceEvents, resetDetectionTracking, resetResults, resetSessionTracking, settings.loop, settings.loopStart, song, stop]);

  const changeHand = useCallback((hand: HandFocus) => {
    const nextEvents = createPracticeTimeline(song, hand);
    if (!nextEvents.length) return;
    stop();
    resetSessionTracking();
    resetDetectionTracking();
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
        ? 'Le micro vérifie séparément la mélodie, les basses ou accords, puis leur coordination.'
        : hand === 'left'
          ? 'Le micro reconnaît la fondamentale des basses et toute l’empreinte des accords.'
          : 'Concentre-toi sur les boutons de la main droite.',
    });
  }, [resetDetectionTracking, resetResults, resetSessionTracking, song, stop]);

  const selectMode = useCallback((mode: PrimaryPracticeMode | SupplementalPracticeMode) => {
    stop();
    resetSessionTracking();
    resetDetectionTracking();
    resetResults();
    setModeOpen(false);
    setSettings((value) => ({ ...value, mode }));
    lastCorrectIndexRef.current = -1;
    waitForReleaseRef.current = null;
    ignoreMicrophoneUntilRef.current = 0;
    if (mode === 'wait') {
      setFeedback({ kind: 'neutral', title: 'La lecture t’attend', detail: 'Appuie sur Commencer, puis joue le geste éclairé. Chaque réussite affiche immédiatement le suivant.' });
    }
  }, [resetDetectionTracking, resetResults, resetSessionTracking, stop]);

  const changeBellowsStyle = useCallback((style: BellowsStyle) => {
    stop();
    resetSessionTracking();
    resetDetectionTracking();
    resetResults();
    setSettings((value) => ({ ...value, bellowsStyle: style, loopStart: 0, loopEnd: sourceSong.events.length - 1 }));
    setActiveIndex(0);
    setActiveAccompanimentIndex(0);
    const option = BELLOWS_STYLE_OPTIONS.find((item) => item.id === style);
    setFeedback({
      kind: 'neutral',
      title: option?.label ?? 'Stratégie de soufflet',
      detail: option?.description ?? 'Le plan de soufflet a été recalculé pour tout le morceau.',
    });
  }, [resetDetectionTracking, resetResults, resetSessionTracking, sourceSong.events.length, stop]);

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

  const begin = useCallback(async () => {
    if (playing || countInBeat !== null) { stop(); return; }
    if (practiceWithMic && detectorStatus === 'idle') {
      setFeedback({ kind: 'neutral', title: 'Le micro se prépare', detail: 'L’écoute démarre avant la musique pour ne pas perdre la première note.' });
      await startDetector();
    }
    const startIndex = getPlaybackStartIndex(activeIndex, sessionCompletedRef.current, settings.loop, settings.loopStart);
    if (sessionCompletedRef.current) {
      resetSessionTracking();
      resetDetectionTracking();
      resetResults();
      assessedRef.current.clear();
      wrongRef.current.clear();
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
  }, [activeIndex, beatMs, click, countInBeat, countInSequence, detectorStatus, playing, practiceEvents, practiceWithMic, resetDetectionTracking, resetResults, resetSessionTracking, settings.countIn, settings.loop, settings.loopStart, song, soundEnabled, startDetector, startPlayback, stop]);

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

  const recordCoordination = useCallback((hand: 'right' | 'left', beat: number, at: number) => {
    if (settings.hand !== 'both' || !accompanimentAttackAtBeat(song.accompaniment, beat)) return;
    const key = beat.toFixed(3);
    (hand === 'right' ? rightAttacksRef : leftAttacksRef).current.set(key, at);
    const rightAt = rightAttacksRef.current.get(key);
    const leftAt = leftAttacksRef.current.get(key);
    if (rightAt === undefined || leftAt === undefined || coordinationAssessedRef.current.has(key)) return;
    coordinationAssessedRef.current.add(key);
    const coordination = classifyHandCoordination(rightAt, leftAt);
    const resultKind = coordination.kind === 'correct' ? 'correct' : coordination.kind === 'left-early' ? 'early' : 'late';
    incrementAssessment('coordination', resultKind);
    if (coordination.kind === 'left-early') {
      setFeedback({ kind: 'hint', title: 'Les deux gestes sont justes, basse un peu tôt', detail: `Retarde la main gauche d’environ ${Math.round(Math.abs(coordination.deltaMs) / 10) * 10} ms pour réunir les attaques.` });
    } else if (coordination.kind === 'left-late') {
      setFeedback({ kind: 'hint', title: 'Les deux gestes sont justes, basse un peu tard', detail: `Prépare la main gauche environ ${Math.round(Math.abs(coordination.deltaMs) / 10) * 10} ms plus tôt.` });
    } else {
      setFeedback({ kind: 'good', title: 'Deux mains bien ensemble', detail: 'La mélodie et l’accompagnement démarrent sur le même temps.' });
    }
  }, [incrementAssessment, settings.hand, song.accompaniment]);

  const completeWaitStep = useCallback((releaseMidi?: number) => {
    if (settings.mode !== 'wait' || !playing) return false;
    const requiresRight = settings.hand !== 'left';
    const requiresLeft = settings.hand === 'left' || Boolean(waitLeftTarget);
    if ((requiresRight && !waitSatisfiedRef.current.right) || (requiresLeft && !waitSatisfiedRef.current.left)) {
      const missing = requiresRight && !waitSatisfiedRef.current.right ? 'la mélodie main droite' : 'la basse ou l’accord main gauche';
      setFeedback({ kind: 'neutral', title: 'Un geste est validé', detail: `Garde-le en mémoire et ajoute maintenant ${missing}.` });
      return false;
    }
    if (lastCorrectIndexRef.current === activeIndex) return true;
    lastCorrectIndexRef.current = activeIndex;
    waitForReleaseRef.current = releaseMidi ?? null;
    const advance = getWaitAdvance(activeIndex, practiceEvents.length, settings.loop, settings.loopStart, settings.loopEnd);
    if (advance.finished) {
      finishActiveSegment();
      sessionCompletedRef.current = true;
      setSessionFinished(true);
      void persistSession(true);
      setPlaying(false);
      setFeedback({ kind: 'good', title: 'Exercice terminé !', detail: settings.hand === 'both' ? 'Tu as validé la mélodie, la main gauche et leur coordination.' : 'Tous les gestes demandés ont été entendus.' });
      return true;
    }
    window.clearTimeout(waitAdvanceTimerRef.current);
    setFeedback({ kind: 'good', title: 'Bon geste, on avance', detail: `Le geste ${advance.nextIndex + 1} sur ${practiceEvents.length} arrive maintenant.` });
    waitAdvanceTimerRef.current = window.setTimeout(() => {
      if (advance.looped) {
        assessedRef.current.clear();
        wrongRef.current.clear();
        leftAssessedRef.current.clear();
        leftWrongRef.current.clear();
        coordinationAssessedRef.current.clear();
      }
      waitSatisfiedRef.current = { right: false, left: false };
      leftCaptureRef.current = null;
      setHandMonitor({
        right: { status: settings.hand === 'left' ? 'waiting' : 'listening', label: settings.hand === 'left' ? 'Non demandée' : 'À jouer' },
        left: { status: settings.hand === 'right' ? 'waiting' : 'listening', label: settings.hand === 'right' ? 'Non demandée' : 'À jouer' },
      });
      setActiveIndex(advance.nextIndex);
      setActiveAccompanimentIndex(accompanimentIndexAt(song, practiceEvents[advance.nextIndex]?.beat ?? 0));
      setFeedback({
        kind: 'neutral',
        title: advance.looped ? 'La boucle recommence' : 'Au geste suivant',
        detail: advance.looped ? 'Reprends depuis le début du passage.' : 'L’écoute reste active : joue quand tu es prêt.',
      });
    }, 180);
    return true;
  }, [activeIndex, finishActiveSegment, persistSession, playing, practiceEvents, settings.hand, settings.loop, settings.loopEnd, settings.loopStart, settings.mode, song, waitLeftTarget]);

  const assessPitch = useCallback((midi: number, note: string, confidence: number, direction?: 'push' | 'pull', fromMicrophone = false) => {
    if (!practiceWithMic || settings.hand === 'left' || !currentEvent || confidence <= .7) return;
    if (settings.mode === 'wait' && fromMicrophone && performance.now() < ignoreMicrophoneUntilRef.current) return;
    if (settings.mode === 'wait' && !fromMicrophone) ignoreMicrophoneUntilRef.current = performance.now() + 1200;
    if (settings.mode === 'wait' && fromMicrophone && waitForReleaseRef.current !== null) {
      if (!canAcceptWaitPitch(waitForReleaseRef.current, midi, performance.now(), lastDetectedOnsetAtRef.current)) return;
      waitForReleaseRef.current = null;
    }
    const now = performance.now();
    const playbackBeat = settings.mode === 'wait'
      ? currentEvent.beat
      : startBeatRef.current + Math.max(0, now - startedAtRef.current) / beatMs;
    const assessmentIndex = settings.mode === 'wait'
      ? activeIndex
      : selectPitchAssessmentIndex(practiceEvents, activeIndex, midi, playbackBeat);
    const assessmentEvent = practiceEvents[assessmentIndex] ?? currentEvent;
    if (direction && direction !== assessmentEvent.direction) {
      setFeedback({ kind: 'hint', title: 'Bon bouton, autre direction', detail: `Ici, il faut ${assessmentEvent.direction === 'pull' ? 'ouvrir et tirer' : 'fermer et pousser'} le soufflet.` });
      return;
    }
    const delta = midi - assessmentEvent.midi;
    const pitchMatches = delta === 0;
    if (settings.mode !== 'wait' && assessmentIndex !== activeIndex && assessedRef.current.has(assessmentIndex)) return;
    setHandMonitor((value) => ({ ...value, right: { status: 'listening', label: note, confidence } }));
    if (pitchMatches) {
      const attackAt = lastDetectedOnsetAtRef.current > 0 && now - lastDetectedOnsetAtRef.current <= 450
        ? lastDetectedOnsetAtRef.current
        : now;
      const targetTime = startedAtRef.current + (assessmentEvent.beat - startBeatRef.current) * beatMs;
      const timingDelta = settings.mode === 'wait' ? 0 : attackAt - targetTime;
      if (!assessedRef.current.has(assessmentIndex)) {
        assessedRef.current.add(assessmentIndex);
        const timingKind = timingDelta < -120 ? 'early' : timingDelta > 180 ? 'late' : 'correct';
        incrementResult(timingKind);
        incrementAssessment('right', timingKind);
      }
      setHandMonitor((value) => ({ ...value, right: { status: 'correct', label: note, confidence } }));
      recordCoordination('right', assessmentEvent.beat, attackAt);
      if (timingDelta < -120) setFeedback({ kind: 'hint', title: 'Bonne note, mais un peu trop tôt', detail: 'Attends que le repère arrive au centre avant d’attaquer la note.' });
      else if (timingDelta > 180) setFeedback({ kind: 'hint', title: 'Bonne note, mais un peu trop tard', detail: 'Prépare ton doigt pendant la note précédente pour partir sur le temps.' });
      else setFeedback({ kind: 'good', title: 'Main droite juste', detail: settings.hand === 'both' && waitLeftTarget ? 'La mélodie est bonne. Je vérifie aussi la main gauche.' : 'La hauteur et l’attaque sont justes.' });
      if (settings.mode === 'wait' && playing) {
        waitSatisfiedRef.current.right = true;
        completeWaitStep(midi);
      }
    } else if (confidence > .72) {
      const targetTime = startedAtRef.current + (assessmentEvent.beat - startBeatRef.current) * beatMs;
      if (settings.mode !== 'wait' && now - targetTime < 90) return;
      const simultaneousLeft = settings.hand === 'both' ? accompanimentAttackAtBeat(song.accompaniment, assessmentEvent.beat) : undefined;
      if (accompanimentContainsPitch(simultaneousLeft, midi)) {
        setHandMonitor((value) => ({ ...value, right: { status: 'uncertain', label: `${note} · accord entendu`, confidence } }));
        return;
      }
      if (!wrongRef.current.has(assessmentIndex)) {
        wrongRef.current.add(assessmentIndex);
        incrementResult('wrong');
        incrementAssessment('right', 'wrong');
      }
      setHandMonitor((value) => ({ ...value, right: { status: 'wrong', label: note, confidence } }));
      setFeedback({
        kind: 'hint',
        title: delta < 0 ? 'Main droite trop grave' : 'Main droite trop aiguë',
        detail: `Tu joues ${note}. Cherche le bouton mélodique éclairé sans changer la direction du soufflet.`,
      });
    }
  }, [activeIndex, beatMs, completeWaitStep, currentEvent, incrementAssessment, incrementResult, playing, practiceEvents, practiceWithMic, recordCoordination, settings.hand, settings.mode, song.accompaniment, waitLeftTarget]);

  useEffect(() => {
    if (!detectedOnset) return;
    lastDetectedOnsetAtRef.current = detectedOnset.at;
    if (!playing || settings.hand === 'right') return;
    let target: AccompanimentEvent | undefined;
    let targetIndex = -1;
    if (settings.mode === 'wait') {
      target = waitLeftTarget;
      targetIndex = settings.hand === 'left' ? activeIndex : target ? song.accompaniment?.indexOf(target) ?? -1 : -1;
    } else if (settings.hand === 'left') {
      targetIndex = activeIndex;
      target = song.accompaniment?.[targetIndex];
    } else {
      const playbackBeat = startBeatRef.current + Math.max(0, detectedOnset.at - startedAtRef.current) / beatMs;
      const ranked = (song.accompaniment ?? []).map((event, index) => ({ event, index, distance: Math.abs(event.beat - playbackBeat) }))
        .sort((left, right) => left.distance - right.distance);
      const nearest = ranked[0];
      if (nearest && nearest.distance * beatMs <= Math.max(360, beatMs * .5)) {
        target = nearest.event;
        targetIndex = nearest.index;
      }
    }
    if (!target || targetIndex < 0 || leftAssessedRef.current.has(targetIndex)) return;
    leftCaptureRef.current = {
      onsetId: detectedOnset.id,
      onsetAt: detectedOnset.at,
      target,
      targetIndex,
      frames: [],
      handled: false,
    };
    setHandMonitor((value) => ({ ...value, left: { status: 'listening', label: 'Analyse harmonique…' } }));
  }, [activeIndex, beatMs, detectedOnset, playing, settings.hand, settings.mode, song.accompaniment, waitLeftTarget]);

  useEffect(() => {
    const capture = leftCaptureRef.current;
    if (!audioFrame || !capture || capture.handled || audioFrame.at < capture.onsetAt - 20) return;
    capture.frames.push(audioFrame);
    capture.frames = capture.frames.filter((frame) => frame.at >= capture.onsetAt - 20 && frame.at <= capture.onsetAt + 900);
    const elapsed = audioFrame.at - capture.onsetAt;
    if (elapsed < 190 || capture.frames.length < 6) return;
    const button = accordion.basses.find((candidate) => candidate.id === capture.target.buttonId);
    if (!button) return;
    const detection = detectPracticeLeftHand(
      capture.frames,
      button,
      capture.target.direction,
      accordion.referencePitchHz ?? 440,
      leftHandProfile,
    );
    if (!detection) return;
    setHandMonitor((value) => ({
      ...value,
      left: {
        status: detection.signalQuality === 'good' ? detection.matched ? 'correct' : 'wrong' : 'uncertain',
        label: `${detection.heardLabel} · ${Math.round(detection.confidence * 100)} %`,
        confidence: detection.confidence,
        source: detection.source,
      },
    }));
    const sufficientlyReliable = detection.signalQuality === 'good' && detection.confidence >= .58;
    if (detection.matched && sufficientlyReliable) {
      capture.handled = true;
      if (!leftAssessedRef.current.has(capture.targetIndex)) {
        leftAssessedRef.current.add(capture.targetIndex);
        const targetTime = startedAtRef.current + (capture.target.beat - startBeatRef.current) * beatMs;
        const timingDelta = settings.mode === 'wait' ? 0 : capture.onsetAt - targetTime;
        const timingKind = timingDelta < -140 ? 'early' : timingDelta > 200 ? 'late' : 'correct';
        incrementResult(timingKind);
        incrementAssessment('left', timingKind);
        recordCoordination('left', capture.target.beat, capture.onsetAt);
      }
      setFeedback({
        kind: 'good',
        title: capture.target.role === 'chord' ? 'Accord main gauche reconnu' : 'Basse main gauche reconnue',
        detail: detection.source === 'personal-profile'
          ? `${detection.expectedLabel} correspond au profil acoustique enregistré de ton accordéon.`
          : `${detection.expectedLabel} est reconnue par son empreinte harmonique complète.`,
      });
      if (settings.mode === 'wait') {
        waitSatisfiedRef.current.left = true;
        completeWaitStep();
      }
      return;
    }
    if (elapsed < 420 || !sufficientlyReliable) return;
    capture.handled = true;
    if (!leftWrongRef.current.has(capture.targetIndex)) {
      leftWrongRef.current.add(capture.targetIndex);
      incrementResult('wrong');
      incrementAssessment('left', 'wrong');
    }
    setFeedback({
      kind: 'hint',
      title: capture.target.role === 'chord' ? 'Autre accord entendu à gauche' : 'Autre basse entendue à gauche',
      detail: `J’attends ${detection.expectedLabel}, mais l’empreinte ressemble à ${detection.heardLabel}. Vérifie le bouton et le sens du soufflet.`,
    });
  }, [accordion.basses, accordion.referencePitchHz, audioFrame, beatMs, completeWaitStep, incrementAssessment, incrementResult, leftHandProfile, recordCoordination, settings.mode]);

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
      if (event.code === 'Space') { event.preventDefault(); void begin(); }
      else if (key === 'r') restart();
      else if (key === 'l') setSettings((value) => ({ ...value, loop: !value.loop }));
      else if (key === 'm') setSettings((value) => ({ ...value, metronome: !value.metronome }));
      else if (key === 's') setSoundEnabled((value) => !value);
      else if (key === 'p') setShowScore((value) => !value);
      else if (key === 'd') setShowFingering((value) => !value);
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
          <label className="bellows-style-picker" title="Recalcule les boutons et les respirations pour tout le morceau">
            <Wind size={17} />
            <span><small>SOUFFLET</small><strong>{BELLOWS_STYLE_OPTIONS.find((item) => item.id === settings.bellowsStyle)?.label}</strong></span>
            <select value={settings.bellowsStyle} disabled={playing || countInBeat !== null} onChange={(event) => changeBellowsStyle(event.target.value as BellowsStyle)} aria-label="Stratégie de soufflet">
              {BELLOWS_STYLE_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label} — {option.short}</option>)}
            </select>
          </label>
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
          <button
            type="button"
            className={`tool-toggle ${showFingering ? 'is-active' : ''}`}
            disabled={settings.hand === 'left' || settings.mode === 'performance'}
            onClick={() => setShowFingering((value) => !value)}
            title="Afficher ou masquer les conseils de doigté main droite"
          >
            <Hand size={17} /> Doigté
          </button>
          <button type="button" className={`tool-toggle ${!showScore ? 'is-active' : ''}`} onClick={() => setShowScore(!showScore)}><SlidersHorizontal size={17} /> {showScore ? 'Masquer la partition' : 'Afficher la partition'}</button>
        </div>

        <section className="instrument-stage">
          {countInBeat !== null && <div className="count-in-overlay" aria-live="assertive"><small>PRÉPARE TON ACCORDÉON</small><strong>{countInBeat}</strong><p>Le morceau démarre après le dernier temps.</p><span>{countInSequence.map((beat) => <i key={beat} className={beat >= countInBeat ? 'is-counted' : ''} />)}</span></div>}
          {settings.mode !== 'performance' && (
            <AccordionInstrument
              config={accordion}
              activeEvent={sessionFinished ? undefined : displayedEvent}
              direction={currentEvent?.direction}
              notation={notation}
              detectedMidi={settings.hand === 'left' ? undefined : detectedReading?.midi}
              bellowsAmount={bellowsAmount}
              airValveActive={Boolean(currentBellowsStep?.airBefore) && !playing && countInBeat === null}
              depressActive={playing && countInBeat === null && !sessionFinished}
              showFingering={showFingering}
              context="practice"
              onButtonPress={(buttonId, direction) => {
                if (settings.mode === 'wait' && playing) {
                  const leftButton = accordion.basses.find((item) => item.id === buttonId);
                  if (leftButton) {
                    if (!waitLeftTarget) {
                      setFeedback({ kind: 'neutral', title: 'Pas de nouvelle attaque à gauche', detail: 'Maintiens l’accompagnement précédent ; seule la mélodie change sur ce repère.' });
                      return;
                    }
                    if (direction !== waitLeftTarget.direction || buttonId !== waitLeftTarget.buttonId) {
                      setFeedback({ kind: 'hint', title: 'Autre geste main gauche', detail: `Cherche ${waitLeftTarget.chord} en ${waitLeftTarget.direction === 'pull' ? 'tirant' : 'poussant'}.` });
                      return;
                    }
                    if (!leftAssessedRef.current.has(activeAccompanimentIndex)) {
                      leftAssessedRef.current.add(activeAccompanimentIndex);
                      incrementResult('correct');
                      incrementAssessment('left', 'correct');
                    }
                    waitSatisfiedRef.current.left = true;
                    setHandMonitor((value) => ({ ...value, left: { status: 'correct', label: waitLeftTarget.chord, confidence: 1 } }));
                    recordCoordination('left', waitLeftTarget.beat, performance.now());
                    completeWaitStep();
                    return;
                  }
                  if (direction !== currentEvent?.direction) {
                    setFeedback({ kind: 'hint', title: 'Bon bouton, autre direction', detail: `Ici, il faut ${currentEvent?.direction === 'pull' ? 'ouvrir et tirer' : 'fermer et pousser'} le soufflet.` });
                    return;
                  }
                  const button = accordion.buttons.find((item) => item.id === buttonId);
                  if (!button) return;
                  const midi = direction === 'push' ? button.pushMidi : button.pullMidi;
                  const note = direction === 'push' ? button.push : button.pull;
                  assessPitch(midi, note, 1, direction);
                }
              }}
            />
          )}
          {settings.mode !== 'performance' && song.bellowsPlan && (
            <div className={`bellows-reserve-status ${currentBellowsStep?.airBefore ? 'is-air-valve' : ''}`} aria-live="polite">
              <Wind size={18} />
              <span><small>RÉSERVE DU SOUFFLET</small><strong>{currentBellowsStep?.airBefore ? 'Soupape avant cette note' : bellowsAmountLabel(bellowsAmount)}</strong></span>
              <i><b style={{ width: `${bellowsAmount * 100}%` }} /></i>
              <em>{Math.round(bellowsAmount * 100)} %</em>
            </div>
          )}
        </section>

        {settings.mode !== 'performance' && settings.hand !== 'left' && showFingering && (
          <FingeringGuide
            events={practiceEvents}
            activeIndex={activeIndex}
            accordion={accordion}
            connectsToScore={showScore}
          />
        )}

        {settings.mode !== 'performance' && showScore && (
          <ScoreStrip
            song={scoreSong}
            activeIndex={activeIndex}
            notation={notation}
            hand={settings.hand}
            completed={sessionFinished}
            showFingering={settings.hand !== 'left' && showFingering}
            onSelect={(_, index) => selectIndex(index)}
          />
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
                <span><kbd>D</kbd><b>Doigté</b></span>
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
          {practiceWithMic && settings.hand !== 'right' && (
            <div className="hand-detection-panel" aria-label="Détection séparée des mains">
              {settings.hand === 'both' && <span className={`hand-detection-${handMonitor.right.status}`}><Music2 /><small>DROITE</small><b>{handMonitor.right.label}</b></span>}
              <span className={`hand-detection-${handMonitor.left.status}`}><Hand /><small>GAUCHE</small><b>{handMonitor.left.label}</b>{handMonitor.left.source === 'personal-profile' && <em>profil perso</em>}</span>
              {settings.hand === 'both' && <span className="hand-coordination"><Wind /><small>ENSEMBLE</small><b>{assessmentBreakdown.coordination.correct} synchronisé{assessmentBreakdown.coordination.correct > 1 ? 's' : ''}</b></span>}
            </div>
          )}
          {practiceWithMic && (
            <div className="mic-status">
              <span className={detectorStatus === 'listening' ? 'mic-live' : ''} />
              {detectorStatus === 'listening'
                ? settings.hand === 'left'
                  ? handMonitor.left.label
                  : detectedReading ? `${detectedReading.note} · ${Math.round(detectedReading.confidence * 100)} %` : 'Écoute…'
                : 'Micro en attente'}
            </div>
          )}
          {practiceWithMic && <div className="live-results" title="Évaluation automatique"><span><b>{results.correct}</b> justes</span><span><b>{results.early + results.late}</b> décalées</span><span><b>{results.wrong}</b> à corriger</span></div>}
          <button type="button" className="explain-button" onClick={() => setFeedback({ kind: 'neutral', title: 'Ce que j’écoute', detail: settings.hand === 'right' ? 'La main droite est reconnue par la hauteur exacte et son attaque.' : settings.hand === 'left' ? 'Une basse est reconnue par sa fondamentale ; un accord par ses trois notes et leurs harmoniques.' : 'Je sépare la hauteur mélodique de l’empreinte harmonique gauche, puis je compare les instants de leurs attaques. Un seul micro ne peut toutefois pas prouver quel bouton physique produit deux sons identiques.' })}>Pourquoi ?</button>
        </section>
      </main>

      <footer className="transport-bar">
        <div className="transport-side">
          <button type="button" className="transport-tool" onClick={restart}><Redo2 /> <span>Recommencer<kbd>R</kbd></span></button>
          <button type="button" className={`transport-tool ${settings.loop ? 'is-active' : ''}`} onClick={() => setSettings((value) => ({ ...value, loop: !value.loop }))}><Repeat2 /> <span>Boucle<kbd>L</kbd></span></button>
        </div>
        <button type="button" className="primary-play" onClick={() => { setTempoOpen(false); void begin(); }}>{playing || countInBeat !== null ? <Pause /> : <Play fill="currentColor" />}<span>{countInBeat !== null ? `Départ dans ${countInBeat}` : playing ? 'Pause' : 'Commencer'}</span><kbd>Espace</kbd></button>
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
