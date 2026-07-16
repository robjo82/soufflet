import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AudioLines, ChevronDown, CircleGauge, Expand, Flag, Gauge,
  Minimize, Pause, Play, Redo2, Repeat2, Settings2, SlidersHorizontal, TimerReset, Volume2,
} from 'lucide-react';
import { AccordionView } from './AccordionView';
import { ScoreStrip } from './ScoreStrip';
import { usePitchDetector } from '../hooks/usePitchDetector';
import { useSynth } from '../hooks/useSynth';
import type { AccordionConfig, Notation, PracticeSessionInput, PracticeSettings, Song } from '../types';
import { PRACTICE_MODES } from '../practiceModes';
import { getCountInSequence, getWaitAdvance } from '../practiceProgress';

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
    mode: 'guided', tempo: 80, countIn, metronome: false, loop: false,
    loopStart: 0, loopEnd: song.events.length - 1, notation,
  });
  const [playing, setPlaying] = useState(false);
  const [countInBeat, setCountInBeat] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeAccompanimentIndex, setActiveAccompanimentIndex] = useState(0);
  const [modeOpen, setModeOpen] = useState(false);
  const [showScore, setShowScore] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [flagged, setFlagged] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
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
  const currentEvent = song.events[activeIndex];
  const currentAccompaniment = song.accompaniment?.[activeAccompanimentIndex];
  const displayedEvent = useMemo(() => settings.mode === 'demo' && currentEvent && currentAccompaniment ? {
    ...currentEvent,
    bassButtonId: currentAccompaniment.buttonId,
    bassLabel: currentAccompaniment.chord,
  } : currentEvent, [currentAccompaniment, currentEvent, settings.mode]);
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
      startedAt,
      endedAt: new Date().toISOString(),
      activeSeconds,
      correctCount: latestResults.correct,
      earlyCount: latestResults.early,
      lateCount: latestResults.late,
      wrongCount: latestResults.wrong,
      completionPercent: completed ? 100 : Math.min(100, Math.round((maxIndexRef.current + 1) / Math.max(1, song.events.length) * 100)),
      tempoPercent: settingsRef.current.tempo,
      flagged: flaggedRef.current,
    });
  }, [activeMilliseconds, onSessionUpdate, song.events.length, song.id, song.title]);

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
    setActiveAccompanimentIndex(accompanimentIndexAt(song, song.events[index]?.beat ?? 0));
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
  }, [clearCountIn, finishActiveSegment, persistSession, resetResults, resetSessionTracking, song]);

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
    setActiveAccompanimentIndex(accompanimentIndexAt(song, song.events[nextIndex]?.beat ?? 0));
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
  }, [resetResults, resetSessionTracking, settings.loop, settings.loopStart, song, stop]);

  const startPlayback = useCallback(() => {
    clearCountIn();
    if (!sessionStartedAtRef.current) sessionStartedAtRef.current = new Date().toISOString();
    activeSegmentStartedAtRef.current = performance.now();
    startedAtRef.current = performance.now();
    startBeatRef.current = song.events[activeIndex]?.beat ?? 0;
    lastPlayedRef.current = -1;
    lastCorrectIndexRef.current = -1;
    lastAccompanimentIndexRef.current = -1;
    lastAccompanimentPlayedRef.current = -1;
    waitForReleaseRef.current = null;
    ignoreMicrophoneUntilRef.current = 0;
    setPlaying(true);
    if (practiceWithMic && detectorStatus === 'idle') void startDetector();
  }, [activeIndex, clearCountIn, detectorStatus, practiceWithMic, song.events, startDetector]);

  const begin = useCallback(() => {
    if (playing || countInBeat !== null) { stop(); return; }
    if (sessionCompletedRef.current) resetSessionTracking();
    if (!settings.countIn || sessionStartedAtRef.current) {
      startPlayback();
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
    countInTimersRef.current.push(window.setTimeout(startPlayback, countInSequence.length * beatMs));
  }, [beatMs, click, countInBeat, countInSequence, playing, resetSessionTracking, settings.countIn, soundEnabled, startPlayback, stop]);

  useEffect(() => {
    if (!practiceWithMic && detectorStatus !== 'idle') stopDetector();
  }, [detectorStatus, practiceWithMic, stopDetector]);

  useEffect(() => {
    if (!playing) return;
    if (settings.mode === 'wait') return;
    const animate = (now: number) => {
      const elapsedBeats = (now - startedAtRef.current) / beatMs;
      const beat = startBeatRef.current + elapsedBeats;
      let nextIndex = activeIndex;
      for (let i = activeIndex; i < song.events.length; i += 1) {
        if (song.events[i].beat <= beat + 0.02) nextIndex = i;
        else break;
      }
      if (nextIndex !== activeIndex) setActiveIndex(nextIndex);
      const event = song.events[nextIndex];
      if (event && lastPlayedRef.current !== nextIndex) {
        lastPlayedRef.current = nextIndex;
        if (soundEnabled && settings.mode === 'demo') {
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
      if (soundEnabled && settings.mode === 'demo' && accompaniment && lastAccompanimentPlayedRef.current !== nextAccompanimentIndex) {
        lastAccompanimentPlayedRef.current = nextAccompanimentIndex;
        playLeftHand(accompaniment.midi, accompaniment.role, accompaniment.chord, accompaniment.duration * beatMs / 1000);
      }
      const boundary = settings.loop ? settings.loopEnd : song.events.length - 1;
      const endEvent = song.events[boundary];
      if (nextIndex >= boundary && beat >= endEvent.beat + endEvent.duration) {
        if (settings.loop) {
          const loopEvent = song.events[settings.loopStart];
          setActiveIndex(settings.loopStart);
          startedAtRef.current = now;
          startBeatRef.current = loopEvent.beat;
          lastPlayedRef.current = -1;
          lastAccompanimentIndexRef.current = -1;
          lastAccompanimentPlayedRef.current = -1;
        } else {
          finishActiveSegment();
          sessionCompletedRef.current = true;
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
  }, [activeIndex, beatMs, click, finishActiveSegment, persistSession, playLeftHand, playMidi, playing, settings.loop, settings.loopEnd, settings.loopStart, settings.metronome, settings.mode, song, soundEnabled]);

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
    if (delta === 0) {
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
        const advance = getWaitAdvance(activeIndex, song.events.length, settings.loop, settings.loopStart, settings.loopEnd);
        if (advance.finished) {
          finishActiveSegment();
          sessionCompletedRef.current = true;
          void persistSession(true);
          setPlaying(false);
          setFeedback({ kind: 'good', title: 'Exercice terminé !', detail: 'Tu as trouvé toutes les notes sans limite de temps.' });
        } else {
          window.clearTimeout(waitAdvanceTimerRef.current);
          setFeedback({ kind: 'good', title: 'Bonne note, on avance', detail: `La note ${advance.nextIndex + 1} sur ${song.events.length} arrive maintenant.` });
          waitAdvanceTimerRef.current = window.setTimeout(() => {
            if (advance.looped) {
              assessedRef.current.clear();
              wrongRef.current.clear();
            }
            setActiveIndex(advance.nextIndex);
            setActiveAccompanimentIndex(accompanimentIndexAt(song, song.events[advance.nextIndex]?.beat ?? 0));
            setFeedback({
              kind: 'neutral',
              title: advance.looped ? 'La boucle recommence' : 'À la note suivante',
              detail: advance.looped ? 'Reprends depuis le début du passage.' : `Joue la note ${advance.nextIndex + 1} sur ${song.events.length}.`,
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
  }, [activeIndex, beatMs, currentEvent, finishActiveSegment, incrementResult, persistSession, playing, practiceWithMic, settings.loop, settings.loopEnd, settings.loopStart, settings.mode, song]);

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
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Space') { event.preventDefault(); begin(); }
      if (event.key.toLowerCase() === 'r') restart();
      if (event.key.toLowerCase() === 'l') setSettings((value) => ({ ...value, loop: !value.loop }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [begin, restart]);

  const closePractice = useCallback(() => {
    finishActiveSegment();
    void persistSession(sessionCompletedRef.current);
    onClose();
  }, [finishActiveSegment, onClose, persistSession]);

  const progress = useMemo(() => ((activeIndex + 1) / song.events.length) * 100, [activeIndex, song.events.length]);

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
                {PRACTICE_MODES.map((mode) => (
                  <button type="button" key={mode.id} className={settings.mode === mode.id ? 'is-selected' : ''} onClick={() => {
                    setSettings((value) => ({ ...value, mode: mode.id })); setModeOpen(false); stop(); resetSessionTracking(); resetResults();
                    lastCorrectIndexRef.current = -1;
                    waitForReleaseRef.current = null;
                    ignoreMicrophoneUntilRef.current = 0;
                    if (mode.id === 'wait') setFeedback({ kind: 'neutral', title: 'La lecture t’attend', detail: 'Appuie sur Commencer, puis joue la note éclairée. Chaque réussite affichera immédiatement la suivante.' });
                    if (mode.id === 'left' || mode.id === 'combined') setFeedback({ kind: 'neutral', title: 'Guidage visuel disponible', detail: 'La reconnaissance fiable des basses et accords simultanés est encore en validation. Le micro évalue seulement les notes isolées.' });
                  }}>
                    <span>{mode.label}</span><small>{mode.short}</small>
                  </button>
                ))}
              </div>
            )}
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
              activeEvent={displayedEvent}
              direction={currentEvent?.direction}
              notation={notation}
              detectedMidi={detectedReading?.midi}
              depressActive={playing && countInBeat === null}
              onButtonPress={(buttonId, direction) => {
                if (direction !== currentEvent?.direction) {
                  setFeedback({ kind: 'hint', title: 'Bon bouton, autre direction', detail: `Ici, il faut ${currentEvent?.direction === 'pull' ? 'ouvrir et tirer' : 'fermer et pousser'} le soufflet.` });
                  return;
                }
                if (settings.mode === 'wait' && playing) {
                  const button = accordion.buttons.find((item) => item.id === buttonId);
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
          <ScoreStrip song={song} activeIndex={activeIndex} notation={notation} onSelect={(_, index) => selectIndex(index)} />
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
        <button type="button" className="primary-play" onClick={begin}>{playing || countInBeat !== null ? <Pause /> : <Play fill="currentColor" />}<span>{countInBeat !== null ? `Départ dans ${countInBeat}` : playing ? 'Pause' : 'Commencer'}</span><kbd>Espace</kbd></button>
        <div className="transport-side align-right">
          <label className="tempo-control"><Gauge size={19} /><span>Tempo <strong>{settings.tempo} %</strong></span><input type="range" min="40" max="120" step="5" value={settings.tempo} onChange={(event) => setSettings((value) => ({ ...value, tempo: Number(event.target.value) }))} /></label>
          <button type="button" className={`transport-tool ${settings.metronome ? 'is-active' : ''}`} onClick={() => setSettings((value) => ({ ...value, metronome: !value.metronome }))}><TimerReset /><span>Métronome</span></button>
          <button type="button" className={`icon-button ${soundEnabled ? '' : 'is-active'}`} onClick={() => setSoundEnabled(!soundEnabled)} title={soundEnabled ? 'Couper le son de l’application' : 'Activer le son'}><Volume2 /></button>
          <button type="button" className="icon-button" onClick={() => setModeOpen(true)} title="Réglages du mode"><Settings2 /></button>
          <button type="button" className={`icon-button ${flagged ? 'is-active' : ''}`} title="Marquer ce passage difficile" onClick={() => { const next = !flagged; flaggedRef.current = next; setFlagged(next); setFeedback({ kind: 'neutral', title: flagged ? 'Marque retirée' : 'Passage marqué pour révision', detail: flagged ? 'Ce passage ne reviendra plus en priorité.' : 'Il sera proposé plus tôt dans une prochaine séance.' }); }}><Flag fill={flagged ? 'currentColor' : 'none'} /></button>
        </div>
      </footer>
    </div>
  );
}
