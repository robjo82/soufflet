import { AlertTriangle, ChevronRight } from 'lucide-react';
import { displayNote } from '../data';
import type { Notation, Song, SongEvent } from '../types';

interface ScoreStripProps {
  song: Song;
  activeIndex: number;
  notation: Notation;
  onSelect: (event: SongEvent, index: number) => void;
}

export function ScoreStrip({ song, activeIndex, notation, onSelect }: ScoreStripProps) {
  const rhythmSymbol = (duration: number) => {
    const quarterNotes = duration * 4 / song.timeSignature[1];
    if (quarterNotes <= .25) return '♬';
    if (quarterNotes <= .5) return '♪';
    if (quarterNotes <= .75) return '♪·';
    if (quarterNotes <= 1) return '♩';
    if (quarterNotes <= 1.5) return '♩·';
    if (quarterNotes <= 2) return '𝅗𝅥';
    if (quarterNotes <= 3) return '𝅗𝅥·';
    return '𝅝';
  };
  return (
    <div className="score-shell">
      <div className="score-labels">
        <span>Mesure</span>
        <span>Soufflet</span>
        <span>Notes</span>
      </div>
      <div className="score-strip" aria-label="Partition interactive">
        {song.events.map((event, index) => {
          const measure = Math.floor(event.beat / song.timeSignature[0]) + 1;
          const newMeasure = index === 0 || Math.floor(song.events[index - 1].beat / song.timeSignature[0]) !== measure - 1;
          const uncertain = (event.confidence ?? 1) < 0.75;
          return (
            <button
              type="button"
              className={`score-event ${index === activeIndex ? 'is-active' : ''} ${index < activeIndex ? 'is-past' : ''}`}
              style={{ '--duration': Math.max(.65, event.duration) } as React.CSSProperties}
              key={event.id}
              onClick={() => onSelect(event, index)}
              aria-label={`${displayNote(event.note, notation, event.buttonId, event.direction)}, mesure ${measure}`}
            >
              {newMeasure && <span className="measure-number">{measure}</span>}
              <span className={`mini-direction direction-${event.direction}`}>
                {event.direction === 'pull' ? '← T' : 'P →'}
              </span>
              <strong>{displayNote(event.note, notation, event.buttonId, event.direction)}</strong>
              <small>{rhythmSymbol(event.duration)}</small>
              {uncertain && <AlertTriangle className="confidence-warning" size={13} />}
              {index === activeIndex && <ChevronRight className="playhead-mark" size={16} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
