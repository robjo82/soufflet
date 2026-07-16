import { ArrowRight, Check, Music2, Piano } from 'lucide-react';
import { useState } from 'react';
import type { InstrumentType } from '../types';

interface InstrumentChoiceProps {
  onComplete: (instruments: InstrumentType[]) => void;
}

export function InstrumentChoice({ onComplete }: InstrumentChoiceProps) {
  const [selected, setSelected] = useState<InstrumentType[]>(['accordion']);
  const toggle = (instrument: InstrumentType) => setSelected((current) => current.includes(instrument)
    ? current.length === 1 ? current : current.filter((item) => item !== instrument)
    : [...current, instrument]);

  return <main className="instrument-onboarding">
    <span className="brand-lockup"><span className="brand-mark"><i /><i /><i /></span><strong>soufflet</strong></span>
    <section>
      <small>ÉTAPE 1 · TON PARCOURS</small>
      <h1>Qu’aimerais-tu apprendre ?</h1>
      <p>Tu peux choisir un instrument ou les deux. Tu pourras changer de parcours à tout moment depuis ton profil.</p>
      <div className="learning-instrument-grid">
        <button type="button" className={selected.includes('accordion') ? 'is-selected' : ''} onClick={() => toggle('accordion')}>
          <span><Music2 /></span><div><strong>Accordéon</strong><p>Boutons, soufflet, basses et coordination.</p></div>{selected.includes('accordion') && <Check />}
        </button>
        <button type="button" className={selected.includes('piano') ? 'is-selected' : ''} onClick={() => toggle('piano')}>
          <span><Piano /></span><div><strong>Piano</strong><p>Clavier visuel, piano roll et premiers accords.</p></div>{selected.includes('piano') && <Check />}
        </button>
      </div>
      <button type="button" className="primary-button instrument-continue" onClick={() => onComplete(selected)}>Continuer avec {selected.length === 2 ? 'les deux instruments' : selected[0] === 'piano' ? 'le piano' : 'l’accordéon'} <ArrowRight /></button>
    </section>
  </main>;
}
