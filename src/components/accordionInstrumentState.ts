import type { AccordionButton, AccordionConfig, Direction, SongEvent } from '../types';

interface AccordionInstrumentStateInput {
  activeEvent?: SongEvent;
  detectedMidi?: number;
  selectedButtonId?: string;
  depressActive?: boolean;
}

export function getAccordionInstrumentState(config: AccordionConfig, input: AccordionInstrumentStateInput) {
  const highlightedButtonIds = [input.activeEvent?.buttonId, input.activeEvent?.bassButtonId].filter(
    (id): id is string => Boolean(id),
  );
  const detectedButtonIds = input.detectedMidi === undefined
    ? []
    : config.buttons
      .filter((button) => button.pushMidi === input.detectedMidi || button.pullMidi === input.detectedMidi)
      .map((button) => button.id);

  return {
    highlightedButtonIds,
    pressedButtonIds: input.depressActive ? highlightedButtonIds : [],
    detectedButtonIds,
    selectedButtonIds: input.selectedButtonId ? [input.selectedButtonId] : [],
  };
}

export function resolveAccordionButtonDirection(
  button: AccordionButton,
  direction: Direction,
  detectedMidi?: number,
): Direction {
  if (detectedMidi === button.pushMidi) return 'push';
  if (detectedMidi === button.pullMidi) return 'pull';
  return direction;
}
