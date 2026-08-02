import { useEffect, useRef } from 'react';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { displayNote } from '../data';
import { getScoreItemContentLeft, getScoreScrollTarget } from '../scoreScroll';
import { createTwoHandScoreTimeline, melodyIndexAtBeat } from '../scoreTimeline';
import type { AccompanimentEvent, Hand, Notation, Song, SongEvent } from '../types';
import { fingerName, fingerSymbol } from '../fingeringGuide';

interface ScoreStripProps {
  song: Song;
  activeIndex: number;
  activeAccompanimentIndex?: number;
  notation: Notation;
  hand?: Hand;
  completed?: boolean;
  showFingering?: boolean;
  onSelect: (event: SongEvent, index: number) => void;
}

export function ScoreStrip({
  song,
  activeIndex,
  activeAccompanimentIndex = 0,
  notation,
  hand = 'right',
  completed = false,
  showFingering = false,
  onSelect,
}: ScoreStripProps) {
  const stripRef = useRef<HTMLDivElement>(null);
  const eventRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const twoHandActiveRef = useRef<HTMLButtonElement | null>(null);
  const isTwoHandScore = hand === 'both' && Boolean(song.accompaniment?.length);

  useEffect(() => {
    const strip = stripRef.current;
    const active = isTwoHandScore ? twoHandActiveRef.current : eventRefs.current[activeIndex];
    if (!strip || !active) return;
    const stripRect = strip.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const target = getScoreScrollTarget({
      activeLeft: getScoreItemContentLeft({
        activeViewportLeft: activeRect.left,
        currentScrollLeft: strip.scrollLeft,
        stripViewportLeft: stripRect.left,
      }),
      activeWidth: activeRect.width,
      contentWidth: strip.scrollWidth,
      currentScrollLeft: strip.scrollLeft,
      viewportWidth: strip.clientWidth,
    });

    if (Math.abs(target - strip.scrollLeft) < 1) return;
    strip.scrollTo({ left: target, behavior: activeIndex === 0 ? 'auto' : 'smooth' });
  }, [activeAccompanimentIndex, activeIndex, isTwoHandScore]);

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

  if (isTwoHandScore) {
    const accompaniment = song.accompaniment ?? [];
    const timeline = createTwoHandScoreTimeline(song);
    const melodyBeat = song.events[activeIndex]?.beat ?? 0;
    const leftBeat = accompaniment[activeAccompanimentIndex]?.beat ?? melodyBeat;
    const activeBeat = Math.max(melodyBeat, leftBeat);
    const timedStyle = (event: Pick<SongEvent | AccompanimentEvent, 'beat' | 'duration'>) => ({
      '--event-beat': event.beat,
      '--event-duration': Math.max(.18, event.duration),
    } as React.CSSProperties);
    const canvasStyle = {
      '--score-total-beats': timeline.totalBeats,
      '--score-active-beat': activeBeat,
    } as React.CSSProperties;

    return (
      <div className="score-shell is-two-hand">
        <div className="score-labels is-two-hand">
          <span>Mesure</span>
          <span><small>Mélodie</small><strong>Main droite</strong></span>
          <span><small>Accompagnement</small><strong>Main gauche</strong></span>
        </div>
        <div className="score-strip score-two-hand-strip" aria-label="Partition interactive à deux pistes" ref={stripRef}>
          <div className="score-two-hand-canvas" style={canvasStyle}>
            <div className="score-measure-ruler" aria-hidden="true">
              {timeline.measureStarts.map((beat, index) => (
                <span key={beat} style={{ '--measure-beat': beat, '--measure-duration': song.timeSignature[0] } as React.CSSProperties}>{index + 1}</span>
              ))}
            </div>
            <div className="score-beat-grid" aria-hidden="true">
              {Array.from({ length: Math.ceil(timeline.totalBeats) + 1 }, (_, beat) => (
                <i key={beat} className={beat % song.timeSignature[0] === 0 ? 'is-measure' : ''} style={{ '--grid-beat': beat } as React.CSSProperties} />
              ))}
            </div>
            <div className="score-timed-lane is-right-hand">
              {song.events.map((event, index) => {
                const uncertain = (event.confidence ?? 1) < .75;
                return (
                  <button
                    type="button"
                    key={event.id}
                    ref={(element) => { if (index === activeIndex) twoHandActiveRef.current = element; }}
                    className={`score-timed-event is-right-hand ${!completed && index === activeIndex ? 'is-active' : ''} ${completed || event.beat < activeBeat ? 'is-past' : ''}`}
                    style={timedStyle(event)}
                    onClick={() => onSelect(event, index)}
                    aria-label={`Main droite, ${displayNote(event.note, notation, event.buttonId, event.direction)}, temps ${event.beat + 1}`}
                  >
                    <span className={`mini-direction direction-${event.direction}`}>{event.direction === 'pull' ? '← T' : 'P →'}</span>
                    <strong>{displayNote(event.note, notation, event.buttonId, event.direction)}</strong>
                    <small>{rhythmSymbol(event.duration)}</small>
                    {showFingering && <span className="score-finger" title={fingerName(event.finger)}>{fingerSymbol(event.finger)}</span>}
                    {uncertain && <AlertTriangle className="confidence-warning" size={13} />}
                  </button>
                );
              })}
            </div>
            <div className="score-timed-lane is-left-hand">
              {accompaniment.map((event, index) => {
                const melodyIndex = melodyIndexAtBeat(song.events, event.beat);
                const label = event.role === 'chord' ? event.chord : displayNote(event.note, notation, event.buttonId, event.direction);
                const uncertain = (event.confidence ?? 1) < .75;
                return (
                  <button
                    type="button"
                    key={event.id}
                    ref={(element) => { if (index === activeAccompanimentIndex) twoHandActiveRef.current = element; }}
                    className={`score-timed-event is-left-hand ${!completed && index === activeAccompanimentIndex ? 'is-active' : ''} ${completed || event.beat < activeBeat ? 'is-past' : ''}`}
                    style={timedStyle(event)}
                    onClick={() => onSelect(song.events[melodyIndex], melodyIndex)}
                    aria-label={`Main gauche, ${event.role === 'bass' ? 'basse' : 'accord'} ${label}, temps ${event.beat + 1}`}
                  >
                    <span className={`mini-direction direction-${event.direction}`}>{event.direction === 'pull' ? '← T' : 'P →'}</span>
                    <strong>{label}</strong>
                    <small>{event.role === 'bass' ? 'Basse' : 'Accord'} · {rhythmSymbol(event.duration)}</small>
                    {uncertain && <AlertTriangle className="confidence-warning" size={13} />}
                  </button>
                );
              })}
            </div>
            {!completed && <i className="score-two-hand-playhead" aria-hidden="true" />}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="score-shell">
      <div className="score-labels">
        <span>Mesure</span>
        <span>Soufflet</span>
        <span>{hand === 'left' ? 'Basses' : showFingering ? 'Notes · doigt' : 'Notes'}</span>
      </div>
      <div className="score-strip" aria-label="Partition interactive" ref={stripRef}>
        {song.events.map((event, index) => {
          const measure = Math.floor(event.beat / song.timeSignature[0]) + 1;
          const newMeasure = index === 0 || Math.floor(song.events[index - 1].beat / song.timeSignature[0]) !== measure - 1;
          const uncertain = (event.confidence ?? 1) < 0.75;
          return (
            <button
              type="button"
              ref={(element) => { eventRefs.current[index] = element; }}
              className={`score-event ${!completed && index === activeIndex ? 'is-active' : ''} ${completed || index < activeIndex ? 'is-past' : ''}`}
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
              {showFingering && (
                <span className="score-finger" title={fingerName(event.finger)} aria-label={`Doigt conseillé : ${fingerName(event.finger)}`}>
                  {fingerSymbol(event.finger)}
                </span>
              )}
              {uncertain && <AlertTriangle className="confidence-warning" size={13} />}
              {!completed && index === activeIndex && <ChevronRight className="playhead-mark" size={16} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
