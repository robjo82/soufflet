import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, ChevronLeft, Info, Mic2, RotateCcw, Save, SlidersHorizontal, Volume2 } from 'lucide-react';
import type { AccordionConfig, Direction, Notation } from '../types';
import { AccordionView } from './AccordionView';
import { frequencyToPitch, rememberReliablePitch, usePitchDetector } from '../hooks/usePitchDetector';
import { noteFromMidi } from '../data';

interface TunerPageProps {
  accordion: AccordionConfig;
  notation: Notation;
  onBack: () => void;
  onAccordionChange: (accordion: AccordionConfig) => void;
}

export function TunerPage({ accordion, notation, onBack, onAccordionChange }: TunerPageProps) {
  const detector = usePitchDetector();
  const { start, stop } = detector;
  const [a4, setA4] = useState(440);
  const [tolerance, setTolerance] = useState(8);
  const [direction, setDirection] = useState<Direction>('push');
  const [selectedButtonId, setSelectedButtonId] = useState(accordion.buttons[0]?.id ?? '');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [rememberedSignal, setRememberedSignal] = useState(detector.reading);
  const liveReading = detector.reading ? frequencyToPitch(detector.reading.frequency, detector.reading.confidence, detector.reading.volume, a4) : null;
  const rememberedReading = rememberedSignal ? frequencyToPitch(rememberedSignal.frequency, rememberedSignal.confidence, rememberedSignal.volume, a4) : null;
  const hasReliableLiveReading = Boolean(liveReading && liveReading.confidence > 0.72);
  const reading = hasReliableLiveReading ? liveReading : rememberedReading;
  const isRememberedReading = Boolean(reading && !hasReliableLiveReading);
  const cents = reading?.cents ?? 0;
  const inTune = Boolean(reading && Math.abs(cents) <= tolerance && reading.confidence > 0.65);
  const matchingButtons = useMemo(() => accordion.buttons.filter((button) => button.pushMidi === reading?.midi || button.pullMidi === reading?.midi), [accordion.buttons, reading?.midi]);
  const selectedButton = accordion.buttons.find((button) => button.id === selectedButtonId) ?? accordion.buttons[0];
  const expectedMidi = selectedButton ? (direction === 'push' ? selectedButton.pushMidi : selectedButton.pullMidi) : undefined;
  const canPropose = Boolean(reading && reading.confidence > 0.72 && expectedMidi !== undefined && reading.midi !== expectedMidi);

  useEffect(() => { void start(); return stop; }, [start, stop]);
  useEffect(() => { setRememberedSignal((previous) => rememberReliablePitch(previous, detector.reading)); }, [detector.reading]);

  const applyDetectedNote = async () => {
    if (!selectedButton || !reading || !canPropose) return;
    setSaving(true); setSaveMessage('');
    try {
      const buttons = accordion.buttons.map((button) => button.id !== selectedButton.id ? button : direction === 'push'
        ? { ...button, pushMidi: reading.midi, push: noteFromMidi(reading.midi) }
        : { ...button, pullMidi: reading.midi, pull: noteFromMidi(reading.midi) });
      const isCustom = accordion.id.startsWith('custom-');
      const draft = { ...accordion, ...(isCustom ? {} : { model: `${accordion.model} — mon instrument` }), buttons, verified: false, sourceNote: `Configuration ajustée avec l’accordeur le ${new Date().toLocaleDateString('fr-FR')}.` };
      const response = await fetch(isCustom ? `/api/accordions/${accordion.id}` : '/api/accordions', {
        method: isCustom ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft),
      });
      const payload = await response.json() as { accordion?: AccordionConfig; error?: string };
      if (!response.ok || !payload.accordion) throw new Error(payload.error ?? 'Impossible d’enregistrer la note.');
      onAccordionChange(payload.accordion);
      setSelectedButtonId(payload.accordion.buttons.find((button) => button.row === selectedButton.row && button.index === selectedButton.index)?.id ?? selectedButton.id);
      setSaveMessage(`${direction === 'push' ? 'Pousser' : 'Tirer'} · bouton ${selectedButton.index} enregistré en ${noteFromMidi(reading.midi)}.`);
    } catch (reason) { setSaveMessage(reason instanceof Error ? reason.message : 'Impossible d’enregistrer la note.'); }
    finally { setSaving(false); }
  };

  return (
    <main className="tuner-page page-content">
      <header className="page-heading tuner-heading">
        <div><button type="button" className="back-link" onClick={onBack}><ChevronLeft /> Retour</button><span className="eyebrow">Outil de précision</span><h1>Accordeur</h1><p>Joue une seule note, doucement et assez longtemps. La dernière note fiable reste en mémoire.</p></div>
        <div className="tuner-settings"><label>La de référence <strong>{a4} Hz</strong><input type="range" min="430" max="450" value={a4} onChange={(event) => setA4(Number(event.target.value))} /></label><label>Tolérance <strong>± {tolerance} cents</strong><input type="range" min="3" max="15" value={tolerance} onChange={(event) => setTolerance(Number(event.target.value))} /></label></div>
      </header>

      <section className="tuner-workspace">
        <div className={`tuner-dial ${inTune ? 'is-tuned' : ''}`}>
          <div className="tuner-scale">{[-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50].map((value) => <i key={value} className={value === 0 ? 'is-center' : ''}><span>{value}</span></i>)}</div>
          <div className="tuner-needle" style={{ transform: `rotate(${Math.max(-45, Math.min(45, cents * 0.9))}deg)` }} />
          <div className="tuner-reading">
            {detector.status === 'listening' && reading ? <><small>{isRememberedReading ? 'Dernière note mémorisée' : inTune ? <><Check /> Juste</> : cents < 0 ? 'Trop bas' : 'Trop haut'}</small><strong>{reading.note}</strong><span>{reading.frequency.toFixed(1)} Hz</span><em>{cents > 0 ? '+' : ''}{cents} cents</em></> : <><Mic2 /><strong>—</strong><span>{detector.status === 'requesting' ? 'Autorisation…' : 'En attente d’une note'}</span></>}
          </div>
        </div>

        <div className="tuner-instrument-card">
          <div className="card-title-row"><div><small>OÙ EST CETTE NOTE ?</small><h2>{matchingButtons.length ? `${matchingButtons.length} position${matchingButtons.length > 1 ? 's' : ''} sur ton accordéon` : 'Joue une note pour la localiser'}</h2></div><span className="local-badge"><span /> Analyse locale</span></div>
          <AccordionView config={accordion} notation={notation} direction={direction} detectedMidi={reading?.midi} onButtonPress={(buttonId, pressedDirection) => { setSelectedButtonId(buttonId); setDirection(pressedDirection); setSaveMessage(''); }} />
          {matchingButtons.length > 0 && <div className="matching-buttons">{matchingButtons.map((button) => <span key={button.id}><strong>Bouton {button.index}</strong>{button.pushMidi === reading?.midi ? 'Pousser →' : '← Tirer'}{button.row === 1 ? ' · rang extérieur' : button.row === 2 ? ' · rang intérieur' : ' · demi-rang'}</span>)}</div>}
        </div>
      </section>

      {selectedButton && <section className="tuner-mapping-card">
        <div><span className="eyebrow">Cartographie de ton instrument</span><h2>Bouton {selectedButton.index} · rang {selectedButton.row}</h2><p>Joue une note : elle reste mémorisée pendant que tu choisis le bouton et la direction à corriger.</p></div>
        <div className="direction-choice"><button type="button" className={direction === 'push' ? 'is-active' : ''} onClick={() => setDirection('push')}><ArrowRight /> Pousser</button><button type="button" className={direction === 'pull' ? 'is-active' : ''} onClick={() => setDirection('pull')}><ArrowLeft /> Tirer</button></div>
        <div className="mapping-comparison"><span><small>Note attendue</small><strong>{noteFromMidi(expectedMidi ?? 60)}</strong></span><i>{reading ? (reading.midi === expectedMidi ? <Check /> : <AlertTriangle />) : <Mic2 />}</i><span><small>{isRememberedReading ? 'Dernière note entendue' : 'Note entendue'}</small><strong>{reading?.note ?? '—'}</strong><em>{reading ? `${Math.round(reading.confidence * 100)} % de confiance` : 'Joue une note tenue'}</em></span></div>
        <button type="button" className="primary-button" disabled={!canPropose || saving} onClick={() => void applyDetectedNote()}>{saving ? 'Enregistrement…' : canPropose ? `Utiliser ${reading?.note} pour ce bouton` : reading?.midi === expectedMidi ? 'La configuration correspond' : 'En attente d’une note fiable'} <Save /></button>
        {saveMessage && <p className="mapping-message">{saveMessage}</p>}
      </section>}

      <section className="tuner-help"><Info /><div><strong>Pour une mesure fiable</strong><p>Une seule note à la fois · soufflet régulier · éloigne le téléphone des bruits mécaniques · attends que l’aiguille se stabilise.</p></div><button type="button" className="secondary-button" onClick={() => { setRememberedSignal(null); detector.stop(); void detector.start(); }}><RotateCcw /> Recalibrer</button></section>
      <section className="signal-bar"><span><Volume2 /> Niveau du signal</span><i><b style={{ width: `${Math.min(100, (liveReading?.volume ?? 0) * 900)}%` }} /></i><span>{liveReading ? `Confiance ${Math.round(liveReading.confidence * 100)} %` : isRememberedReading ? `Dernière note : ${reading?.note}` : 'Signal faible ou ambigu'}</span><SlidersHorizontal /></section>
    </main>
  );
}
