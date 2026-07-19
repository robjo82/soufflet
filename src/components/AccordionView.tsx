import { ArrowLeft, ArrowRight, Hand, MoveHorizontal } from 'lucide-react';
import type { AccordionConfig, Direction, Notation, SongEvent } from '../types';
import { displayNote, FRENCH_NOTES } from '../data';
import { useSynth } from '../hooks/useSynth';
import { getAccordionVisualVariant, getMelodyButtonSize } from './accordionLayout';

interface AccordionViewProps {
  config: AccordionConfig;
  activeEvent?: SongEvent;
  direction?: Direction;
  notation: Notation;
  detectedMidi?: number;
  selectedButtonId?: string;
  compact?: boolean;
  depressActive?: boolean;
  bellowsAmount?: number;
  airValveActive?: boolean;
  onButtonPress?: (buttonId: string, direction: Direction) => void;
}

function labelForButton(push: string, notation: Notation, id: string) {
  if (notation === 'button' || notation === 'tablature') return id.match(/(\d+)$/)?.[1] ?? '•';
  const source = push.replace(/\d$/, '');
  const target = notation === 'french' ? FRENCH_NOTES[source] ?? source : source;
  return target.length > 3 ? target.slice(0, 3) : target;
}

export function AccordionView({
  config,
  activeEvent,
  direction = 'push',
  notation,
  detectedMidi,
  selectedButtonId,
  compact = false,
  depressActive = false,
  bellowsAmount,
  airValveActive = false,
  onButtonPress,
}: AccordionViewProps) {
  const { playMidi } = useSynth();
  const rows = config.rightRows.map((_, index) => config.buttons.filter((button) => button.row === index + 1));
  const longestRow = Math.max(1, ...rows.map((row) => row.length));
  const melodyButtonSize = getMelodyButtonSize(longestRow);
  const detectedButtonIds = new Set(
    config.buttons
      .filter((button) => button.pushMidi === detectedMidi || button.pullMidi === detectedMidi)
      .map((button) => button.id),
  );
  const amount = Math.max(0, Math.min(1, bellowsAmount ?? (direction === 'pull' ? .58 : .34)));
  const expanded = amount >= .5;
  const bellowsPercent = Math.round(amount * 100);
  const visualVariant = getAccordionVisualVariant(config);
  const isClubI = visualVariant === 'club-i';

  return (
    <div className={`accordion-wrap ${compact ? 'is-compact' : ''}`} aria-label={`Représentation du ${config.model}`}>
      <div className={`direction-banner direction-${direction} ${airValveActive ? 'is-air-valve' : ''}`} role="status">
        <span className="direction-icon">{airValveActive ? <MoveHorizontal /> : direction === 'pull' ? <ArrowLeft /> : <ArrowRight />}</span>
        <span>
          <small>{airValveActive ? 'SOUPAPE · SANS NOTE' : direction === 'pull' ? 'OUVRIR' : 'FERMER'}</small>
          <strong>{airValveActive ? 'Recentrer avec la soupape' : direction === 'pull' ? 'Tirer le soufflet' : 'Pousser le soufflet'}</strong>
        </span>
        <MoveHorizontal aria-hidden="true" />
      </div>

      <div
        className={`accordion direction-${direction} visual-${visualVariant}`}
        style={{
          '--instrument': config.color,
          '--melody-button-size': `${melodyButtonSize}px`,
          '--bellows-width': `clamp(120px, ${120 + amount * 200}px, 25vw)`,
        } as React.CSSProperties}
        data-longest-row={longestRow}
      >
        <section className="accordion-case bass-case" aria-label="Main gauche, basses et accords">
          <div className="case-depth" aria-hidden="true" />
          <div className="case-shine" />
          <div className="case-hardware" aria-hidden="true"><i /><i /><i /><i /></div>
          {isClubI ? <div className="club-brand" aria-hidden="true"><strong>HOHNER</strong><small>CLUB<br />MODELL I</small></div> : <div className="instrument-nameplate" aria-hidden="true"><strong>{config.maker}</strong><small>{config.model.split('—')[0]}</small></div>}
          <span className="hand-caption"><Hand size={14} /> Main gauche</span>
          <div className="bass-grid">
            {config.basses.map((button) => {
              const active = activeEvent?.bassButtonId === button.id;
              return (
                <button
                  type="button"
                  className={`bass-button ${active ? 'is-active' : ''} ${active && depressActive ? 'is-pressed' : ''}`}
                  key={button.id}
                  aria-pressed={active && depressActive}
                  aria-label={`${button.role === 'bass' ? 'Basse' : 'Accord'} ${button.index}`}
                  onPointerDown={() => {
                    playMidi(direction === 'push' ? button.pushMidi : button.pullMidi, .5, .09);
                    onButtonPress?.(button.id, direction);
                  }}
                >
                  {active ? activeEvent?.bassLabel ?? '●' : button.role === 'bass' ? 'B' : 'a'}
                </button>
              );
            })}
          </div>
        </section>

        <div className={`bellows ${expanded ? 'is-open' : 'is-closed'} ${airValveActive ? 'is-air-valve' : ''}`} aria-label={`Soufflet ouvert à ${bellowsPercent} %`}>
          <div className="bellows-edge" />
          {Array.from({ length: 15 }).map((_, index) => <i key={index} />)}
          <div className="bellows-center"><span>{airValveActive ? 'SOUPAPE' : `${bellowsPercent} %`}</span></div>
          <div className="bellows-edge" />
        </div>

        <section className="accordion-case melody-case" aria-label="Main droite, clavier mélodique">
          <div className="case-depth" aria-hidden="true" />
          <div className="case-shine" />
          <div className="case-hardware" aria-hidden="true"><i /><i /><i /><i /></div>
          {isClubI ? <div className="club-ornament" aria-hidden="true"><i>✣</i><span>II</span><i>✣</i></div> : <div className="instrument-nameplate is-right" aria-hidden="true"><strong>{config.maker}</strong><small>{config.tuning}</small></div>}
          <span className="hand-caption"><Hand size={14} /> Main droite</span>
          <div className={`melody-rows rows-${rows.length}`}>
            {rows.map((row, rowIndex) => (
              <div className="melody-row" key={rowIndex}>
                {row.map((button) => {
                  const isActive = activeEvent?.buttonId === button.id;
                  const isDetected = detectedButtonIds.has(button.id);
                  const currentMidi = direction === 'push' ? button.pushMidi : button.pullMidi;
                  const detectedDirection = detectedMidi === button.pushMidi ? 'push' : 'pull';
                  const label = isActive && activeEvent
                    ? displayNote(activeEvent.note, notation, button.id, activeEvent.direction)
                    : labelForButton(button.push, notation, button.id);
                  return (
                    <button
                      type="button"
                      key={button.id}
                      onPointerDown={() => {
                        const pressedDirection = isDetected ? detectedDirection : direction;
                        playMidi(pressedDirection === 'push' ? button.pushMidi : button.pullMidi, .5);
                        onButtonPress?.(button.id, pressedDirection);
                      }}
                      className={`melody-button ${isActive ? 'is-active' : ''} ${isActive && depressActive ? 'is-pressed' : ''} ${isDetected ? 'is-detected' : ''} ${selectedButtonId === button.id ? 'is-selected' : ''} ${button.role === 'accidental' ? 'is-helper' : ''}`}
                      aria-label={`Bouton ${button.index}, ${direction === 'push' ? button.push : button.pull}`}
                      aria-pressed={isActive && depressActive}
                      title={`Pousser : ${button.push} · Tirer : ${button.pull}${button.isGleichton ? ' · Gleichton' : ''}`}
                      data-midi={currentMidi}
                    >
                      <span>{label}</span>
                      {isActive && activeEvent?.finger && <b className="finger-badge">{activeEvent.finger}</b>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
