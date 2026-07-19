import {
  ArrowDown, ArrowLeft, ArrowRight, ChevronRight, Gauge, Hand, Keyboard, Mic2,
  Pause, Play, RotateCcw, Sparkles, Trophy, Volume2, X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BUTTON_GAME_LEVELS, createGameTargets, gameNoteLabel, selectGameButtons, timingGrade,
  type ButtonGameLevelId,
} from '../gameTraining';
import { usePitchDetector } from '../hooks/usePitchDetector';
import { useSynth } from '../hooks/useSynth';
import type { AccordionButton, AccordionConfig, Direction, Notation, PracticeSessionInput } from '../types';

type GamePhase = 'intro' | 'arming' | 'countdown' | 'playing' | 'paused' | 'result';
type InputMode = 'microphone' | 'touch';
type TargetGrade = 'perfect' | 'early' | 'late' | 'missed';

interface TargetResult { targetId: string; grade: TargetGrade; deltaMs: number; }

interface ButtonMemoryGameProps {
  accordion: AccordionConfig;
  notation: Notation;
  onClose: () => void;
  onSessionUpdate: (session: PracticeSessionInput) => Promise<void>;
}

const FEEDBACK: Record<TargetGrade, { title: string; detail: string }> = {
  perfect: { title: 'Pile en rythme !', detail: 'Bonne note, au bon moment.' },
  early: { title: 'Bonne note, un peu tôt', detail: 'Laisse la tuile rejoindre la ligne.' },
  late: { title: 'Bonne note, un peu tard', detail: 'Prépare le bouton juste avant la ligne.' },
  missed: { title: 'Note passée', detail: 'Regarde la prochaine tuile : la série peut repartir.' },
};

function directionCopy(direction: Direction) {
  return direction === 'push'
    ? { short: 'P', verb: 'Pousser', action: 'Fermer', icon: <ArrowRight aria-hidden="true" /> }
    : { short: 'T', verb: 'Tirer', action: 'Ouvrir', icon: <ArrowLeft aria-hidden="true" /> };
}

function laneNumber(button: AccordionButton) {
  return button.id.match(/(\d+)$/)?.[1] ?? String(button.index);
}

export function ButtonMemoryGame({ accordion, notation, onClose, onSessionUpdate }: ButtonMemoryGameProps) {
  const [levelId, setLevelId] = useState<ButtonGameLevelId>(1);
  const [inputMode, setInputMode] = useState<InputMode>('microphone');
  const [phase, setPhase] = useState<GamePhase>('intro');
  const [countdown, setCountdown] = useState(3);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [results, setResults] = useState<TargetResult[]>([]);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [feedback, setFeedback] = useState<{ kind: TargetGrade | 'wrong' | 'ready'; title: string; detail: string }>({
    kind: 'ready', title: 'Prêt ?', detail: 'Suis les tuiles jusqu’à la ligne de jeu.',
  });
  const {
    reading: detectedPitch,
    onset: detectedOnset,
    error: microphoneError,
    start: startDetector,
    stop: stopDetector,
    canOpenSettings: canOpenMicrophoneSettings,
    openSettings: openMicrophoneSettings,
  } = usePitchDetector();
  const { playMidi, click } = useSynth();
  const level = BUTTON_GAME_LEVELS.find((item) => item.id === levelId) ?? BUTTON_GAME_LEVELS[0];
  const buttons = useMemo(() => selectGameButtons(accordion, level.buttonCount), [accordion, level.buttonCount]);
  const targets = useMemo(() => createGameTargets(buttons, level), [buttons, level]);
  const currentTarget = targets[results.length];
  const baseElapsedRef = useRef(0);
  const segmentStartedAtRef = useRef(0);
  const sessionStartedAtRef = useRef('');
  const recordedRef = useRef(false);
  const lastMetronomeBeatRef = useRef(-1);
  const lastProcessedOnsetRef = useRef(0);

  const resetRun = useCallback(() => {
    setElapsedMs(0);
    baseElapsedRef.current = 0;
    setResults([]);
    setWrongAttempts(0);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setFeedback({ kind: 'ready', title: 'Prêt ?', detail: 'Suis les tuiles jusqu’à la ligne de jeu.' });
    recordedRef.current = false;
    lastMetronomeBeatRef.current = -1;
    lastProcessedOnsetRef.current = 0;
  }, []);

  const beginCountdown = useCallback(() => {
    resetRun();
    setCountdown(3);
    setPhase('countdown');
  }, [resetRun]);

  const startRun = useCallback(async () => {
    if (inputMode === 'microphone') {
      setPhase('arming');
      const ready = await startDetector();
      if (!ready) {
        setPhase('intro');
        return;
      }
    } else {
      stopDetector();
    }
    beginCountdown();
  }, [beginCountdown, inputMode, startDetector, stopDetector]);

  useEffect(() => {
    if (phase !== 'countdown') return;
    click(countdown === 3);
    if (countdown <= 1) {
      const timeout = window.setTimeout(() => {
        sessionStartedAtRef.current = new Date().toISOString();
        segmentStartedAtRef.current = performance.now();
        setPhase('playing');
      }, 720);
      return () => window.clearTimeout(timeout);
    }
    const timeout = window.setTimeout(() => setCountdown((value) => value - 1), 720);
    return () => window.clearTimeout(timeout);
  }, [click, countdown, phase]);

  useEffect(() => {
    if (phase !== 'playing') return;
    let frame = 0;
    const tick = () => {
      setElapsedMs(baseElapsedRef.current + performance.now() - segmentStartedAtRef.current);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const beatMs = 60_000 / level.bpm;
    const beat = Math.floor(Math.max(0, elapsedMs - targets[0]?.hitAtMs) / beatMs);
    if (elapsedMs >= (targets[0]?.hitAtMs ?? 0) && beat !== lastMetronomeBeatRef.current) {
      lastMetronomeBeatRef.current = beat;
      click(beat % 4 === 0);
    }
  }, [click, elapsedMs, level.bpm, phase, targets]);

  const resolveTarget = useCallback((grade: TargetGrade, deltaMs: number) => {
    if (!currentTarget) return;
    setResults((items) => [...items, { targetId: currentTarget.id, grade, deltaMs }]);
    const nextCombo = grade === 'missed' ? 0 : combo + 1;
    setCombo(nextCombo);
    setMaxCombo((value) => Math.max(value, nextCombo));
    setScore((value) => value + (grade === 'perfect' ? 100 + Math.min(combo, 10) * 5 : grade === 'missed' ? 0 : 70));
    setFeedback({ kind: grade, ...FEEDBACK[grade] });
  }, [combo, currentTarget]);

  useEffect(() => {
    if (phase === 'playing' && currentTarget && elapsedMs > currentTarget.hitAtMs + level.timingWindowMs) {
      resolveTarget('missed', elapsedMs - currentTarget.hitAtMs);
    }
  }, [currentTarget, elapsedMs, level.timingWindowMs, phase, resolveTarget]);

  const rejectAttempt = useCallback((detail: string) => {
    setWrongAttempts((value) => value + 1);
    setCombo(0);
    setFeedback({ kind: 'wrong', title: 'Pas encore', detail });
  }, []);

  const attemptMidi = useCallback((midi: number) => {
    if (phase !== 'playing' || !currentTarget) return;
    const delta = elapsedMs - currentTarget.hitAtMs;
    if (delta < -level.timingWindowMs) {
      setFeedback({ kind: 'ready', title: 'Attends la ligne', detail: 'La prochaine note arrive : prépare le geste.' });
      return;
    }
    if (midi !== currentTarget.midi) {
      rejectAttempt(`J’ai entendu une autre note. Cherche ${gameNoteLabel(currentTarget, notation)}.`);
      return;
    }
    resolveTarget(timingGrade(delta), delta);
  }, [currentTarget, elapsedMs, level.timingWindowMs, notation, phase, rejectAttempt, resolveTarget]);

  const attemptButton = useCallback((button: AccordionButton, direction: Direction) => {
    const midi = direction === 'push' ? button.pushMidi : button.pullMidi;
    playMidi(midi, .32);
    if (phase !== 'playing' || !currentTarget) return;
    const delta = elapsedMs - currentTarget.hitAtMs;
    if (delta < -level.timingWindowMs) {
      setFeedback({ kind: 'ready', title: 'Attends la ligne', detail: 'Prépare ce bouton, puis joue quand la tuile arrive.' });
      return;
    }
    if (button.id !== currentTarget.buttonId || direction !== currentTarget.direction) {
      rejectAttempt(button.id === currentTarget.buttonId
        ? `Bon bouton, mais il faut ${directionCopy(currentTarget.direction).verb.toLowerCase()}.`
        : `Cherche le bouton ${laneNumber(buttons[currentTarget.lane])} de la rangée ${buttons[currentTarget.lane].row}.`);
      return;
    }
    resolveTarget(timingGrade(delta), delta);
  }, [buttons, currentTarget, elapsedMs, level.timingWindowMs, phase, playMidi, rejectAttempt, resolveTarget]);

  useEffect(() => {
    if (phase !== 'playing' || inputMode !== 'microphone' || !detectedOnset || !detectedPitch) return;
    if (detectedPitch.confidence < .64) return;
    if (lastProcessedOnsetRef.current === detectedOnset.id) return;
    lastProcessedOnsetRef.current = detectedOnset.id;
    attemptMidi(detectedPitch.midi);
  }, [attemptMidi, detectedOnset, detectedPitch, inputMode, phase]);

  const finishRun = useCallback(() => {
    const finalElapsed = Math.max(elapsedMs, targets.at(-1)?.hitAtMs ?? elapsedMs);
    baseElapsedRef.current = finalElapsed;
    setElapsedMs(finalElapsed);
    setPhase('result');
    stopDetector();
  }, [elapsedMs, stopDetector, targets]);

  useEffect(() => {
    if (phase === 'playing' && targets.length > 0 && results.length === targets.length) finishRun();
  }, [finishRun, phase, results.length, targets.length]);

  useEffect(() => {
    if (phase !== 'result' || recordedRef.current) return;
    recordedRef.current = true;
    const endedAt = new Date().toISOString();
    const assessed = inputMode === 'microphone';
    const count = (grade: TargetGrade) => results.filter((item) => item.grade === grade).length;
    void onSessionUpdate({
      id: crypto.randomUUID(),
      songId: 'button-memory-game',
      songTitle: `Défi des touches · niveau ${level.id}`,
      mode: 'game',
      hand: 'right',
      startedAt: sessionStartedAtRef.current || endedAt,
      endedAt,
      activeSeconds: Math.max(1, Math.round(elapsedMs / 1000)),
      correctCount: assessed ? count('perfect') : 0,
      earlyCount: assessed ? count('early') : 0,
      lateCount: assessed ? count('late') : 0,
      wrongCount: assessed ? count('missed') + wrongAttempts : 0,
      completionPercent: 100,
      tempoPercent: 100,
      flagged: false,
    });
  }, [elapsedMs, inputMode, level.id, onSessionUpdate, phase, results, wrongAttempts]);

  const pause = useCallback(() => {
    if (phase === 'playing') {
      const current = baseElapsedRef.current + performance.now() - segmentStartedAtRef.current;
      baseElapsedRef.current = current;
      setElapsedMs(current);
      setPhase('paused');
    } else if (phase === 'paused') {
      segmentStartedAtRef.current = performance.now();
      setPhase('playing');
    }
  }, [phase]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && (phase === 'playing' || phase === 'paused')) {
        event.preventDefault();
        pause();
        return;
      }
      if (phase !== 'playing' || inputMode !== 'touch') return;
      const lane = Number(event.key) - 1;
      const button = buttons[lane];
      if (!button) return;
      event.preventDefault();
      attemptButton(button, event.shiftKey ? 'pull' : 'push');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [attemptButton, buttons, inputMode, pause, phase]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && phase === 'playing') pause();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [pause, phase]);

  useEffect(() => () => stopDetector(), [stopDetector]);

  const successful = results.filter((item) => item.grade !== 'missed').length;
  const accuracy = targets.length ? Math.round(successful / targets.length * 100) : 0;
  const nextLevel = BUTTON_GAME_LEVELS.find((item) => item.id === level.id + 1);
  const travelMs = 2_650;
  const visibleTargets = targets.slice(results.length).filter((target) => {
    const progress = (elapsedMs - (target.hitAtMs - travelMs)) / travelMs;
    return progress > -.16 && progress < 1.22;
  });
  const direction = currentTarget ? directionCopy(currentTarget.direction) : directionCopy('push');

  if (phase === 'intro' || phase === 'arming') {
    return (
      <main className="button-game-page game-intro-page">
        <header className="button-game-header"><button type="button" className="game-close" onClick={onClose}><X /> <span>Quitter</span></button><div className="brand-lockup"><span className="brand-mark"><i /><i /><i /></span><strong>soufflet</strong></div><span className="game-header-mode"><Sparkles /> Défi des touches</span></header>
        <div className="game-intro-shell">
          <section className="game-intro-copy">
            <span className="eyebrow"><Sparkles /> Jeu d’apprentissage · 2 min</span>
            <h1>Regarde. Prépare.<br /><em>Joue sur la ligne.</em></h1>
            <p>Les notes descendent vers tes boutons. Trouve le bon bouton, respecte pousser ou tirer, puis garde le rythme.</p>
            <div className="game-rule-list">
              <span><b>1</b><strong>Une tuile indique le bouton et la note</strong></span>
              <span><b>2</b><strong>La flèche dit s’il faut pousser ou tirer</strong></span>
              <span><b>3</b><strong>Joue quand elle touche la ligne</strong></span>
            </div>
          </section>
          <section className="game-setup-card">
            <div><span className="eyebrow">Choisis ton défi</span><h2>Une difficulté à la fois</h2></div>
            <div className="game-levels">
              {BUTTON_GAME_LEVELS.map((item) => <button type="button" key={item.id} className={levelId === item.id ? 'is-selected' : ''} onClick={() => setLevelId(item.id)}><span>{item.id}</span><div><strong>{item.title}</strong><small>{item.description}</small></div><em>{item.bpm} BPM</em></button>)}
            </div>
            <div className="game-input-title"><span className="eyebrow">Comment veux-tu répondre ?</span></div>
            <div className="game-input-options">
              <button type="button" className={inputMode === 'microphone' ? 'is-selected' : ''} onClick={() => setInputMode('microphone')}><Mic2 /><span><strong>Avec mon accordéon</strong><small>Le micro confirme la note et le rythme</small></span><b>CONSEILLÉ</b></button>
              <button type="button" className={inputMode === 'touch' ? 'is-selected' : ''} onClick={() => setInputMode('touch')}><Hand /><span><strong>Sur l’écran</strong><small>Touche le bouton P ou T qui convient</small></span></button>
            </div>
            {inputMode === 'microphone' && <p className="game-micro-note"><Mic2 /> Le micro reconnaît la hauteur. La direction du soufflet reste un repère visuel, car elle n’est pas déductible du son seul.</p>}
            {microphoneError && <div className="game-mic-error"><strong>Micro indisponible</strong><span>{microphoneError}</span>{canOpenMicrophoneSettings && <button type="button" onClick={() => void openMicrophoneSettings()}>Ouvrir les réglages</button>}<button type="button" onClick={() => setInputMode('touch')}>Continuer au toucher</button></div>}
            <footer><span><Gauge /> {level.noteCount} notes · {level.buttonCount} boutons · {accordion.model}</span><button type="button" className="primary-button" disabled={phase === 'arming'} onClick={() => void startRun()}>{phase === 'arming' ? <><Mic2 /> Préparation du micro…</> : <><Play fill="currentColor" /> Commencer</>}</button></footer>
          </section>
        </div>
      </main>
    );
  }

  if (phase === 'result') {
    const stars = accuracy >= 90 ? 3 : accuracy >= 70 ? 2 : 1;
    return (
      <main className="button-game-page game-result-page">
        <header className="button-game-header"><button type="button" className="game-close" onClick={onClose}><X /> <span>Quitter</span></button><div className="brand-lockup"><span className="brand-mark"><i /><i /><i /></span><strong>soufflet</strong></div><span className="game-header-mode"><Sparkles /> Défi terminé</span></header>
        <section className="game-result-card">
          <span className="game-trophy"><Trophy /></span>
          <span className="eyebrow">Niveau {level.id} terminé</span>
          <h1>{accuracy >= 90 ? 'Tes repères sont solides.' : accuracy >= 70 ? 'La mémoire s’installe.' : 'Une deuxième partie va aider.'}</h1>
          <div className="game-stars" aria-label={`${stars} étoiles sur 3`}>{[1, 2, 3].map((star) => <Sparkles key={star} className={star <= stars ? 'is-earned' : ''} />)}</div>
          <div className="game-result-stats"><span><small>SCORE</small><strong>{score}</strong></span><span><small>NOTES TROUVÉES</small><strong>{successful}/{targets.length}</strong></span><span><small>MEILLEURE SÉRIE</small><strong>{maxCombo}</strong></span><span><small>RÉUSSITE</small><strong>{accuracy} %</strong></span></div>
          {inputMode === 'touch' && <p className="game-result-context"><Keyboard /> Cette partie a entraîné le repérage tactile. Elle compte dans ton temps de pratique, mais pas dans la précision micro.</p>}
          <div className="game-result-actions"><button type="button" className="secondary-button" onClick={() => void startRun()}><RotateCcw /> Rejouer</button>{nextLevel && accuracy >= 70 ? <button type="button" className="primary-button" onClick={() => { setLevelId(nextLevel.id); window.setTimeout(() => void startRun(), 0); }}>Niveau {nextLevel.id} <ChevronRight /></button> : <button type="button" className="primary-button" onClick={onClose}>Retour au parcours <ChevronRight /></button>}</div>
        </section>
      </main>
    );
  }

  return (
    <main className="button-game-page game-play-page">
      <header className="button-game-header"><button type="button" className="game-close" onClick={onClose}><X /> <span>Quitter</span></button><div className="game-live-stats"><span><small>SCORE</small><strong>{score}</strong></span><span><small>SÉRIE</small><strong>× {combo}</strong></span><span><small>NOTE</small><strong>{results.length + 1}/{targets.length}</strong></span></div><button type="button" className="game-pause" onClick={pause}>{phase === 'paused' ? <Play /> : <Pause />}<span>{phase === 'paused' ? 'Reprendre' : 'Pause'}</span></button></header>
      <section className="game-stage" aria-label="Piste de notes">
        <div className={`game-direction-callout direction-${currentTarget?.direction ?? 'push'}`}><span>{direction.icon}</span><div><small>{direction.action.toUpperCase()} LE SOUFFLET</small><strong>{direction.verb}</strong></div><ArrowDown aria-hidden="true" /></div>
        <div className="game-track" style={{ '--lane-count': buttons.length } as React.CSSProperties}>
          <div className="game-lane-labels">{buttons.map((button, index) => <span key={button.id}><small>RANGÉE {button.row}</small><strong>{laneNumber(button)}</strong><kbd>{index + 1}</kbd></span>)}</div>
          <div className="game-lane-lines">{buttons.map((button) => <i key={button.id} />)}</div>
          {visibleTargets.map((target, index) => {
            const progress = (elapsedMs - (target.hitAtMs - travelMs)) / travelMs;
            const top = Math.max(-12, Math.min(86, progress * 86));
            const copy = directionCopy(target.direction);
            return <div key={target.id} className={`falling-note direction-${target.direction} ${index === 0 ? 'is-current' : ''}`} style={{ gridColumn: `${target.lane + 1} / span 1`, top: `${top}%` }}><small>{copy.icon}{copy.verb}</small><strong>{gameNoteLabel(target, notation)}</strong><em>Bouton {laneNumber(buttons[target.lane])}</em></div>;
          })}
          <div className="game-hit-line"><span>JOUE ICI</span></div>
          <div className={`game-feedback is-${feedback.kind}`} role="status" aria-live="polite"><strong>{feedback.title}</strong><span>{feedback.detail}</span></div>
        </div>
        {inputMode === 'touch' ? <div className="game-touch-pads" style={{ '--lane-count': buttons.length } as React.CSSProperties}>{buttons.map((button, index) => <div key={button.id} className={currentTarget?.buttonId === button.id ? 'is-target-lane' : ''}><span><b>{laneNumber(button)}</b><small>R{button.row} · touche {index + 1}</small></span><button type="button" className="direction-push" onPointerDown={() => attemptButton(button, 'push')}><ArrowRight /><strong>{gameNoteLabel({ note: button.push, buttonId: button.id, direction: 'push' }, notation)}</strong><small>Pousser</small></button><button type="button" className="direction-pull" onPointerDown={() => attemptButton(button, 'pull')}><ArrowLeft /><strong>{gameNoteLabel({ note: button.pull, buttonId: button.id, direction: 'pull' }, notation)}</strong><small>Tirer</small></button></div>)}</div> : <div className="game-micro-bar"><span className={`game-mic-pulse ${detectedPitch ? 'is-hearing' : ''}`}><Mic2 /></span><div><small>LE MICRO ÉCOUTE</small><strong>{detectedPitch ? `J’entends ${detectedPitch.note.replace('#', '♯')}` : 'Joue la note sur ton accordéon'}</strong></div><span className="game-confidence">{detectedPitch ? `${Math.round(detectedPitch.confidence * 100)} %` : 'signal en attente'}</span></div>}
      </section>
      {phase === 'countdown' && <div className="game-countdown" role="status"><span>{countdown}</span><strong>Prépare ton accordéon</strong></div>}
      {phase === 'paused' && <div className="game-paused"><button type="button" onClick={pause}><Play fill="currentColor" /> Reprendre</button><span>La partie est en pause, ton temps aussi.</span></div>}
      <div className="game-audio-hint"><Volume2 /> Métronome actif à {level.bpm} BPM</div>
    </main>
  );
}
