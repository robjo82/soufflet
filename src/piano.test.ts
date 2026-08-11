import { describe, expect, it } from 'vitest';
import { eventsForHand, matchesPianoEvent, pianoKeyGeometry, pianoLyricCueAtBeat, pianoNoteLabel, pianoRange, pianoVisibleRange } from './piano';

describe('piano learning helpers', () => {
  it('builds standard keyboard ranges', () => {
    expect(pianoRange(88)).toHaveLength(88);
    expect(pianoRange(88)[0]).toBe(21);
    expect(pianoRange(61)).toEqual(expect.arrayContaining([60]));
  });

  it('labels and filters independent hands', () => {
    const arrangement = {
      instrumentType: 'piano' as const, difficulty: 1, provenance: 'test',
      events: [
        { id: 'r', beat: 0, duration: 1, midis: [60], hand: 'right' as const },
        { id: 'l', beat: 0, duration: 1, midis: [48, 52, 55], hand: 'left' as const },
      ],
    };
    expect(pianoNoteLabel(60, 'french')).toBe('Do4');
    expect(eventsForHand(arrangement, 'right').map((event) => event.id)).toEqual(['r']);
    expect(matchesPianoEvent(arrangement.events[1], 52)).toBe(true);
  });

  it('aligns falling notes with their piano keys', () => {
    const geometry = pianoKeyGeometry([60, 61, 62, 63, 64]);
    expect(geometry.find((key) => key.midi === 60)).toMatchObject({ black: false, left: 0 });
    expect(geometry.find((key) => key.midi === 61)).toMatchObject({ black: true });
    expect(geometry.find((key) => key.midi === 62)?.left).toBeCloseTo(100 / 3);
    expect(geometry.find((key) => key.midi === 61)!.left).toBeGreaterThan(20);
    expect(geometry.find((key) => key.midi === 61)!.left).toBeLessThan(34);
  });

  it('keeps the useful register readable without showing unused octaves', () => {
    const visible = pianoVisibleRange(pianoRange(88), [
      { id: 'c', beat: 0, duration: 1, midis: [60], hand: 'right' },
      { id: 'g', beat: 1, duration: 1, midis: [67], hand: 'right' },
    ]);
    expect(visible).toHaveLength(25);
    expect(visible).toContain(60);
    expect(visible).toContain(67);
  });

  it('synchronizes the lyric line and its highlighted word', () => {
    const cue = pianoLyricCueAtBeat([
      { beat: 0, text: 'Au clair de la lune', section: 'Couplet' },
      { beat: 4, text: 'Mon ami Pierrot', section: 'Couplet' },
    ], 2, 8);
    expect(cue.current?.text).toBe('Au clair de la lune');
    expect(cue.next?.text).toBe('Mon ami Pierrot');
    expect(cue.words[cue.activeWord]).toBe('de');
  });
});
