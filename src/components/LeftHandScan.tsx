import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, Cloud, Hand, Mic2, RefreshCw, ScanLine, ShieldCheck, X } from 'lucide-react';
import type { AudioFeatureFrame, AudioOnset } from '../audioTraining';
import {
  analyzeLeftHandFrames, buildLeftHandScanSample, expectedLeftHandLabel, type LeftHandSoundAnalysis,
} from '../leftHandAnalysis';
import { createTunerTargets, type TunerTarget } from '../tunerWorkflow';
import type { AccordionConfig, Direction, LeftHandAcousticProfile, LeftHandScanSample } from '../types';

interface LeftHandScanProps {
  accordion: AccordionConfig;
  audioFrame: AudioFeatureFrame | null;
  onset: AudioOnset | null;
  referencePitchHz: number;
  onTargetChange: (buttonId: string, direction: Direction) => void;
  onVerified: (sample: LeftHandScanSample) => void;
  onActiveChange: (active: boolean) => void;
}

type ScanPhase = 'intro' | 'armed' | 'capturing' | 'release' | 'review' | 'saving' | 'complete';

function scanInstruction(phase: ScanPhase, direction: Direction) {
  if (phase === 'capturing') return 'Tiens le son…';
  if (phase === 'release') return 'Relâche le bouton';
  if (phase === 'review') return 'Vérifie ce résultat';
  if (phase === 'saving') return 'Synchronisation…';
  if (phase === 'complete') return 'Cartographie terminée';
  return direction === 'push' ? 'Pousse et tiens le bouton indiqué' : 'Tire et tiens le bouton indiqué';
}

function leftButtonPosition(index: number) {
  const level = ['haut', '2e niveau', '3e niveau', 'bas'][Math.ceil(index / 2) - 1] ?? `niveau ${Math.ceil(index / 2)}`;
  return `${level} · ${index % 2 ? 'intérieur' : 'extérieur'}`;
}

export function LeftHandScan({ accordion, audioFrame, onset, referencePitchHz, onTargetChange, onVerified, onActiveChange }: LeftHandScanProps) {
  const targets = useMemo(() => createTunerTargets(accordion).filter((target) => target.hand === 'left'), [accordion]);
  const [active, setActive] = useState(false);
  const [phase, setPhaseState] = useState<ScanPhase>('intro');
  const [targetIndex, setTargetIndex] = useState(0);
  const [samples, setSamples] = useState<LeftHandScanSample[]>([]);
  const [pending, setPending] = useState<{ sample: LeftHandScanSample; analysis: LeftHandSoundAnalysis } | null>(null);
  const [message, setMessage] = useState('');
  const framesRef = useRef<AudioFeatureFrame[]>([]);
  const phaseRef = useRef<ScanPhase>('intro');
  const targetIndexRef = useRef(0);
  const samplesRef = useRef<LeftHandScanSample[]>([]);
  const captureTimerRef = useRef<number>(0);
  const quietFramesRef = useRef(0);
  const lastOnsetIdRef = useRef(0);

  const setPhase = (next: ScanPhase) => {
    phaseRef.current = next;
    setPhaseState(next);
  };

  useEffect(() => () => window.clearTimeout(captureTimerRef.current), []);
  useEffect(() => { targetIndexRef.current = targetIndex; }, [targetIndex]);
  useEffect(() => { samplesRef.current = samples; }, [samples]);

  const saveProfile = useCallback(async (completedSamples: LeftHandScanSample[]) => {
    setPhase('saving');
    const profile: LeftHandAcousticProfile = {
      accordionId: accordion.id,
      accordionModel: accordion.model,
      referencePitchHz,
      completedAt: new Date().toISOString(),
      samples: completedSamples,
    };
    try {
      const response = await fetch('/api/audio-profiles/left-hand', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      if (!response.ok) throw new Error('sync');
      setMessage('Profil acoustique synchronisé avec ton compte. Il sera disponible sur tes autres appareils.');
    } catch {
      setMessage('Le scan est terminé, mais la synchronisation a échoué. Garde cette page ouverte et relance le scan plus tard.');
    }
    setPhase('complete');
  }, [accordion.id, accordion.model, referencePitchHz]);

  const moveNext = useCallback((accepted?: LeftHandScanSample) => {
    const completedSamples = accepted ? [...samplesRef.current, accepted] : samplesRef.current;
    if (accepted) {
      samplesRef.current = completedSamples;
      setSamples(completedSamples);
      onVerified(accepted);
    }
    setPending(null);
    quietFramesRef.current = 0;
    const nextIndex = targetIndexRef.current + 1;
    if (nextIndex >= targets.length) {
      void saveProfile(completedSamples);
      return;
    }
    targetIndexRef.current = nextIndex;
    setTargetIndex(nextIndex);
    const target = targets[nextIndex];
    onTargetChange(target.buttonId, target.direction);
    setPhase('armed');
  }, [onTargetChange, onVerified, saveProfile, targets]);

  const finishCapture = useCallback(() => {
    if (phaseRef.current !== 'capturing') return;
    const target = targets[targetIndexRef.current];
    const button = accordion.basses.find((item) => item.id === target?.buttonId);
    if (!target || !button) return;
    const analysis = analyzeLeftHandFrames(framesRef.current, button.role === 'chord' ? 'chord' : 'bass', referencePitchHz);
    if (!analysis) {
      setMessage('Le signal était trop court ou trop faible. Rejoue le geste en tenant le son environ une seconde.');
      setPhase('review');
      return;
    }
    const sample = buildLeftHandScanSample(button, target.direction, analysis);
    setPending({ sample, analysis });
    if (sample.outcome === 'matched') {
      setMessage(`${sample.detectedLabel} reconnu avec ${Math.round(sample.confidence * 100)} % de confiance.`);
      setPhase('release');
    } else {
      setMessage(sample.outcome === 'uncertain'
        ? `Résultat incertain (${Math.round(sample.confidence * 100)} %). Rejoue le geste avant de le conserver.`
        : `Soufflet attend ${sample.expectedLabel}, mais entend plutôt ${sample.detectedLabel}. Rejoue pour écarter une fausse mesure.`);
      setPhase('review');
    }
  }, [accordion.basses, referencePitchHz, targets]);

  useEffect(() => {
    if (!active || phaseRef.current !== 'armed' || !onset || onset.id === lastOnsetIdRef.current) return;
    lastOnsetIdRef.current = onset.id;
    framesRef.current = [];
    setMessage('Analyse des fondamentales et des harmoniques…');
    setPhase('capturing');
    window.clearTimeout(captureTimerRef.current);
    captureTimerRef.current = window.setTimeout(finishCapture, 1250);
  }, [active, finishCapture, onset]);

  useEffect(() => {
    if (!active || !audioFrame) return;
    if (phaseRef.current === 'capturing') framesRef.current.push(audioFrame);
    if (phaseRef.current !== 'release') return;
    quietFramesRef.current = audioFrame.volume < .007 ? quietFramesRef.current + 1 : 0;
    if (quietFramesRef.current >= 5 && pending) moveNext(pending.sample);
  }, [active, audioFrame, moveNext, pending]);

  const startScan = () => {
    const first = targets[0];
    if (!first) return;
    window.clearTimeout(captureTimerRef.current);
    samplesRef.current = [];
    targetIndexRef.current = 0;
    setSamples([]);
    setTargetIndex(0);
    setPending(null);
    setMessage('Le scan avance tout seul après chaque son fiable. Joue un seul bouton à la fois.');
    setActive(true);
    onActiveChange(true);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    lastOnsetIdRef.current = onset?.id ?? 0;
    onTargetChange(first.buttonId, first.direction);
    setPhase('armed');
  };

  const retry = () => {
    window.clearTimeout(captureTimerRef.current);
    framesRef.current = [];
    setPending(null);
    setMessage('Relâche, puis rejoue le même geste en tenant le son.');
    setPhase('armed');
  };

  const close = () => {
    window.clearTimeout(captureTimerRef.current);
    setActive(false);
    onActiveChange(false);
    setPending(null);
    setPhase('intro');
  };

  if (!active) {
    return (
      <section className="left-scan-invitation">
        <span><ScanLine /></span>
        <div><strong>Cartographier automatiquement la main gauche</strong><p>16 gestes, environ 2 minutes. Soufflet distingue basses et accords puis synchronise uniquement leur empreinte harmonique — jamais l’enregistrement.</p></div>
        <button type="button" className="secondary-button" onClick={startScan}><ScanLine /> Démarrer le scan</button>
      </section>
    );
  }

  const target: TunerTarget | undefined = targets[targetIndex];
  const button = accordion.basses.find((item) => item.id === target?.buttonId);
  const progress = targets.length ? samples.length / targets.length * 100 : 0;

  return (
    <section className={`left-scan-panel is-${phase}`} aria-live="polite">
      <header>
        <div><span><Hand /></span><div><small>SCAN MAIN GAUCHE</small><strong>{scanInstruction(phase, target?.direction ?? 'push')}</strong></div></div>
        <button type="button" onClick={close} aria-label="Fermer le scan"><X /></button>
      </header>
      <div className="left-scan-progress"><i><b style={{ width: `${progress}%` }} /></i><strong>{Math.min(targetIndex + 1, targets.length)} / {targets.length}</strong></div>
      {button && target && <div className="left-scan-target">
        <span className={target.direction === 'push' ? 'is-push' : 'is-pull'}>{target.direction === 'push' ? '→ POUSSER' : '← TIRER'}</span>
        <div><small>{button.role === 'chord' ? 'ACCORD ATTENDU' : 'BASSE ATTENDUE'}</small><strong>{expectedLeftHandLabel(button, target.direction)}</strong><em>{leftButtonPosition(button.index)}</em></div>
        <i className={phase === 'capturing' ? 'is-listening' : ''}>{phase === 'release' ? <Check /> : <Mic2 />}</i>
      </div>}
      {pending && <div className={`left-scan-result is-${pending.sample.outcome}`}><span>{pending.sample.outcome === 'matched' ? <Check /> : <AlertTriangle />}</span><div><small>ENTENDU</small><strong>{pending.sample.detectedLabel}</strong><em>{Math.round(pending.sample.confidence * 100)} % de confiance</em></div></div>}
      <p className="left-scan-message">{phase === 'complete' ? <Cloud /> : <ShieldCheck />}{message}</p>
      {phase === 'review' && <footer>
        <button type="button" className="secondary-button" onClick={retry}><RefreshCw /> Rejouer ce geste</button>
        {pending && <button type="button" className="text-button" onClick={() => moveNext(pending.sample)}>Conserver ce relevé</button>}
      </footer>}
      {phase === 'complete' && <footer><button type="button" className="primary-button" onClick={close}><Check /> Terminer</button><button type="button" className="text-button" onClick={startScan}>Refaire le scan</button></footer>}
    </section>
  );
}
