import { ArrowLeft, ArrowRight, Box, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { FALLBACK_ACCORDIONS, FRENCH_NOTES } from '../../data';
import { useSynth } from '../../hooks/useSynth';
import type { AccordionButton, Direction } from '../../types';
import { AccordionView } from '../AccordionView';
import { Accordion3D } from './Accordion3D';
import { Accordion3DErrorBoundary } from './Accordion3DErrorBoundary';

function buttonLabel(button: AccordionButton, direction: Direction) {
  const note = direction === 'push' ? button.push : button.pull;
  const match = note.match(/^([A-G]#?)(-?\d)$/);
  return match ? `${FRENCH_NOTES[match[1]] ?? match[1]}${match[2]}` : note;
}
export default function Accordion3DLab() {
  const accordion = useMemo(() => FALLBACK_ACCORDIONS.find((item) => item.id === 'hohner-club-i-cf-10-9-2')!, []);
  const [bellowsAmount, setBellowsAmount] = useState(0.28);
  const [direction, setDirection] = useState<Direction>('pull');
  const [activeButtonId, setActiveButtonId] = useState<string>();
  const [showFallback, setShowFallback] = useState(false);
  const { playMidi } = useSynth();

  const press = (buttonId: string) => {
    const button = [...accordion.buttons, ...accordion.basses].find((item) => item.id === buttonId);
    if (!button) return;
    setActiveButtonId(buttonId);
    playMidi(direction === 'push' ? button.pushMidi : button.pullMidi, 0.65, 0.08);
    window.setTimeout(() => setActiveButtonId((current) => current === buttonId ? undefined : current), 240);
  };

  const fallback = <AccordionView config={accordion} notation="french" direction={direction} compact onButtonPress={press} />;

  return (
    <main className="accordion-3d-lab">
      <header className="accordion-3d-lab-header">
        <div>
          <span className="eyebrow"><Box size={16} /> Laboratoire interne</span>
          <h1>Hohner Club Modell I · contrat 3D</h1>
          <p>Teste le mouvement continu du soufflet, chaque bouton et le repli 2D avant intégration au lecteur.</p>
        </div>
        <a className="secondary-button" href="/"><ArrowLeft size={18} /> Revenir à Soufflet</a>
      </header>

      <section className="accordion-3d-stage">
        <Accordion3DErrorBoundary fallback={fallback}>
          {showFallback ? fallback : (
            <Accordion3D
              bellowsAmount={bellowsAmount}
              activeButtonIds={activeButtonId ? [activeButtonId] : []}
              onButtonPress={press}
            />
          )}
        </Accordion3DErrorBoundary>
      </section>

      <section className="accordion-3d-controls" aria-label="Commandes de test du modèle 3D">
        <div className="accordion-3d-control-row">
          <label htmlFor="bellows-amount">
            <span>Ouverture du soufflet</span>
            <strong>{Math.round(bellowsAmount * 100)} %</strong>
          </label>
          <input id="bellows-amount" type="range" min="0" max="1" step="0.01" value={bellowsAmount} onChange={(event) => setBellowsAmount(Number(event.target.value))} />
        </div>
        <div className="accordion-3d-toolbar">
          <button type="button" className={direction === 'push' ? 'is-active' : ''} onClick={() => setDirection('push')}><ArrowRight /> Pousser</button>
          <button type="button" className={direction === 'pull' ? 'is-active' : ''} onClick={() => setDirection('pull')}><ArrowLeft /> Tirer</button>
          <button type="button" onClick={() => { setBellowsAmount(0); setActiveButtonId(undefined); }}><RotateCcw /> Fermer</button>
          <button type="button" onClick={() => setShowFallback((value) => !value)}>{showFallback ? 'Afficher la 3D' : 'Tester le repli 2D'}</button>
        </div>
      </section>

      <section className="accordion-3d-buttons">
        <div>
          <h2>Main droite · 10 + 9 + 2</h2>
          <div className="accordion-3d-button-grid">
            {accordion.buttons.map((button) => (
              <button type="button" className={activeButtonId === button.id ? 'is-active' : ''} key={button.id} onClick={() => press(button.id)}>
                <small>{button.id}</small><strong>{buttonLabel(button, direction)}</strong>
              </button>
            ))}
          </div>
        </div>
        <div>
          <h2>Main gauche · basses et accords</h2>
          <div className="accordion-3d-button-grid is-bass">
            {accordion.basses.map((button) => (
              <button type="button" className={activeButtonId === button.id ? 'is-active' : ''} key={button.id} onClick={() => press(button.id)}>
                <small>{button.id}</small><strong>{button.role === 'bass' ? 'Basse' : 'Accord'}</strong>
              </button>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
