import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, Gauge, Guitar, Keyboard, Library, Mic2, Piano, Play, Sparkles, Usb, Volume2 } from 'lucide-react';
import type { GuitarConfig, InstrumentArrangementEvent, PianoConfig } from '../types';
import { pianoRange } from '../piano';
import { PianoFallingStage } from './PianoKeyboard';
import { useSynth } from '../hooks/useSynth';
import { usePitchDetector } from '../hooks/usePitchDetector';

interface MidiMessageLike { data: ArrayLike<number> }
interface MidiInputLike { onmidimessage: ((event: MidiMessageLike) => void) | null }
interface MidiAccessLike { inputs: Map<unknown, MidiInputLike>; onstatechange: (() => void) | null }

const PIANO_TUTORIAL_EVENTS: InstrumentArrangementEvent[] = [
  { id: 'piano-tutorial-c', beat: 0, duration: .85, midis: [60], hand: 'right', fingers: [1], label: 'Do' },
  { id: 'piano-tutorial-d', beat: 1, duration: .85, midis: [62], hand: 'right', fingers: [2], label: 'Ré' },
  { id: 'piano-tutorial-e', beat: 2, duration: 1.2, midis: [64], hand: 'right', fingers: [3], label: 'Mi' },
];

export function PianoFirstTutorial({ piano, notation, onComplete }: { piano: PianoConfig; notation: 'french' | 'english'; onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [demoBeat, setDemoBeat] = useState(-2.4);
  const [demoRunning, setDemoRunning] = useState(false);
  const [noteIndex, setNoteIndex] = useState(0);
  const [active, setActive] = useState<Set<number>>(new Set());
  const [wrong, setWrong] = useState<number | null>(null);
  const [midiStatus, setMidiStatus] = useState<'idle' | 'ready' | 'unavailable'>('idle');
  const { playPianoMidi } = useSynth();
  const detector = usePitchDetector();
  const startDetector = detector.start;
  const stopDetector = detector.stop;
  const playedDemo = useRef(new Set<string>());
  const midis = useMemo(() => pianoRange(piano.keyboardSize), [piano.keyboardSize]);
  const expectedMidi = PIANO_TUTORIAL_EVENTS[noteIndex]?.midis[0];
  const complete = noteIndex >= PIANO_TUTORIAL_EVENTS.length;

  const runDemo = useCallback(() => {
    setDemoBeat(-2.4); playedDemo.current.clear(); setDemoRunning(true);
  }, []);
  useEffect(() => { const timer = window.setTimeout(runDemo, 500); return () => window.clearTimeout(timer); }, [runDemo]);
  useEffect(() => {
    if (!demoRunning || step !== 0) return;
    let frame = 0; let previous = performance.now();
    const animate = (time: number) => {
      const delta = (time - previous) / 1000; previous = time;
      setDemoBeat((current) => {
        const next = current + delta * 1.35;
        PIANO_TUTORIAL_EVENTS.forEach((event) => { if (event.beat <= next && event.beat > current && !playedDemo.current.has(event.id)) { playedDemo.current.add(event.id); playPianoMidi(event.midis[0], .7); } });
        if (next >= 3.4) { setDemoRunning(false); return 3.4; }
        return next;
      });
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [demoRunning, playPianoMidi, step]);

  const hit = useCallback((midi: number, audible = true) => {
    if (audible) playPianoMidi(midi);
    setActive(new Set([midi])); window.setTimeout(() => setActive(new Set()), 230);
    if (step !== 1 || complete) return;
    if (midi !== expectedMidi) { setWrong(midi); window.setTimeout(() => setWrong(null), 420); return; }
    setWrong(null); setNoteIndex((index) => index + 1);
  }, [complete, expectedMidi, playPianoMidi, step]);
  useEffect(() => { if (step === 1 && piano.input === 'microphone' && detector.status === 'idle') void startDetector(); }, [detector.status, piano.input, startDetector, step]);
  useEffect(() => { if (step === 1 && detector.reading) hit(detector.reading.midi, false); }, [detector.reading, hit, step]);
  useEffect(() => { if (complete) stopDetector(); }, [complete, stopDetector]);
  useEffect(() => {
    const keyMap: Record<string, number> = { a: 60, z: 62, e: 64 };
    const listener = (event: KeyboardEvent) => { const midi = keyMap[event.key.toLowerCase()]; if (midi !== undefined && !event.repeat) hit(midi); };
    window.addEventListener('keydown', listener); return () => window.removeEventListener('keydown', listener);
  }, [hit]);
  const connectMidi = async () => {
    const request = (navigator as Navigator & { requestMIDIAccess?: () => Promise<MidiAccessLike> }).requestMIDIAccess;
    if (!request) { setMidiStatus('unavailable'); return; }
    try {
      const access = await request.call(navigator);
      const bind = () => access.inputs.forEach((input) => { input.onmidimessage = (message) => { const [command = 0, midi = 0, velocity = 0] = Array.from(message.data); if ((command & 0xf0) === 0x90 && velocity > 0) hit(midi, false); }; });
      bind(); access.onstatechange = bind; setMidiStatus('ready');
    } catch { setMidiStatus('unavailable'); }
  };
  const next = () => { if (step === 0) { setDemoRunning(false); setStep(1); } else if (step === 1 && complete) { stopDetector(); setStep(2); } else if (step === 2) onComplete(); };
  const practiceBeat = complete ? 2.9 : PIANO_TUTORIAL_EVENTS[noteIndex]?.beat ?? 0;

  return <main className="instrument-tutorial piano-first-tutorial">
    <header><span className="brand-lockup"><span className="brand-mark"><i /><i /><i /></span><strong>soufflet</strong></span><div className="instrument-tutorial-progress">{[0,1,2].map((value) => <i key={value} className={value <= step ? 'is-done' : ''} />)}</div><span>Tutoriel piano · {step + 1}/3</span></header>
    <section className="instrument-tutorial-copy"><span className="eyebrow"><Piano /> {step === 0 ? 'Observe' : step === 1 ? 'À ton tour' : 'Tes repères'}</span><h1>{step === 0 ? 'Regarde les notes tomber.' : step === 1 ? complete ? 'Tes trois notes sont justes !' : 'Joue Do, Ré, Mi.' : 'Tu retrouveras toujours ce lecteur.'}</h1><p>{step === 0 ? 'Chaque tuile descend vers la touche à jouer. La ligne dorée donne le moment exact.' : step === 1 ? 'Le rythme est libre pour ce premier essai. Utilise le piano, les touches A–Z–E ou le clavier à l’écran.' : 'Les mêmes tuiles servent en démonstration, lecture guidée, attente de la bonne note et performance.'}</p></section>
    {step < 2 ? <section className={`tutorial-piano-stage ${wrong !== null ? 'has-error' : ''} ${complete ? 'is-success' : ''}`}>
      {complete && <div className="tutorial-success-burst"><Sparkles /><strong>Première mélodie réussie</strong><span>{piano.input === 'microphone' ? 'Le micro est maintenant coupé.' : 'Ton premier geste est validé.'}</span></div>}
      <PianoFallingStage midis={midis} events={PIANO_TUTORIAL_EVENTS} beat={step === 0 ? demoBeat : practiceBeat} expected={step === 1 && expectedMidi !== undefined ? [expectedMidi] : []} active={active} notation={notation} onHit={hit} lookAhead={5} className="is-tutorial" />
      {step === 1 && <div className="tutorial-input-status"><span>{[0,1,2].map((value) => <i key={value} className={value < noteIndex ? 'is-done' : value === noteIndex ? 'is-current' : ''}>{value < noteIndex ? <Check /> : value + 1}</i>)}</span>{piano.input === 'midi' && <button type="button" onClick={() => void connectMidi()} className={midiStatus === 'ready' ? 'is-ready' : ''}><Usb /> {midiStatus === 'ready' ? 'MIDI connecté' : 'Connecter mon piano'}</button>}{piano.input === 'microphone' && <span className="tutorial-micro-status"><Mic2 /> {detector.status === 'listening' ? 'Micro actif' : 'Micro indisponible · utilise l’écran'}</span>}<small><Keyboard /> A = Do · Z = Ré · E = Mi</small></div>}
    </section> : <section className="tutorial-interface-tour"><article><Play /><strong>Démonstration</strong><span>Écoute et observe sans microphone.</span></article><article><Volume2 /><strong>Lecture guidée</strong><span>Joue avec le morceau et reçois un retour.</span></article><article><Check /><strong>Attendre les notes</strong><span>La musique avance seulement quand le geste est juste.</span></article><article><Gauge /><strong>Performance</strong><span>Joue sans aide, puis consulte ton bilan.</span></article><aside><Library /><span><strong>Ta bibliothèque est commune</strong>Chaque morceau peut avoir un arrangement piano, accordéon et guitare.</span></aside></section>}
    <footer><button type="button" className="primary-button" disabled={step === 1 && !complete} onClick={next}>{step === 0 ? demoRunning ? 'Passer à mon essai' : 'À mon tour' : step === 1 ? 'Découvrir l’interface' : 'Ouvrir mon tableau de bord'} <ArrowRight /></button></footer>
  </main>;
}

export function GuitarFirstTutorial({ guitar, onComplete }: { guitar: GuitarConfig; onComplete: () => void }) {
  const route = [{ string: 1, fret: 0 }, { string: 1, fret: 1 }, { string: 1, fret: 3 }];
  const [index, setIndex] = useState(0);
  const [activeMidi, setActiveMidi] = useState<number | null>(null);
  const { playGuitarMidi } = useSynth();
  const current = route[index];
  const string = guitar.strings.find((item) => item.number === current?.string) ?? guitar.strings[0];
  const hit = (fret: number) => {
    const midi = string.midi + guitar.capo + fret; playGuitarMidi(midi); setActiveMidi(midi); window.setTimeout(() => setActiveMidi(null), 260);
    if (fret === current?.fret) setIndex((value) => value + 1);
  };
  const complete = index >= route.length;
  return <main className="instrument-tutorial guitar-first-tutorial"><header><span className="brand-lockup"><span className="brand-mark"><i /><i /><i /></span><strong>soufflet</strong></span><span>Tutoriel guitare</span></header><section className="instrument-tutorial-copy"><span className="eyebrow"><Guitar /> Premier riff</span><h1>{complete ? 'Tes trois notes sont justes !' : 'Joue corde 1 : à vide, case 1, case 3.'}</h1><p>Le rond lumineux indique la corde, la case et le doigt. Touche les positions dans l’ordre pour essayer l’interface réelle.</p></section><section className={`tutorial-guitar-neck ${complete ? 'is-success' : ''}`}>{complete && <div className="tutorial-success-burst"><Sparkles /><strong>Premier riff réussi</strong></div>}<div>{[0,1,2,3,4,5].map((fret) => { const midi = string.midi + guitar.capo + fret; const expected = current?.fret === fret; return <button type="button" key={fret} className={`${expected ? 'is-expected' : ''} ${activeMidi === midi ? 'is-active' : ''}`} onClick={() => hit(fret)}><i /><span>{fret}</span>{expected && <b>{fret === 0 ? '0' : fret === 1 ? '1' : '3'}</b>}</button>; })}</div></section><footer><button type="button" className="primary-button" disabled={!complete} onClick={onComplete}>Ouvrir mon tableau de bord <ArrowRight /></button></footer></main>;
}
