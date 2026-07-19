import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight, AudioLines, Check, ChevronDown, CircleGauge, Gauge, Headphones,
  Mic2, Play, Repeat2, Sparkles,
} from 'lucide-react';
import type { AccordionConfig, Direction, Notation, PracticeMode, Song, SongEvent } from '../types';
import { PRACTICE_MODES } from '../practiceModes';
import { createWaitTutorialSong, TUTORIAL_MODE_TRIALS } from '../tutorialFlow';
import { usePitchDetector } from '../hooks/usePitchDetector';
import { useSynth } from '../hooks/useSynth';
import { AccordionInstrument } from './AccordionInstrument';
import { ScoreStrip } from './ScoreStrip';
import { MicrophoneRecovery } from './MicrophoneRecovery';

interface FirstLessonTutorialProps {
  accountId: string;
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

function readDraft(key: string): TutorialDraft | null {
  try {
    const value = localStorage.getItem(key) ?? localStorage.getItem(DRAFT_KEY);
    return value ? JSON.parse(value) as TutorialDraft : null;
  } catch {
    return null;
  }
}

export function FirstLessonTutorial({ accountId, accordion, notation, song, onNotationChange, onComplete }: FirstLessonTutorialProps) {
  const draftKey = `${DRAFT_KEY}.${accountId}`;
  const initialDraft = useMemo(() => readDraft(draftKey), [draftKey]);
  const [stage, setStage] = useState(() => Math.min(4, Math.max(0, initialDraft?.stage ?? 0)));
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeAccompanimentIndex, setActiveAccompanimentIndex] = useState(0);
  const [demoPlaying, setDemoPlaying] = useState(false);
  const [demoDone, setDemoDone] = useState(() => (initialDraft?.stage ?? 0) > 1);
  const [guidedProgress, setGuidedProgress] = useState(initialDraft?.guidedProgress ?? 0);
  const [guidedCelebrating, setGuidedCelebrating] = useState(false);
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
  const detector = usePitchDetector();
  const stopDetector = detector.stop;
  const { playMidi, playLeftHand } = useSynth();
  const tutorialSong = useMemo(() => ({
    ...song,
    id: `${song.id}-tutorial`,
    events: song.events.slice(0, 3),
    accompaniment: song.accompaniment?.filter((event) => event.beat < 3),
  }), [song]);
  const events = tutorialSong.events;
  const waitTutorialSong = useMemo(() => createWaitTutorialSong(song), [song]);
  const waitEvents = waitTutorialSong.events;
  const currentTrial = TUTORIAL_MODE_TRIALS[modeIndex];
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
    localStorage.setItem(draftKey, JSON.stringify(draft));
    localStorage.removeItem(DRAFT_KEY);
  }, [completedModes, draftKey, guidedProgress, modeIndex, modeProgress, stage, tourStep]);

  useEffect(() => () => timersRef.current.forEach((timer) => window.clearTimeout(timer)), []);

  const goToStage = useCallback((next: number) => {
    heldMidiRef.current = null;
    setStage(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

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
        setFeedback({ good: true, title: 'Mélodie réussie !', detail: 'Les trois hauteurs sont justes. Le micro s’arrête et nous passons à une vraie petite phrase.' });
      } else {
        setFeedback({ good: true, title: 'Bonne note', detail: `Encore ${events.length - next} ${events.length - next === 1 ? 'note' : 'notes'}. Regarde le prochain bouton.` });
      }
      return;
    }

    if (stage !== 3 || !currentTrial || modeFinished) return;
    if (!['wait-melody', 'memory'].includes(currentTrial.task)) return;
    const trialEvents = currentTrial.task === 'wait-melody' ? waitEvents : events;
    const expected = trialEvents[Math.min(modeProgress, trialEvents.length - 1)];
    if (midi !== expected.midi) {
      setFeedback({ good: false, title: midi < expected.midi ? 'Cette note est trop grave' : 'Cette note est trop aiguë', detail: currentTrial.task === 'memory' ? 'Repars de la première note de la petite mélodie.' : 'La lecture reste ici. Repère le bouton éclairé puis réessaie.' });
      if (currentTrial.task === 'memory') setModeProgress(0);
      return;
    }
    if (direction && currentTrial.task === 'wait-melody' && direction !== expected.direction) {
      setFeedback({ good: false, title: 'La note est bonne, pas le soufflet', detail: `Utilise la direction ${expected.direction === 'pull' ? 'tirer' : 'pousser'}.` });
      return;
    }
    const next = modeProgress + 1;
    setModeProgress(next);
    setActiveIndex(Math.min(next, trialEvents.length - 1));
    if (next >= trialEvents.length) {
      markModeComplete(currentTrial.id, currentTrial.task === 'memory'
        ? 'Tu as retrouvé les trois notes sans touche éclairée.'
        : 'Tu as fait avancer toute la petite phrase, note après note, à ton rythme.');
    } else {
      setFeedback({
        good: true,
        title: currentTrial.task === 'memory' ? 'Bien mémorisé' : 'Bonne note, la lecture avance',
        detail: `Il reste ${trialEvents.length - next} ${trialEvents.length - next === 1 ? 'note' : 'notes'}.`,
      });
    }
  }, [currentTrial, events, guidedDone, guidedProgress, markModeComplete, modeFinished, modeProgress, stage, waitEvents]);

  const handleButtonPress = (buttonId: string, direction: Direction) => {
    if (stage === 3 && detector.status !== 'denied' && detector.status !== 'error') {
      setFeedback({ good: false, title: 'Essaie sur ton accordéon', detail: 'Le dessin sert à écouter et à repérer le bouton. Seul le son du vrai instrument valide ce mini-défi.' });
      return;
    }
    const button = accordion.buttons.find((item) => item.id === buttonId);
    if (!button) return;
    submitMelody(direction === 'push' ? button.pushMidi : button.pullMidi, direction);
  };

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
    submitMelody(reading.midi);
  }, [detector.reading, stage, submitMelody]);

  useEffect(() => {
    if (stage !== 2 || !guidedDone) return;
    stopDetector();
    setGuidedCelebrating(true);
    setFeedback({ good: true, title: 'Mélodie réussie !', detail: 'Les trois notes sont justes. Le microphone est maintenant coupé.' });
    const timer = window.setTimeout(() => {
      setGuidedCelebrating(false);
      setModeIndex(2);
      setModeProgress(0);
      setFeedback({ good: false, title: TUTORIAL_MODE_TRIALS[2].title, detail: TUTORIAL_MODE_TRIALS[2].instruction });
      goToStage(3);
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [goToStage, guidedDone, stage, stopDetector]);

  const advanceMode = () => {
    heldMidiRef.current = null;
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
    if (stage === 2) return guidedDone ? undefined : events[Math.min(guidedProgress, events.length - 1)];
    if (stage !== 3 || !currentTrial) return events[0];
    if (currentTrial.task === 'memory' || modeFinished) return undefined;
    return waitEvents[Math.min(modeProgress, waitEvents.length - 1)];
  }, [activeAccompanimentIndex, activeIndex, currentTrial, events, guidedDone, guidedProgress, modeFinished, modeProgress, stage, tutorialSong.accompaniment, waitEvents]);

  const visualDirection: Direction = activeEvent?.direction ?? events[0]?.direction ?? 'push';

  const finishTutorial = () => {
    localStorage.removeItem(draftKey);
    localStorage.removeItem(DRAFT_KEY);
    stopDetector();
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
          <div className="tutorial-intro-instrument"><AccordionInstrument config={accordion} notation={notation} direction="push" compact context="tutorial" showLearningGuides={false} /></div>
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
            <AccordionInstrument config={accordion} activeEvent={guidedCelebrating ? undefined : activeEvent} direction={activeEvent?.direction} notation={notation} detectedMidi={detector.reading?.midi} depressActive={stage === 1 && demoPlaying} onButtonPress={handleButtonPress} context="tutorial" />
            {guidedCelebrating && <div className="tutorial-success-burst" role="status"><span><Check /></span><Sparkles /><strong>Trois notes justes !</strong><p>Micro coupé · prochaine étape…</p>{Array.from({ length: 8 }).map((_, index) => <i key={index} />)}</div>}
          </section>
          {stage === 2 && <div className="tutorial-score"><ScoreStrip song={tutorialSong} activeIndex={Math.min(guidedProgress, events.length - 1)} notation={notation} completed={guidedDone} onSelect={() => undefined} /></div>}
          <section className={`tutorial-feedback ${feedback.good ? 'is-good' : ''}`} aria-live="polite"><AudioLines /><span><small>TON PROFESSEUR</small><strong>{feedback.title}</strong><p>{feedback.detail}</p></span></section>
          <footer className="tutorial-lesson-footer">
            {stage === 1 && <button type="button" className="primary-button" disabled={!demoDone} onClick={() => { setFeedback({ good: false, title: 'À toi de jouer', detail: 'Commence par la première note éclairée.' }); goToStage(2); }}>À moi de jouer <ArrowRight /></button>}
            {stage === 2 && guidedCelebrating && <span className="tutorial-auto-next"><i /> Passage automatique vers la suite</span>}
          </footer>
        </main>
      )}

      {stage === 3 && currentTrial && (
        <main className="tutorial-modes">
          <aside className="tutorial-mode-rail">
            <span className="eyebrow">4 façons de travailler</span>
            <h1>Un rôle clair pour chacune.</h1>
            <p>Tu as déjà observé la démonstration et joué avec le guidage. Essaie maintenant l’attente sans pression, puis la performance sans aide.</p>
            <ol>{TUTORIAL_MODE_TRIALS.map((trial, index) => <li key={trial.id} className={completedModes.has(trial.id) ? 'is-done' : index === modeIndex ? 'is-current' : ''}><i>{completedModes.has(trial.id) ? <Check /> : index + 1}</i><span><strong>{trial.title}</strong><small>{PRACTICE_MODES.find((mode) => mode.id === trial.id)?.short}</small></span></li>)}</ol>
          </aside>
          <section className="tutorial-mode-workspace">
            <header><span className="eyebrow">Mode {modeIndex + 1} sur {TUTORIAL_MODE_TRIALS.length}</span><h2>{currentTrial.title}</h2><p>{currentTrial.explanation}</p><div className="tutorial-task"><CircleGauge /><span><small>TON MINI-DÉFI</small><strong>{currentTrial.instruction}</strong></span></div></header>
            <div className="tutorial-practice-preview">
              <div className="practice-toolbar tutorial-practice-toolbar">
                <button type="button" className="mode-trigger"><span><small>MODE D’ENTRAÎNEMENT</small><strong>{currentTrial.title}</strong></span><ChevronDown /></button>
                <div className="tutorial-hand-focus"><small>JE TRAVAILLE</small><strong>Mélodie · main droite</strong></div>
                <div className="notation-switch">{(['french', 'english', 'tablature'] as Notation[]).map((item) => <button type="button" key={item} className={notation === item ? 'is-active' : ''} onClick={() => onNotationChange(item)}>{item === 'french' ? 'Do Ré' : item === 'english' ? 'A B C' : '1P / 1T'}</button>)}</div>
              </div>
              {currentTrial.task === 'wait-melody' ? <>
                <section className="instrument-stage tutorial-wait-instrument">
                  <AccordionInstrument config={accordion} activeEvent={activeEvent} direction={visualDirection} notation={notation} detectedMidi={detector.reading?.midi} onButtonPress={handleButtonPress} context="tutorial" />
                  {!modeFinished && <aside className={`tutorial-context-bubble bubble-step-${Math.min(3, modeProgress)}`}>
                    <span>{modeProgress === 0 ? '1' : modeProgress < 3 ? '2' : '3'}</span>
                    <div><small>{modeProgress === 0 ? 'LE GESTE À JOUER' : modeProgress < 3 ? 'LA PARTITION T’ATTEND' : 'AUCUNE PRESSION DE TEMPO'}</small><strong>{modeProgress === 0 ? 'Commence par le bouton éclairé.' : modeProgress < 3 ? 'Une bonne note grise la précédente et révèle la suivante.' : 'Prends le temps de trouver chaque note. Ici, le rythme ne compte pas.'}</strong></div>
                  </aside>}
                </section>
                <ScoreStrip song={waitTutorialSong} activeIndex={Math.min(modeProgress, waitEvents.length - 1)} notation={notation} completed={modeFinished} onSelect={() => undefined} />
                <section className={`coach-feedback ${feedback.good ? 'feedback-good' : 'feedback-neutral'}`} aria-live="polite"><div className="coach-avatar"><AudioLines /></div><div><small>CONSEIL EN DIRECT</small><strong>{feedback.title}</strong><p>{feedback.detail}</p></div><div className="tutorial-wait-counter"><b>{Math.min(modeProgress, waitEvents.length)}</b><span>/ {waitEvents.length}<small>notes</small></span></div></section>
              </> : <section className="tutorial-performance-stage">
                <span><Mic2 /></span><small>PERFORMANCE SANS ASSISTANCE</small><h3>L’écran se retire. Ton oreille et ta mémoire prennent le relais.</h3><p>Joue Do, Ré, Mi comme au début. Le micro confirme chaque note, mais aucun bouton n’est montré.</p>
                <div className="guided-note-progress">{events.map((event, index) => <span key={event.id} className={index < modeProgress ? 'is-done' : index === modeProgress ? 'is-current' : ''}>{index < modeProgress ? <Check /> : index + 1}</span>)}</div>
              </section>}
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
            {currentTrial.task !== 'wait-melody' && <section className={`tutorial-feedback ${feedback.good ? 'is-good' : ''}`} aria-live="polite"><AudioLines /><span><small>VALIDATION AUTOMATIQUE</small><strong>{feedback.title}</strong><p>{feedback.detail}</p></span></section>}
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
            <div className="tutorial-ui-instrument"><AccordionInstrument config={accordion} activeEvent={events[0]} direction={events[0]?.direction} notation={notation} compact context="tutorial" /></div>
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
