import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Guitar, Keyboard, Mic2, MoveHorizontal, Music2, Piano, Sparkles, Usb, Volume2 } from 'lucide-react';
import type { AccordionConfig, GuitarConfig, InstrumentType, Notation, PianoConfig } from '../types';
import { AccordionInstrument } from './AccordionInstrument';
import { usePitchDetector } from '../hooks/usePitchDetector';
import { MicrophoneRecovery } from './MicrophoneRecovery';
import { PianoKeyboard } from './PianoKeyboard';
import { useSynth } from '../hooks/useSynth';

export interface OnboardingSelection {
  instrumentType: InstrumentType;
  accordionId: string;
  pianoId: string;
  guitarId: string;
  notation: Notation;
}

interface OnboardingProps {
  accordions: AccordionConfig[];
  pianos: PianoConfig[];
  guitars: GuitarConfig[];
  initialSelection: OnboardingSelection;
  onComplete: (selection: OnboardingSelection) => void;
  onSkip: (selection: OnboardingSelection) => void;
}

const instrumentLabel = (instrument: InstrumentType) => instrument === 'piano' ? 'piano' : instrument === 'guitar' ? 'guitare' : 'accordéon';

export function Onboarding({ accordions, pianos, guitars, initialSelection, onComplete, onSkip }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [selection, setSelection] = useState(initialSelection);
  const [direction, setDirection] = useState<'push' | 'pull'>('pull');
  const [playedMidi, setPlayedMidi] = useState<number | null>(null);
  const detector = usePitchDetector();
  const { playPianoMidi, playGuitarMidi } = useSynth();
  const accordion = accordions.find((item) => item.id === selection.accordionId) ?? accordions[0];
  const piano = pianos.find((item) => item.id === selection.pianoId) ?? pianos[0];
  const guitar = guitars.find((item) => item.id === selection.guitarId) ?? guitars[0];
  const steps = ['Bienvenue', 'Ton parcours', 'Ton modèle', 'Tes repères', 'Ton entrée', 'Premier geste'];
  const isLast = step === steps.length - 1;
  const needsMicrophone = selection.instrumentType === 'accordion' || selection.instrumentType === 'guitar' || piano?.input === 'microphone';
  const canContinue = useMemo(() => step !== 4 || !needsMicrophone || detector.status === 'listening' || detector.status === 'denied' || detector.status === 'error', [detector.status, needsMicrophone, step]);

  useEffect(() => {
    document.title = `Soufflet — apprendre ${selection.instrumentType === 'piano' ? 'le piano' : selection.instrumentType === 'guitar' ? 'la guitare' : 'l’accordéon'}`;
  }, [selection.instrumentType]);

  const finish = (callback: (value: OnboardingSelection) => void) => {
    detector.stop();
    callback(selection);
  };
  const setInstrument = (instrumentType: InstrumentType) => setSelection((current) => ({
    ...current,
    instrumentType,
    notation: instrumentType !== 'accordion' && (current.notation === 'button' || current.notation === 'tablature') ? 'french' : current.notation,
  }));
  const hitPiano = (midi: number) => { setPlayedMidi(midi); playPianoMidi(midi); window.setTimeout(() => setPlayedMidi(null), 260); };
  const hitGuitar = (midi: number) => { setPlayedMidi(midi); playGuitarMidi(midi); window.setTimeout(() => setPlayedMidi(null), 260); };

  return <div className={`onboarding-overlay onboarding-${selection.instrumentType}`}>
    <div className="onboarding-shell">
      <header className="onboarding-top">
        <span className="brand-lockup"><span className="brand-mark"><i /><i /><i /></span><strong>soufflet</strong></span>
        <span className="onboarding-step">Étape {step + 1} sur {steps.length}</span>
        <button type="button" className="text-button" onClick={() => finish(onSkip)}>Passer pour l’instant</button>
      </header>
      <div className="onboarding-progress">{steps.map((label, index) => <i key={label} className={index <= step ? 'is-done' : ''} />)}</div>

      <main className="onboarding-content">
        {step === 0 && <div className="welcome-step instrument-welcome-step">
          <div className="welcome-art" aria-hidden="true"><span className="welcome-note note-one">♪</span><span className="welcome-note note-two">♫</span><div className="welcome-instruments"><Music2 /><Piano /><Guitar /></div></div>
          <span className="eyebrow"><Sparkles size={15} /> Ton professeur musical personnel</span>
          <h1>Ta première mélodie<br />commence ici.</h1>
          <p>Choisis l’instrument que tu as devant toi. L’interface, les exercices et le tutoriel s’adapteront dès la première minute.</p>
          <div className="welcome-promises"><span><Check /> Une difficulté à la fois</span><span><Check /> Des conseils qui t’écoutent</span><span><Check /> À ton rythme</span></div>
        </div>}

        {step === 1 && <div className="setup-step">
          <span className="eyebrow">Ton premier parcours</span><h1>Qu’aimerais-tu apprendre ?</h1><p>Choisis ce que tu vas utiliser maintenant. Tu pourras changer de parcours à tout moment.</p>
          <div className="learning-instrument-grid">
            {([
              ['accordion', Music2, 'Accordéon diatonique', 'Boutons, soufflet, basses et coordination.'],
              ['piano', Piano, 'Piano', 'Clavier, notes descendantes, deux mains et MIDI.'],
              ['guitar', Guitar, 'Guitare', 'Cordes, cases, accords et accordeur chromatique.'],
            ] as const).map(([id, Icon, title, description]) => <button type="button" key={id} className={selection.instrumentType === id ? 'is-selected' : ''} onClick={() => setInstrument(id)}><span><Icon /></span><div><strong>{title}</strong><p>{description}</p></div>{selection.instrumentType === id && <Check />}</button>)}
          </div>
        </div>}

        {step === 2 && <div className="setup-step">
          <span className="eyebrow">Ton matériel</span><h1>Quel {instrumentLabel(selection.instrumentType)} as-tu devant toi ?</h1><p>Cette configuration est enregistrée dans ton compte et reprise sur tous tes appareils.</p>
          <div className="instrument-choices">
            {selection.instrumentType === 'accordion' && accordions.map((item) => <button type="button" key={item.id} className={`instrument-choice ${item.id === selection.accordionId ? 'is-selected' : ''}`} onClick={() => setSelection({ ...selection, accordionId: item.id })}><span className="instrument-swatch" style={{ background: item.color }}><i /><i /></span><span><small>{item.maker}</small><strong>{item.model}</strong><em>{item.tuning}</em></span><b>{item.id === selection.accordionId && <Check />}</b></button>)}
            {selection.instrumentType === 'piano' && pianos.map((item) => <button type="button" key={item.id} className={`instrument-choice instrument-choice-piano ${item.id === selection.pianoId ? 'is-selected' : ''}`} onClick={() => setSelection({ ...selection, pianoId: item.id })}><span><Piano /></span><span><small>{item.keyboardSize} touches</small><strong>{item.name}</strong><em>{item.input === 'midi' ? 'Clavier MIDI' : item.input === 'microphone' ? 'Piano acoustique · microphone' : 'Clavier d’ordinateur'}</em></span><b>{item.id === selection.pianoId && <Check />}</b></button>)}
            {selection.instrumentType === 'guitar' && guitars.map((item) => <button type="button" key={item.id} className={`instrument-choice instrument-choice-guitar ${item.id === selection.guitarId ? 'is-selected' : ''}`} onClick={() => setSelection({ ...selection, guitarId: item.id })}><span><Guitar /></span><span><small>{item.strings.length} cordes</small><strong>{item.name}</strong><em>{item.strings.map((string) => string.note.replace(/\d/g, '')).join(' · ')}</em></span><b>{item.id === selection.guitarId && <Check />}</b></button>)}
          </div>
          {selection.instrumentType === 'accordion' && !accordion.verified && <div className="setup-note">Les Club anciens peuvent varier. L’accordeur te permettra ensuite de vérifier chaque bouton et de corriger la configuration.</div>}
        </div>}

        {step === 3 && <div className="setup-step notation-step">
          <span className="eyebrow">Tes repères</span><h1>{selection.instrumentType === 'guitar' ? 'Comment lire une position ?' : 'Comment veux-tu lire les notes ?'}</h1>
          {selection.instrumentType === 'guitar' ? <><p>Soufflet affichera toujours la corde, la case et le doigt. Le nom de la note reste disponible comme repère secondaire.</p><div className="guitar-notation-preview"><Guitar /><span><small>CORDE</small><strong>2</strong></span><span><small>CASE</small><strong>1</strong></span><span><small>DOIGT</small><strong>1</strong></span></div></> : <><p>Tu pourras changer à tout moment. Pour débuter, les noms français sont souvent les plus naturels.</p><div className="notation-cards">{([
            ['french', 'Do · Ré · Mi', 'Noms français', 'Le choix conseillé pour commencer'],
            ['english', 'C · D · E', 'Noms internationaux', 'Pratique avec les apps et logiciels'],
            ...(selection.instrumentType === 'accordion' ? [['tablature', '4P · 4T · 5P', 'Tablature simplifiée', 'Bouton + pousser ou tirer'], ['button', '4 · 4 · 5', 'Numéros seuls', 'Pour mémoriser le clavier']] : []),
          ] as Array<[Notation, string, string, string]>).map(([id, example, title, description]) => <button type="button" key={id} className={`notation-card ${selection.notation === id ? 'is-selected' : ''}`} onClick={() => setSelection({ ...selection, notation: id })}><span>{example}</span><strong>{title}</strong><small>{description}</small><i>{selection.notation === id && <Check />}</i></button>)}</div></>}
        </div>}

        {step === 4 && <div className="setup-step mic-step">
          <span className="eyebrow">Une entrée pour t’aider</span>
          {!needsMicrophone ? <><h1>Ton piano parlera en MIDI.</h1><p>Le câble transmet chaque touche et les accords sans bruit ambiant. Tu pourras le connecter au début d’une séance.</p><div className="input-ready-card"><Usb /><span><strong>{piano?.name}</strong><small>MIDI recommandé pour évaluer les deux mains</small></span><Check /></div><div className="input-ready-card is-secondary"><Keyboard /><span><strong>Pas de câble maintenant ?</strong><small>Le clavier à l’écran et celui de l’ordinateur restent utilisables.</small></span></div></> : <><h1>Vérifions ton microphone.</h1><p>Le son reste analysé dans ton appareil pendant les exercices. Aucun enregistrement n’est conservé.</p><div className={`mic-orb status-${detector.status}`}><span><Mic2 /></span>{detector.status === 'listening' && <div className="mic-rings"><i /><i /><i /></div>}</div>{detector.status === 'idle' && <button type="button" className="primary-button" onClick={() => void detector.start()}><Mic2 /> Tester mon micro</button>}{detector.status === 'requesting' && <strong className="mic-message">Autorise le micro dans ton navigateur…</strong>}{detector.status === 'listening' && <div className="calibration-result"><span className={detector.reading ? 'signal-good' : ''}><Volume2 /> {detector.reading ? 'Signal reçu' : `Joue une note ${selection.instrumentType === 'guitar' ? 'ou une corde' : 'longue'}…`}</span>{detector.reading && <strong>{detector.reading.note} <small>{Math.round(detector.reading.frequency)} Hz · confiance {Math.round(detector.reading.confidence * 100)} %</small></strong>}</div>}{(detector.status === 'denied' || detector.status === 'error') && <MicrophoneRecovery error={detector.error} canOpenSettings={detector.canOpenSettings} detail="Tu peux aussi continuer et le configurer plus tard." onOpenSettings={() => void detector.openSettings()} onRetry={() => void detector.start()} variant="setup" />}<small className="privacy-note">Analyse locale · aucun audio envoyé</small></>}
        </div>}

        {step === 5 && <div className="setup-step first-breath-step instrument-first-gesture">
          <span className="eyebrow">Ton premier geste</span>
          {selection.instrumentType === 'accordion' && <><h1>{direction === 'pull' ? 'Ouvre doucement le soufflet.' : 'Referme doucement le soufflet.'}</h1><p>{direction === 'pull' ? 'Tirer fait entrer l’air. Tiens les deux côtés et écarte-les sans forcer.' : 'Pousser chasse l’air. Rapproche les deux côtés avec un mouvement régulier.'}</p><AccordionInstrument config={accordion} direction={direction} notation={selection.notation} compact context="onboarding" /><button type="button" className="direction-practice-button" onClick={() => setDirection(direction === 'pull' ? 'push' : 'pull')}><MoveHorizontal /> J’ai fait le geste — montrer {direction === 'pull' ? 'pousser' : 'tirer'}</button></>}
          {selection.instrumentType === 'piano' && <><h1>Appuie sur trois touches.</h1><p>Tu peux déjà écouter le clavier. Dans le tutoriel, les notes descendront exactement vers les touches à jouer.</p><div className="onboarding-piano"><PianoKeyboard midis={Array.from({ length: 15 }, (_, index) => 55 + index)} expected={[60, 62, 64]} active={new Set(playedMidi === null ? [] : [playedMidi])} notation={selection.notation === 'english' ? 'english' : 'french'} onHit={hitPiano} /></div></>}
          {selection.instrumentType === 'guitar' && <><h1>Fais sonner chaque corde.</h1><p>Touche une corde pour écouter son son attendu. Le tutoriel te montrera ensuite où poser ton premier doigt.</p><div className="onboarding-guitar-strings">{guitar?.strings.map((string) => <button type="button" key={string.number} className={playedMidi === string.midi ? 'is-active' : ''} onClick={() => hitGuitar(string.midi)}><span>{string.number}</span><i style={{ height: `${Math.max(2, 8 - string.number)}px` }} /><strong>{string.note}</strong></button>)}</div></>}
        </div>}
      </main>

      <footer className="onboarding-footer">
        <button type="button" className="secondary-button" disabled={step === 0} onClick={() => setStep(Math.max(0, step - 1))}><ArrowLeft /> Retour</button>
        <span><strong>{steps[step]}</strong><small>{step === 0 ? 'Quelques minutes pour tout préparer' : `Parcours ${instrumentLabel(selection.instrumentType)}`}</small></span>
        <button type="button" className="primary-button" disabled={!canContinue} onClick={() => isLast ? finish(onComplete) : setStep(step + 1)}>{isLast ? 'Commencer mon tutoriel' : 'Continuer'} <ArrowRight /></button>
      </footer>
    </div>
  </div>;
}
