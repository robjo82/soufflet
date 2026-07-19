import { describe, expect, it } from 'vitest';
import { FALLBACK_ACCORDIONS } from './data';
import { buildTunerExport, tunerExportFilename } from './tunerExport';
import type { TunerReading } from './types';

describe('tuner export', () => {
  const accordion = FALLBACK_ACCORDIONS[0];
  const reading: TunerReading = {
    id: 'reading-1', sessionId: 'session-1', accordionId: accordion.id, accordionModel: accordion.model,
    buttonId: 'c1-in-3', row: 2, buttonIndex: 3, direction: 'push', expectedMidi: 65, detectedMidi: 65,
    frequency: 349.8, cents: 3, confidence: .94, volume: .08, outcome: 'matched', measuredAt: '2026-07-19T16:00:00.000Z',
  };

  it('includes the complete instrument mapping and readable notes', () => {
    const report = buildTunerExport(accordion, [reading], '2026-07-19T16:01:00.000Z');
    expect(report.instrument.buttons).toHaveLength(21);
    expect(report.readings[0]).toMatchObject({ expectedNote: 'F4', detectedNote: 'F4', cents: 3 });
    expect(report.diagnosticNote).toContain('cents');
  });

  it('creates a portable filename without accents or spaces', () => {
    expect(tunerExportFilename(accordion, new Date('2026-07-19T16:00:00.000Z')))
      .toBe('soufflet-accordeur-hohner-club-i-10-9-2-2026-07-19.json');
  });
});
