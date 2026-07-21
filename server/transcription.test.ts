import { describe, expect, it } from 'vitest';
import { calculateTimelineCoverage, midiFromNote, sanitizeTranscription, youtubeResultNeedsRepair } from './transcription.js';

describe('multimodal transcription safeguards', () => {
  it('derives MIDI from scientific note names, including flats', () => {
    expect(midiFromNote('C4')).toBe(60);
    expect(midiFromNote('F♯5')).toBe(78);
    expect(midiFromNote('Bb3')).toBe(58);
    expect(midiFromNote('not-a-note')).toBeUndefined();
  });

  it('repairs contradictory MIDI values instead of silently turning every note into C4', () => {
    const result = sanitizeTranscription({
      title: 'Valse test', artist: 'Test', bpm: 120, key: 'Am', timeSignature: [3, 4], confidence: .8, warnings: [],
      events: [
        { beat: 0, duration: 1, midi: 60, note: 'A4', confidence: .8 },
        { beat: 1, duration: 1, note: 'B4', confidence: .7 },
      ],
    });

    expect(result.events.map((event) => [event.note, event.midi])).toEqual([['A4', 69], ['B4', 71]]);
    expect(result.warnings[0]).toContain('incohérence');
  });

  it('keeps a beat-aligned left-hand transcription and its evidence report', () => {
    const result = sanitizeTranscription({
      title: 'Valse test', artist: 'Test', bpm: 120, key: 'Am', timeSignature: [3, 4], confidence: .84, warnings: [],
      events: [{ beat: 0, duration: 1, note: 'A4', confidence: .9 }],
      accompaniment: [
        { beat: 0, duration: .8, note: 'A2', chord: 'Am', role: 'bass', confidence: .8 },
        { beat: 1, duration: .8, note: 'A3', chord: 'Am', role: 'chord', confidence: .7 },
      ],
      sources: [{ title: 'Édition ABC', url: 'https://example.com/tune.abc', kind: 'abc', usedFor: 'Mélodie et basses', reliability: .9 }],
      coverage: { sourceDurationSeconds: 90, transcribedDurationSeconds: 88, ratio: .98, sectionsFound: 4, sectionsTranscribed: 4 },
    });

    expect(result.accompaniment).toHaveLength(2);
    expect(result.accompaniment?.map((event) => event.role)).toEqual(['bass', 'chord']);
    expect(result.sources?.[0]).toMatchObject({ kind: 'abc', reliability: .9 });
    expect(result.coverage?.ratio).toBe(.98);
  });

  it('requests a repair when coverage or the left hand is incomplete', () => {
    const result = sanitizeTranscription({
      title: 'Fragment', artist: 'Test', bpm: 120, key: 'Am', timeSignature: [3, 4], confidence: .6, warnings: [],
      events: Array.from({ length: 20 }, (_, index) => ({ beat: index, duration: 1, note: 'A4', confidence: .6 })),
      accompaniment: [],
      coverage: { sourceDurationSeconds: 120, transcribedDurationSeconds: 10, ratio: .08, sectionsFound: 5, sectionsTranscribed: 1 },
    });

    expect(youtubeResultNeedsRepair(result)).toBe(true);
  });

  it('measures coverage from the emitted timeline instead of trusting a model percentage', () => {
    const coverage = calculateTimelineCoverage([
      { beat: 0, duration: 1, midi: 69, note: 'A4', confidence: .8 },
      { beat: 89, duration: 1, midi: 69, note: 'A4', confidence: .8 },
    ], 90, 120);

    expect(coverage.transcribedDurationSeconds).toBe(60);
    expect(coverage.ratio).toBe(.5);
  });
});
