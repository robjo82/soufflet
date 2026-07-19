import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, CircleCheck,
  Download, Info, Mic2, RotateCcw, Save, SlidersHorizontal, Volume2,
} from 'lucide-react';
import type { AccordionConfig, Direction, Notation, PitchReading, TunerReading } from '../types';
import { noteFromMidi } from '../data';
import { frequencyToPitch, rememberReliablePitch, usePitchDetector } from '../hooks/usePitchDetector';
import { buildTunerExport, tunerExportFilename } from '../tunerExport';
import { createTunerTargets, findTunerTargetIndex, nextTunerTarget } from '../tunerWorkflow';
import { AccordionInstrument } from './AccordionInstrument';

interface TunerPageProps {
  accordion: AccordionConfig;
  notation: Notation;
  onBack: () => void;
  onAccordionChange: (accordion: AccordionConfig) => void;
}

function targetKey(buttonId: string, direction: Direction) {
  return `${buttonId}:${direction}`;
}

function rowLabel(row: number) {
  if (row === 1) return 'extérieur';
  if (row === 2) return 'intérieur';
  return 'demi-rang';
}

export function TunerPage({ accordion, notation, onBack, onAccordionChange }: TunerPageProps) {
  const detector = usePitchDetector();
  const { start, stop } = detector;
  const [a4, setA4] = useState(440);
  const [tolerance, setTolerance] = useState(8);
  const [direction, setDirection] = useState<Direction>('push');
  const [selectedButtonId, setSelectedButtonId] = useState(accordion.buttons[0]?.id ?? '');
  const [verifiedTargets, setVerifiedTargets] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [rememberedSignal, setRememberedSignal] = useState(detector.reading);
  const [sessionReadings, setSessionReadings] = useState<TunerReading[]>([]);
  const sessionId = useRef(crypto.randomUUID()).current;

  const targets = useMemo(() => createTunerTargets(accordion), [accordion]);
  const targetIndex = findTunerTargetIndex(targets, selectedButtonId, direction);
  const selectedButton = accordion.buttons.find((button) => button.id === selectedButtonId) ?? accordion.buttons[0];
  const expectedMidi = selectedButton ? (direction === 'push' ? selectedButton.pushMidi : selectedButton.pullMidi) : undefined;
  const liveReading = detector.reading
    ? frequencyToPitch(detector.reading.frequency, detector.reading.confidence, detector.reading.volume, a4)
    : null;
  const rememberedReading = rememberedSignal
    ? frequencyToPitch(rememberedSignal.frequency, rememberedSignal.confidence, rememberedSignal.volume, a4)
    : null;
  const hasReliableLiveReading = Boolean(liveReading && liveReading.confidence > .72);
  const reading = hasReliableLiveReading ? liveReading : rememberedReading;
  const isRememberedReading = Boolean(reading && !hasReliableLiveReading);
  const cents = reading?.cents ?? 0;
  const inTune = Boolean(reading && Math.abs(cents) <= tolerance && reading.confidence > .65);
  const noteMatches = Boolean(reading && reading.midi === expectedMidi);
  const canCorrect = Boolean(reading && reading.confidence > .72 && expectedMidi !== undefined && !noteMatches);
  const currentVerified = selectedButton ? verifiedTargets.has(targetKey(selectedButton.id, direction)) : false;
  const matchingButtons = useMemo(
    () => accordion.buttons.filter((button) => button.pushMidi === reading?.midi || button.pullMidi === reading?.midi),
    [accordion.buttons, reading?.midi],
  );

  useEffect(() => { void start(); return stop; }, [start, stop]);
  useEffect(() => { setRememberedSignal((previous) => rememberReliablePitch(previous, detector.reading)); }, [detector.reading]);

  const selectTarget = (buttonId: string, nextDirection = direction) => {
    setSelectedButtonId(buttonId);
    setDirection(nextDirection);
    setSaveMessage('');
  };

  const moveTarget = (offset: number) => {
    const target = nextTunerTarget(targets, selectedButtonId, direction, offset);
    if (target) selectTarget(target.buttonId, target.direction);
  };

  const archiveReading = async (
    outcome: TunerReading['outcome'],
    capturedReading: PitchReading,
    capturedExpectedMidi: number,
    capturedAccordion: Pick<AccordionConfig, 'id' | 'model'> = accordion,
  ) => {
    if (!selectedButton) return false;
    const tunerReading: TunerReading = {
      id: crypto.randomUUID(),
      sessionId,
      accordionId: capturedAccordion.id,
      accordionModel: capturedAccordion.model,
      buttonId: selectedButton.id,
      row: selectedButton.row,
      buttonIndex: selectedButton.index,
      direction,
      expectedMidi: capturedExpectedMidi,
      detectedMidi: capturedReading.midi,
      frequency: capturedReading.frequency,
      cents: capturedReading.cents,
      confidence: capturedReading.confidence,
      volume: capturedReading.volume,
      outcome,
      measuredAt: new Date().toISOString(),
    };
    setSessionReadings((previous) => [...previous, tunerReading]);
    try {
      const response = await fetch('/api/tuner-readings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tunerReading),
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  const validateAndContinue = async () => {
    if (!selectedButton || !reading || expectedMidi === undefined) return;
    setSaving(true);
    const archived = await archiveReading('matched', reading, expectedMidi);
    setVerifiedTargets((previous) => new Set(previous).add(targetKey(selectedButton.id, direction)));
    setSaveMessage(`${direction === 'push' ? 'Pousser' : 'Tirer'} vérifié pour le bouton ${selectedButton.index}.${archived ? ' Relevé archivé.' : ' Relevé gardé pour l’export local.'}`);
    setSaving(false);
    window.setTimeout(() => moveTarget(1), 380);
  };

  const applyDetectedNote = async () => {
    if (!selectedButton || !reading || !canCorrect) return;
    const capturedReading = reading;
    const capturedExpectedMidi = expectedMidi;
    setSaving(true);
    setSaveMessage('');
    try {
      const buttons = accordion.buttons.map((button) => button.id !== selectedButton.id ? button : direction === 'push'
        ? { ...button, pushMidi: reading.midi, push: noteFromMidi(reading.midi) }
        : { ...button, pullMidi: reading.midi, pull: noteFromMidi(reading.midi) });
      const isCustom = accordion.id.startsWith('custom-');
      const draft = {
        ...accordion,
        ...(isCustom ? {} : { model: `${accordion.model} — mon instrument` }),
        buttons,
        verified: false,
        sourceNote: `Configuration ajustée avec l’accordeur le ${new Date().toLocaleDateString('fr-FR')}.`,
      };
      const response = await fetch(isCustom ? `/api/accordions/${accordion.id}` : '/api/accordions', {
        method: isCustom ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const payload = await response.json() as { accordion?: AccordionConfig; error?: string };
      if (!response.ok || !payload.accordion) throw new Error(payload.error ?? 'Impossible d’enregistrer la note.');
      const savedAccordion = payload.accordion;
      const archived = capturedExpectedMidi === undefined
        ? false
        : await archiveReading('corrected', capturedReading, capturedExpectedMidi, savedAccordion);
      onAccordionChange(savedAccordion);
      const savedButton = savedAccordion.buttons.find((button) => button.row === selectedButton.row && button.index === selectedButton.index);
      if (savedButton) setSelectedButtonId(savedButton.id);
      setVerifiedTargets((previous) => new Set(previous).add(targetKey(savedButton?.id ?? selectedButton.id, direction)));
      setSaveMessage(`${direction === 'push' ? 'Pousser' : 'Tirer'} · bouton ${selectedButton.index} corrigé en ${noteFromMidi(capturedReading.midi)}.${archived ? ' Relevé archivé.' : ' Relevé gardé pour l’export local.'}`);
      window.setTimeout(() => {
        const updatedTargets = createTunerTargets(savedAccordion);
        const target = nextTunerTarget(updatedTargets, savedButton?.id ?? selectedButton.id, direction);
        if (target) selectTarget(target.buttonId, target.direction);
      }, 500);
    } catch (reason) {
      setSaveMessage(reason instanceof Error ? reason.message : 'Impossible d’enregistrer la note.');
    } finally {
      setSaving(false);
    }
  };

  const exportReadings = async () => {
    setExporting(true);
    setSaveMessage('');
    try {
      let readings = sessionReadings;
      if (!readings.length) {
        const response = await fetch('/api/tuner-readings');
        if (response.ok) readings = (await response.json() as { readings: TunerReading[] }).readings;
      }
      const report = buildTunerExport(accordion, readings);
      const url = URL.createObjectURL(new Blob([`${JSON.stringify(report, null, 2)}\n`], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = tunerExportFilename(accordion);
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setSaveMessage(readings.length
        ? `${readings.length} relevé${readings.length > 1 ? 's' : ''} et la cartographie complète ont été exportés.`
        : 'La cartographie complète a été exportée. Les relevés fins commenceront à la prochaine validation.');
    } catch {
      setSaveMessage('Export impossible pour le moment. Réessaie sans quitter cette page.');
    } finally {
      setExporting(false);
    }
  };

  const actionLabel = saving
    ? 'Enregistrement…'
    : noteMatches
      ? `Valider ${direction === 'push' ? 'pousser' : 'tirer'} et continuer`
      : canCorrect
        ? `Corriger avec ${reading?.note} et continuer`
        : 'Joue la note de ce bouton';

  return (
    <main className="tuner-page page-content">
      <header className="page-heading tuner-heading tuner-heading-compact">
        <div>
          <button type="button" className="back-link" onClick={onBack}><ChevronLeft /> Retour</button>
          <span className="eyebrow">Vérification guidée</span>
          <h1>Accordeur</h1>
          <p>Sélectionne un bouton, joue pousser puis tirer : Soufflet mémorise la dernière note fiable et t’emmène au geste suivant.</p>
        </div>
        <div className="tuner-heading-actions">
          <button type="button" className="tuner-export-button" onClick={() => void exportReadings()} disabled={exporting}>
            <Download /> <span><strong>{exporting ? 'Préparation…' : 'Exporter les relevés'}</strong><small>JSON · notes, Hz, cents et confiance</small></span>
          </button>
          <div className="tuner-progress-summary" aria-label={`${verifiedTargets.size} gestes vérifiés sur ${targets.length} dans cette session`}>
            <CircleCheck />
            <span><strong>{verifiedTargets.size} / {targets.length}</strong><small>session actuelle</small></span>
            <i><b style={{ width: `${targets.length ? (verifiedTargets.size / targets.length) * 100 : 0}%` }} /></i>
          </div>
        </div>
      </header>

      <section className="tuner-guided-workspace">
        <aside className="tuner-control-card">
          <div className="tuner-step-label"><span>1</span><div><small>ÉCOUTER</small><strong>Joue une note tenue</strong></div></div>
          <div className={`tuner-dial tuner-dial-compact ${inTune ? 'is-tuned' : ''}`}>
            <div className="tuner-scale">{[-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50].map((value) => <i key={value} className={value === 0 ? 'is-center' : ''}><span>{value}</span></i>)}</div>
            <div className="tuner-needle" style={{ transform: `rotate(${Math.max(-45, Math.min(45, cents * .9))}deg)` }} />
            <div className="tuner-reading">
              {detector.status === 'listening' && reading ? <>
                <small>{isRememberedReading ? 'Dernière note mémorisée' : inTune ? <><Check /> Juste</> : cents < 0 ? 'Trop bas' : 'Trop haut'}</small>
                <strong>{reading.note}</strong><span>{reading.frequency.toFixed(1)} Hz</span><em>{cents > 0 ? '+' : ''}{cents} cents</em>
              </> : <><Mic2 /><strong>—</strong><span>{detector.status === 'requesting' ? 'Autorisation…' : 'En attente d’une note'}</span></>}
            </div>
          </div>
          <div className="tuner-signal-compact">
            <span><Volume2 /> Signal</span>
            <i><b style={{ width: `${Math.min(100, (liveReading?.volume ?? 0) * 900)}%` }} /></i>
            <strong>{liveReading ? `${Math.round(liveReading.confidence * 100)} %` : '—'}</strong>
          </div>
          <details className="tuner-fine-settings">
            <summary><SlidersHorizontal /> Réglages de précision</summary>
            <label>La de référence <strong>{a4} Hz</strong><input type="range" min="430" max="450" value={a4} onChange={(event) => setA4(Number(event.target.value))} /></label>
            <label>Tolérance <strong>± {tolerance} cents</strong><input type="range" min="3" max="15" value={tolerance} onChange={(event) => setTolerance(Number(event.target.value))} /></label>
          </details>
          <button type="button" className="tuner-relisten" onClick={() => { setRememberedSignal(null); detector.stop(); void detector.start(); }}><RotateCcw /> Effacer la note mémorisée</button>
        </aside>

        <section className="tuner-instrument-card tuner-guided-card">
          <header className="tuner-target-header">
            <div className="tuner-step-label"><span>2</span><div><small>VÉRIFIER</small><strong>Choisis le bouton et le sens</strong></div></div>
            <div className="tuner-target-navigation">
              <button type="button" aria-label="Geste précédent" disabled={targetIndex === 0} onClick={() => moveTarget(-1)}><ChevronLeft /></button>
              <strong>{targetIndex + 1} / {targets.length}</strong>
              <button type="button" aria-label="Geste suivant" disabled={targetIndex >= targets.length - 1} onClick={() => moveTarget(1)}><ChevronRight /></button>
            </div>
          </header>

          <div className="tuner-target-controls">
            <label>
              <small>Bouton</small>
              <select value={selectedButton?.id ?? ''} onChange={(event) => selectTarget(event.target.value)}>
                {accordion.buttons.map((button) => <option key={button.id} value={button.id}>Bouton {button.index} · rang {rowLabel(button.row)}</option>)}
              </select>
            </label>
            <div className="direction-choice" aria-label="Direction du soufflet">
              <button type="button" className={direction === 'push' ? 'is-active' : ''} onClick={() => selectTarget(selectedButtonId, 'push')}><ArrowRight /> Pousser</button>
              <button type="button" className={direction === 'pull' ? 'is-active' : ''} onClick={() => selectTarget(selectedButtonId, 'pull')}><ArrowLeft /> Tirer</button>
            </div>
          </div>

          <div className="tuner-accordion-viewport">
            <AccordionInstrument
              config={accordion}
              notation={notation}
              direction={direction}
              detectedMidi={reading?.midi}
              selectedButtonId={selectedButton?.id}
              context="tuner"
              onButtonPress={(buttonId) => selectTarget(buttonId)}
            />
          </div>

          <div className={`tuner-check-panel ${noteMatches ? 'is-match' : canCorrect ? 'is-mismatch' : ''}`}>
            <div className="tuner-expected-note">
              <small>Ce bouton doit jouer</small>
              <strong>{noteFromMidi(expectedMidi ?? 60)}</strong>
              <span>{direction === 'push' ? '→ fermer · pousser' : '← ouvrir · tirer'}</span>
            </div>
            <i>{noteMatches ? <Check /> : reading ? <AlertTriangle /> : <Mic2 />}</i>
            <div className="tuner-heard-note">
              <small>{isRememberedReading ? 'Dernière note entendue' : 'Note entendue'}</small>
              <strong>{reading?.note ?? '—'}</strong>
              <span>{reading ? `${Math.round(reading.confidence * 100)} % de confiance` : 'Joue doucement et tiens le son'}</span>
            </div>
            <button
              type="button"
              className="primary-button tuner-confirm-button"
              disabled={(!noteMatches && !canCorrect) || saving || currentVerified}
              onClick={() => noteMatches ? void validateAndContinue() : void applyDetectedNote()}
            >
              {currentVerified ? 'Geste déjà vérifié' : actionLabel} {canCorrect ? <Save /> : <ChevronRight />}
            </button>
          </div>
          {saveMessage && <p className="mapping-message tuner-inline-message">{saveMessage}</p>}
          {matchingButtons.length > 0 && <p className="tuner-location-hint"><Info /> La note entendue existe à {matchingButtons.length} endroit{matchingButtons.length > 1 ? 's' : ''} sur cette configuration. Le bouton entouré reste celui que tu vérifies.</p>}
        </section>
      </section>

      <section className="tuner-help tuner-help-compact"><Info /><div><strong>Mesure fiable et privée</strong><p>Une seule note à la fois · soufflet régulier · téléphone éloigné des bruits mécaniques · attends la stabilisation avant de corriger. Seules les mesures que tu valides sont archivées avec ton compte ; jamais l’audio.</p></div></section>
    </main>
  );
}
