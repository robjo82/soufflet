import { describe, expect, it } from 'vitest';
import { FALLBACK_ACCORDIONS } from './data';
import { getAccordionInstrumentState, resolveAccordionButtonDirection } from './components/accordionInstrumentState';
import type { SongEvent } from './types';

const accordion = FALLBACK_ACCORDIONS.find((item) => item.maker === 'Hohner' && item.model.includes('Club I'))!;

describe('accordion instrument 3D state', () => {
  it('keeps pedagogical highlighting separate from physical depression', () => {
    const event: SongEvent = {
      id: 'event-1',
      beat: 0,
      duration: 1,
      midi: accordion.buttons[2].pushMidi,
      note: accordion.buttons[2].push,
      buttonId: accordion.buttons[2].id,
      bassButtonId: accordion.basses[0].id,
      direction: 'push',
      finger: 2,
    };

    expect(getAccordionInstrumentState(accordion, { activeEvent: event, depressActive: false })).toEqual({
      highlightedButtonIds: [event.buttonId, event.bassButtonId],
      pressedButtonIds: [],
      detectedButtonIds: [],
      selectedButtonIds: [],
    });
    expect(getAccordionInstrumentState(accordion, { activeEvent: event, depressActive: true }).pressedButtonIds)
      .toEqual([event.buttonId, event.bassButtonId]);
  });

  it('maps microphone and tuner feedback onto every matching melody button', () => {
    const detectedMidi = accordion.buttons[4].pullMidi;
    const selectedButtonId = accordion.buttons[4].id;
    const state = getAccordionInstrumentState(accordion, { detectedMidi, selectedButtonId });

    expect(state.detectedButtonIds).toContain(selectedButtonId);
    expect(state.selectedButtonIds).toEqual([selectedButtonId]);
  });

  it('uses the detected push or pull direction when a mapped button is pressed', () => {
    const button = accordion.buttons.find((candidate) => candidate.pushMidi !== candidate.pullMidi)!;

    expect(resolveAccordionButtonDirection(button, 'pull', button.pushMidi)).toBe('push');
    expect(resolveAccordionButtonDirection(button, 'push', button.pullMidi)).toBe('pull');
    expect(resolveAccordionButtonDirection(button, 'pull')).toBe('pull');
  });
});
