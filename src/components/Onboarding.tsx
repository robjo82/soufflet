import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Mic2, MoveHorizontal, Sparkles, Volume2 } from 'lucide-react';
import type { AccordionConfig, Notation } from '../types';
import { AccordionInstrument } from './AccordionInstrument';
import { usePitchDetector } from '../hooks/usePitchDetector';
import { MicrophoneRecovery } from './MicrophoneRecovery';

interface OnboardingProps {
  accordions: AccordionConfig[];
  initialAccordionId: string;
  initialNotation: Notation;
  onComplete: (accordionId: string, notation: Notation) => void;
  onSkip: (accordionId: string, notation: Notation) => void;
}

export function Onboarding({ accordions, initialAccordionId, initialNotation, onComplete, onSkip }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [accordionId, setAccordionId] = useState(initialAccordionId);
  const [notation, setNotation] = useState<Notation>(initialNotation);
  const [direction, setDirection] = useState<'push' | 'pull'>('pull');
  const detector = usePitchDetector();
  const accordion = accordions.find((item) => item.id === accordionId) ?? accordions[0];
  const steps = ['Bienvenue', 'Ton accordéon', 'Ta notation', 'Ton micro', 'Premier souffle'];
  const isLast = step === steps.length - 1;

  const canContinue = useMemo(() => step !== 3 || detector.status === 'listening' || detector.status === 'denied', [detector.status, step]);

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-shell">
        <header className="onboarding-top">
          <span className="brand-lockup"><span className="brand-mark"><i /><i /><i /></span><strong>soufflet</strong></span>
          <span className="onboarding-step">Étape {step + 1} sur {steps.length}</span>
          <button type="button" className="text-button" onClick={() => onSkip(accordionId, notation)}>Passer pour l’instant</button>
        </header>
        <div className="onboarding-progress">{steps.map((label, index) => <i key={label} className={index <= step ? 'is-done' : ''} />)}</div>

        <main className="onboarding-content">
          {step === 0 && (
            <div className="welcome-step">
              <div className="welcome-art" aria-hidden="true">
                <span className="welcome-note note-one">♪</span><span className="welcome-note note-two">♫</span>
                <div className="mini-accordion"><i /><div>{Array.from({ length: 7 }).map((_, i) => <b key={i} />)}</div><i /></div>
              </div>
              <span className="eyebrow"><Sparkles size={15} /> Ton professeur personnel</span>
              <h1>Ta première mélodie<br />commence ici.</h1>
              <p>En quelques minutes, tu vas comprendre ton instrument et jouer tes trois premières notes. Aucune connaissance musicale nécessaire.</p>
              <div className="welcome-promises"><span><Check /> Une difficulté à la fois</span><span><Check /> Des conseils qui t’écoutent</span><span><Check /> À ton rythme</span></div>
            </div>
          )}

          {step === 1 && (
            <div className="setup-step">
              <span className="eyebrow">Ton instrument</span>
              <h1>Quel accordéon as-tu devant toi ?</h1>
              <p>Ce choix détermine exactement quels boutons nous allons te montrer.</p>
              <div className="instrument-choices">
                {accordions.map((item) => (
                  <button type="button" key={item.id} className={`instrument-choice ${item.id === accordionId ? 'is-selected' : ''}`} onClick={() => setAccordionId(item.id)}>
                    <span className="instrument-swatch" style={{ background: item.color }}><i /><i /></span>
                    <span><small>{item.maker}</small><strong>{item.model}</strong><em>{item.tuning}</em></span>
                    <b>{item.id === accordionId && <Check />}</b>
                  </button>
                ))}
              </div>
              {!accordion.verified && <div className="setup-note">Les Club anciens peuvent varier. Après l’onboarding, l’accordeur te permettra de vérifier chaque bouton et de corriger la configuration.</div>}
            </div>
          )}

          {step === 2 && (
            <div className="setup-step notation-step">
              <span className="eyebrow">Tes repères</span>
              <h1>Comment veux-tu lire les notes ?</h1>
              <p>Tu pourras changer à tout moment. Pour débuter, les noms français sont souvent les plus naturels.</p>
              <div className="notation-cards">
                {([
                  ['french', 'Do · Ré · Mi', 'Noms français', 'Le choix conseillé pour commencer'],
                  ['english', 'C · D · E', 'Noms internationaux', 'Pratique avec les apps et logiciels'],
                  ['tablature', '4P · 4T · 5P', 'Tablature simplifiée', 'Bouton + pousser ou tirer'],
                  ['button', '4 · 4 · 5', 'Numéros seuls', 'Pour travailler la mémoire du clavier'],
                ] as Array<[Notation, string, string, string]>).map(([id, example, title, description]) => (
                  <button type="button" key={id} className={`notation-card ${notation === id ? 'is-selected' : ''}`} onClick={() => setNotation(id)}>
                    <span>{example}</span><strong>{title}</strong><small>{description}</small><i>{notation === id && <Check />}</i>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="setup-step mic-step">
              <span className="eyebrow">Une oreille pour t’aider</span>
              <h1>Vérifions ton microphone.</h1>
              <p>Le son reste analysé dans ton navigateur pendant les exercices. Aucun enregistrement n’est conservé.</p>
              <div className={`mic-orb status-${detector.status}`}>
                <span><Mic2 /></span>
                {detector.status === 'listening' && <div className="mic-rings"><i /><i /><i /></div>}
              </div>
              {detector.status === 'idle' && <button type="button" className="primary-button" onClick={() => void detector.start()}><Mic2 /> Tester mon micro</button>}
              {detector.status === 'requesting' && <strong className="mic-message">Autorise le micro dans ton navigateur…</strong>}
              {detector.status === 'listening' && (
                <div className="calibration-result">
                  <span className={detector.reading ? 'signal-good' : ''}><Volume2 /> {detector.reading ? 'Signal reçu' : 'Joue une note longue…'}</span>
                  {detector.reading && <strong>{detector.reading.note} <small>{Math.round(detector.reading.frequency)} Hz · confiance {Math.round(detector.reading.confidence * 100)} %</small></strong>}
                </div>
              )}
              {(detector.status === 'denied' || detector.status === 'error') && (
                <MicrophoneRecovery
                  error={detector.error}
                  canOpenSettings={detector.canOpenSettings}
                  detail="Tu peux aussi continuer et le configurer plus tard."
                  onOpenSettings={() => void detector.openSettings()}
                  onRetry={() => void detector.start()}
                  variant="setup"
                />
              )}
              <small className="privacy-note">Analyse locale · aucun audio envoyé</small>
            </div>
          )}

          {step === 4 && (
            <div className="setup-step first-breath-step">
              <span className="eyebrow">Ton premier geste</span>
              <h1>{direction === 'pull' ? 'Ouvre doucement le soufflet.' : 'Referme doucement le soufflet.'}</h1>
              <p>{direction === 'pull' ? 'Tirer fait entrer l’air. Tiens les deux côtés et écarte-les sans forcer.' : 'Pousser chasse l’air. Rapproche les deux côtés avec un mouvement régulier.'}</p>
              <AccordionInstrument config={accordion} direction={direction} notation={notation} compact context="onboarding" />
              <button type="button" className="direction-practice-button" onClick={() => setDirection(direction === 'pull' ? 'push' : 'pull')}>
                <MoveHorizontal /> J’ai fait le geste — montrer {direction === 'pull' ? 'pousser' : 'tirer'}
              </button>
            </div>
          )}
        </main>

        <footer className="onboarding-footer">
          <button type="button" className="secondary-button" disabled={step === 0} onClick={() => setStep(Math.max(0, step - 1))}><ArrowLeft /> Retour</button>
          <span><strong>{steps[step]}</strong><small>{step === 0 ? '2 minutes pour tout préparer' : 'Tu pourras modifier ce choix plus tard'}</small></span>
          <button type="button" className="primary-button" disabled={!canContinue} onClick={() => isLast ? onComplete(accordionId, notation) : setStep(step + 1)}>
            {isLast ? 'Commencer mon tutoriel' : 'Continuer'} <ArrowRight />
          </button>
        </footer>
      </div>
    </div>
  );
}
