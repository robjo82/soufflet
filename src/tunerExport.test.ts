import { describe, expect, it } from 'vitest';
import { FALLBACK_ACCORDIONS } from './data';
import { buildTunerExport, tunerExportFilename } from './tunerExport';
import type { TunerReading } from './types';

describe('tuner export', () => {
  const accordion = FALLBACK_ACCORDIONS[0];
  const reading: TunerReading = {
    id: 'reading-1', sessionId: 'session-1', accordionId: accordion.id, accordionModel: accordion.model,
    buttonId: 'c1-in-3', row: 2, buttonIndex: 3, hand: 'right', direction: 'push', expectedMidi: 65, detectedMidi: 65,
    frequency: 349.8, cents: 3, confidence: .94, volume: .08, outcome: 'matched', measuredAt: '2026-07-19T16:00:00.000Z',
  };

  it('includes the complete instrument mapping and readable notes', () => {
    const report = buildTunerExport(accordion, [reading], null, '2026-07-19T16:01:00.000Z');
    expect(report.instrument.buttons).toHaveLength(21);
    expect(report.instrument.basses).toHaveLength(8);
    expect(report.readings[0]).toMatchObject({ expectedNote: 'F4', detectedNote: 'F4', cents: 3, hand: 'right' });
    expect(report.diagnosticNote).toContain('cents');
  });

  it('exports the synchronized left-hand fingerprint without raw audio', () => {
    const leftHandProfile = {
      accordionId: accordion.id, accordionModel: accordion.model, referencePitchHz: 435,
      completedAt: '2026-08-02T10:00:00.000Z',
      samples: [{
        buttonId: 'c1-chord-a-dm', buttonIndex: 1, row: 1, direction: 'push' as const, role: 'chord' as const,
        expectedLabel: 'La', detectedLabel: 'La', expectedRootPitchClass: 9, detectedRootPitchClass: 9,
        chordQuality: 'major' as const, confidence: .88, chroma: Array(12).fill(1 / 12), outcome: 'matched' as const,
        measuredAt: '2026-08-02T09:59:59.000Z',
      }],
    };
    const report = buildTunerExport(accordion, [], leftHandProfile, '2026-08-02T10:01:00.000Z');
    expect(report).toMatchObject({ schemaVersion: 2, leftHandProfile: { referencePitchHz: 435 } });
    expect(JSON.stringify(report)).not.toContain('audioData');
  });

  it('creates a portable filename without accents or spaces', () => {
    expect(tunerExportFilename(accordion, new Date('2026-07-19T16:00:00.000Z')))
      .toBe('soufflet-accordeur-hohner-club-i-10-9-2-2026-07-19.json');
  });
});
