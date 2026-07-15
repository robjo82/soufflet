import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, Info, Mic2, RotateCcw, SlidersHorizontal, Volume2 } from 'lucide-react';
import type { AccordionConfig, Notation } from '../types';
import { AccordionView } from './AccordionView';
import { frequencyToPitch, usePitchDetector } from '../hooks/usePitchDetector';

interface TunerPageProps {
  accordion: AccordionConfig;
  notation: Notation;
  onBack: () => void;
}

export function TunerPage({ accordion, notation, onBack }: TunerPageProps) {
  const detector = usePitchDetector();
  const { start, stop } = detector;
  const [a4, setA4] = useState(440);
  const [tolerance, setTolerance] = useState(8);
  const reading = detector.reading ? frequencyToPitch(detector.reading.frequency, detector.reading.confidence, detector.reading.volume, a4) : null;
  const cents = reading?.cents ?? 0;
  const inTune = Boolean(reading && Math.abs(cents) <= tolerance && reading.confidence > 0.65);
  const matchingButtons = useMemo(() => accordion.buttons.filter((button) => button.pushMidi === reading?.midi || button.pullMidi === reading?.midi), [accordion.buttons, reading?.midi]);

  useEffect(() => { void start(); return stop; }, [start, stop]);

  return (
    <main className="tuner-page page-content">
      <header className="page-heading tuner-heading">
        <div><button type="button" className="back-link" onClick={onBack}><ChevronLeft /> Retour</button><span className="eyebrow">Outil de précision</span><h1>Accordeur</h1><p>Joue une seule note, doucement et assez longtemps.</p></div>
        <div className="tuner-settings"><label>La de référence <strong>{a4} Hz</strong><input type="range" min="430" max="450" value={a4} onChange={(event) => setA4(Number(event.target.value))} /></label><label>Tolérance <strong>± {tolerance} cents</strong><input type="range" min="3" max="15" value={tolerance} onChange={(event) => setTolerance(Number(event.target.value))} /></label></div>
      </header>

      <section className="tuner-workspace">
        <div className={`tuner-dial ${inTune ? 'is-tuned' : ''}`}>
          <div className="tuner-scale">{[-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50].map((value) => <i key={value} className={value === 0 ? 'is-center' : ''}><span>{value}</span></i>)}</div>
          <div className="tuner-needle" style={{ transform: `rotate(${Math.max(-45, Math.min(45, cents * 0.9))}deg)` }} />
          <div className="tuner-reading">
            {detector.status === 'listening' && reading ? <><small>{inTune ? <><Check /> Juste</> : cents < 0 ? 'Trop bas' : 'Trop haut'}</small><strong>{reading.note}</strong><span>{reading.frequency.toFixed(1)} Hz</span><em>{cents > 0 ? '+' : ''}{cents} cents</em></> : <><Mic2 /><strong>—</strong><span>{detector.status === 'requesting' ? 'Autorisation…' : 'En attente d’une note'}</span></>}
          </div>
        </div>

        <div className="tuner-instrument-card">
          <div className="card-title-row"><div><small>OÙ EST CETTE NOTE ?</small><h2>{matchingButtons.length ? `${matchingButtons.length} position${matchingButtons.length > 1 ? 's' : ''} sur ton accordéon` : 'Joue une note pour la localiser'}</h2></div><span className="local-badge"><span /> Analyse locale</span></div>
          <AccordionView config={accordion} notation={notation} direction={matchingButtons[0] && matchingButtons[0].pullMidi === reading?.midi ? 'pull' : 'push'} detectedMidi={reading?.midi} compact />
          {matchingButtons.length > 0 && <div className="matching-buttons">{matchingButtons.map((button) => <span key={button.id}><strong>Bouton {button.index}</strong>{button.pushMidi === detector.reading?.midi ? 'Pousser →' : '← Tirer'}{button.row === 1 ? ' · rang extérieur' : button.row === 2 ? ' · rang intérieur' : ' · demi-rang'}</span>)}</div>}
        </div>
      </section>

      <section className="tuner-help"><Info /><div><strong>Pour une mesure fiable</strong><p>Une seule note à la fois · soufflet régulier · éloigne le téléphone des bruits mécaniques · attends que l’aiguille se stabilise.</p></div><button type="button" className="secondary-button" onClick={() => { detector.stop(); void detector.start(); }}><RotateCcw /> Recalibrer</button></section>
      <section className="signal-bar"><span><Volume2 /> Niveau du signal</span><i><b style={{ width: `${Math.min(100, (reading?.volume ?? 0) * 900)}%` }} /></i><span>{reading ? `Confiance ${Math.round(reading.confidence * 100)} %` : 'Signal faible ou ambigu'}</span><SlidersHorizontal /></section>
    </main>
  );
}
