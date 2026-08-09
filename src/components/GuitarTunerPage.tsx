import { ArrowLeft, Check, Guitar, Mic2, RotateCcw, Volume2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { guitarFrequency, guitarNoteLabel, nearestGuitarString } from '../guitar';
import { usePitchDetector } from '../hooks/usePitchDetector';
import { useSynth } from '../hooks/useSynth';
import type { GuitarConfig } from '../types';

export function GuitarTunerPage({ guitar, onBack }: { guitar: GuitarConfig; onBack: () => void }) {
  const detector = usePitchDetector();
  const { playGuitarMidi } = useSynth();
  const [selectedString, setSelectedString] = useState(guitar.strings[0]?.number ?? 6);
  const [automatic, setAutomatic] = useState(true);
  const target = guitar.strings.find((string) => string.number === selectedString) ?? guitar.strings[0];
  useEffect(() => {
    if (!automatic || !detector.reading) return;
    const nearest = nearestGuitarString(detector.reading.midi, guitar);
    if (Math.abs(nearest.midi + guitar.capo - detector.reading.midi) <= 3) setSelectedString(nearest.number);
  }, [automatic, detector.reading, guitar]);
  const targetMidi = (target?.midi ?? 40) + guitar.capo;
  const cents = detector.reading ? 1200 * Math.log2(detector.reading.frequency / guitarFrequency(targetMidi)) : 0;
  const inTune = Boolean(detector.reading && Math.abs(cents) <= 6);
  const quality = !detector.reading ? 'En attente' : inTune ? 'Juste' : cents < 0 ? 'Trop grave' : 'Trop aigu';
  const orderedStrings = useMemo(() => guitar.handedness === 'left' ? [...guitar.strings].reverse() : guitar.strings, [guitar]);
  return <main className="page-content guitar-tuner"><button type="button" className="back-link" onClick={() => { detector.stop(); onBack(); }}><ArrowLeft /> Retour</button><header className="page-heading split-heading"><div><span className="eyebrow">Accordeur chromatique · Guitare</span><h1>Accorde corde par corde.</h1><p>Joue une corde à vide, laisse-la sonner, puis ajuste jusqu’au centre. Soufflet mémorise la dernière mesure stable.</p></div><button type="button" className={`secondary-button ${automatic ? 'is-active' : ''}`} onClick={() => setAutomatic(!automatic)}><RotateCcw /> Sélection {automatic ? 'automatique' : 'manuelle'}</button></header>
    <section className="guitar-tuner-layout"><div className={`guitar-tuner-dial ${inTune ? 'is-tuned' : ''}`}><span className="guitar-tuner-status">{inTune && <Check />}{quality}</span><strong>{detector.reading ? guitarNoteLabel(detector.reading.midi) : guitarNoteLabel(targetMidi)}</strong><small>{detector.reading ? `${detector.reading.frequency.toFixed(1)} Hz` : `${guitarFrequency(targetMidi).toFixed(1)} Hz attendu`}</small><div className="guitar-cents-scale"><i style={{ transform: `translateX(${Math.max(-50, Math.min(50, cents))}%) rotate(${Math.max(-45, Math.min(45, cents * .9))}deg)` }} /><span>-50</span><span>-25</span><span>0</span><span>+25</span><span>+50</span></div><em>{detector.reading ? `${cents > 0 ? '+' : ''}${Math.round(cents)} cents` : '—'}</em><button type="button" className="primary-button" onClick={() => detector.status === 'listening' ? detector.stop() : void detector.start()}><Mic2 />{detector.status === 'listening' ? 'Arrêter' : 'Démarrer l’écoute'}</button>{detector.error && <p>{detector.error}</p>}</div>
      <div className="guitar-tuner-strings"><header><Guitar /><div><strong>{guitar.name}</strong><span>{guitar.capo ? `Capodastre case ${guitar.capo}` : 'Sans capodastre'} · A4 = 440 Hz</span></div></header>{orderedStrings.map((string) => { const midi = string.midi + guitar.capo; const active = selectedString === string.number; return <div key={string.number} className={active ? 'is-active' : ''}><button type="button" className="guitar-string-select" onClick={() => { setSelectedString(string.number); setAutomatic(false); }}><span>{string.number}</span><i style={{ height: `${Math.max(1, 7 - string.number)}px` }} /><span><strong>{guitarNoteLabel(midi)}</strong><small>{guitarFrequency(midi).toFixed(1)} Hz</small></span></button><button type="button" className="guitar-string-reference" aria-label={`Écouter la corde ${string.number}`} onClick={() => playGuitarMidi(midi, 1.2)}><Volume2 /></button></div>; })}<footer><span><Mic2 /> Micro analysé localement</span><small>Pour limiter les harmoniques parasites, étouffe les autres cordes avec la main.</small></footer></div></section>
  </main>;
}
