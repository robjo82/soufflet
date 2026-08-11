import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { pianoKeyGeometry, pianoNoteLabel } from '../piano';
import type { InstrumentArrangementEvent } from '../types';

interface PianoKeyboardProps {
  midis: number[];
  expected?: number[];
  active?: Set<number>;
  notation: 'french' | 'english';
  onHit: (midi: number) => void;
  bare?: boolean;
}

export function PianoKeyboard({ midis, expected = [], active = new Set(), notation, onHit, bare = false }: PianoKeyboardProps) {
  const geometry = useMemo(() => pianoKeyGeometry(midis), [midis]);
  const whiteCount = geometry.filter((key) => !key.black).length;
  const keyboard = <div className="piano-keyboard" style={{ width: `max(100%, ${Math.max(620, whiteCount * 28)}px)` }}>
    {geometry.map((key) => <button
      type="button"
      key={key.midi}
      data-midi={key.midi}
      className={`piano-key ${key.black ? 'black' : 'white'} ${expected.includes(key.midi) ? 'is-expected' : ''} ${active.has(key.midi) ? 'is-active' : ''}`}
      style={{ left: `${key.left}%`, width: `${key.width}%` }}
      aria-label={pianoNoteLabel(key.midi, notation)}
      onPointerDown={() => onHit(key.midi)}
    >{!key.black && <span>{key.midi % 12 === 0 ? pianoNoteLabel(key.midi, notation) : ''}</span>}</button>)}
  </div>;
  return bare ? keyboard : <div className="piano-keyboard-scroll">{keyboard}</div>;
}

interface PianoFallingStageProps extends Omit<PianoKeyboardProps, 'bare'> {
  events: InstrumentArrangementEvent[];
  beat: number;
  lookAhead?: number;
  className?: string;
  overlay?: ReactNode;
}

export function PianoFallingStage({ midis, expected = [], active = new Set(), notation, onHit, events, beat, lookAhead = 8, className = '', overlay }: PianoFallingStageProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const geometry = useMemo(() => pianoKeyGeometry(midis), [midis]);
  const geometryByMidi = useMemo(() => new Map(geometry.map((key) => [key.midi, key])), [geometry]);
  const whiteCount = geometry.filter((key) => !key.black).length;
  const width = Math.max(620, whiteCount * 28);
  const targetMidi = expected[0];

  useEffect(() => {
    if (targetMidi === undefined || !scrollRef.current) return;
    const key = scrollRef.current.querySelector<HTMLElement>(`[data-midi="${targetMidi}"]`);
    if (!key) return;
    const desired = key.offsetLeft + key.offsetWidth / 2 - scrollRef.current.clientWidth / 2;
    scrollRef.current.scrollTo({ left: Math.max(0, desired), behavior: 'smooth' });
  }, [targetMidi]);

  const visibleEvents = events.filter((event) => event.beat + event.duration >= beat - .35 && event.beat <= beat + lookAhead);
  return <div className={`piano-falling-stage ${className}`}>
    <div className="piano-falling-scroll" ref={scrollRef}>
      <div className="piano-falling-visual" style={{ width: `max(100%, ${width}px)` }}>
      <div className="piano-falling-roll" aria-label="Notes de piano à venir">
        <div className="piano-roll-lanes">{geometry.filter((key) => !key.black).map((key) => <i key={key.midi} style={{ left: `${key.left}%`, width: `${key.width}%` }} />)}</div>
        {visibleEvents.flatMap((event) => event.midis.map((midi, midiIndex) => {
          const key = geometryByMidi.get(midi);
          if (!key) return null;
          const top = Math.max(-20, Math.min(112, (1 - (event.beat - beat + event.duration) / lookAhead) * 100));
          const height = Math.max(7, event.duration / lookAhead * 100);
          return <span
            key={`${event.id}-${midi}`}
            className={`piano-falling-note is-${event.hand} ${expected.includes(midi) && event.beat <= beat + .4 ? 'is-current' : ''}`}
            style={{ left: `${key.left}%`, width: `${key.width}%`, top: `${top}%`, height: `${height}%` }}
          ><b>{event.midis.length === 1 || midiIndex === 0 ? pianoNoteLabel(midi, notation) : ''}</b>{event.fingers?.[midiIndex] && <small>{event.fingers[midiIndex]}</small>}</span>;
        }))}
        <div className="piano-hit-line"><span>Joue ici</span></div>
      </div>
      <PianoKeyboard midis={midis} expected={expected} active={active} notation={notation} onHit={onHit} bare />
      </div>
    </div>
    {overlay}
  </div>;
}
