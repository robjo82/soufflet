import { ArrowLeft, ArrowRight, Hand, MoveHorizontal } from 'lucide-react';
import type { AccordionConfig, Direction, Notation, SongEvent } from '../types';
import { displayNote, FRENCH_NOTES } from '../data';
import { useSynth } from '../hooks/useSynth';

interface AccordionViewProps {
  config: AccordionConfig;
  activeEvent?: SongEvent;
  direction?: Direction;
  notation: Notation;
  detectedMidi?: number;
  compact?: boolean;
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
  compact = false,
  onButtonPress,
}: AccordionViewProps) {
  const { playMidi } = useSynth();
  const rows = config.rightRows.map((_, index) => config.buttons.filter((button) => button.row === index + 1));
  const detectedButtonIds = new Set(
    config.buttons
      .filter((button) => button.pushMidi === detectedMidi || button.pullMidi === detectedMidi)
      .map((button) => button.id),
  );
  const expanded = direction === 'pull';

  return (
    <div className={`accordion-wrap ${compact ? 'is-compact' : ''}`} aria-label={`Représentation du ${config.model}`}>
      <div className={`direction-banner direction-${direction}`} role="status">
        <span className="direction-icon">{direction === 'pull' ? <ArrowLeft /> : <ArrowRight />}</span>
        <span>
          <small>{direction === 'pull' ? 'OUVRIR' : 'FERMER'}</small>
          <strong>{direction === 'pull' ? 'Tirer le soufflet' : 'Pousser le soufflet'}</strong>
        </span>
        <MoveHorizontal aria-hidden="true" />
      </div>

      <div className={`accordion direction-${direction}`} style={{ '--instrument': config.color } as React.CSSProperties}>
        <section className="accordion-case bass-case" aria-label="Main gauche, basses et accords">
          <div className="case-shine" />
          <span className="hand-caption"><Hand size={14} /> Main gauche</span>
          <div className="bass-grid">
            {config.basses.map((button) => {
              const active = activeEvent?.bassButtonId === button.id;
              return (
                <button
                  type="button"
                  className={`bass-button ${active ? 'is-active' : ''}`}
                  key={button.id}
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

        <div className={`bellows ${expanded ? 'is-open' : 'is-closed'}`} aria-label={expanded ? 'Soufflet ouvert' : 'Soufflet fermé'}>
          <div className="bellows-edge" />
          {Array.from({ length: 9 }).map((_, index) => <i key={index} />)}
          <div className="bellows-center"><span>{expanded ? 'TIRER' : 'POUSSER'}</span></div>
          <div className="bellows-edge" />
        </div>

        <section className="accordion-case melody-case" aria-label="Main droite, clavier mélodique">
          <div className="case-shine" />
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
                      className={`melody-button ${isActive ? 'is-active' : ''} ${isDetected ? 'is-detected' : ''} ${button.role === 'accidental' ? 'is-helper' : ''}`}
                      aria-label={`Bouton ${button.index}, ${direction === 'push' ? button.push : button.pull}`}
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
