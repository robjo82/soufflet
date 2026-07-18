import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight, AudioLines, Check, ChevronDown, CircleGauge, Gauge, Headphones,
  Mic2, MoveHorizontal, Play, Repeat2, RotateCcw, Sparkles, TimerReset,
} from 'lucide-react';
import type { AccordionConfig, Direction, Notation, PracticeMode, Song, SongEvent } from '../types';
import {
  classifyBellows, createBellowsReference, evaluateRhythm, midiMatches, readBellowsProfiles,
  removeBellowsProfile, saveBellowsProfile,
  type AudioFeatureFrame, type BellowsDetection, type BellowsProfile, type BellowsReference,
} from '../audioTraining';
import { PRACTICE_MODES } from '../practiceModes';
import { TUTORIAL_MODE_TRIALS } from '../tutorialFlow';
import { usePitchDetector } from '../hooks/usePitchDetector';
import { useSynth } from '../hooks/useSynth';
import { AccordionView } from './AccordionView';
import { ScoreStrip } from './ScoreStrip';
import { MicrophoneRecovery } from './MicrophoneRecovery';

interface FirstLessonTutorialProps {
  accordion: AccordionConfig;
  notation: Notation;
  song: Song;
  onNotationChange: (notation: Notation) => void;
  onComplete: () => void;
}

interface TutorialDraft {
  stage: number;
  guidedProgress: number;
  modeIndex: number;
  modeProgress: number;
  completedModes: PracticeMode[];
  tourStep: number;
}

const DRAFT_KEY = 'soufflet.firstLessonTutorial';
const CHAPTERS = ['Découvrir', 'Écouter', 'Jouer', 'Essayer les modes', 'Visiter l’interface'];

function readDraft(): TutorialDraft | null {
  try {
    const value = localStorage.getItem(DRAFT_KEY);
    return value ? JSON.parse(value) as TutorialDraft : null;
  } catch {
    return null;
  }
}

export function FirstLessonTutorial({ accordion, notation, song, onNotationChange, onComplete }: FirstLessonTutorialProps) {
  const initialDraft = useMemo(readDraft, []);
  const [stage, setStage] = useState(() => Math.min(4, Math.max(0, initialDraft?.stage ?? 0)));
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeAccompanimentIndex, setActiveAccompanimentIndex] = useState(0);
  const [demoPlaying, setDemoPlaying] = useState(false);
  const [demoDone, setDemoDone] = useState(() => (initialDraft?.stage ?? 0) > 1);
  const [guidedProgress, setGuidedProgress] = useState(initialDraft?.guidedProgress ?? 0);
  const [modeIndex, setModeIndex] = useState(initialDraft?.modeIndex ?? 2);
  const [modeProgress, setModeProgress] = useState(initialDraft?.modeProgress ?? 0);
  const [completedModes, setCompletedModes] = useState<Set<PracticeMode>>(
    () => new Set(initialDraft?.completedModes ?? ['demo', 'guided']),
  );
  const [tourStep, setTourStep] = useState(initialDraft?.tourStep ?? 0);
  const [tempo, setTempo] = useState(80);
  const [looped, setLooped] = useState(false);
  const [feedback, setFeedback] = useState({
    good: false,
    title: 'Je te guide pas à pas',
    detail: 'Une seule chose nouvelle apparaît à la fois.',
  });
  const timersRef = useRef<number[]>([]);
  const heldMidiRef = useRef<number | null>(null);
  const rhythmTimesRef = useRef<number[]>([]);
  const lastOnsetIdRef = useRef(0);
  const bellowsFramesRef = useRef<AudioFeatureFrame[]>([]);
  const bellowsReferencesRef = useRef<Partial<Record<Direction, BellowsReference>>>({});
  const bellowsCandidateRef = useRef<{ direction: Direction | null; frames: number }>({ direction: null, frames: 0 });
  const lastBellowsDirectionRef = useRef<Direction | null>(null);
  const [bellowsProfile, setBellowsProfile] = useState<BellowsProfile | null>(() => readBellowsProfiles()[accordion.id] ?? null);
  const [bellowsCaptureDirection, setBellowsCaptureDirection] = useState<Direction | null>(null);
  const [bellowsCaptureState, setBellowsCaptureState] = useState<'idle' | 'countdown' | 'recording'>('idle');
  const [bellowsCountdown, setBellowsCountdown] = useState(3);
  const [bellowsDetection, setBellowsDetection] = useState<BellowsDetection | null>(null);
  const detector = usePitchDetector();
  const { playMidi, playLeftHand } = useSynth();
  const tutorialSong = useMemo(() => ({
    ...song,
    id: `${song.id}-tutorial`,
    events: song.events.slice(0, 3),
    accompaniment: song.accompaniment?.filter((event) => event.beat < 3),
  }), [song]);
  const events = tutorialSong.events;
  const currentTrial = TUTORIAL_MODE_TRIALS[modeIndex];
  const expectedBassButton = accordion.basses.find((button) => button.role === 'bass') ?? accordion.basses[0];
  const expectedBassId = expectedBassButton?.id;
  const calibrationButton = useMemo(() => {
    const profileButton = accordion.buttons.find((button) => button.id === bellowsProfile?.buttonId);
    const songButton = accordion.buttons.find((button) => button.id === events[0]?.buttonId && button.pushMidi !== button.pullMidi && !button.isGleichton);
    return profileButton ?? songButton ?? accordion.buttons.find((button) => button.pushMidi !== button.pullMidi && !button.isGleichton) ?? accordion.buttons[0];
  }, [accordion.buttons, bellowsProfile?.buttonId, events]);
  const guidedDone = guidedProgress >= events.length;
  const modeFinished = currentTrial ? completedModes.has(currentTrial.id) : false;

  useEffect(() => {
    const draft: TutorialDraft = {
      stage,
      guidedProgress,
      modeIndex,
      modeProgress,
      completedModes: [...completedModes],
      tourStep,
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [completedModes, guidedProgress, modeIndex, modeProgress, stage, tourStep]);

  useEffect(() => () => timersRef.current.forEach((timer) => window.clearTimeout(timer)), []);

  const goToStage = (next: number) => {
    heldMidiRef.current = null;
    rhythmTimesRef.current = [];
    lastBellowsDirectionRef.current = null;
    setStage(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const playDemo = () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
    setDemoPlaying(true);
    setDemoDone(false);
    setActiveIndex(0);
    setFeedback({ good: false, title: 'Écoute et regarde', detail: 'Le bouton, la note et le soufflet changent ensemble.' });
    events.forEach((event, index) => {
      const timer = window.setTimeout(() => {
        setActiveIndex(index);
        playMidi(event.midi, .58, .12);
        const accompanimentIndex = tutorialSong.accompaniment?.findIndex((item) => item.beat === event.beat) ?? -1;
        const accompaniment = accompanimentIndex >= 0 ? tutorialSong.accompaniment?.[accompanimentIndex] : undefined;
        if (accompaniment) {
          setActiveAccompanimentIndex(accompanimentIndex);
          playLeftHand(accompaniment.midi, accompaniment.role, accompaniment.chord, .5);
        }
      }, index * 720);
      timersRef.current.push(timer);
    });
    const ending = window.setTimeout(() => {
      setDemoPlaying(false);
      setDemoDone(true);
      setFeedback({ good: true, title: 'Tu as vu toute la mélodie', detail: 'Trois notes, jouées une par une. Maintenant, nous allons les retrouver ensemble.' });
    }, events.length * 720 + 250);
    timersRef.current.push(ending);
  };

  const markModeComplete = useCallback((mode: PracticeMode, detail: string) => {
    setCompletedModes((current) => new Set([...current, mode]));
    setFeedback({ good: true, title: 'Mode validé', detail });
  }, []);

  const submitMelody = useCallback((midi: number, direction?: Direction) => {
    if (!events.length) return;
    if (stage === 2) {
      if (guidedDone) return;
      const expected = events[guidedProgress];
      if (midi !== expected.midi) {
        setFeedback({ good: false, title: midi < expected.midi ? 'Cette note est trop grave' : 'Cette note est trop aiguë', detail: 'Cherche le bouton éclairé et garde le soufflet dans la direction indiquée.' });
        return;
      }
      if (direction && direction !== expected.direction) {
        setFeedback({ good: false, title: 'Bon bouton, autre direction', detail: `Ici, il faut ${expected.direction === 'pull' ? 'tirer et ouvrir' : 'pousser et fermer'} le soufflet.` });
        return;
      }
      const next = guidedProgress + 1;
      setGuidedProgress(next);
      setActiveIndex(Math.min(next, events.length - 1));
      if (next >= events.length) {
        setFeedback({ good: true, title: 'Mélodie réussie !', detail: 'Les trois hauteurs sont justes. Le tutoriel peut maintenant te montrer les autres façons de travailler.' });
      } else {
        setFeedback({ good: true, title: 'Bonne note', detail: `Encore ${events.length - next} ${events.length - next === 1 ? 'note' : 'notes'}. Regarde le prochain bouton.` });
      }
      return;
    }

    if (stage !== 3 || !currentTrial || modeFinished) return;
    if (!['melody', 'combined', 'memory'].includes(currentTrial.task)) {
      setFeedback({ good: false, title: 'Pas encore', detail: currentTrial.instruction });
      return;
    }
    if (currentTrial.task === 'combined' && modeProgress === 0) {
      setFeedback({ good: false, title: 'Commence par la basse', detail: 'La coordination se construit dans cet ordre : main gauche, puis main droite.' });
      return;
    }
    const expected = currentTrial.task === 'memory' ? events[Math.min(modeProgress, events.length - 1)] : events[0];
    if (midi !== expected.midi) {
      setFeedback({ good: false, title: 'Ce n’est pas encore la bonne note', detail: currentTrial.task === 'memory' ? 'Repars de la première note de la petite mélodie.' : 'Essaie le bouton attendu une nouvelle fois.' });
      if (currentTrial.task === 'memory') setModeProgress(0);
      return;
    }
    if (direction && currentTrial.task !== 'memory' && direction !== expected.direction) {
      setFeedback({ good: false, title: 'La note est bonne, pas le soufflet', detail: `Utilise la direction ${expected.direction === 'pull' ? 'tirer' : 'pousser'}.` });
      return;
    }
    if (currentTrial.task === 'memory') {
      const next = modeProgress + 1;
      setModeProgress(next);
      if (next >= events.length) markModeComplete(currentTrial.id, 'Tu as retrouvé les trois notes sans touche éclairée.');
      else setFeedback({ good: true, title: 'Bien mémorisé', detail: `Il reste ${events.length - next} ${events.length - next === 1 ? 'note' : 'notes'}.` });
      return;
    }
    markModeComplete(currentTrial.id, currentTrial.task === 'combined' ? 'La basse puis la mélodie sont parties dans le bon ordre.' : 'La note attendue a été reconnue.');
  }, [currentTrial, events, guidedDone, guidedProgress, markModeComplete, modeFinished, modeProgress, stage]);

  const submitBass = useCallback((buttonId: string) => {
    if (stage !== 3 || !currentTrial || !['bass', 'combined'].includes(currentTrial.task) || modeFinished) return;
    if (buttonId !== expectedBassId) {
      setFeedback({ good: false, title: 'Essaie la basse éclairée', detail: 'Sur la main gauche, commence par le bouton situé en haut de la grille.' });
      return;
    }
    if (currentTrial.task === 'bass') {
      markModeComplete(currentTrial.id, 'Tu sais maintenant isoler une basse de la main gauche.');
      return;
    }
    setModeProgress(1);
    setFeedback({ good: true, title: 'Basse correcte', detail: 'Maintenant, joue la note éclairée avec la main droite.' });
  }, [currentTrial, expectedBassId, markModeComplete, modeFinished, stage]);

  const handleButtonPress = (buttonId: string, direction: Direction) => {
    if (stage === 3 && detector.status !== 'denied' && detector.status !== 'error') {
      setFeedback({ good: false, title: 'Essaie sur ton accordéon', detail: 'Le dessin sert à écouter et à repérer le bouton. Seul le son du vrai instrument valide ce mini-défi.' });
      return;
    }
    if (accordion.basses.some((button) => button.id === buttonId)) {
      submitBass(buttonId);
      return;
    }
    const button = accordion.buttons.find((item) => item.id === buttonId);
    if (!button) return;
    submitMelody(direction === 'push' ? button.pushMidi : button.pullMidi, direction);
  };

  const chooseBellows = useCallback((direction: Direction) => {
    if (currentTrial?.task !== 'bellows' || modeFinished) return;
    const expected: Direction = modeProgress === 0 ? 'push' : 'pull';
    if (direction !== expected) {
      setFeedback({ good: false, title: `Commence par ${expected === 'push' ? 'pousser' : 'tirer'}`, detail: 'Le mode soufflet évalue la direction avant la hauteur.' });
      return;
    }
    const next = modeProgress + 1;
    setModeProgress(next);
    if (next >= 2) markModeComplete(currentTrial.id, 'Le micro a reconnu fermer puis ouvrir dans le bon ordre.');
    else setFeedback({ good: true, title: 'Pousser reconnu', detail: 'Relâche le bouton un instant, puis tire en tenant le même bouton.' });
  }, [currentTrial, markModeComplete, modeFinished, modeProgress]);

  const finishBellowsCapture = useCallback((direction: Direction) => {
    const reference = createBellowsReference(direction, bellowsFramesRef.current);
    setBellowsCaptureState('idle');
    setBellowsCaptureDirection(null);
    if (!reference) {
      setFeedback({ good: false, title: 'Son trop court ou trop faible', detail: 'Garde le bouton enfoncé pendant tout l’enregistrement et fais un mouvement régulier.' });
      return;
    }
    bellowsReferencesRef.current[direction] = reference;
    const push = bellowsReferencesRef.current.push;
    const pull = bellowsReferencesRef.current.pull;
    if (!push || !pull) {
      setFeedback({ good: true, title: 'Pousser enregistré', detail: 'Nous avons gardé seulement sa signature acoustique. Enregistre maintenant tirer avec le même bouton.' });
      return;
    }
    if (push.midi === pull.midi && Math.abs(push.frequency - pull.frequency) < 8) {
      bellowsReferencesRef.current = {};
      setFeedback({ good: false, title: 'Les deux références se ressemblent trop', detail: 'Vérifie que tu as bien fermé pour pousser, puis ouvert pour tirer, toujours avec le bouton indiqué.' });
      return;
    }
    const profile: BellowsProfile = {
      accordionId: accordion.id,
      buttonId: calibrationButton.id,
      createdAt: new Date().toISOString(),
      push,
      pull,
    };
    saveBellowsProfile(profile);
    setBellowsProfile(profile);
    setFeedback({ good: true, title: 'Soufflet calibré', detail: 'Le micro peut maintenant comparer ce qu’il entend à tes deux références.' });
  }, [accordion.id, calibrationButton.id]);

  const startBellowsCapture = (direction: Direction) => {
    bellowsFramesRef.current = [];
    setBellowsCaptureDirection(direction);
    setBellowsCaptureState('countdown');
    setBellowsCountdown(3);
    [2, 1].forEach((value, index) => {
      timersRef.current.push(window.setTimeout(() => setBellowsCountdown(value), (index + 1) * 800));
    });
    timersRef.current.push(window.setTimeout(() => {
      setBellowsCountdown(0);
      setBellowsCaptureState('recording');
    }, 2400));
    timersRef.current.push(window.setTimeout(() => finishBellowsCapture(direction), 4400));
  };

  const recalibrateBellows = () => {
    removeBellowsProfile(accordion.id);
    bellowsReferencesRef.current = {};
    lastBellowsDirectionRef.current = null;
    setBellowsProfile(null);
    setBellowsDetection(null);
    setModeProgress(0);
    setFeedback({ good: false, title: 'Recalibrage du soufflet', detail: 'Nous allons réenregistrer pousser puis tirer, sans conserver le son brut.' });
  };

  useEffect(() => {
    if (bellowsCaptureState === 'recording' && detector.audioFrame) bellowsFramesRef.current.push(detector.audioFrame);
  }, [bellowsCaptureState, detector.audioFrame]);

  useEffect(() => {
    const reading = detector.reading;
    if (!reading || reading.confidence < .72 || ![2, 3].includes(stage)) {
      if (!reading) heldMidiRef.current = null;
      return;
    }
    if (heldMidiRef.current === reading.midi) return;
    heldMidiRef.current = reading.midi;
    if (stage === 2) {
      submitMelody(reading.midi);
      return;
    }
    if (!currentTrial || ['rhythm', 'bellows'].includes(currentTrial.task)) return;
    if ((currentTrial.task === 'bass' || (currentTrial.task === 'combined' && modeProgress === 0)) && expectedBassButton) {
      const direction = events[0]?.direction ?? 'push';
      const expectedMidi = direction === 'push' ? expectedBassButton.pushMidi : expectedBassButton.pullMidi;
      if (midiMatches(expectedMidi, reading.midi)) submitBass(expectedBassButton.id);
      else setFeedback({ good: false, title: 'La basse attendue n’est pas encore reconnue', detail: 'Joue seulement le bouton de basse éclairé, sans la main droite, puis laisse le son s’arrêter.' });
      return;
    }
    submitMelody(reading.midi);
  }, [currentTrial, detector.reading, events, expectedBassButton, modeProgress, stage, submitBass, submitMelody]);

  useEffect(() => {
    const onset = detector.onset;
    if (stage !== 3 || currentTrial?.task !== 'rhythm' || modeFinished || !onset || onset.id === lastOnsetIdRef.current) return;
    lastOnsetIdRef.current = onset.id;
    const times = [...rhythmTimesRef.current, onset.at];
    rhythmTimesRef.current = times;
    setModeProgress(times.length);
    if (times.length < 4) {
      setFeedback({ good: true, title: `Attaque ${times.length} sur 4 entendue`, detail: 'Continue sur ton accordéon en gardant le même espace.' });
      return;
    }
    const result = evaluateRhythm(times);
    if (result.regular) markModeComplete(currentTrial.id, `Quatre attaques régulières reconnues à environ ${Math.round(60_000 / result.averageInterval)} BPM.`);
    else {
      rhythmTimesRef.current = [];
      setModeProgress(0);
      setFeedback({ good: false, title: 'Le micro a entendu quatre notes, mais elles sont irrégulières', detail: 'Recommence plus lentement : joue, attends, joue, attends, toujours avec le même espace.' });
    }
  }, [currentTrial, detector.onset, markModeComplete, modeFinished, stage]);

  useEffect(() => {
    const frame = detector.audioFrame;
    if (stage !== 3 || currentTrial?.task !== 'bellows' || modeFinished || !bellowsProfile || bellowsCaptureState !== 'idle' || !frame) return;
    const detection = classifyBellows(frame, bellowsProfile);
    setBellowsDetection(detection);
    if (!detection.direction) {
      if (!frame.pitch || frame.volume < .008) lastBellowsDirectionRef.current = null;
      bellowsCandidateRef.current = { direction: null, frames: 0 };
      return;
    }
    const candidate = bellowsCandidateRef.current;
    bellowsCandidateRef.current = candidate.direction === detection.direction
      ? { direction: detection.direction, frames: candidate.frames + 1 }
      : { direction: detection.direction, frames: 1 };
    if (bellowsCandidateRef.current.frames < 3 || lastBellowsDirectionRef.current === detection.direction) return;
    lastBellowsDirectionRef.current = detection.direction;
    bellowsCandidateRef.current = { direction: null, frames: 0 };
    chooseBellows(detection.direction);
  }, [bellowsCaptureState, bellowsProfile, chooseBellows, currentTrial, detector.audioFrame, modeFinished, stage]);

  const advanceMode = () => {
    heldMidiRef.current = null;
    rhythmTimesRef.current = [];
    lastOnsetIdRef.current = detector.onset?.id ?? 0;
    lastBellowsDirectionRef.current = null;
    setBellowsDetection(null);
    setModeProgress(0);
    if (modeIndex >= TUTORIAL_MODE_TRIALS.length - 1) {
      goToStage(4);
      return;
    }
    const nextIndex = modeIndex + 1;
    setModeIndex(nextIndex);
    setFeedback({ good: false, title: TUTORIAL_MODE_TRIALS[nextIndex].title, detail: TUTORIAL_MODE_TRIALS[nextIndex].instruction });
  };

  const activeEvent = useMemo<SongEvent | undefined>(() => {
    if (!events.length) return undefined;
    if (stage === 1) {
      const event = events[activeIndex];
      const accompaniment = tutorialSong.accompaniment?.[activeAccompanimentIndex];
      return event && accompaniment ? { ...event, bassButtonId: accompaniment.buttonId, bassLabel: accompaniment.chord } : event;
    }
    if (stage === 2) return events[Math.min(guidedProgress, events.length - 1)];
    if (stage !== 3 || !currentTrial) return events[0];
    if (currentTrial.task === 'memory' || currentTrial.task === 'rhythm') return undefined;
    if (currentTrial.task === 'bellows' && calibrationButton) {
      const direction = bellowsCaptureDirection ?? (modeProgress === 0 ? 'push' : 'pull');
      return {
        ...events[0],
        buttonId: calibrationButton.id,
        direction,
        midi: direction === 'push' ? calibrationButton.pushMidi : calibrationButton.pullMidi,
        note: direction === 'push' ? calibrationButton.push : calibrationButton.pull,
      };
    }
    if (currentTrial.task === 'bass' || (currentTrial.task === 'combined' && modeProgress === 0)) {
      return { ...events[0], buttonId: '', bassButtonId: expectedBassId, bassLabel: 'B' };
    }
    return events[0];
  }, [activeAccompanimentIndex, activeIndex, bellowsCaptureDirection, calibrationButton, currentTrial, events, expectedBassId, guidedProgress, modeProgress, stage, tutorialSong.accompaniment]);

  const visualDirection: Direction = currentTrial?.task === 'bellows'
    ? (bellowsCaptureDirection ?? (modeProgress === 0 ? 'push' : 'pull'))
    : activeEvent?.direction ?? events[0]?.direction ?? 'push';

  const finishTutorial = () => {
    localStorage.removeItem(DRAFT_KEY);
    detector.stop();
    onComplete();
  };

  const tour = [
    { title: 'Choisis une façon de travailler', detail: 'Le sélecteur de mode adapte immédiatement les aides et ce que le micro évalue.' },
    { title: 'Garde la notation qui te parle', detail: 'Tu peux afficher Do/Ré, A/B/C ou la tablature pousser/tirer.' },
    { title: 'Repars de n’importe quelle note', detail: 'La partition est interactive : touche une note pour placer la lecture dessus.' },
    { title: 'Répète un passage difficile', detail: 'La boucle évite de rechercher manuellement le même endroit.' },
    { title: 'Commence lentement', detail: 'Le tempo se règle sans changer la hauteur. Monte seulement quand le geste est stable.' },
    { title: 'Tu sais lancer une séance', detail: 'Espace démarre, R recommence et L active la boucle. Le plein écran reste disponible en haut.' },
  ];

  return (
    <div className={`first-lesson-tutorial tutorial-stage-${stage}`}>
      <header className="tutorial-header">
        <span className="brand-lockup"><span className="brand-mark"><i /><i /><i /></span><strong>soufflet</strong></span>
        <ol aria-label="Progression du tutoriel">
          {CHAPTERS.map((chapter, index) => <li key={chapter} className={index < stage ? 'is-done' : index === stage ? 'is-current' : ''}><i>{index < stage ? <Check /> : index + 1}</i><span>{chapter}</span></li>)}
        </ol>
        <span className="tutorial-counter">Première leçon · {Math.min(stage + 1, CHAPTERS.length)}/{CHAPTERS.length}</span>
      </header>

      {stage === 0 && (
        <main className="tutorial-intro">
          <section>
            <span className="eyebrow"><Sparkles /> Ta première réussite</span>
            <h1>Écoute d’abord.<br /><em>Joue ensuite.</em></h1>
            <p>Nous allons apprendre trois notes très simples. Les commandes apparaîtront seulement quand elles deviendront utiles.</p>
            <div className="tutorial-promises"><span><Headphones /> Une mélodie de trois notes</span><span><Mic2 /> Une validation automatique</span><span><Check /> Aucun solfège nécessaire</span></div>
            <button type="button" className="primary-button tutorial-main-action" onClick={() => goToStage(1)}>Commencer par écouter <ArrowRight /></button>
          </section>
          <div className="tutorial-intro-instrument"><AccordionView config={accordion} notation={notation} direction="push" compact /></div>
        </main>
      )}

      {(stage === 1 || stage === 2) && (
        <main className="tutorial-lesson">
          <section className="tutorial-instruction-card">
            <span className="eyebrow">{stage === 1 ? '1. Regarde et écoute' : '2. À ton tour'}</span>
            <h1>{stage === 1 ? 'Une toute petite mélodie.' : 'Retrouve les trois notes.'}</h1>
            <p>{stage === 1 ? 'Observe la mélodie à droite, puis la basse et l’accord qui alternent à gauche. Le soufflet relie les deux mains.' : 'Joue sur ton accordéon : le micro avance tout seul quand la note est juste. Le dessin sert à écouter et à trouver le bon bouton.'}</p>
            {stage === 2 && <div className="guided-note-progress">{events.map((event, index) => <span key={event.id} className={index < guidedProgress ? 'is-done' : index === guidedProgress ? 'is-current' : ''}>{index < guidedProgress ? <Check /> : index + 1}</span>)}</div>}
            {stage === 1 && <button type="button" className="primary-button" disabled={demoPlaying} onClick={playDemo}><Play fill="currentColor" /> {demoPlaying ? 'La mélodie joue…' : demoDone ? 'Réécouter' : 'Écouter la mélodie'}</button>}
            {stage === 2 && detector.status === 'idle' && <button type="button" className="secondary-button" onClick={() => void detector.start()}><Mic2 /> Activer l’écoute</button>}
            {stage === 2 && detector.status === 'requesting' && <span className="tutorial-mic-state"><Mic2 /> Autorise le microphone…</span>}
            {stage === 2 && detector.status === 'listening' && <span className="tutorial-mic-state is-live"><i /> Micro en écoute {detector.reading && `· ${detector.reading.note}`}</span>}
            {stage === 2 && (detector.status === 'denied' || detector.status === 'error') && (
              <MicrophoneRecovery
                error={detector.error}
                canOpenSettings={detector.canOpenSettings}
                detail="Une fois l’autorisation accordée, Soufflet avancera à nouveau tout seul."
                onOpenSettings={() => void detector.openSettings()}
                onRetry={() => void detector.start()}
              />
            )}
          </section>
          <section className="tutorial-instrument-card">
            <AccordionView config={accordion} activeEvent={activeEvent} direction={activeEvent?.direction} notation={notation} detectedMidi={detector.reading?.midi} depressActive={stage === 1 && demoPlaying} onButtonPress={handleButtonPress} />
          </section>
          {stage === 2 && <div className="tutorial-score"><ScoreStrip song={tutorialSong} activeIndex={Math.min(guidedProgress, events.length - 1)} notation={notation} onSelect={() => undefined} /></div>}
          <section className={`tutorial-feedback ${feedback.good ? 'is-good' : ''}`} aria-live="polite"><AudioLines /><span><small>TON PROFESSEUR</small><strong>{feedback.title}</strong><p>{feedback.detail}</p></span></section>
          <footer className="tutorial-lesson-footer">
            {stage === 1 && <button type="button" className="primary-button" disabled={!demoDone} onClick={() => { setFeedback({ good: false, title: 'À toi de jouer', detail: 'Commence par la première note éclairée.' }); goToStage(2); }}>À moi de jouer <ArrowRight /></button>}
            {stage === 2 && <button type="button" className="primary-button" disabled={!guidedDone} onClick={() => { if (detector.status === 'idle') void detector.start(); setFeedback({ good: false, title: TUTORIAL_MODE_TRIALS[2].title, detail: TUTORIAL_MODE_TRIALS[2].instruction }); goToStage(3); }}>Découvrir les modes <ArrowRight /></button>}
          </footer>
        </main>
      )}

      {stage === 3 && currentTrial && (
        <main className="tutorial-modes">
          <aside className="tutorial-mode-rail">
            <span className="eyebrow">Tous les modes</span>
            <h1>Essaie-les une fois.</h1>
            <p>Chaque essai se joue sur ton accordéon. Le dessin montre où agir, le micro valide ce qu’il entend.</p>
            <ol>{TUTORIAL_MODE_TRIALS.map((trial, index) => <li key={trial.id} className={completedModes.has(trial.id) ? 'is-done' : index === modeIndex ? 'is-current' : ''}><i>{completedModes.has(trial.id) ? <Check /> : index + 1}</i><span><strong>{trial.title}</strong><small>{PRACTICE_MODES.find((mode) => mode.id === trial.id)?.short}</small></span></li>)}</ol>
          </aside>
          <section className="tutorial-mode-workspace">
            <header><span className="eyebrow">Mode {modeIndex + 1} sur {TUTORIAL_MODE_TRIALS.length}</span><h2>{currentTrial.title}</h2><p>{currentTrial.explanation}</p><div className="tutorial-task"><CircleGauge /><span><small>TON MINI-DÉFI</small><strong>{currentTrial.instruction}</strong></span></div></header>
            <div className={`tutorial-mode-instrument ${currentTrial.task === 'memory' ? 'is-performance' : ''}`}>
              <AccordionView config={accordion} activeEvent={activeEvent} direction={visualDirection} notation={notation} detectedMidi={detector.reading?.midi} onButtonPress={handleButtonPress} />
              {currentTrial.task === 'rhythm' && <div className="rhythm-listen-card"><TimerReset /><span><small>LE MICRO COMPTE LES ATTAQUES</small><strong>Joue quatre notes courtes</strong><p>N’importe quelle note, avec un silence bref entre chacune.</p></span><b>{Array.from({ length: 4 }).map((_, index) => <i key={index} className={index < modeProgress ? 'is-done' : ''}>{index < modeProgress ? <Check /> : index + 1}</i>)}</b></div>}
              {currentTrial.task === 'bellows' && <div className="bellows-listen-card">{!bellowsProfile ? <><header><MoveHorizontal /><span><small>CALIBRATION PERSONNELLE</small><strong>Tiens le bouton {calibrationButton.index} pendant chaque mouvement</strong><p>Le son n’est jamais conservé : seules quelques mesures acoustiques restent sur cet appareil.</p></span></header><div className="bellows-record-actions"><button type="button" className={bellowsReferencesRef.current.push ? 'is-done' : ''} disabled={detector.status !== 'listening' || bellowsCaptureState !== 'idle' || Boolean(bellowsReferencesRef.current.push)} onClick={() => startBellowsCapture('push')}>{bellowsReferencesRef.current.push ? <Check /> : <span>1</span>} Fermer · pousser</button><button type="button" className={bellowsReferencesRef.current.pull ? 'is-done' : ''} disabled={detector.status !== 'listening' || bellowsCaptureState !== 'idle' || !bellowsReferencesRef.current.push} onClick={() => startBellowsCapture('pull')}>{bellowsReferencesRef.current.pull ? <Check /> : <span>2</span>} Ouvrir · tirer</button></div>{bellowsCaptureState !== 'idle' && <div className={`bellows-recording-state ${bellowsCaptureState}`}><i />{bellowsCaptureState === 'countdown' ? `Prépare-toi… ${bellowsCountdown}` : `Enregistrement ${bellowsCaptureDirection === 'push' ? 'pousser' : 'tirer'}…`}</div>}</> : <><header><MoveHorizontal /><span><small>DÉTECTION EN DIRECT</small><strong>{modeProgress === 0 ? 'Ferme le soufflet en poussant' : 'Ouvre le soufflet en tirant'}</strong><p>Garde le bouton {calibrationButton.index} enfoncé, puis relâche-le entre les deux gestes.</p></span></header><div className={`bellows-live-result ${bellowsDetection?.direction ? 'has-direction' : ''}`}><span>{bellowsDetection?.direction === 'push' ? 'P →' : bellowsDetection?.direction === 'pull' ? '← T' : '…'}</span><div><strong>{bellowsDetection?.direction === 'push' ? 'Pousser entendu' : bellowsDetection?.direction === 'pull' ? 'Tirer entendu' : bellowsDetection?.reason === 'ambiguous' ? 'Signal ambigu' : 'Joue quand tu es prêt'}</strong><small>{bellowsDetection?.direction ? `Confiance ${Math.round(bellowsDetection.confidence * 100)} %` : 'Le micro attend une note stable.'}</small></div><button type="button" onClick={recalibrateBellows} aria-label="Recalibrer le soufflet"><RotateCcw /></button></div></>}</div>}
            </div>
            {detector.status === 'idle' && currentTrial.task !== 'already-done' && <button type="button" className="primary-button tutorial-start-mic" onClick={() => void detector.start()}><Mic2 /> Activer le micro pour jouer ce mode</button>}
            {detector.status === 'requesting' && <span className="tutorial-mic-state"><Mic2 /> Autorise le microphone…</span>}
            {detector.status === 'listening' && currentTrial.task !== 'already-done' && <span className="tutorial-mic-state is-live"><i /> Ton accordéon est écouté {detector.reading && `· ${detector.reading.note}`}</span>}
            {(detector.status === 'denied' || detector.status === 'error') && (
              <MicrophoneRecovery
                error={detector.error}
                canOpenSettings={detector.canOpenSettings}
                detail="Réactive-le pour obtenir la validation acoustique de l’exercice."
                onOpenSettings={() => void detector.openSettings()}
                onRetry={() => void detector.start()}
              />
            )}
            <section className={`tutorial-feedback ${feedback.good ? 'is-good' : ''}`} aria-live="polite"><AudioLines /><span><small>VALIDATION AUTOMATIQUE</small><strong>{feedback.title}</strong><p>{feedback.detail}</p></span></section>
            <footer><button type="button" className="primary-button" disabled={!modeFinished} onClick={advanceMode}>{modeIndex === TUTORIAL_MODE_TRIALS.length - 1 ? 'Visiter l’interface' : 'Mode suivant'} <ArrowRight /></button></footer>
          </section>
        </main>
      )}

      {stage === 4 && (
        <main className="tutorial-interface-tour">
          <section className="tour-callout" aria-live="polite">
            <span><MousePointerIcon step={tourStep} /></span>
            <div><small>VISITE GUIDÉE · {Math.min(tourStep + 1, tour.length)}/{tour.length}</small><strong>{tour[tourStep].title}</strong><p>{tour[tourStep].detail}</p></div>
            {tourStep === tour.length - 1 && <button type="button" className="primary-button" onClick={finishTutorial}>Terminer et voir mon tableau de bord <ArrowRight /></button>}
          </section>
          <section className="tutorial-ui-demo">
            <div className="practice-toolbar">
              <button type="button" className={`mode-trigger ${tourStep === 0 ? 'is-tutorial-focus' : ''}`} onClick={() => tourStep === 0 && setTourStep(1)}><span><small>MODE D’ENTRAÎNEMENT</small><strong>Lecture guidée</strong></span><ChevronDown /></button>
              <div className={`notation-switch ${tourStep < 1 ? 'is-concealed' : ''} ${tourStep === 1 ? 'is-tutorial-focus' : ''}`}>
                {(['french', 'english', 'tablature'] as Notation[]).map((item) => <button type="button" key={item} className={notation === item ? 'is-active' : ''} onClick={() => { onNotationChange(item); if (tourStep === 1) setTourStep(2); }}>{item === 'french' ? 'Do Ré' : item === 'english' ? 'A B C' : '1P / 1T'}</button>)}
              </div>
              <button type="button" className={`tool-toggle ${tourStep < 3 ? 'is-concealed' : ''} ${tourStep === 3 ? 'is-tutorial-focus' : ''} ${looped ? 'is-active' : ''}`} onClick={() => { setLooped(!looped); if (tourStep === 3) setTourStep(4); }}><Repeat2 /> Boucler</button>
            </div>
            <div className="tutorial-ui-instrument"><AccordionView config={accordion} activeEvent={events[0]} direction={events[0]?.direction} notation={notation} compact /></div>
            <div className={`${tourStep < 2 ? 'is-concealed' : ''} ${tourStep === 2 ? 'is-tutorial-focus score-focus' : ''}`}><ScoreStrip song={tutorialSong} activeIndex={0} notation={notation} onSelect={() => tourStep === 2 && setTourStep(3)} /></div>
            <footer className={`${tourStep < 4 ? 'is-concealed' : ''}`}>
              <button type="button" className="transport-tool"><Repeat2 /></button>
              <button type="button" className="primary-play"><Play fill="currentColor" /><span>Commencer</span><kbd>Espace</kbd></button>
              <label className={`tempo-control ${tourStep === 4 ? 'is-tutorial-focus' : ''}`}><Gauge /><span>Tempo <strong>{tempo} %</strong></span><input aria-label="Tempo du tutoriel" type="range" min="40" max="120" step="5" value={tempo} onChange={(event) => { setTempo(Number(event.target.value)); if (tourStep === 4) setTourStep(5); }} /></label>
            </footer>
          </section>
        </main>
      )}
    </div>
  );
}

function MousePointerIcon({ step }: { step: number }) {
  if (step === 4) return <Gauge />;
  if (step === 3) return <Repeat2 />;
  if (step === 2) return <Play />;
  if (step === 1) return <Sparkles />;
  return <CircleGauge />;
}
