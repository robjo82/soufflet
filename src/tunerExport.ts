import { noteFromMidi } from './data';
import type { AccordionConfig, TunerReading } from './types';

export interface TunerExportReport {
  schemaVersion: 1;
  exportedAt: string;
  instrument: AccordionConfig;
  readings: Array<TunerReading & { expectedNote: string; detectedNote: string }>;
  diagnosticNote: string;
}

export function buildTunerExport(
  accordion: AccordionConfig,
  readings: TunerReading[],
  exportedAt = new Date().toISOString(),
): TunerExportReport {
  return {
    schemaVersion: 1,
    exportedAt,
    instrument: structuredClone(accordion),
    readings: readings.map((reading) => ({
      ...reading,
      expectedNote: noteFromMidi(reading.expectedMidi),
      detectedNote: noteFromMidi(reading.detectedMidi),
    })),
    diagnosticNote: readings.length
      ? 'Les cents permettent d’évaluer l’accordage fin. Un changement de note MIDI indique d’abord une différence de cartographie.'
      : 'Aucun relevé fin n’était archivé pour cette campagne. La cartographie complète de l’instrument reste incluse.',
  };
}

export function tunerExportFilename(accordion: AccordionConfig, date = new Date()) {
  const instrument = `${accordion.maker}-${accordion.model}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `soufflet-accordeur-${instrument}-${date.toISOString().slice(0, 10)}.json`;
}
